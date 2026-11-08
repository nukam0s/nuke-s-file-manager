// Remote filesystem subsystem: FTP, FTPS/FTPES, SFTP and WebDAV behind a single connector
// interface, plus a local credential vault. Pure-JS dependencies only so esbuild can bundle
// the whole service into the Node SEA single executable (no native binaries).
//
// Virtual path contract (shared with the frontend IPC layer):
//   remote::<connId>::<remotePath>
//   - connId     : stable connection id from the vault
//   - remotePath : absolute remote path, `/`-separated, always starts with `/`
//   - root       : remote::<connId>::/
//
// The connection `rootPath` (default `/`) is the remote directory exposed as the virtual root
// `/`. Paths are translated between the virtual space and the server space on every operation.
import { promises as fs, createReadStream, createWriteStream } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import crypto from 'node:crypto'
import { PassThrough } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { Client } from 'basic-ftp'
import SftpClient from 'ssh2-sftp-client'
import { createClient } from 'webdav'

const MAX_TEXT_BYTES = 2 * 1024 * 1024

const PROTOCOLS = ['ftp', 'ftps', 'sftp', 'webdav']

function makeError(code, message) {
  const error = new Error(message)
  error.code = code
  return error
}

function emptyOp(prefix, success) {
  return {
    opId: `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    success,
    skipped: 0,
    failed: 0,
    errors: [],
    cancelled: false,
  }
}

// ---------------------------------------------------------------------------
// Virtual path helpers
// ---------------------------------------------------------------------------

export function isRemotePath(p) {
  return typeof p === 'string' && p.startsWith('remote::')
}

// "Network root" virtual path: `remote::` (no connId) lists the saved connections as folders.
export function isRemoteRoot(p) {
  return p === 'remote::'
}

export function parseRemotePath(p) {
  if (!isRemotePath(p)) throw makeError('invalid_path', `not a remote path: ${p}`)
  const rest = p.slice('remote::'.length)
  const sep = rest.indexOf('::')
  if (sep <= 0) throw makeError('invalid_path', `malformed remote path: ${p}`)
  const connId = rest.slice(0, sep)
  const remotePath = normalizeRemote(rest.slice(sep + 2))
  return { connId, remotePath }
}

export function toRemotePath(connId, remotePath) {
  return `remote::${connId}::${normalizeRemote(remotePath)}`
}

// Parent path used as `ListingResult.parent`: one level up inside the remote tree.
export function remoteParent(p) {
  const { connId, remotePath } = parseRemotePath(p)
  if (remotePath === '/') return null
  return toRemotePath(connId, dirnameRemote(remotePath))
}

function normalizeRemote(p) {
  if (typeof p !== 'string' || p === '') return '/'
  let r = p.replace(/\\/g, '/')
  if (!r.startsWith('/')) r = `/${r}`
  r = r.replace(/\/+/g, '/')
  if (r !== '/') r = r.replace(/\/+$/, '')
  return r
}

function joinRemote(a, b) {
  const left = a === '/' ? '' : normalizeRemote(a).replace(/\/+$/, '')
  const right = String(b || '').replace(/^\/+/, '')
  if (!right) return left || '/'
  return `${left}/${right}`
}

function dirnameRemote(p) {
  const n = normalizeRemote(p)
  if (n === '/') return '/'
  const idx = n.lastIndexOf('/')
  return idx <= 0 ? '/' : n.slice(0, idx)
}

function basenameRemote(p) {
  const n = normalizeRemote(p)
  if (n === '/') return ''
  return n.slice(n.lastIndexOf('/') + 1)
}

function extRemote(name) {
  const base = String(name || '').split('/').pop() || ''
  const dot = base.lastIndexOf('.')
  if (dot <= 0) return null
  return base.slice(dot + 1).toLowerCase()
}

function sortEntries(entries, sort) {
  const field = sort && sort.field ? sort.field : 'name'
  const dir = sort && sort.dir ? sort.dir : 'asc'
  entries.sort((a, b) => {
    const dirCmp = Number(b.isDir) - Number(a.isDir)
    if (dirCmp !== 0) return dirCmp
    let order = 0
    if (field === 'name') order = a.name.toLowerCase().localeCompare(b.name.toLowerCase())
    else if (field === 'size') order = a.size - b.size
    else if (field === 'extension') order = (a.extension || '').localeCompare(b.extension || '')
    else if (field === 'modified') order = (a.modified || '').localeCompare(b.modified || '')
    return dir === 'asc' ? order : -order
  })
}

// ---------------------------------------------------------------------------
// Credential vault (best-effort obfuscation)
//
// Passwords are encrypted at rest with AES-256-GCM using a key stored in
// `vault.key`. This is NOT a substitute for the OS credential manager / DPAPI /
// Keychain: an attacker who can read both `vault.json` and `vault.key` can
// decrypt the passwords. It only prevents accidental plaintext exposure.
// ---------------------------------------------------------------------------

function vaultDir() {
  return process.env.FM_VAULT_DIR || path.join(process.env.APPDATA || os.homedir(), 'NukeFileManager')
}

function vaultPath() {
  return path.join(vaultDir(), 'vault.json')
}

function keyPath() {
  return path.join(vaultDir(), 'vault.key')
}

let keyPromise = null

function getKey() {
  if (!keyPromise) keyPromise = loadOrCreateKey()
  return keyPromise
}

async function loadOrCreateKey() {
  const file = keyPath()
  try {
    const hex = (await fs.readFile(file, 'utf8')).trim()
    if (/^[0-9a-f]{64}$/i.test(hex)) return Buffer.from(hex, 'hex')
  } catch {
    // No key yet; create one below.
  }
  const key = crypto.randomBytes(32)
  await fs.mkdir(vaultDir(), { recursive: true })
  await fs.writeFile(file, key.toString('hex'), { mode: 0o600 })
  try {
    await fs.chmod(file, 0o600)
  } catch {
    // chmod is best-effort (ignored on some platforms).
  }
  return key
}

async function encryptPassword(plain) {
  const key = await getKey()
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const ciphertext = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString('base64')}.${tag.toString('base64')}.${ciphertext.toString('base64')}`
}

async function decryptPassword(payload) {
  const key = await getKey()
  const parts = String(payload).split('.')
  if (parts.length !== 3) throw makeError('vault_error', 'malformed encrypted password')
  const [ivB64, tagB64, ctB64] = parts
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64'))
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'))
  return Buffer.concat([
    decipher.update(Buffer.from(ctB64, 'base64')),
    decipher.final(),
  ]).toString('utf8')
}

async function readVault() {
  try {
    const raw = await fs.readFile(vaultPath(), 'utf8')
    const data = JSON.parse(raw)
    return Array.isArray(data.connections) ? data : { connections: [] }
  } catch {
    return { connections: [] }
  }
}

async function writeVault(data) {
  await fs.mkdir(vaultDir(), { recursive: true })
  await fs.writeFile(vaultPath(), JSON.stringify(data, null, 2), { mode: 0o600 })
}

function sanitizeConnection(record) {
  const { passwordEncrypted, ...safe } = record
  return safe
}

function normalizePort(port, protocol) {
  if (port && Number.isInteger(port) && port > 0 && port < 65536) return port
  if (protocol === 'sftp') return 22
  if (protocol === 'webdav') return 443
  return 21
}

function validateConnection(conn) {
  if (!conn || typeof conn !== 'object') throw makeError('invalid_connection', 'connection required')
  if (!PROTOCOLS.includes(conn.protocol)) {
    throw makeError('invalid_connection', `unsupported protocol: ${conn.protocol}`)
  }
  if (!String(conn.host || '').trim()) throw makeError('invalid_connection', 'host required')
}

export async function listConnections() {
  const vault = await readVault()
  return vault.connections.map(sanitizeConnection)
}

export async function saveConnection(conn, password) {
  validateConnection(conn)
  const vault = await readVault()
  const now = new Date().toISOString()
  const id = conn.id || crypto.randomUUID()
  const existing = vault.connections.find((candidate) => candidate.id === id) || null

  let passwordEncrypted = existing ? existing.passwordEncrypted : null
  if (typeof password === 'string' && password.length > 0) {
    passwordEncrypted = await encryptPassword(password)
  }

  const record = {
    id,
    name: String(conn.name || '').trim() || id,
    protocol: conn.protocol,
    host: String(conn.host || '').trim(),
    port: normalizePort(conn.port, conn.protocol),
    username: String(conn.username || ''),
    secure: Boolean(conn.secure),
    ftpsImplicit: Boolean(conn.ftpsImplicit),
    rootPath: normalizeRemote(conn.rootPath || '/'),
    createdAt: conn.createdAt || (existing ? existing.createdAt : now),
    passwordEncrypted,
  }

  const index = vault.connections.findIndex((candidate) => candidate.id === id)
  if (index >= 0) vault.connections[index] = record
  else vault.connections.push(record)
  await writeVault(vault)
  return sanitizeConnection(record)
}

export async function deleteConnection(id) {
  const vault = await readVault()
  const index = vault.connections.findIndex((candidate) => candidate.id === id)
  if (index >= 0) vault.connections.splice(index, 1)
  await writeVault(vault)
  await disconnectConnection(id)
  return { ok: true }
}

// Internal helper: decrypted password for a stored connection (never exposed over HTTP).
export async function getPassword(id) {
  const record = await findRecord(id)
  if (!record || !record.passwordEncrypted) return null
  try {
    return await decryptPassword(record.passwordEncrypted)
  } catch {
    return null
  }
}

async function findRecord(id) {
  const vault = await readVault()
  return vault.connections.find((candidate) => candidate.id === id) || null
}

// ---------------------------------------------------------------------------
// Session map: live connectors keyed by connection id.
// ---------------------------------------------------------------------------

const sessions = new Map()

export async function testConnection(conn, password) {
  try {
    validateConnection(conn)
    const connector = createConnector(sanitizeConnection(normalizeInput(conn)), password || '')
    await connector.connect()
    await connector.disconnect()
    return { ok: true }
  } catch (error) {
    return { ok: false, error: error.message || String(error) }
  }
}

function normalizeInput(conn) {
  return {
    ...conn,
    port: normalizePort(conn.port, conn.protocol),
    secure: Boolean(conn.secure),
    ftpsImplicit: Boolean(conn.ftpsImplicit),
    rootPath: normalizeRemote(conn.rootPath || '/'),
    username: String(conn.username || ''),
  }
}

export async function connectConnection(id) {
  const record = await findRecord(id)
  if (!record) throw makeError('not_found', `connection not found: ${id}`)
  const password = record.passwordEncrypted ? await decryptPassword(record.passwordEncrypted) : ''
  const connector = createConnector(sanitizeConnection(record), password)
  await connector.connect()
  sessions.set(id, connector)
  return { ok: true }
}

export async function disconnectConnection(id) {
  const connector = sessions.get(id)
  if (connector) {
    try {
      await connector.disconnect()
    } catch {
      // Ignore close errors; the session is dropped regardless.
    }
    sessions.delete(id)
  }
  return { ok: true }
}

async function getConnector(id) {
  const existing = sessions.get(id)
  if (existing) return existing
  await connectConnection(id)
  return sessions.get(id)
}

// ---------------------------------------------------------------------------
// Virtual <-> server path translation (rootPath aware)
// ---------------------------------------------------------------------------

function serverRoot(conn) {
  return normalizeRemote(conn.rootPath || '/')
}

function virtualToServer(conn, virtual) {
  const v = normalizeRemote(virtual)
  const root = serverRoot(conn)
  if (root === '/') return v
  if (v === '/') return root
  return joinRemote(root, v.slice(1))
}

function serverToVirtual(conn, serverPath) {
  const s = normalizeRemote(serverPath)
  const root = serverRoot(conn)
  if (root === '/') return s
  if (s === root) return '/'
  if (s.startsWith(`${root}/`)) return `/${s.slice(root.length + 1)}`
  return s
}

function makeEntry(connId, virtualRemotePath, meta) {
  const v = normalizeRemote(virtualRemotePath)
  const name = basenameRemote(v)
  const isDir = Boolean(meta.isDir)
  return {
    name,
    path: toRemotePath(connId, v),
    isDir,
    isSymlink: false,
    size: isDir ? 0 : Number(meta.size || 0),
    modified: meta.modified || null,
    extension: isDir ? null : extRemote(name),
    attributes: isDir ? 'D' : 'A',
  }
}

function toIso(value) {
  if (value == null || value === '') return null
  if (typeof value === 'number') {
    const ms = value < 1e12 ? value * 1000 : value
    const date = new Date(ms)
    return Number.isNaN(date.getTime()) ? null : date.toISOString()
  }
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

// ---------------------------------------------------------------------------
// High-level remote operations (called by main.js routes)
// ---------------------------------------------------------------------------

// Synthetic folder entry describing the `remote::` network root (used by get_metadata).
export function remoteRootEntry() {
  return {
    name: 'Rede',
    path: 'remote::',
    isDir: true,
    isSymlink: false,
    size: 0,
    modified: null,
    extension: null,
    attributes: 'D',
  }
}

export async function remoteListDir(virtualPath, showHidden = false, sort = { field: 'name', dir: 'asc' }) {
  // Network root: each saved connection appears as a folder rooted at `remote::<id>::/`.
  if (isRemoteRoot(virtualPath)) {
    const connections = await listConnections()
    const entries = connections.map((conn) => ({
      name: conn.name || conn.id,
      path: toRemotePath(conn.id, '/'),
      isDir: true,
      isSymlink: false,
      size: 0,
      modified: conn.createdAt || null,
      extension: conn.protocol,
      attributes: 'D',
    }))
    sortEntries(entries, sort)
    return { parent: null, entries }
  }

  const { connId, remotePath } = parseRemotePath(virtualPath)
  const record = await requireRecord(connId)
  const connector = await getConnector(connId)
  const serverPath = virtualToServer(record, remotePath)
  const items = await connector.list(serverPath)

  const entries = []
  for (const item of items) {
    if (!showHidden && item.name.startsWith('.')) continue
    const childServer = joinRemote(serverPath, item.name)
    entries.push(makeEntry(connId, serverToVirtual(record, childServer), item))
  }
  sortEntries(entries, sort)
  return { parent: remoteParent(virtualPath), entries }
}

export async function remoteGetMetadata(virtualPath) {
  const { connId, remotePath } = parseRemotePath(virtualPath)
  const record = await requireRecord(connId)
  const connector = await getConnector(connId)
  const serverPath = virtualToServer(record, remotePath)
  const meta = await connector.stat(serverPath)
  return makeEntry(connId, serverToVirtual(record, serverPath), meta)
}

export async function remoteReadFile(virtualPath) {
  const { connId, remotePath } = parseRemotePath(virtualPath)
  const record = await requireRecord(connId)
  const connector = await getConnector(connId)
  const buffer = await connector.read(virtualToServer(record, remotePath))
  const sample = buffer.subarray(0, Math.min(4096, buffer.length))
  const binary = sample.includes(0)
  const readSize = Math.min(buffer.length, MAX_TEXT_BYTES)
  return {
    path: toRemotePath(connId, remotePath),
    content: binary ? '' : buffer.subarray(0, readSize).toString('utf8'),
    truncated: buffer.length > MAX_TEXT_BYTES,
    binary,
    size: buffer.length,
  }
}

export async function remoteRaw(virtualPath) {
  const { connId, remotePath } = parseRemotePath(virtualPath)
  const record = await requireRecord(connId)
  const connector = await getConnector(connId)
  return connector.read(virtualToServer(record, remotePath))
}

export async function remoteMkdir(virtualPath) {
  const { connId, remotePath } = parseRemotePath(virtualPath)
  const record = await requireRecord(connId)
  const connector = await getConnector(connId)
  await connector.mkdir(virtualToServer(record, remotePath))
  return remoteGetMetadata(virtualPath)
}

export async function remoteDeleteFiles(paths) {
  const result = emptyOp('delete', 0)
  for (const input of paths || []) {
    try {
      const { connId, remotePath } = parseRemotePath(input)
      const record = await requireRecord(connId)
      const connector = await getConnector(connId)
      await connector.delete(virtualToServer(record, remotePath))
      result.success += 1
    } catch (error) {
      result.failed += 1
      result.errors.push({ path: input, message: error.message })
    }
  }
  return result
}

export async function remoteRename(virtualPath, newName) {
  if (!newName || typeof newName !== 'string' || /[\\/]/.test(newName) || newName.includes('\0')) {
    throw makeError('invalid_path', 'invalid new name')
  }
  const { connId, remotePath } = parseRemotePath(virtualPath)
  const record = await requireRecord(connId)
  const connector = await getConnector(connId)
  await connector.rename(virtualToServer(record, remotePath), newName)
  const newVirtual = toRemotePath(connId, joinRemote(dirnameRemote(remotePath), newName))
  return remoteGetMetadata(newVirtual)
}

export async function remoteDownload(virtualPath, destination) {
  if (!destination || typeof destination !== 'string') {
    throw makeError('invalid_path', 'destination required')
  }
  const { connId, remotePath } = parseRemotePath(virtualPath)
  const record = await requireRecord(connId)
  const connector = await getConnector(connId)
  await connector.download(virtualToServer(record, remotePath), destination)
  const stat = await fs.stat(destination).catch(() => null)
  return { destination, size: stat ? stat.size : 0 }
}

export async function remoteUpload(localPath, destination) {
  if (!localPath || typeof localPath !== 'string') {
    throw makeError('invalid_path', 'localPath required')
  }
  const { connId, remotePath } = parseRemotePath(destination)
  const record = await requireRecord(connId)
  const connector = await getConnector(connId)
  const serverDir = virtualToServer(record, remotePath)
  const targetServer = joinRemote(serverDir, path.basename(localPath))
  await connector.upload(localPath, targetServer)
  return remoteGetMetadata(toRemotePath(connId, serverToVirtual(record, targetServer)))
}

async function requireRecord(id) {
  const record = await findRecord(id)
  if (!record) throw makeError('not_found', `connection not found: ${id}`)
  return record
}

// ---------------------------------------------------------------------------
// Connectors (common interface: connect/list/read/stat/mkdir/delete/rename/upload/download/disconnect)
// ---------------------------------------------------------------------------

function createConnector(conn, password) {
  if (conn.protocol === 'sftp') return createSftpConnector(conn, password)
  if (conn.protocol === 'webdav') return createWebdavConnector(conn, password)
  return createFtpConnector(conn, password) // ftp | ftps
}

// --- FTP / FTPS (basic-ftp) ---

async function ftpDelete(client, serverPath) {
  try {
    await client.remove(serverPath) // removes a file
    return
  } catch {
    // likely a non-empty directory; recurse below
  }
  await client.cd(serverPath)
  const children = await client.list()
  for (const child of children) {
    const childPath = joinRemote(serverPath, child.name)
    if (child.isDirectory) await ftpDelete(client, childPath)
    else await client.remove(childPath)
  }
  await client.removeDir(serverPath)
}

function createFtpConnector(conn, password) {
  const client = new Client(15000)
  client.ftp.verbose = false
  const secure = conn.protocol === 'ftps' ? (conn.ftpsImplicit ? 'implicit' : true) : false
  return {
    protocol: conn.protocol,
    async connect() {
      await client.access({
        host: conn.host,
        port: conn.port,
        user: conn.username || 'anonymous',
        password: password || '',
        secure,
        secureOptions: conn.protocol === 'ftps' ? { rejectUnauthorized: false } : undefined,
      })
    },
    async list(serverPath) {
      await client.cd(serverPath)
      const items = await client.list()
      return items.map((item) => ({
        name: item.name,
        isDir: item.isDirectory,
        size: item.isDirectory ? 0 : item.size,
        modified: item.modifiedAt ? item.modifiedAt.toISOString() : null,
      }))
    },
    async read(serverPath) {
      const chunks = []
      const sink = new PassThrough()
      sink.on('data', (chunk) => chunks.push(chunk))
      await client.downloadTo(sink, serverPath)
      return Buffer.concat(chunks)
    },
    async stat(serverPath) {
      const parent = dirnameRemote(serverPath)
      const name = basenameRemote(serverPath)
      await client.cd(parent)
      const items = await client.list()
      const item = items.find((candidate) => candidate.name === name)
      if (!item) throw makeError('not_found', `not found: ${serverPath}`)
      return {
        name: item.name,
        isDir: item.isDirectory,
        size: item.isDirectory ? 0 : item.size,
        modified: item.modifiedAt ? item.modifiedAt.toISOString() : null,
      }
    },
    async mkdir(serverPath) {
      await client.ensureDir(serverPath)
    },
    async delete(serverPath) {
      await ftpDelete(client, serverPath)
    },
    async rename(serverPath, newName) {
      await client.rename(serverPath, joinRemote(dirnameRemote(serverPath), newName))
    },
    async upload(localPath, serverPath) {
      await client.uploadFrom(localPath, serverPath)
    },
    async download(serverPath, localPath) {
      await client.downloadTo(localPath, serverPath)
    },
    async disconnect() {
      client.close()
    },
  }
}

// --- SFTP (ssh2-sftp-client) ---

function createSftpConnector(conn, password) {
  const sftp = new SftpClient()
  return {
    protocol: conn.protocol,
    async connect() {
      await sftp.connect({
        host: conn.host,
        port: conn.port,
        username: conn.username,
        password: password || '',
        readyTimeout: 15000,
      })
    },
    async list(serverPath) {
      const items = await sftp.list(serverPath)
      return items
        .filter((item) => item.name !== '.' && item.name !== '..')
        .map((item) => ({
          name: item.name,
          isDir: item.type === 'd',
          size: item.type === 'd' ? 0 : item.size,
          modified: toIso(item.modifyTime),
        }))
    },
    async read(serverPath) {
      return sftp.get(serverPath)
    },
    async stat(serverPath) {
      const item = await sftp.stat(serverPath)
      return {
        name: item.name,
        isDir: item.type === 'd',
        size: item.type === 'd' ? 0 : item.size,
        modified: toIso(item.modifyTime),
      }
    },
    async mkdir(serverPath) {
      await sftp.mkdir(serverPath, true)
    },
    async delete(serverPath) {
      const item = await sftp.stat(serverPath)
      if (item.type === 'd') await sftp.rmdir(serverPath, true)
      else await sftp.delete(serverPath)
    },
    async rename(serverPath, newName) {
      await sftp.rename(serverPath, joinRemote(dirnameRemote(serverPath), newName))
    },
    async upload(localPath, serverPath) {
      const stat = await fs.stat(localPath)
      if (stat.isDirectory()) await sftp.uploadDir(localPath, dirnameRemote(serverPath))
      else await sftp.fastPut(localPath, serverPath)
    },
    async download(serverPath, localPath) {
      const item = await sftp.stat(serverPath)
      if (item.type === 'd') await sftp.downloadDir(serverPath, localPath)
      else await sftp.fastGet(serverPath, localPath)
    },
    async disconnect() {
      await sftp.end()
    },
  }
}

// --- WebDAV ---

function createWebdavConnector(conn, password) {
  const scheme = conn.secure ? 'https' : 'http'
  const url = `${scheme}://${conn.host}:${conn.port}`
  const client = createClient(url, {
    username: conn.username,
    password: password || '',
  })
  const rootPath = normalizeRemote(conn.rootPath || '/')
  return {
    protocol: conn.protocol,
    async connect() {
      // Verify reachability; throws on connection/auth failure.
      await client.getDirectoryContents(rootPath, { deep: false })
    },
    async list(serverPath) {
      const items = await client.getDirectoryContents(serverPath, { deep: false })
      return items.map((item) => ({
        name: item.basename,
        isDir: item.type === 'directory',
        size: item.type === 'directory' ? 0 : Number(item.size || 0),
        modified: toIso(item.lastmod),
      }))
    },
    async read(serverPath) {
      return client.getFileContents(serverPath)
    },
    async stat(serverPath) {
      const item = await client.stat(serverPath)
      return {
        name: item.basename,
        isDir: item.type === 'directory',
        size: item.type === 'directory' ? 0 : Number(item.size || 0),
        modified: toIso(item.lastmod),
      }
    },
    async mkdir(serverPath) {
      await client.createDirectory(serverPath)
    },
    async delete(serverPath) {
      // WebDAV DELETE removes collections recursively (RFC 4918).
      await client.deleteFile(serverPath)
    },
    async rename(serverPath, newName) {
      await client.moveFile(serverPath, joinRemote(dirnameRemote(serverPath), newName))
    },
    async upload(localPath, serverPath) {
      const reader = createReadStream(localPath)
      const writer = client.createWriteStream(serverPath)
      await pipeline(reader, writer)
    },
    async download(serverPath, localPath) {
      const reader = client.createReadStream(serverPath)
      await pipeline(reader, createWriteStream(localPath))
    },
    async disconnect() {
      // Stateless HTTP client: nothing to close.
    },
  }
}
