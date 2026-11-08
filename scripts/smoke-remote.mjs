// Smoke test for the remote-filesystem subsystem that does NOT require a live
// FTP/SFTP/WebDAV server. It validates:
//   1. vault CRUD (save / list / delete)
//   2. passwords are encrypted at rest and never returned in plaintext
//   3. testConnection fails gracefully for an unreachable host
//
// The vault is isolated into a temporary directory via FM_VAULT_DIR, so your real
// %APPDATA%/NukeFileManager/vault.json credentials are left untouched.
//
// ---------------------------------------------------------------------------
// Manual testing against a REAL server
// ---------------------------------------------------------------------------
// 1. Start the portable backend:
//      set "FM_PORT=18080"&& set "FM_NO_OPEN=1"&& node server/main.js
//
// 2. Drive the HTTP API (see server/main.js and src/ipc/httpClient.ts for shapes):
//      POST /api/remote/save      { connection, password }
//      POST /api/remote/list      {}
//      POST /api/remote/test      { connection, password }
//      POST /api/remote/connect   { id }
//      POST /api/remote/disconnect{ id }
//      POST /api/remote/mkdir     { path: "remote::<id>::/folder" }
//      POST /api/remote/delete    { paths: ["remote::<id>::/folder"] }
//      POST /api/remote/rename    { path: "remote::<id>::/folder", newName: "renamed" }
//      POST /api/remote/download  { path: "remote::<id>::/report.txt", destination: "C:\\tmp\\report.txt" }
//      POST /api/remote/upload    { localPath: "C:\\tmp\\report.txt", destination: "remote::<id>::/" }
//
//    Example connection payloads:
//      FTP  : { name, protocol: "ftp",  host, port: 21, username, secure: false }
//      FTPS : { name, protocol: "ftps", host, port: 21, username, secure: true, ftpsImplicit: false } // explicit TLS
//             (set ftpsImplicit: true and port 990 for implicit TLS)
//      SFTP : { name, protocol: "sftp", host, port: 22, username, secure: true }
//      WebDAV: { name, protocol: "webdav", host, port: 443, username, secure: true }
//
// 3. Read a remote entry through the existing remote-aware routes:
//      POST /api/list_dir     { path: "remote::<id>::/" }
//      POST /api/get_metadata { path: "remote::<id>::/report.txt" }
//      POST /api/read_file    { path: "remote::<id>::/report.txt" }
//      GET  /api/raw?path=remote::<id>::/report.txt
// ---------------------------------------------------------------------------
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import {
  listConnections,
  saveConnection,
  deleteConnection,
  testConnection,
} from '../server/remoteService.js'

const vaultDir = path.join(os.tmpdir(), `nuke-fm-vault-${Date.now()}`)
process.env.FM_VAULT_DIR = vaultDir

const password = 'super-secret-123'

function assert(condition, label) {
  if (!condition) throw new Error(`FAIL: ${label}`)
  console.log(`ok: ${label}`)
}

async function main() {
  // 1. Save (upsert) a connection with a password.
  const saved = await saveConnection(
    {
      name: 'Smoke FTP',
      protocol: 'ftp',
      host: 'ftp.example.com',
      port: 21,
      username: 'user',
      secure: false,
      ftpsImplicit: false,
      rootPath: '/',
    },
    password,
  )
  assert(saved.id, 'save returns an id')
  assert(!('password' in saved) && !('passwordEncrypted' in saved), 'save returns no password field')

  // 2. List returns sanitized connections (no password anywhere).
  const list = await listConnections()
  assert(list.length === 1, 'list contains the saved connection')
  assert(!('password' in list[0]) && !('passwordEncrypted' in list[0]), 'list has no password field')
  assert(!JSON.stringify(list).includes(password), 'plaintext password not present in list')

  // 3. Password is encrypted at rest on disk.
  const raw = await fs.readFile(path.join(vaultDir, 'vault.json'), 'utf8')
  assert(!raw.includes(password), 'plaintext password not present on disk')
  const vaultData = JSON.parse(raw)
  const record = vaultData.connections.find((candidate) => candidate.id === saved.id)
  assert(
    record && typeof record.passwordEncrypted === 'string' && record.passwordEncrypted.length > 0,
    'password stored as encrypted payload',
  )

  // 4. Testing an unreachable connection fails gracefully.
  const result = await testConnection(
    {
      name: 'bad',
      protocol: 'ftp',
      host: '127.0.0.1',
      port: 1,
      username: 'x',
      secure: false,
      ftpsImplicit: false,
      rootPath: '/',
    },
    'nope',
  )
  assert(
    result.ok === false && typeof result.error === 'string' && result.error.length > 0,
    'invalid connection fails gracefully',
  )

  // 5. Delete removes the connection.
  await deleteConnection(saved.id)
  const after = await listConnections()
  assert(after.length === 0, 'delete removes the connection')

  console.log('REMOTE TEST: PASS')
}

main().catch((error) => {
  console.error(error.message || error)
  console.log('REMOTE TEST: FAIL')
  process.exit(1)
})
