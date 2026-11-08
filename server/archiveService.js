// "Archives as folders" service for the portable Node backend.
// Navigates inside ZIP (adm-zip) and TAR (tar, incl. .tar.gz/.tgz) without extracting to disk.
// Virtual path contract: `<zip|tar>::<absoluteArchivePath>::<inner>` where `inner` uses `/`.
import { promises as fs } from 'node:fs'
import path from 'node:path'
import AdmZip from 'adm-zip'
import * as tarNs from 'tar'

const tar = tarNs.default || tarNs

const MAX_TEXT_BYTES = 2 * 1024 * 1024

const META_TYPES = new Set([
  'GlobalExtendedHeader',
  'ExtendedHeader',
  'OldExtendedHeader',
  'SolarisACL',
  'GNUDumpDir',
  'Inode',
  'NextFileHasLongLinkpath',
  'NextFileHasLongPath',
  'TapeVolumeHeader',
  'Unsupported',
])

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

function normalizeInner(p) {
  return String(p || '')
    .replace(/\\/g, '/')
    .replace(/\/+$/, '')
    .replace(/^\/+/, '')
}

function extensionOf(name) {
  const ext = path.extname(name)
  return ext ? ext.slice(1).toLowerCase() : null
}

export function isArchivePath(p) {
  return typeof p === 'string' && (p.startsWith('zip::') || p.startsWith('tar::'))
}

export function parseArchivePath(p) {
  if (!isArchivePath(p)) throw makeError('invalid_path', `not an archive path: ${p}`)
  const type = p.startsWith('zip::') ? 'zip' : 'tar'
  const rest = p.slice(type.length + 2)
  const sep = rest.indexOf('::')
  if (sep < 0) throw makeError('invalid_path', `malformed archive path: ${p}`)
  const archive = rest.slice(0, sep)
  const inner = normalizeInner(rest.slice(sep + 2))
  return { type, archive, inner }
}

export function toArchivePath(type, archive, inner) {
  return `${type}::${archive}::${inner || ''}`
}

// Parent path used as `ListingResult.parent`: one level up inside the archive,
// or the real directory that contains the archive file when at the archive root.
export function archiveParent(p) {
  const { type, archive, inner } = parseArchivePath(p)
  if (!inner) return path.dirname(archive)
  const idx = inner.lastIndexOf('/')
  const parentInner = idx < 0 ? '' : inner.slice(0, idx)
  return toArchivePath(type, archive, parentInner)
}

