// Higher-level tools: search (name/content), checksums, multi-rename, split/combine,
// zip, tar, compare, synchronize, tree, open.
import { promises as fs, createReadStream, createWriteStream } from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { once } from 'node:events'
import { spawn } from 'node:child_process'
import AdmZip from 'adm-zip'
import * as tarNs from 'tar'

import { getMetadata } from './fsService.js'

const tar = tarNs.default || tarNs

function makeError(code, message) {
  const error = new Error(message)
  error.code = code
  return error
}

const TEXT_EXT = /\.(txt|md|markdown|json|js|ts|tsx|jsx|css|scss|html?|xml|ya?ml|ini|cfg|conf|log|csv|rs|py|go|java|c|cc|cpp|h|hpp|sh|bat|ps1|env)$/i

export async function search(root, query, recursive = true, maxResults = 2000, options = {}) {
  const base = path.resolve(root)
  const needle = String(query || '').toLowerCase()
  const inContent = Boolean(options && options.inContent)
  const results = []
  let truncated = false

  async function walk(dir) {
    let dirents
    try {
      dirents = await fs.readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const dirent of dirents) {
      if (results.length >= maxResults) {
        truncated = true
        return
      }
      const full = path.join(dir, dirent.name)

      let matched = needle === '' || dirent.name.toLowerCase().includes(needle)
      if (!matched && inContent && !dirent.isDirectory() && TEXT_EXT.test(dirent.name)) {
        try {
          const stat = await fs.stat(full)
          if (stat.size <= 1024 * 1024) {
            const buffer = await fs.readFile(full)
            matched = buffer.toString('utf8').toLowerCase().includes(needle)
          }
        } catch {
          matched = false
        }
      }

      if (matched) {
        try {
          results.push(await getMetadata(full))
        } catch {
          // skip unreadable
        }
      }

      if (recursive && dirent.isDirectory() && !dirent.isSymbolicLink()) {
        await walk(full)
        if (truncated) return
      }
    }
  }

  await walk(base)
  return { entries: results.slice(0, maxResults), truncated }
}

async function hashFile(file, algorithm) {
  const hash = crypto.createHash(algorithm)
  for await (const chunk of createReadStream(file)) hash.update(chunk)
  return hash.digest('hex')
}

export async function checksums(paths, algorithm = 'sha256') {
  const alg = ['md5', 'sha1', 'sha256'].includes(algorithm) ? algorithm : 'sha256'
  const output = []
  for (const input of paths) {
    try {
      const target = path.resolve(input)
      const stat = await fs.stat(target)
      if (stat.isDirectory()) {
        output.push({ path: target, algorithm: alg, hash: '', size: 0, error: 'is a directory' })
        continue
      }
      const hash = await hashFile(target, alg)
      output.push({ path: target, algorithm: alg, hash, size: stat.size })
    } catch (error) {
      output.push({ path: input, algorithm: alg, hash: '', size: 0, error: error.message })
    }
  }
  return output
}

export async function multiRename(items) {
  const result = {
    opId: `multi-${Date.now()}`,
    success: 0,
    skipped: 0,
    failed: 0,
    errors: [],
    cancelled: false,
  }
  for (const item of items) {
    try {
      const source = path.resolve(item.path)
      const parent = path.dirname(source)
      if (parent === source) throw new Error('cannot rename a filesystem root')
      if (!item.newName || /[\\/]/.test(item.newName) || item.newName.includes('\0')) {
        throw new Error('invalid new name')
      }
      await fs.rename(source, path.join(parent, item.newName))
      result.success += 1
    } catch (error) {
      result.failed += 1
      result.errors.push({ path: item.path, message: error.message })
    }
  }
  return result
}

function streamPart(source, outPath, start, end) {
  return new Promise((resolve, reject) => {
    const reader = createReadStream(source, { start, end })
    const writer = createWriteStream(outPath)
    reader.on('error', reject)
    writer.on('error', reject)
    writer.on('finish', resolve)
    reader.pipe(writer)
  })
}

export async function splitFile(inputPath, partSizeBytes, destDir) {
  const source = path.resolve(inputPath)
  const stat = await fs.stat(source)
  const size = Number(partSizeBytes)
  if (!(size > 0)) throw makeError('invalid_path', 'invalid part size')

  const dest = path.resolve(destDir || path.dirname(source))
  await fs.mkdir(dest, { recursive: true })
  const base = path.basename(source)
  const total = Math.max(1, Math.ceil(stat.size / size))
  const parts = []

  for (let index = 0; index < total; index += 1) {
    const outPath = path.join(dest, `${base}.part${String(index + 1).padStart(3, '0')}`)
    const start = index * size
    const end = Math.min(start + size - 1, stat.size - 1)
    await streamPart(source, outPath, start, end)
    parts.push(outPath)
  }

  return { parts, total }
}

