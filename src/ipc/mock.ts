// Browser-only mock of the backend so `npm run dev` works without the Node server.
// It is never used when running inside Tauri or served by the portable backend.
import type {
  ChecksumEntry,
  CombineResult,
  CompareEntry,
  CompareResult,
  DriveInfo,
  FileContent,
  FileEntry,
  ListingResult,
  OperationResult,
  ProgressUpdate,
  RenameItem,
  SearchResult,
  SortOptions,
  SplitResult,
  SyncResult,
  RemoteConnection,
  RemoteConnectionInput,
  RemoteListResult,
  RemoteTestResult,
  RemoteTransferResult,
  TreeResult,
} from './types'

const HOME = '/home/nuke'

type DirMap = Record<string, FileEntry[]>

function join(dir: string, name: string): string {
  if (dir.endsWith('/')) return `${dir}${name}`
  return `${dir}/${name}`
}

function parentOf(path: string): string | null {
  if (path === '/' || path === '') return null
  const trimmed = path.replace(/\/$/, '')
  const index = trimmed.lastIndexOf('/')
  if (index <= 0) return '/'
  return trimmed.slice(0, index)
}

function extOf(name: string): string | null {
  const dot = name.lastIndexOf('.')
  if (dot <= 0) return null
  return name.slice(dot + 1).toLowerCase()
}

function entry(
  name: string,
  dir: string,
  isDir: boolean,
  size = 0,
  modified = new Date().toISOString(),
): FileEntry {
  return {
    name,
    path: join(dir, name),
    isDir,
    isSymlink: false,
    size,
    modified,
    extension: isDir ? null : extOf(name),
    attributes: isDir ? 'D' : 'A',
  }
}

const db: DirMap = {
  '/': [entry('home', '/', true), entry('etc', '/', true)],
  '/home': [entry('nuke', '/home', true)],
  [HOME]: [
    entry('Documents', HOME, true),
    entry('Downloads', HOME, true),
    entry('Pictures', HOME, true),
    entry('readme.txt', HOME, false, 1024),
    entry('notes.md', HOME, false, 4096),
  ],
  [join(HOME, 'Documents')]: [
    entry('projeto.md', join(HOME, 'Documents'), false, 2048),
    entry('orçamento.xlsx', join(HOME, 'Documents'), false, 15600),
  ],
  [join(HOME, 'Downloads')]: [
    entry('setup.exe', join(HOME, 'Downloads'), false, 52428800),
  ],
  [join(HOME, 'Pictures')]: [
    entry('foto.png', join(HOME, 'Pictures'), false, 2097152),
  ],
  '/etc': [entry('hosts', '/etc', false, 512)],
}

const progressListeners = new Set<(update: ProgressUpdate) => void>()
const completedListeners = new Set<(result: OperationResult) => void>()

function schedule(opId: string, items: string[], result: OperationResult): void {
  items.forEach((item, index) => {
    setTimeout(() => {
      progressListeners.forEach((listener) =>
        listener({ opId, processed: index + 1, total: items.length, current: item }),
      )
    }, (index + 1) * 100)
  })
  setTimeout(() => {
    completedListeners.forEach((listener) => listener(result))
  }, (items.length + 1) * 100)
}

function okResult(prefix: string, success: number): OperationResult {
  return { opId: `${prefix}-${Date.now()}`, success, skipped: 0, failed: 0, errors: [], cancelled: false }
}

function findEntry(path: string): { parent: string; index: number; entry: FileEntry } | null {
  const parent = parentOf(path)
  if (!parent) return null
  const list = db[parent] ?? []
  const index = list.findIndex((item) => item.path === path)
  if (index < 0) return null
  return { parent, index, entry: list[index] }
}

