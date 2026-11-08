// Exercises real file operations against the running portable backend (uses os tmp dir).
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
const nameA = `nuke-fm-a-${stamp}`
const nameB = `nuke-fm-b-${stamp}`
const nameC = `nuke-fm-c-${stamp}`
const nameD = `nuke-fm-d-${stamp}`

const createdA = await post('/api/create_dir', { parent: tmp, name: nameA })
const renamed = await post('/api/rename_item', { path: createdA.path, newName: nameB })
const createdC = await post('/api/create_dir', { parent: tmp, name: nameC })
const createdD = await post('/api/create_dir', { parent: tmp, name: nameD })

const copied = await post('/api/copy_items', {
  sources: [renamed.path],
  destination: createdC.path,
})
const moved = await post('/api/move_items', {
  sources: [path.join(createdC.path, nameB)],
  destination: createdD.path,
})
const listing = await post('/api/list_dir', {
  path: createdD.path,
  showHidden: false,
  sort: { field: 'name', dir: 'asc' },
})
const deleted = await post('/api/delete_items', {
  paths: [createdA.path, createdC.path, createdD.path],
  useTrash: false,
})

console.log('create_dir   :', createdA.isDir && createdA.name === nameA)
console.log('rename_item  :', renamed.name === nameB)
console.log('copy_items   :', copied.success === 1, `(success=${copied.success}, failed=${copied.failed})`)
console.log('move_items   :', moved.success === 1, `(success=${moved.success}, failed=${moved.failed})`)
console.log('list after   :', listing.entries.map((entry) => entry.name).join(', '))
console.log('delete_items :', deleted.success === 3, `(success=${deleted.success})`)

const ok =
  createdA.isDir &&
  renamed.name === nameB &&
  copied.success === 1 &&
  moved.success === 1 &&
  listing.entries.some((entry) => entry.name === nameB) &&
  deleted.success === 3

console.log(ok ? 'OPS TEST: PASS' : 'OPS TEST: FAIL')
process.exit(ok ? 0 : 1)