export async function combineFiles(parts, output) {
  const outPath = path.resolve(output)
  await fs.mkdir(path.dirname(outPath), { recursive: true })
  const writer = createWriteStream(outPath)

  try {
    for (const part of parts) {
      for await (const chunk of createReadStream(path.resolve(part))) {
        if (!writer.write(chunk)) await once(writer, 'drain')
      }
    }
  } finally {
    writer.end()
  }
  await once(writer, 'finish')
  const stat = await fs.stat(outPath)
  return { output: outPath, size: stat.size }
}

export async function packZip(sources, destination) {
  const zip = new AdmZip()
  const result = emptyOp('zip', sources.length)
  for (const source of sources) {
    try {
      const full = path.resolve(source)
      const stat = await fs.stat(full)
      if (stat.isDirectory()) zip.addLocalFolder(full, path.basename(full))
      else zip.addLocalFile(full)
    } catch (error) {
      result.success -= 1
      result.failed += 1
      result.errors.push({ path: source, message: error.message })
    }
  }
  const dest = path.resolve(destination)
  await fs.mkdir(path.dirname(dest), { recursive: true })
  zip.writeZip(dest)
  return result
}

export async function extractZip(archive, destination) {
  const zip = new AdmZip(path.resolve(archive))
  const dest = path.resolve(destination)
  await fs.mkdir(dest, { recursive: true })
  zip.extractAllTo(dest, true)
  return emptyOp('unzip', zip.getEntries().length)
}

function commonAncestor(paths) {
  if (paths.length === 0) return process.cwd()
  const split = (p) => path.dirname(p).split(path.sep)
  let common = split(paths[0])
  for (const p of paths.slice(1)) {
    const parts = split(p)
    let index = 0
    while (index < common.length && index < parts.length && common[index] === parts[index]) index += 1
    common = common.slice(0, index)
  }
  return common.join(path.sep) || path.sep
}

export async function packTar(sources, destination) {
  const dest = path.resolve(destination)
  await fs.mkdir(path.dirname(dest), { recursive: true })
  const gzip = /\.(tgz|tar\.gz)$/i.test(dest)
  // Store entries relative to their common ancestor so the archive is navigable
  // ("archives as folders") instead of embedding absolute filesystem paths.
  const resolved = sources.map((source) => path.resolve(source))
  const base = commonAncestor(resolved)
  const entries = resolved.map((source) => path.relative(base, source) || path.basename(source))
  await tar.c({ gzip, file: dest, portable: true, cwd: base }, entries)
  return emptyOp('tar', sources.length)
}

export async function extractTar(archive, destination) {
  const dest = path.resolve(destination)
  await fs.mkdir(dest, { recursive: true })
  await tar.x({ file: path.resolve(archive), cwd: dest })
  return emptyOp('untar', 1)
}

async function readDirMap(dir) {
  const resolved = path.resolve(dir)
  const map = new Map()
  const dirents = await fs.readdir(resolved, { withFileTypes: true })
  for (const dirent of dirents) {
    const full = path.join(resolved, dirent.name)
    try {
      const stat = await fs.lstat(full)
      map.set(dirent.name, {
        path: full,
        isDir: stat.isDirectory(),
        size: stat.isDirectory() ? 0 : stat.size,
      })
    } catch {
      // skip
    }
  }
  return map
}

export async function compareDirs(left, right) {
  const a = await readDirMap(left)
  const b = await readDirMap(right)
  const names = [...new Set([...a.keys(), ...b.keys()])].sort()

  const entries = []
  let onlyLeft = 0
  let onlyRight = 0
  let different = 0
  let same = 0

  for (const name of names) {
    const ea = a.get(name)
    const eb = b.get(name)
    if (ea && !eb) {
      onlyLeft += 1
      entries.push({ name, leftPath: ea.path, status: 'onlyLeft', leftSize: ea.size })
    } else if (!ea && eb) {
      onlyRight += 1
      entries.push({ name, rightPath: eb.path, status: 'onlyRight', rightSize: eb.size })
    } else if (ea && eb) {
      const differs = ea.isDir !== eb.isDir || (!ea.isDir && ea.size !== eb.size)
      if (differs) {
        different += 1
        entries.push({
          name,
          leftPath: ea.path,
          rightPath: eb.path,
          status: 'different',
          leftSize: ea.size,
          rightSize: eb.size,
        })
      } else {
        same += 1
        entries.push({ name, leftPath: ea.path, rightPath: eb.path, status: 'same', leftSize: ea.size, rightSize: eb.size })
      }
    }
  }

  return { entries, onlyLeft, onlyRight, different, same }
}

