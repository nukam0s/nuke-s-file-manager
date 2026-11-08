// Filesystem service for the portable Node backend.
// Pure Node built-ins only, so the whole server can be embedded in a single SEA executable.
import { promises as fs } from 'node:fs'
import fsSync from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function makeError(code, message) {
  const error = new Error(message)
  error.code = code
  return error
}

function validate(input) {
  if (typeof input !== 'string' || input.trim() === '') {
    throw makeError('invalid_path', 'empty path')
  }
  if (input.includes('\0')) {
    throw makeError('invalid_path', 'path contains a null byte')
  }
  return input
}

function guardDestructive(input) {
  validate(input)
  const resolved = path.resolve(input)
  if (path.dirname(resolved) === resolved) {
    throw makeError('invalid_path', 'refusing to operate on a filesystem root')
  }
  return resolved
}

function extensionOf(name) {
  const ext = path.extname(name)
  return ext ? ext.slice(1).toLowerCase() : null
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

async function entryFrom(fullPath) {
  const stat = await fs.lstat(fullPath)
  const name = path.basename(fullPath)
  const isDir = stat.isDirectory()
  return {
    name,
    path: fullPath,
    isDir,
    isSymlink: stat.isSymbolicLink(),
    size: isDir ? 0 : stat.size,
    modified: stat.mtime ? stat.mtime.toISOString() : null,
    extension: isDir ? null : extensionOf(name),
    attributes: isDir ? 'D' : 'A',
  }
}

export async function listDir(inputPath, showHidden = false, sort = { field: 'name', dir: 'asc' }) {
  validate(inputPath)
  const dir = path.resolve(inputPath)

  let dirents
  try {
    dirents = await fs.readdir(dir, { withFileTypes: true })
  } catch (error) {
    throw makeError('io_error', `${inputPath}: ${error.message}`)
  }

  const entries = []
  for (const dirent of dirents) {
    if (!showHidden && dirent.name.startsWith('.')) continue
    try {
      const full = path.join(dir, dirent.name)
      const stat = await fs.lstat(full)
      const isDir = stat.isDirectory()
      entries.push({
        name: dirent.name,
        path: full,
        isDir,
        isSymlink: stat.isSymbolicLink(),
        size: isDir ? 0 : stat.size,
        modified: stat.mtime ? stat.mtime.toISOString() : null,
        extension: isDir ? null : extensionOf(dirent.name),
        attributes: isDir ? 'D' : 'A',
      })
    } catch {
      // Entry disappeared during listing; skip it.
    }
  }

  sortEntries(entries, sort)
  const parentPath = path.dirname(dir)
  return { parent: parentPath === dir ? null : parentPath, entries }
}

export async function getMetadata(inputPath) {
  validate(inputPath)
  try {
    return await entryFrom(path.resolve(inputPath))
  } catch (error) {
    throw makeError('io_error', error.message)
  }
}

export async function readFileText(inputPath) {
  validate(inputPath)
  const target = path.resolve(inputPath)
  const stat = await fs.stat(target)
  if (stat.isDirectory()) throw makeError('io_error', 'path is a directory')

  const maxBytes = 2 * 1024 * 1024
  const readSize = Math.min(stat.size, maxBytes)
  const handle = await fs.open(target, 'r')
  try {
    const buffer = Buffer.alloc(readSize)
    if (readSize > 0) await handle.read(buffer, 0, readSize, 0)
    const sample = buffer.subarray(0, Math.min(4096, buffer.length))
    const binary = sample.includes(0)
    return {
      path: target,
      content: binary ? '' : buffer.toString('utf8'),
      truncated: stat.size > maxBytes,
      binary,
      size: stat.size,
    }
  } finally {
    await handle.close()
  }
}

export async function writeFileText(inputPath, content) {
  validate(inputPath)
  const target = path.resolve(inputPath)
  await fs.writeFile(target, content == null ? '' : String(content), 'utf8')
  return getMetadata(target)
}

async function exists(target) {
  try {
    await fs.lstat(target)
    return true
  } catch {
    return false
  }
}

function uniqueName(destDir, name) {
  const ext = path.extname(name)
  const base = ext ? name.slice(0, -ext.length) : name
  return { destDir, base, ext }
}

async function resolveTarget(destDir, name, policy) {
  const target = path.join(destDir, name)
  if (!(await exists(target))) return { target, skip: false }
  if (policy === 'skip') return { target, skip: true }
  if (policy === 'rename') {
    const { base, ext } = uniqueName(destDir, name)
    for (let index = 1; index < 10000; index += 1) {
      const candidate = path.join(destDir, `${base} (${index})${ext}`)
      if (!(await exists(candidate))) return { target: candidate, skip: false }
    }
  }
  return { target, skip: false }
}

async function controlGate(control, result) {
  if (control && control.cancelled) {
    result.cancelled = true
    return false
  }
  while (control && control.paused && !control.cancelled) {
    await sleep(150)
  }
  if (control && control.cancelled) {
    result.cancelled = true
    return false
  }
  return true
}

export async function copyItems(sources, destination, onProgress, options = {}, control = {}) {
  validate(destination)
  const destDir = path.resolve(destination)
  const policy = options.policy || 'overwrite'
  const result = emptyResult('copy')
  const total = sources.length

  for (let index = 0; index < sources.length; index += 1) {
    if (!(await controlGate(control, result))) break
    const source = sources[index]
    try {
      validate(source)
      const { target, skip } = await resolveTarget(destDir, path.basename(source), policy)
      if (skip) {
        result.skipped += 1
      } else {
        await fs.cp(path.resolve(source), target, { recursive: true, force: true })
        result.success += 1
      }
    } catch (error) {
      result.failed += 1
      result.errors.push({ path: source, message: error.message })
    }
    if (onProgress) onProgress({ opId: result.opId, processed: index + 1, total, current: source })
  }

  return result
}

async function moveOne(source, target) {
  try {
    await fs.rename(source, target)
  } catch (error) {
    if (error.code === 'EXDEV') {
      await fs.cp(source, target, { recursive: true, force: true })
      await fs.rm(source, { recursive: true, force: true })
    } else {
      throw error
    }
  }
}

export async function moveItems(sources, destination, onProgress, options = {}, control = {}) {
  validate(destination)
  const destDir = path.resolve(destination)
  const policy = options.policy || 'overwrite'
  const result = emptyResult('move')
  const total = sources.length

  for (let index = 0; index < sources.length; index += 1) {
    if (!(await controlGate(control, result))) break
    const source = sources[index]
    try {
      validate(source)
      const { target, skip } = await resolveTarget(destDir, path.basename(source), policy)
      if (skip) {
        result.skipped += 1
      } else {
        await moveOne(path.resolve(source), target)
        result.success += 1
      }
    } catch (error) {
      result.failed += 1
      result.errors.push({ path: source, message: error.message })
    }
    if (onProgress) onProgress({ opId: result.opId, processed: index + 1, total, current: source })
  }

  return result
}

async function makeTrashDir() {
  const base = path.join(os.tmpdir(), 'nuke-file-manager-trash')
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const dir = path.join(base, stamp)
  await fs.mkdir(dir, { recursive: true })
  return dir
}

export async function deleteItems(paths, useTrash, onProgress, control = {}) {
  const result = emptyResult('delete')
  const total = paths.length
  const trash = useTrash ? await makeTrashDir() : null

  for (let index = 0; index < paths.length; index += 1) {
    if (!(await controlGate(control, result))) break
    const input = paths[index]
    try {
      const target = guardDestructive(input)
      if (trash) {
        const dest = path.join(trash, `${Date.now()}-${path.basename(target)}`)
        try {
          await fs.rename(target, dest)
        } catch {
          await fs.cp(target, dest, { recursive: true, force: true })
          await fs.rm(target, { recursive: true, force: true })
        }
      } else {
        await fs.rm(target, { recursive: true, force: true })
      }
      result.success += 1
    } catch (error) {
      result.failed += 1
      result.errors.push({ path: input, message: error.message })
    }
    if (onProgress) onProgress({ opId: result.opId, processed: index + 1, total, current: input })
  }

  return result
}

export async function renameItem(inputPath, newName) {
  validate(inputPath)
  const source = path.resolve(inputPath)
  const parent = path.dirname(source)
  if (parent === source) throw makeError('invalid_path', 'cannot rename a filesystem root')
  if (!newName || newName.includes('\0') || newName.includes('/') || newName.includes('\\')) {
    throw makeError('invalid_path', 'invalid new name')
  }

  const target = path.join(parent, newName)
  try {
    await fs.rename(source, target)
    return await getMetadata(target)
  } catch (error) {
    throw makeError('io_error', error.message)
  }
}

export async function createDir(parent, name) {
  validate(parent)
  if (!name || name.includes('\0') || name.includes('/') || name.includes('\\')) {
    throw makeError('invalid_path', 'invalid folder name')
  }
  const target = path.join(path.resolve(parent), name)
  try {
    await fs.mkdir(target, { recursive: true })
    return await getMetadata(target)
  } catch (error) {
    throw makeError('io_error', error.message)
  }
}

export function getHomeDir() {
  return os.homedir()
}

export function getDrives() {
  const drives = []
  if (process.platform === 'win32') {
    for (let code = 65; code <= 90; code += 1) {
      const letter = String.fromCharCode(code)
      const root = `${letter}:\\`
      try {
        if (fsSync.existsSync(root)) {
          drives.push({ path: root, label: `${letter}:`, kind: 'fixed', total: 0, free: 0 })
        }
      } catch {
        // Ignore inaccessible drives.
      }
    }
  } else {
    drives.push({ path: '/', label: 'Root', kind: 'fixed', total: 0, free: 0 })
  }
  return drives
}

function emptyResult(prefix) {
  return {
    opId: `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    success: 0,
    skipped: 0,
    failed: 0,
    errors: [],
    cancelled: false,
  }
}
