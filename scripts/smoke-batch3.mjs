// Exercises batch-3 features: content search, conflict policy, sync, TAR, tree, control.
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
const work = await post('/api/create_dir', { parent: tmp, name: `nuke-b3-${stamp}` })
const dirA = await post('/api/create_dir', { parent: work.path, name: 'A' })
const dirB = await post('/api/create_dir', { parent: work.path, name: 'B' })
const fileA = await post('/api/write_file', {
  path: path.join(dirA.path, 'alpha.txt'),
  content: 'hello CONTENT marker inside',
})

const contentSearch = await post('/api/search', {
  root: work.path,
  query: 'marker',
  recursive: true,
  inContent: true,
})
const nameSearch = await post('/api/search', {
  root: work.path,
  query: 'alpha',
  recursive: true,
})

const skip = await post('/api/copy_items', {
  sources: [fileA.path],
  destination: dirA.path,
  options: { policy: 'skip' },
})
const rename = await post('/api/copy_items', {
  sources: [fileA.path],
  destination: dirA.path,
  options: { policy: 'rename' },
})
const listA = await post('/api/list_dir', {
  path: dirA.path,
  showHidden: false,
  sort: { field: 'name', dir: 'asc' },
})

const sync = await post('/api/sync', { left: dirA.path, right: dirB.path, direction: 'leftToRight' })
const listB = await post('/api/list_dir', {
  path: dirB.path,
  showHidden: false,
  sort: { field: 'name', dir: 'asc' },
})

const tarDest = path.join(work.path, 'pack.tar.gz')
const tarPack = await post('/api/tar', { sources: [fileA.path], destination: tarDest })
const tarOut = path.join(work.path, 'tarout')
const tarExtract = await post('/api/untar', { archive: tarDest, destination: tarOut })

const tree = await post('/api/tree', { root: work.path, maxDepth: 2 })

const rawRes = await fetch(`${base}/api/raw?path=${encodeURIComponent(fileA.path)}`)
const rawText = await rawRes.text()

const pause = await post('/api/pause', {})
const resume = await post('/api/resume', {})
const cancel = await post('/api/cancel', {})

const cleanup = await post('/api/delete_items', { paths: [work.path], useTrash: false })

console.log('content search :', contentSearch.entries.map((e) => e.name).join(', '))
console.log('name search    :', nameSearch.entries.map((e) => e.name).join(', '))
console.log('copy skip      :', `success=${skip.success} skipped=${skip.skipped}`)
console.log('copy rename    :', `success=${rename.success}`)
console.log('list A         :', listA.entries.map((e) => e.name).join(', '))
console.log('sync           :', `copied=${sync.copied} skipped=${sync.skipped} failed=${sync.failed}`)
console.log('list B         :', listB.entries.map((e) => e.name).join(', '))
console.log('tar pack       :', tarPack.success === 1)
console.log('tar extract    :', tarExtract.success >= 1)
console.log('tree children  :', Array.isArray(tree.children) ? tree.children.map((n) => n.name).join(', ') : 'n/a')
console.log('raw (thumb)    :', rawRes.ok, rawText.includes('marker'))
console.log('control        :', `pause=${pause.paused} resume=${resume.paused} cancel=${cancel.cancelled}`)
console.log('cleanup        :', cleanup.success === 1)

const ok =
  contentSearch.entries.some((e) => e.name === 'alpha.txt') &&
  skip.skipped === 1 &&
  rename.success === 1 &&
  listA.entries.length >= 2 &&
  sync.copied >= 1 &&
  listB.entries.length >= 1 &&
  tarPack.success === 1 &&
  tarExtract.success >= 1 &&
  Array.isArray(tree.children) &&
  rawRes.ok &&
  rawText.includes('marker') &&
  pause.paused === true &&
  resume.paused === false &&
  cancel.cancelled === true &&
  cleanup.success === 1

console.log(ok ? 'BATCH3 TEST: PASS' : 'BATCH3 TEST: FAIL')
process.exit(ok ? 0 : 1)