// Copy files missing or with different size from source dir to destination dir (recursive).
export async function syncDirs(left, right, direction = 'leftToRight') {
  const sourceRoot = direction === 'rightToLeft' ? right : left
  const destRoot = direction === 'rightToLeft' ? left : right
  const report = { copied: 0, skipped: 0, failed: 0, entries: [], errors: [] }

  async function walk(srcDir, dstDir) {
    let dirents
    try {
      dirents = await fs.readdir(srcDir, { withFileTypes: true })
    } catch {
      return
    }
    for (const dirent of dirents) {
      const src = path.join(srcDir, dirent.name)
      const dst = path.join(dstDir, dirent.name)
      if (dirent.isDirectory()) {
        try {
          await fs.mkdir(dst, { recursive: true })
        } catch {
          // ignore mkdir errors, continue
        }
        await walk(src, dst)
      } else {
        try {
          const srcStat = await fs.stat(src)
          let needsCopy = true
          try {
            const dstStat = await fs.stat(dst)
            needsCopy = dstStat.size !== srcStat.size
          } catch {
            needsCopy = true
          }
          if (needsCopy) {
            await fs.mkdir(path.dirname(dst), { recursive: true })
            await fs.copyFile(src, dst)
            report.copied += 1
            report.entries.push({ path: dst, action: 'copy' })
          } else {
            report.skipped += 1
          }
        } catch (error) {
          report.failed += 1
          report.errors.push({ path: src, message: error.message })
        }
      }
    }
  }

  await walk(path.resolve(sourceRoot), path.resolve(destRoot))
  return report
}

export async function tree(root, maxDepth = 3) {
  const base = path.resolve(root)

  async function build(dir, depth) {
    let dirents
    try {
      dirents = await fs.readdir(dir, { withFileTypes: true })
    } catch {
      return []
    }
    const nodes = []
    for (const dirent of dirents) {
      if (!dirent.isDirectory() || dirent.isSymbolicLink()) continue
      const full = path.join(dir, dirent.name)
      nodes.push({
        name: dirent.name,
        path: full,
        isDir: true,
        children: depth < maxDepth ? await build(full, depth + 1) : null,
      })
    }
    nodes.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()))
    return nodes
  }

  return {
    name: path.basename(base) || base,
    path: base,
    isDir: true,
    children: await build(base, 1),
  }
}

function runCommand(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: 'ignore' })
    child.on('error', reject)
    child.on('close', (code) =>
      code === 0 ? resolve(true) : reject(new Error(`${cmd} exited with ${code}`)),
    )
  })
}

// Extract zip/tar natively; rar/7z via system 7-Zip/WinRAR when available.
export async function extractArchive(archive, destination) {
  const source = path.resolve(archive)
  const dest = path.resolve(destination)
  await fs.mkdir(dest, { recursive: true })

  if (/\.zip$/i.test(source)) return extractZip(source, dest)
  if (/\.(tar|tgz|tar\.gz)$/i.test(source)) return extractTar(source, dest)

  const ext = path.extname(source).toLowerCase()
  const candidates =
    ext === '.rar'
      ? [
          ['unrar', ['x', '-y', source, `${dest}/`]],
          ['7z', ['x', '-y', `-o${dest}`, source]],
        ]
      : [['7z', ['x', '-y', `-o${dest}`, source]]]

  let lastError = null
  for (const [cmd, args] of candidates) {
    try {
      await runCommand(cmd, args)
      return emptyOp('extract', 1)
    } catch (error) {
      lastError = error
    }
  }
  throw makeError(
    'unsupported_archive',
    `RAR/7z requer 7-Zip ou WinRAR (7z/unrar) no PATH. ${lastError ? lastError.message : ''}`,
  )
}

export function openPath(inputPath) {
  const target = path.resolve(inputPath)
  const platform = process.platform
  let child
  if (platform === 'win32') {
    child = spawn('cmd', ['/c', 'start', '', target], { detached: true, stdio: 'ignore' })
  } else if (platform === 'darwin') {
    child = spawn('open', [target], { detached: true, stdio: 'ignore' })
  } else {
    child = spawn('xdg-open', [target], { detached: true, stdio: 'ignore' })
  }
  child.on('error', () => {})
  child.unref()
  return true
}

// Open the target path with a user-specified program (association by extension).
export function openWith(inputPath, command) {
  const target = path.resolve(inputPath)
  if (!command || typeof command !== 'string') {
    throw makeError('invalid_command', 'empty command')
  }
  const child = spawn(command, [target], { detached: true, stdio: 'ignore' })
  child.on('error', () => {})
  child.unref()
  return true
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
