// Exercises "archives as folders": create a ZIP/TAR, list inside it via `zip::`/`tar::`,
// read an entry, and extract an entry back to disk. Run against the portable backend:
//   node server/main.js           (in another terminal)
//   node scripts/smoke-archive.mjs
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

function listDir(target) {
  return post('/api/list_dir', { path: target, showHidden: false, sort: { field: 'name', dir: 'asc' } })
}

const tmp = os.tmpdir()
const stamp = Date.now()
const work = await post('/api/create_dir', { parent: tmp, name: `nuke-fm-archive-${stamp}` })
const sub = await post('/api/create_dir', { parent: work.path, name: 'sub' })

const alpha = await post('/api/write_file', {
  path: path.join(work.path, 'alpha.txt'),
  content: 'hello from inside the archive',
})
const beta = await post('/api/write_file', {
  path: path.join(sub.path, 'beta.txt'),
  content: 'nested entry',
})

// --- ZIP ---
const zipPath = path.join(work.path, 'pack.zip')
await post('/api/zip', { sources: [alpha.path, sub.path], destination: zipPath })
const zipRoot = `zip::${zipPath}::`
const zipSub = `zip::${zipPath}::sub`
const zipAlpha = `zip::${zipPath}::alpha.txt`

const zipListing = await listDir(zipRoot)
const zipSubListing = await listDir(zipSub)
const zipRead = await post('/api/read_file', { path: zipAlpha })
const zipMeta = await post('/api/get_metadata', { path: zipAlpha })
const zipRaw = await fetch(`${base}/api/raw?path=${encodeURIComponent(zipAlpha)}`).then((r) => r.text())

const outDir = path.join(work.path, 'out')
const zipExtract = await post('/api/archive_extract', { path: zipAlpha, destination: outDir })
const outListing = await listDir(outDir)

// --- TAR.GZ ---
const tarPath = path.join(work.path, 'pack.tar.gz')
await post('/api/tar', { sources: [alpha.path, sub.path], destination: tarPath })
const tarRoot = `tar::${tarPath}::`
const tarAlpha = `tar::${tarPath}::alpha.txt`

const tarListing = await listDir(tarRoot)
const tarRead = await post('/api/read_file', { path: tarAlpha })
const tarExtract = await post('/api/archive_extract', { path: tarAlpha, destination: path.join(work.path, 'out-tar') })
const outTarListing = await listDir(path.join(work.path, 'out-tar'))

const cleanup = await post('/api/delete_items', { paths: [work.path], useTrash: false })

console.log('zip list root :', zipListing.entries.map((e) => `${e.name}${e.isDir ? '/' : ''}`).join(', '))
console.log('zip list sub  :', zipSubListing.entries.map((e) => e.name).join(', '))
console.log('zip read      :', zipRead.content === 'hello from inside the archive')
console.log('zip meta      :', zipMeta.name === 'alpha.txt' && !zipMeta.isDir)
console.log('zip raw       :', zipRaw === 'hello from inside the archive')
console.log('zip extract   :', `success=${zipExtract.success}`)
console.log('zip out list  :', outListing.entries.map((e) => e.name).join(', '))
console.log('tar list root :', tarListing.entries.map((e) => `${e.name}${e.isDir ? '/' : ''}`).join(', '))
console.log('tar read      :', tarRead.content === 'hello from inside the archive')
console.log('tar extract   :', `success=${tarExtract.success}`)
console.log('tar out list  :', outTarListing.entries.map((e) => e.name).join(', '))
console.log('cleanup       :', cleanup.success === 1)

const ok =
  zipListing.entries.some((e) => e.name === 'alpha.txt' && !e.isDir) &&
  zipListing.entries.some((e) => e.name === 'sub' && e.isDir) &&
  zipSubListing.entries.some((e) => e.name === 'beta.txt') &&
  zipRead.content === 'hello from inside the archive' &&
  zipMeta.name === 'alpha.txt' &&
  zipRaw === 'hello from inside the archive' &&
  zipExtract.success >= 1 &&
  outListing.entries.some((e) => e.name === 'alpha.txt') &&
  tarListing.entries.some((e) => e.name === 'alpha.txt' && !e.isDir) &&
  tarListing.entries.some((e) => e.name === 'sub' && e.isDir) &&
  tarRead.content === 'hello from inside the archive' &&
  tarExtract.success >= 1 &&
  outTarListing.entries.some((e) => e.name === 'alpha.txt') &&
  cleanup.success === 1

console.log(ok ? 'ARCHIVE TEST: PASS' : 'ARCHIVE TEST: FAIL')
process.exit(ok ? 0 : 1)