export async function listDir(path: string, showHidden: boolean, sort: SortOptions): Promise<ListingResult> {
  const dir = path || HOME
  let entries = (db[dir] ?? []).map((item) => ({ ...item }))
  if (!showHidden) entries = entries.filter((item) => !item.name.startsWith('.'))
  entries.sort((a, b) => {
    const dirCmp = Number(b.isDir) - Number(a.isDir)
    if (dirCmp !== 0) return dirCmp
    let order = 0
    if (sort.field === 'name') order = a.name.toLowerCase().localeCompare(b.name.toLowerCase())
    else if (sort.field === 'size') order = a.size - b.size
    else if (sort.field === 'extension') order = (a.extension ?? '').localeCompare(b.extension ?? '')
    else if (sort.field === 'modified') order = (a.modified ?? '').localeCompare(b.modified ?? '')
    return sort.dir === 'asc' ? order : -order
  })
  return { parent: parentOf(dir), entries }
}

export async function getMetadata(path: string): Promise<FileEntry> {
  const found = findEntry(path)
  if (!found) throw new Error(`not found: ${path}`)
  return { ...found.entry }
}

export async function createDir(parent: string, name: string): Promise<FileEntry> {
  const created = entry(name, parent, true)
  ;(db[parent] ??= []).push(created)
  db[created.path] = []
  return { ...created }
}

export async function renameItem(path: string, newName: string): Promise<FileEntry> {
  const found = findEntry(path)
  if (!found) throw new Error(`not found: ${path}`)
  const updated: FileEntry = {
    ...found.entry,
    name: newName,
    path: join(found.parent, newName),
    extension: found.entry.isDir ? null : extOf(newName),
  }
  db[found.parent][found.index] = updated
  if (db[path]) {
    db[updated.path] = db[path]
    delete db[path]
  }
  return { ...updated }
}

function transfer(sources: string[], destination: string, move: boolean, opId: string): OperationResult {
  let success = 0
  let failed = 0
  for (const source of sources) {
    const parent = parentOf(source)
    if (!parent) {
      failed += 1
      continue
    }
    const list = db[parent] ?? []
    const index = list.findIndex((item) => item.path === source)
    if (index < 0) {
      failed += 1
      continue
    }
    const original = list[index]
    const copyEntry: FileEntry = { ...original, path: join(destination, original.name) }
    ;(db[destination] ??= []).push(copyEntry)
    if (original.isDir && db[source]) db[copyEntry.path] = db[source].map((item) => ({ ...item }))
    if (move) {
      list.splice(index, 1)
      delete db[source]
    }
    success += 1
  }
  return { opId, success, skipped: 0, failed, errors: [], cancelled: false }
}

export async function copyItems(sources: string[], destination: string): Promise<OperationResult> {
  const opId = `mock-copy-${Date.now()}`
  const result = transfer(sources, destination, false, opId)
  schedule(opId, sources, result)
  return result
}

export async function moveItems(sources: string[], destination: string): Promise<OperationResult> {
  const opId = `mock-move-${Date.now()}`
  const result = transfer(sources, destination, true, opId)
  schedule(opId, sources, result)
  return result
}

export async function deleteItems(paths: string[], _useTrash: boolean): Promise<OperationResult> {
  const opId = `mock-delete-${Date.now()}`
  let success = 0
  let failed = 0
  for (const path of paths) {
    const parent = parentOf(path)
    if (!parent) {
      failed += 1
      continue
    }
    const list = db[parent] ?? []
    const index = list.findIndex((item) => item.path === path)
    if (index >= 0) {
      list.splice(index, 1)
      success += 1
    } else {
      failed += 1
    }
    delete db[path]
  }
  const result: OperationResult = { opId, success, skipped: 0, failed, errors: [], cancelled: false }
  schedule(opId, paths, result)
  return result
}

export async function getDrives(): Promise<DriveInfo[]> {
  return [
    { path: '/', label: 'Root', kind: 'fixed', total: 0, free: 0 },
    { path: HOME, label: 'Home', kind: 'fixed', total: 0, free: 0 },
  ]
}

export async function getHomeDir(): Promise<string> {
  return HOME
}

export async function search(root: string, query: string, recursive: boolean, maxResults = 2000): Promise<SearchResult> {
  const needle = query.toLowerCase()
  const output: FileEntry[] = []
  for (const [dir, entries] of Object.entries(db)) {
    if (output.length >= maxResults) break
    if (recursive && !dir.startsWith(root)) continue
    if (!recursive && dir !== root) continue
    for (const item of entries) {
      if (item.name.toLowerCase().includes(needle)) output.push({ ...item })
    }
  }
  return { entries: output.slice(0, maxResults), truncated: output.length >= maxResults }
}

