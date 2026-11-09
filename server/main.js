// Portable HTTP server: serves the embedded React build and a JSON API over the local filesystem.
// Bundled by esbuild and embedded in a Node SEA single executable, or loaded by the Electron main process.
import http from 'node:http'
import { URL, pathToFileURL } from 'node:url'
import { exec } from 'node:child_process'
import { promises as fsNode, createReadStream } from 'node:fs'
import pathNode from 'node:path'

import { ASSETS, INDEX_HTML } from './assets.generated.js'
import * as svc from './fsService.js'
import * as tools from './toolsService.js'
import * as archive from './archiveService.js'
import * as remote from './remoteService.js'
import * as settings from './settingsService.js'

const clients = new Set()

// Cooperative control for the currently running batch operation (single active op).
const control = { paused: false, cancelled: false }

function resetControl() {
  control.paused = false
  control.cancelled = false
}

function broadcast(event, payload) {
  const message = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`
  for (const client of clients) {
    try {
      client.write(message)
    } catch {
      clients.delete(client)
    }
  }
}

async function readBody(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  if (chunks.length === 0) return {}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

function sendJson(res, status, data) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(data))
}

function sendError(res, error) {
  sendJson(res, 400, { code: error.code || 'error', message: error.message || String(error) })
}

function progress() {
  return (update) => broadcast('progress', update)
}

const RAW_MIME = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain; charset=utf-8',
  '.mp4': 'video/mp4',
  '.mp3': 'audio/mpeg',
}

async function serveRaw(res, url) {
  const target = url.searchParams.get('path')
  if (!target) {
    res.writeHead(400)
    res.end()
    return
  }
  try {
    if (remote.isRemotePath(target)) {
      const parsed = remote.parseRemotePath(target)
      const buffer = await remote.remoteRaw(target)
      const type =
        RAW_MIME[pathNode.extname(parsed.remotePath).toLowerCase()] || 'application/octet-stream'
      res.writeHead(200, {
        'content-type': type,
        'content-length': buffer.length,
        'cache-control': 'no-cache',
      })
      res.end(buffer)
      return
    }
    if (archive.isArchivePath(target)) {
      const parsed = archive.parseArchivePath(target)
      const buffer = await archive.archiveRaw({
        type: parsed.type,
        archive: parsed.archive,
        innerPath: parsed.inner,
      })
      const type =
        RAW_MIME[pathNode.extname(parsed.inner).toLowerCase()] || 'application/octet-stream'
      res.writeHead(200, {
        'content-type': type,
        'content-length': buffer.length,
        'cache-control': 'no-cache',
      })
      res.end(buffer)
      return
    }
    const stat = await fsNode.stat(target)
    if (!stat.isFile()) {
      res.writeHead(400)
      res.end()
      return
    }
    const type = RAW_MIME[pathNode.extname(target).toLowerCase()] || 'application/octet-stream'
    res.writeHead(200, {
      'content-type': type,
      'content-length': stat.size,
      'cache-control': 'no-cache',
    })
    createReadStream(target).pipe(res)
  } catch {
    res.writeHead(404)
    res.end()
  }
}

async function handleApi(req, res, url) {
  const route = url.pathname
  try {
    if (req.method === 'GET' && route === '/api/health') return sendJson(res, 200, { ok: true })
    if (req.method === 'GET' && route === '/api/home') return sendJson(res, 200, svc.getHomeDir())
    if (req.method === 'GET' && route === '/api/drives') return sendJson(res, 200, svc.getDrives())
    if (req.method === 'GET' && route === '/api/raw') return serveRaw(res, url)

    // Persistent UI settings (hotlist / extension associations). Stored as JSON files
    // under %APPDATA%/NukeFileManager/settings so they survive the random port.
    if (req.method === 'GET' && route === '/api/settings') {
      const value = await settings.getSetting(url.searchParams.get('key') || '')
      return sendJson(res, 200, { value })
    }

    if (req.method === 'GET' && route === '/api/events') {
      res.writeHead(200, {
        'content-type': 'text/event-stream; charset=utf-8',
        'cache-control': 'no-cache',
        connection: 'keep-alive',
      })
      res.write(': connected\n\n')
      clients.add(res)
      req.on('close', () => clients.delete(res))
      return
    }

    if (req.method === 'POST') {
      const body = await readBody(req)

      if (route === '/api/settings') {
        await settings.setSetting(body.key, body.value)
        return sendJson(res, 200, { ok: true })
      }

      if (route === '/api/list_dir') {
        if (remote.isRemotePath(body.path)) {
          return sendJson(res, 200, await remote.remoteListDir(body.path, body.showHidden, body.sort))
        }
        if (archive.isArchivePath(body.path)) {
          const parsed = archive.parseArchivePath(body.path)
          return sendJson(res, 200, {
            parent: archive.archiveParent(body.path),
            entries: await archive.listArchive(parsed, body.showHidden, body.sort),
          })
        }
        return sendJson(res, 200, await svc.listDir(body.path, body.showHidden, body.sort))
      }
      if (route === '/api/get_metadata') {
        if (remote.isRemoteRoot(body.path)) {
          return sendJson(res, 200, remote.remoteRootEntry())
        }
        if (remote.isRemotePath(body.path)) {
          return sendJson(res, 200, await remote.remoteGetMetadata(body.path))
        }
        if (archive.isArchivePath(body.path)) {
          const { type, archive: file, inner } = archive.parseArchivePath(body.path)
          return sendJson(res, 200, await archive.archiveMetadata({ type, archive: file, innerPath: inner }))
        }
        return sendJson(res, 200, await svc.getMetadata(body.path))
      }
      if (route === '/api/read_file') {
        if (remote.isRemoteRoot(body.path)) {
          return sendJson(res, 200, { path: 'remote::', content: '', truncated: false, binary: false, size: 0 })
        }
        if (remote.isRemotePath(body.path)) {
          return sendJson(res, 200, await remote.remoteReadFile(body.path))
        }
        if (archive.isArchivePath(body.path)) {
          const { type, archive: file, inner } = archive.parseArchivePath(body.path)
          return sendJson(res, 200, await archive.readArchiveEntry({ type, archive: file, innerPath: inner }))
        }
        return sendJson(res, 200, await svc.readFileText(body.path))
      }
      if (route === '/api/write_file') {
        return sendJson(res, 200, await svc.writeFileText(body.path, body.content))
      }

      if (route === '/api/copy_items') {
        resetControl()
        const result = await svc.copyItems(body.sources || [], body.destination, progress(), body.options || {}, control)
        broadcast('completed', result)
        return sendJson(res, 200, result)
      }
      if (route === '/api/move_items') {
        resetControl()
        const result = await svc.moveItems(body.sources || [], body.destination, progress(), body.options || {}, control)
        broadcast('completed', result)
        return sendJson(res, 200, result)
      }
      if (route === '/api/delete_items') {
        resetControl()
        const result = await svc.deleteItems(body.paths || [], body.useTrash !== false, progress(), control)
        broadcast('completed', result)
        return sendJson(res, 200, result)
      }
      if (route === '/api/rename_item') {
        return sendJson(res, 200, await svc.renameItem(body.path, body.newName))
      }
      if (route === '/api/create_dir') {
        return sendJson(res, 200, await svc.createDir(body.parent, body.name))
      }

      // --- operation control (pause / resume / cancel) ---
      if (route === '/api/pause') {
        control.paused = true
        return sendJson(res, 200, { paused: true })
      }
      if (route === '/api/resume') {
        control.paused = false
        return sendJson(res, 200, { paused: false })
      }
      if (route === '/api/cancel') {
        control.cancelled = true
        control.paused = false
        return sendJson(res, 200, { cancelled: true })
      }

      // --- tools ---
      if (route === '/api/search') {
        return sendJson(res, 200, await tools.search(body.root, body.query, body.recursive !== false, body.maxResults, { inContent: body.inContent }))
      }
      if (route === '/api/checksums') {
        return sendJson(res, 200, await tools.checksums(body.paths || [], body.algorithm))
      }
      if (route === '/api/multi_rename') {
        const result = await tools.multiRename(body.items || [])
        broadcast('completed', result)
        return sendJson(res, 200, result)
      }
      if (route === '/api/split') {
        return sendJson(res, 200, await tools.splitFile(body.path, body.partSizeBytes, body.destDir))
      }
      if (route === '/api/combine') {
        return sendJson(res, 200, await tools.combineFiles(body.parts || [], body.output))
      }
      if (route === '/api/zip') {
        const result = await tools.packZip(body.sources || [], body.destination)
        broadcast('completed', result)
        return sendJson(res, 200, result)
      }
      if (route === '/api/unzip') {
        const result = await tools.extractZip(body.archive, body.destination)
        broadcast('completed', result)
        return sendJson(res, 200, result)
      }
      if (route === '/api/tar') {
        const result = await tools.packTar(body.sources || [], body.destination)
        broadcast('completed', result)
        return sendJson(res, 200, result)
      }
      if (route === '/api/untar') {
        const result = await tools.extractTar(body.archive, body.destination)
        broadcast('completed', result)
        return sendJson(res, 200, result)
      }
      if (route === '/api/compare') {
        return sendJson(res, 200, await tools.compareDirs(body.left, body.right))
      }
      if (route === '/api/sync') {
        const result = await tools.syncDirs(body.left, body.right, body.direction)
        broadcast('completed', {
          opId: `sync-${Date.now()}`,
          success: result.copied,
          skipped: result.skipped,
          failed: result.failed,
          errors: result.errors,
          cancelled: false,
        })
        return sendJson(res, 200, result)
      }
      if (route === '/api/tree') {
        return sendJson(res, 200, await tools.tree(body.root, body.maxDepth))
      }
      if (route === '/api/extract_archive') {
        const result = await tools.extractArchive(body.archive, body.destination)
        broadcast('completed', result)
        return sendJson(res, 200, result)
      }
      if (route === '/api/archive_extract') {
        const { type, archive: file, inner } = archive.parseArchivePath(body.path)
        const result = await archive.extractArchiveEntry({
          type,
          archive: file,
          innerPath: inner,
          destination: body.destination,
        })
        broadcast('completed', result)
        return sendJson(res, 200, result)
      }
      if (route === '/api/open') {
        return sendJson(res, 200, tools.openPath(body.path))
      }
      if (route === '/api/open_with') {
        return sendJson(res, 200, tools.openWith(body.path, body.command))
      }

      // --- remote filesystems (FTP / FTPS / SFTP / WebDAV) ---
      if (route === '/api/remote/list') {
        return sendJson(res, 200, { connections: await remote.listConnections() })
      }
      if (route === '/api/remote/save') {
        return sendJson(res, 200, await remote.saveConnection(body.connection, body.password))
      }
      if (route === '/api/remote/delete') {
        if (Array.isArray(body.paths)) {
          return sendJson(res, 200, await remote.remoteDeleteFiles(body.paths))
        }
        return sendJson(res, 200, await remote.deleteConnection(body.id))
      }
      if (route === '/api/remote/test') {
        return sendJson(res, 200, await remote.testConnection(body.connection, body.password))
      }
      if (route === '/api/remote/connect') {
        return sendJson(res, 200, await remote.connectConnection(body.id))
      }
      if (route === '/api/remote/disconnect') {
        return sendJson(res, 200, await remote.disconnectConnection(body.id))
      }
      if (route === '/api/remote/mkdir') {
        return sendJson(res, 200, await remote.remoteMkdir(body.path))
      }
      if (route === '/api/remote/rename') {
        return sendJson(res, 200, await remote.remoteRename(body.path, body.newName))
      }
      if (route === '/api/remote/download') {
        return sendJson(res, 200, await remote.remoteDownload(body.path, body.destination))
      }
      if (route === '/api/remote/upload') {
        return sendJson(res, 200, await remote.remoteUpload(body.localPath, body.destination))
      }
    }

    sendJson(res, 404, { code: 'not_found', message: 'route not found' })
  } catch (error) {
    sendError(res, error)
  }
}

function serveStatic(res, url) {
  if (url.pathname === '/' || url.pathname === '/index.html') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
    res.end(INDEX_HTML)
    return true
  }

  const asset = ASSETS[url.pathname]
  if (asset) {
    const buffer = Buffer.from(asset.data, 'base64')
    res.writeHead(200, { 'content-type': asset.type, 'content-length': buffer.length })
    res.end(buffer)
    return true
  }

  return false
}

function openBrowser(targetUrl) {
  const platform = process.platform
  const command =
    platform === 'win32'
      ? `start "" "${targetUrl}"`
      : platform === 'darwin'
        ? `open "${targetUrl}"`
        : `xdg-open "${targetUrl}"`
  exec(command, () => {})
}

/// Creates (and starts) the HTTP backend without assuming it is the process entry.
/// opts = { host = '127.0.0.1', port = 0, openBrowser = false }
/// Resolves to { server, port, url, close() }.
export function createAppServer(opts = {}) {
  const host = opts.host || '127.0.0.1'
  const openBrowserWhenReady = opts.openBrowser === true
  const requestedPort = opts.port ?? 0

  const server = http.createServer((req, res) => {
    const url = new URL(req.url || '/', `http://${req.headers.host || host}`)
    if (url.pathname.startsWith('/api/')) {
      void handleApi(req, res, url)
      return
    }
    if (serveStatic(res, url)) return

    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
    res.end(INDEX_HTML)
  })

  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(requestedPort, host, () => {
      server.removeListener('error', reject)
      const address = server.address()
      const port = address && typeof address === 'object' ? address.port : requestedPort
      const url = `http://${host}:${port}/`

      if (openBrowserWhenReady) openBrowser(url)

      resolve({
        server,
        port,
        url,
        close: () => new Promise((res) => server.close(() => res())),
      })
    })
  })
}

// Detects direct execution across ESM (`node server/main.js`) and the CJS bundle
// produced by esbuild (the SEA single executable). In the Electron bundle this
// returns false because the module is required by `electron/main.cjs`.
function isMainModule() {
  // CJS bundle: `require.main === module` is true only for the entry script (SEA).
  if (typeof require !== 'undefined' && require.main === module) return true
  // ESM: `import.meta.url` matches the resolved CLI entry.
  if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) return true
  return false
}

if (isMainModule()) {
  const port = Number(process.env.FM_PORT || 0)
  const openBrowser = process.env.FM_NO_OPEN !== '1'
  createAppServer({ port, openBrowser })
    .then(({ url }) => {
      // eslint-disable-next-line no-console
      console.log(`Nuke File Manager running at ${url}`)
    })
    .catch((error) => {
      // eslint-disable-next-line no-console
      console.error(error)
      process.exit(1)
    })
}
