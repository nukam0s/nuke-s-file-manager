// Smoke test for the portable HTTP backend. Usage: FM_URL=... node scripts/smoke.mjs
const base = process.env.FM_URL || 'http://127.0.0.1:18080'

async function getJson(path) {
  const response = await fetch(base + path)
  if (!response.ok) throw new Error(`${path} -> ${response.status}`)
  return response.json()
}

async function postJson(path, body) {
  const response = await fetch(base + path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok) throw new Error(`${path} -> ${response.status}: ${await response.text()}`)
  return response.json()
}

const health = await getJson('/api/health')
const home = await getJson('/api/home')
const drives = await getJson('/api/drives')
const listing = await postJson('/api/list_dir', {
  path: home,
  showHidden: false,
  sort: { field: 'name', dir: 'asc' },
})
const html = await (await fetch(base + '/')).text()

console.log('health          :', JSON.stringify(health))
console.log('home            :', home)
console.log('drives          :', drives.map((drive) => drive.path).join(', '))
console.log('home entries    :', listing.entries.length)
console.log('first entries   :', listing.entries.slice(0, 5).map((entry) => entry.name).join(' | '))
console.log('parent          :', listing.parent)
console.log('backend marker  :', html.includes('__FM_BACKEND__'))

const ok =
  health.ok === true &&
  typeof home === 'string' &&
  Array.isArray(drives) &&
  Array.isArray(listing.entries) &&
  html.includes('__FM_BACKEND__')

console.log(ok ? 'SMOKE TEST: PASS' : 'SMOKE TEST: FAIL')
process.exit(ok ? 0 : 1)