export async function readFileText(path: string): Promise<FileContent> {
  const found = findEntry(path)
  if (!found) throw new Error(`not found: ${path}`)
  if (found.entry.isDir) throw new Error('path is a directory')
  return {
    path,
    content: `// mock content of ${found.entry.name}\n`,
    truncated: false,
    binary: false,
    size: found.entry.size,
  }
}

export async function writeFileText(path: string, content: string): Promise<FileEntry> {
  const found = findEntry(path)
  if (found) {
    const updated = { ...found.entry, size: content.length }
    db[found.parent][found.index] = updated
    return { ...updated }
  }
  return entry(path.split('/').pop() || 'file.txt', parentOf(path) || HOME, false, content.length)
}

export async function openPath(_path: string): Promise<boolean> {
  return true
}

export async function openWith(_path: string, _command: string): Promise<boolean> {
  return true
}

export async function checksums(paths: string[], algorithm: string): Promise<ChecksumEntry[]> {
  return paths.map((path) => ({
    path,
    algorithm,
    hash: `mock-${path.length.toString(16)}${algorithm}`,
    size: 0,
  }))
}

export async function multiRename(items: RenameItem[]): Promise<OperationResult> {
  let success = 0
  let failed = 0
  for (const item of items) {
    try {
      await renameItem(item.path, item.newName)
      success += 1
    } catch {
      failed += 1
    }
  }
  return { opId: `mock-multi-${Date.now()}`, success, skipped: 0, failed, errors: [], cancelled: false }
}

export async function splitFile(path: string, _partSizeBytes: number, _destDir: string): Promise<SplitResult> {
  return { parts: [`${path}.part001`], total: 1 }
}

export async function combineFiles(_parts: string[], output: string): Promise<CombineResult> {
  return { output, size: 0 }
}

export async function packZip(sources: string[], _destination: string): Promise<OperationResult> {
  return okResult('mock-zip', sources.length)
}

export async function extractZip(_archive: string, _destination: string): Promise<OperationResult> {
  return okResult('mock-unzip', 1)
}

export async function compareDirs(left: string, right: string): Promise<CompareResult> {
  const a = db[left] ?? []
  const b = db[right] ?? []
  const names = [...new Set([...a.map((e) => e.name), ...b.map((e) => e.name)])].sort()
  const entries: CompareEntry[] = names.map((name) => {
    const ea = a.find((e) => e.name === name)
    const eb = b.find((e) => e.name === name)
    if (ea && !eb) return { name, leftPath: ea.path, status: 'onlyLeft', leftSize: ea.size }
    if (!ea && eb) return { name, rightPath: eb.path, status: 'onlyRight', rightSize: eb.size }
    const differs = ea!.isDir !== eb!.isDir || (!ea!.isDir && ea!.size !== eb!.size)
    return {
      name,
      leftPath: ea!.path,
      rightPath: eb!.path,
      status: differs ? 'different' : 'same',
      leftSize: ea!.size,
      rightSize: eb!.size,
    }
  })
  return {
    entries,
    onlyLeft: entries.filter((e) => e.status === 'onlyLeft').length,
    onlyRight: entries.filter((e) => e.status === 'onlyRight').length,
    different: entries.filter((e) => e.status === 'different').length,
    same: entries.filter((e) => e.status === 'same').length,
  }
}

export async function packTar(sources: string[], _destination: string): Promise<OperationResult> {
  return okResult('mock-tar', sources.length)
}

export async function extractTar(_archive: string, _destination: string): Promise<OperationResult> {
  return okResult('mock-untar', 1)
}

export async function extractArchive(_archive: string, _destination: string): Promise<OperationResult> {
  return okResult('mock-extract', 1)
}

export async function extractArchiveEntry(_path: string, _destination: string): Promise<OperationResult> {
  return okResult('mock-archive-extract', 1)
}

