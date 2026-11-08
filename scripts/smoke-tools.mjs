// Exercises the new tool endpoints against the running portable backend.
import os from 'node:os'
import path from 'node:path'

const base = process.env.FM_URL || 'http://127.0.0.1:18080'

async function post(pathname, body) {
  const response = await fetch(base + pathname, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok) throw new Error(`${pathname} -> ${response.status}: ${await response.text()}`)
  return response.json()
}

const tmp = os.tmpdir()
const stamp = Date.now()
const root = await post('/api/create_dir', { parent: tmp, name: `nuke-fm-tools-${stamp}` })

const file1 = await post('/api/write_file', {
  path: path.join(root.path, 'alpha.txt'),
  content: 'hello world',
})
const file2 = await post('/api/write_file', {
  path: path.join(root.path, 'beta.txt'),
  content: 'second file',
})

const read = await post('/api/read_file', { path: file1.path })
const hashes = await post('/api/checksums', {
  paths: [file1.path, file2.path],
  algorithm: 'sha256',
})
const found = await post('/api/search', { root: root.path, query: '.txt', recursive: true })

const zipPath = path.join(root.path, 'pack.zip')
const zip = await post('/api/zip', { sources: [file1.path], destination: zipPath })
const extractDir = path.join(root.path, 'extract')
const unzip = await post('/api/unzip', { archive: zipPath, destination: extractDir })
const extracted = await post('/api/list_dir', {
  path: extractDir,
  showHidden: false,
  sort: { field: 'name', dir: 'asc' },
})

const split = await post('/api/split', {
  path: file1.path,
  partSizeBytes: 4,
  destDir: path.join(root.path, 'parts'),
})
const combine = await post('/api/combine', {
  parts: split.parts,
  output: path.join(root.path, 'rejoined.txt'),
})

const multi = await post('/api/multi_rename', {
  items: [{ path: file2.path, newName: 'beta-renamed.txt' }],
})
const compare = await post('/api/compare', { left: root.path, right: extractDir })
const cleanup = await post('/api/delete_items', { paths: [root.path], useTrash: false })

console.log('read_file     :', read.content === 'hello world', `(bytes=${read.size})`)
console.log('checksums     :', hashes.map((h) => `${h.algorithm}:${h.hash.length}`).join(', '))
console.log('search        :', found.entries.map((e) => e.name).join(', '))
console.log('zip           :', zip.success === 1, `(success=${zip.success})`)
console.log('unzip         :', unzip.success >= 1, `(success=${unzip.success})`)
console.log('extracted     :', extracted.entries.map((e) => e.name).join(', '))
console.log('split         :', split.total, 'parte(s)')
console.log('combine       :', combine.size, 'bytes')
console.log('multi_rename  :', multi.success === 1)
console.log('compare       :', `onlyLeft=${compare.onlyLeft} onlyRight=${compare.onlyRight} different=${compare.different} same=${compare.same}`)
console.log('cleanup       :', cleanup.success === 1)

const ok =
  read.content === 'hello world' &&
  hashes.every((h) => h.hash.length === 64) &&
  found.entries.some((e) => e.name === 'alpha.txt') &&
  zip.success === 1 &&
  unzip.success >= 1 &&
  extracted.entries.some((e) => e.name === 'alpha.txt') &&
  split.total >= 1 &&
  combine.size > 0 &&
  multi.success === 1 &&
  typeof compare.different === 'number' &&
  cleanup.success === 1

console.log(ok ? 'TOOLS TEST: PASS' : 'TOOLS TEST: FAIL')
process.exit(ok ? 0 : 1)