function entryFrom(type, archive, innerPath, meta) {
  const p = normalizeInner(innerPath)
  const name = p.split('/').filter(Boolean).pop() || path.basename(archive)
  return {
    name,
    path: toArchivePath(type, archive, p),
    isDir: Boolean(meta.isDir),
    isSymlink: false,
    size: meta.isDir ? 0 : meta.size,
    modified: meta.modified || null,
    extension: meta.isDir ? null : extensionOf(name),
    attributes: meta.isDir ? 'D' : 'A',
  }
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

function rawZipItems(archive) {
  const zip = new AdmZip(archive)
  return zip.getEntries().map((entry) => {
    const p = normalizeInner(entry.entryName)
    return {
      path: p,
      isDir: entry.isDirectory,
      size: entry.isDirectory ? 0 : entry.header.size,
      modified: entry.header.time instanceof Date ? entry.header.time.toISOString() : null,
    }
  })
}

async function rawTarItems(archive) {
  const items = []
  await tar.t({
    file: archive,
    onReadEntry: (entry) => {
      if (META_TYPES.has(entry.type)) return
      const p = normalizeInner(entry.path)
      items.push({
        path: p,
        isDir: entry.type === 'Directory',
        size: entry.type === 'Directory' ? 0 : entry.size,
        modified: entry.mtime ? entry.mtime.toISOString() : null,
      })
    },
  })
  return items
}

function rawItems(type, archive) {
  return type === 'zip' ? rawZipItems(archive) : rawTarItems(archive)
}

function findZipEntry(archive, innerPath) {
  const target = normalizeInner(innerPath)
  const zip = new AdmZip(archive)
  return zip.getEntries().find((entry) => normalizeInner(entry.entryName) === target) || null
}

async function readTarBuffer(archive, innerPath) {
  const target = normalizeInner(innerPath)
  return new Promise((resolve, reject) => {
    let result = null
    let matched = false
    tar
      .t({
        file: archive,
        onReadEntry: (entry) => {
          if (META_TYPES.has(entry.type)) return
          if (normalizeInner(entry.path) !== target) return
          matched = true
          if (entry.type === 'Directory') {
            result = Buffer.alloc(0)
            return
          }
          const chunks = []
          entry.on('data', (chunk) => chunks.push(chunk))
          entry.on('end', () => {
            result = Buffer.concat(chunks)
          })
          entry.on('error', reject)
        },
      })
      .then(() => {
        if (!matched) reject(makeError('not_found', `entry not found: ${target}`))
        else resolve(result)
      }, reject)
  })
}

// Listing of the immediate children of `inner` (empty = archive root).
// Implicit directory entries are synthesized from nested paths when needed.
export async function listArchive({ type, archive, inner }, showHidden = false, sort = { field: 'name', dir: 'asc' }) {
  const raw = await rawItems(type, archive)
  const prefix = inner ? `${inner}/` : ''
  const map = new Map()

  for (const item of raw) {
    const p = item.path
    if (!p || p === inner) continue
    if (prefix && !p.startsWith(prefix)) continue
    const rel = prefix ? p.slice(prefix.length) : p
    const segments = rel.split('/').filter(Boolean)
    if (segments.length === 0) continue
    const firstName = segments[0]
    if (!showHidden && firstName.startsWith('.')) continue

    if (segments.length === 1) {
      map.set(firstName, { name: firstName, isDir: item.isDir, size: item.size, modified: item.modified })
    } else if (!map.has(firstName)) {
      // Nested path implies a directory we haven't seen explicitly.
      map.set(firstName, { name: firstName, isDir: true, size: 0, modified: null })
    }
  }

  const entries = []
  for (const meta of map.values()) {
    const innerPath = inner ? `${inner}/${meta.name}` : meta.name
    entries.push(entryFrom(type, archive, innerPath, meta))
  }
  sortEntries(entries, sort)
  return entries
}

export async function archiveMetadata({ type, archive, innerPath }) {
  const target = normalizeInner(innerPath)

  if (type === 'zip') {
    const entry = findZipEntry(archive, target)
    if (!entry) throw makeError('not_found', `entry not found: ${target}`)
    return entryFrom(type, archive, target, {
      isDir: entry.isDirectory,
      size: entry.isDirectory ? 0 : entry.header.size,
      modified: entry.header.time instanceof Date ? entry.header.time.toISOString() : null,
    })
  }

  const raw = await rawTarItems(archive)
  const item = raw.find((candidate) => candidate.path === target)
  if (item) return entryFrom(type, archive, target, item)

  // Implicit directory (files nested under it but no explicit directory entry).
  if (raw.some((candidate) => candidate.path.startsWith(`${target}/`))) {
    return entryFrom(type, archive, target, { isDir: true, size: 0, modified: null })
  }

  throw makeError('not_found', `entry not found: ${target}`)
}

export async function archiveRaw({ type, archive, innerPath }) {
  const target = normalizeInner(innerPath)
  if (type === 'zip') {
    const entry = findZipEntry(archive, target)
    if (!entry) throw makeError('not_found', `entry not found: ${target}`)
    return entry.isDirectory ? Buffer.alloc(0) : entry.getData()
  }
  return readTarBuffer(archive, target)
}

// Text preview of an entry, mirroring fsService.readFileText's return shape.
export async function readArchiveEntry({ type, archive, innerPath }) {
  const buffer = await archiveRaw({ type, archive, innerPath })
  const sample = buffer.subarray(0, Math.min(4096, buffer.length))
  const binary = sample.includes(0)
  const readSize = Math.min(buffer.length, MAX_TEXT_BYTES)
  return {
    path: toArchivePath(type, archive, innerPath),
    content: binary ? '' : buffer.subarray(0, readSize).toString('utf8'),
    truncated: buffer.length > MAX_TEXT_BYTES,
    binary,
    size: buffer.length,
  }
}

// Extracts a single entry (or a virtual directory and its children) to a real destination.
// An empty innerPath extracts the whole archive.
export async function extractArchiveEntry({ type, archive, innerPath, destination }) {
  const target = normalizeInner(innerPath)
  const dest = path.resolve(destination)
  await fs.mkdir(dest, { recursive: true })

  if (type === 'zip') {
    const zip = new AdmZip(archive)
    if (!target) {
      zip.extractAllTo(dest, true)
      const count = zip.getEntries().filter((entry) => !entry.isDirectory).length
      return emptyOp('extract', count)
    }

    const entry = findZipEntry(archive, target)
    if (!entry) throw makeError('not_found', `entry not found: ${target}`)

    if (entry.isDirectory) {
      const prefix = `${target}/`
      const children = zip.getEntries().filter((child) => {
        const p = normalizeInner(child.entryName)
        return p === target || p.startsWith(prefix)
      })
      let count = 0
      for (const child of children) {
        const p = normalizeInner(child.entryName)
        if (child.isDirectory) {
          if (p !== target) await fs.mkdir(path.join(dest, p), { recursive: true })
          continue
        }
        const out = path.join(dest, p)
        await fs.mkdir(path.dirname(out), { recursive: true })
        await fs.writeFile(out, child.getData())
        count += 1
      }
      return emptyOp('extract', count)
    }

    await fs.writeFile(path.join(dest, path.basename(target)), entry.getData())
    return emptyOp('extract', 1)
  }

  // TAR
  if (!target) {
    await tar.x({ file: archive, cwd: dest })
    return emptyOp('extract', 1)
  }

  const raw = await rawTarItems(archive)
  const item = raw.find((candidate) => candidate.path === target)
  if (!item) throw makeError('not_found', `entry not found: ${target}`)

  if (item.isDir) {
    const prefix = `${target}/`
    await tar.x({
      file: archive,
      cwd: dest,
      filter: (p) => {
        const normalized = normalizeInner(p)
        return normalized === target || normalized.startsWith(prefix)
      },
    })
    return emptyOp('extract', 1)
  }

  const buffer = await readTarBuffer(archive, target)
  await fs.writeFile(path.join(dest, path.basename(target)), buffer)
  return emptyOp('extract', 1)
}
