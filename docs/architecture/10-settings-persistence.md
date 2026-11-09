# Settings persistence (hotlist / extension associations)

## Problem

The Electron window is loaded from `http://127.0.0.1:<random port>/`. `localStorage` is scoped per
origin (scheme + host + **port**), so anything written there is thrown away on the next launch —
the port changes every time. Historically the hotlist and the extension→command associations lived
only in `localStorage` (`nuke.hotlist`, `nuke.associations`), which is why both reset on restart.

The random port is intentional (defence against other local processes guessing the UI/API origin)
and was **not** changed.

## Solution

Both values are now persisted by the portable Node backend next to the remote credential vault:

```
%APPDATA%/NukeFileManager/settings/hotlist.json
%APPDATA%/NukeFileManager/settings/associations.json
```

`FM_SETTINGS_DIR` overrides that directory (tests/portable runs). `FM_VAULT_DIR` is unrelated and
still controls only the remote-connection vault.

### Backend

- [`server/settingsService.js`](../../server/settingsService.js)
  - `sanitizeKey(key)` — trim + lowercase, then require `^[a-z0-9_-]{1,64}$`; anything else throws
    `invalid_key` (so `key` can never escape the settings directory).
  - `getSetting(key)` — returns the parsed JSON value, or `null` when the file is missing/unreadable
    or corrupt (a corrupt file never breaks startup).
  - `setSetting(key, value)` — atomic write: temp file in the same directory, then `rename`
    (with a direct-write fallback for Windows AV/indexer locks).
- Routes in [`server/main.js`](../../server/main.js):
  - `GET /api/settings?key=<key>` → `{ "value": <json|null> }`
  - `POST /api/settings` `{ "key": "...", "value": ... }` → `{ "ok": true }`
  - invalid/missing key → `400 {"code":"invalid_key","message":"..."}`

### Frontend

- Contract: `getSetting(key): Promise<unknown>` (value or `null`) and
  `setSetting(key, value): Promise<{ ok: boolean }>` in
  [`src/ipc/api.ts`](../../src/ipc/api.ts) and [`src/ipc/types.ts`](../../src/ipc/types.ts).
- Implementations: `httpClient` (real routes), `mock`/`mockClient` (in-memory), `tauriClient`
  (`notSupported`, like the other portable-only features).
- Stores ([`src/state/hotlistStore.ts`](../../src/state/hotlistStore.ts),
  [`src/state/associationsStore.ts`](../../src/state/associationsStore.ts)):
  - the initial state is still loaded **synchronously** from `localStorage`, so the first render is
    unchanged and components keep using the stores synchronously;
  - `hydrateHotlist()` / `hydrateAssociations()` run once from `App.tsx`; when the backend answers,
    `setState` replaces the state and re-renders subscribers;
  - every mutation updates the state immediately, refreshes the `localStorage` fallback and
    schedules a backend write with a 350 ms debounce (rapid add/remove clicks collapse into one write);
  - **migration**: if the backend has no value (`null`) and `localStorage` still holds data from an
    older version, that data is written to the backend on the first launch;
  - **race guard**: if the user changes the list before hydration resolves, the stale backend
    snapshot is ignored;
  - **fallback**: in browser dev (mock client), in Tauri, or if `getSetting` fails, `localStorage`
    remains the source of truth.

## How to validate persistence across two launches (two different ports)

The setting files live outside the browser origin, so the port is irrelevant. Reproduce with the
plain backend:

```bat
:: launch #1
set "FM_PORT=18090" && set "FM_NO_OPEN=1" && node server/main.js
:: in another terminal — write + read
node -e "const b='http://127.0.0.1:18090';const p=async(k,v)=>await (await fetch(b+'/api/settings',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({key:k,value:v})})).json();const g=async(k)=>await (await fetch(b+'/api/settings?key='+k)).json();(async()=>{console.log(await p('hotlist',['D:/Projects']));console.log(await g('hotlist'));})()"
type "%APPDATA%\NukeFileManager\settings\hotlist.json"

:: stop launch #1, then launch #2 on a DIFFERENT port
set "FM_PORT=18091" && set "FM_NO_OPEN=1" && node server/main.js
node -e "(async()=>{const r=await (await fetch('http://127.0.0.1:18091/api/settings?key=hotlist')).json();console.log(r.value);})()"
```

Expected: launch #2 prints the same list even though the origin changed. In the real app the same
happens transparently: add an entry to the hotlist (or save an "open with" association), close the
window, reopen it — the entry is still there.

## Verified

- `npm run typecheck` → 0 errors.
- `node --check server/main.js server/settingsService.js` → 0 errors.
- `POST`/`GET` round-trip and the JSON files under `%APPDATA%\NukeFileManager\settings\` confirmed.
- Invalid keys (`../evil`, `..%2F..%2Fevil`) → `400 invalid_key` for both methods.
- Two consecutive launches on ports 18090 and 18091 returned identical values.
- `scripts/smoke*.mjs` → all PASS (health, archive, batch3, ops, remote, tools).
- `npm run build:electron` → `release/Nuke File Manager 0.4.0.exe` rebuilt; the bundled
  `build/server.cjs` contains the `/api/settings` routes.

## Known limits (honest)

- Writes are debounced by 350 ms: if the app is killed within that window right after a change, the
  last change may not reach disk (the `localStorage` fallback still has it for that session).
- `localStorage` is still written on every change as a fallback; it is simply no longer authoritative
  when the backend is reachable.
- No automated test asserts the restart behaviour yet — the check is the manual two-launch procedure
  above. A future `scripts/smoke-settings.mjs` could automate it.