export async function syncDirs(_left: string, _right: string, _direction: string): Promise<SyncResult> {
  return { copied: 0, skipped: 0, failed: 0, entries: [], errors: [] }
}

export async function tree(root: string, maxDepth = 3): Promise<TreeResult> {
  const dir = root || HOME
  function build(base: string, depth: number): TreeResult[] {
    const entries = (db[base] ?? []).filter((entry) => entry.isDir)
    return entries.map((entry) => ({
      name: entry.name,
      path: entry.path,
      isDir: true,
      children: depth < maxDepth ? build(entry.path, depth + 1) : null,
    }))
  }
  return {
    name: dir.split('/').filter(Boolean).pop() || dir,
    path: dir,
    isDir: true,
    children: build(dir, 1),
  }
}

// --- Remote filesystems mock ---

const remoteDb: RemoteConnection[] = [
  {
    id: 'demo-ftp',
    name: 'Demo FTP',
    protocol: 'ftp',
    host: 'ftp.example.com',
    port: 21,
    username: 'anonymous',
    secure: false,
    ftpsImplicit: false,
    rootPath: '/',
    createdAt: new Date().toISOString(),
  },
]

export async function remoteList(): Promise<RemoteListResult> {
  return { connections: remoteDb.map((connection) => ({ ...connection })) }
}

export async function remoteSave(
  connection: RemoteConnectionInput,
  _password?: string,
): Promise<RemoteConnection> {
  const existing = remoteDb.find((candidate) => candidate.id === connection.id)
  const saved: RemoteConnection = {
    id: connection.id || `remote-${Date.now()}`,
    name: connection.name,
    protocol: connection.protocol,
    host: connection.host,
    port: connection.port,
    username: connection.username,
    secure: connection.secure,
    ftpsImplicit: connection.ftpsImplicit ?? false,
    rootPath: connection.rootPath || '/',
    createdAt: connection.createdAt || existing?.createdAt || new Date().toISOString(),
  }
  if (existing) Object.assign(existing, saved)
  else remoteDb.push(saved)
  return { ...saved }
}

export async function remoteDeleteConnection(id: string): Promise<{ ok: boolean }> {
  const index = remoteDb.findIndex((candidate) => candidate.id === id)
  if (index >= 0) remoteDb.splice(index, 1)
  return { ok: true }
}

export async function remoteTest(
  _connection: RemoteConnectionInput,
  _password?: string,
): Promise<RemoteTestResult> {
  return { ok: true }
}

export async function remoteConnect(_id: string): Promise<{ ok: boolean }> {
  return { ok: true }
}

export async function remoteDisconnect(_id: string): Promise<{ ok: boolean }> {
  return { ok: true }
}

export async function remoteMkdir(path: string): Promise<FileEntry> {
  return entry(path.split('/').filter(Boolean).pop() || 'folder', path, true)
}

export async function remoteDeleteFiles(paths: string[]): Promise<OperationResult> {
  return okResult('mock-remote-delete', paths.length)
}

export async function remoteRename(path: string, newName: string): Promise<FileEntry> {
  return entry(newName, path, false)
}

export async function remoteDownload(_path: string, destination: string): Promise<RemoteTransferResult> {
  return { destination, size: 0 }
}

export async function remoteUpload(_localPath: string, destination: string): Promise<FileEntry> {
  return entry('uploaded.txt', destination, false)
}

// --- Persistent settings mock (memory only; the stores also keep localStorage) ---

const settingsDb = new Map<string, unknown>()

export async function getSetting(key: string): Promise<unknown> {
  return settingsDb.has(key) ? settingsDb.get(key) : null
}

export async function setSetting(key: string, value: unknown): Promise<{ ok: boolean }> {
  settingsDb.set(key, value)
  return { ok: true }
}

export function onProgress(callback: (update: ProgressUpdate) => void): () => void {
  progressListeners.add(callback)
  return () => progressListeners.delete(callback)
}

export function onCompleted(callback: (result: OperationResult) => void): () => void {
  completedListeners.add(callback)
  return () => completedListeners.delete(callback)
}
