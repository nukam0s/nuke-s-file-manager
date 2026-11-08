import type { IpcApi, UnlistenFn } from './api'
import type { OperationResult, ProgressUpdate } from './types'

// The window is served by the local backend (Electron/portable), so the current
// origin is the backend base URL. Relative routes already resolve against it,
// but we make the base explicit to avoid CORS and fixed ports.
const BASE_URL = typeof window !== 'undefined' ? window.location.origin : ''

async function handle<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = response.statusText
    try {
      const data = (await response.json()) as { message?: string }
      if (data.message) message = data.message
    } catch {
      // ignore parse errors
    }
    throw new Error(message)
  }
  return (await response.json()) as T
}

function post<T>(route: string, body: unknown): Promise<T> {
  return fetch(BASE_URL + route, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }).then((response) => handle<T>(response))
}

function get<T>(route: string): Promise<T> {
  return fetch(BASE_URL + route).then((response) => handle<T>(response))
}

let eventSource: EventSource | null = null

function events(): EventSource {
  if (!eventSource) eventSource = new EventSource(BASE_URL + '/api/events')
  return eventSource
}

async function control(route: string): Promise<boolean> {
  const result = await post<{ paused?: boolean; cancelled?: boolean }>(route, {})
  return Boolean(result.paused ?? result.cancelled ?? true)
}

/// IPC implementation used when the UI is served by the portable Node backend.
export const httpIpc: IpcApi = {
  listDir: (path, showHidden, sort) => post('/api/list_dir', { path, showHidden, sort }),
  getMetadata: (path) => post('/api/get_metadata', { path }),
  copyItems: (sources, destination, options) =>
    post('/api/copy_items', { sources, destination, options }),
  moveItems: (sources, destination, options) =>
    post('/api/move_items', { sources, destination, options }),
  deleteItems: (paths, useTrash) => post('/api/delete_items', { paths, useTrash }),
  renameItem: (path, newName) => post('/api/rename_item', { path, newName }),
  createDir: (parent, name) => post('/api/create_dir', { parent, name }),
  getDrives: () => get('/api/drives'),
  getHomeDir: () => get('/api/home'),

  pauseOperation: () => control('/api/pause'),
  resumeOperation: () => control('/api/resume'),
  cancelOperation: () => control('/api/cancel'),

  search: (root, query, recursive, maxResults, inContent) =>
    post('/api/search', { root, query, recursive, maxResults, inContent }),
  readFileText: (path) => post('/api/read_file', { path }),
  writeFileText: (path, content) => post('/api/write_file', { path, content }),
  openPath: (path) => post('/api/open', { path }),
  openWith: (path, command) => post('/api/open_with', { path, command }),
  checksums: (paths, algorithm) => post('/api/checksums', { paths, algorithm }),
  multiRename: (items) => post('/api/multi_rename', { items }),
  splitFile: (path, partSizeBytes, destDir) =>
    post('/api/split', { path, partSizeBytes, destDir }),
  combineFiles: (parts, output) => post('/api/combine', { parts, output }),
  packZip: (sources, destination) => post('/api/zip', { sources, destination }),
  extractZip: (archive, destination) => post('/api/unzip', { archive, destination }),
  packTar: (sources, destination) => post('/api/tar', { sources, destination }),
  extractTar: (archive, destination) => post('/api/untar', { archive, destination }),
  extractArchive: (archive, destination) =>
    post('/api/extract_archive', { archive, destination }),
  extractArchiveEntry: (path, destination) =>
    post('/api/archive_extract', { path, destination }),
  compareDirs: (left, right) => post('/api/compare', { left, right }),
  syncDirs: (left, right, direction) => post('/api/sync', { left, right, direction }),
  tree: (root, maxDepth) => post('/api/tree', { root, maxDepth }),

  remoteList: () => post('/api/remote/list', {}),
  remoteSave: (connection, password) => post('/api/remote/save', { connection, password }),
  remoteDeleteConnection: (id) => post('/api/remote/delete', { id }),
  remoteTest: (connection, password) => post('/api/remote/test', { connection, password }),
  remoteConnect: (id) => post('/api/remote/connect', { id }),
  remoteDisconnect: (id) => post('/api/remote/disconnect', { id }),
  remoteMkdir: (path) => post('/api/remote/mkdir', { path }),
  remoteDeleteFiles: (paths) => post('/api/remote/delete', { paths }),
  remoteRename: (path, newName) => post('/api/remote/rename', { path, newName }),
  remoteDownload: (path, destination) => post('/api/remote/download', { path, destination }),
  remoteUpload: (localPath, destination) => post('/api/remote/upload', { localPath, destination }),

  onProgress(callback) {
    const source = events()
    const handler = (event: MessageEvent) =>
      callback(JSON.parse(event.data) as ProgressUpdate)
    source.addEventListener('progress', handler as EventListener)
    return Promise.resolve<UnlistenFn>(() =>
      source.removeEventListener('progress', handler as EventListener),
    )
  },

  onCompleted(callback) {
    const source = events()
    const handler = (event: MessageEvent) =>
      callback(JSON.parse(event.data) as OperationResult)
    source.addEventListener('completed', handler as EventListener)
    return Promise.resolve<UnlistenFn>(() =>
      source.removeEventListener('completed', handler as EventListener),
    )
  },
}
