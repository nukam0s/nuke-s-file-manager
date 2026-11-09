# RUN — launching Nuke File Manager from a local build

This document describes how to run the app **from a local checkout**. It is a developer note, not
end-user documentation, and it assumes Windows x64 with Node.js 20+ installed.

> **Distribution status:** the portable `.exe` produced by `npm run build:electron` is **unsigned**.
> On Windows 11 with Smart App Control / WDAC enforced, that binary can be blocked before any of its
> code runs (electron-builder rewrites the PE header, which voids Electron's own signature).
> **Code signing is the outstanding item for real distribution** — see
> [`docs/architecture/09-packaging-signing.md`](docs/architecture/09-packaging-signing.md).

---

## Prerequisites

```bat
npm install
npm run build:electron
```

`npm run build:electron` produces `release\win-unpacked\` (and a portable `.exe` next to it). The
launchers below depend on two artifacts:

- `node_modules\electron\dist\electron.exe` — installed by `npm install`
- `release\win-unpacked\resources\app.asar` — produced by `npm run build:electron`

Both `node_modules/` and `release/` are git-ignored; a fresh clone has neither.

---

## Option A — double-click launcher (dev convenience)

| File | Console window | Notes |
| --- | --- | --- |
| `Iniciar Nuke File Manager.vbs` | none | launches without a console window |
| `Iniciar Nuke File Manager.bat` | brief flash | same behaviour, easier to debug |

These scripts are **local development helpers**, not a distribution format. They run the plain
Electron runtime from `node_modules` against the packaged `app.asar`:

```bat
set "ELECTRON_RUN_AS_NODE="
start "" "node_modules\electron\dist\electron.exe" "release\win-unpacked\resources\app.asar"
```

Why it works: the Electron binary shipped inside `node_modules` is still signed by the Electron
project, so code-integrity policies accept it. Pointing it at the packaged `app.asar` runs the
**same UI and the same backend** as the portable build — a native window, no browser tab, no menu
bar.

Why `set "ELECTRON_RUN_AS_NODE="`: Electron checks that variable by *presence*, so a
defined-but-empty value still boots it as plain Node and the app exits silently. The assignment
above **unsets** it (cmd syntax `set "VAR="`), and the VBScript removes it from the process
environment before spawning.

Both scripts resolve their own directory (`%~dp0`) and therefore work from any checkout location.

The backend listens on a **random free loopback port** (`createAppServer({ port: 0 })`). To find it:

```powershell
$ids = (Get-Process electron).Id
Get-NetTCPConnection -State Listen | Where-Object { $_.OwningProcess -in $ids } |
  Select-Object LocalPort, OwningProcess
```

Closing the window shuts the app down (the server closes on `will-quit`).

---

## Option B — SEA binary (proof of concept only: browser + console)

The legacy Node single-executable build is kept as evidence that a self-contained runtime exists.
It opens a **browser tab and a console window** — it is *not* the intended end-user UI.

```bat
set "FM_NO_OPEN=1"&& set "FM_PORT=18080"&& start "" "build\NukeFileManager.exe"
curl -s http://127.0.0.1:18080/api/health
taskkill /F /IM NukeFileManager.exe
```

It responds `{"ok":true}` on `/api/health`. Build it with `npm run build:sea`; see
[`docs/architecture/07-node-portable.md`](docs/architecture/07-node-portable.md).

---

## If a launcher reports missing files

```bat
npm install                 :: restores node_modules\electron\dist\electron.exe
npm run build:electron      :: rebuilds release\win-unpacked
```

If the portable `.exe` itself is blocked by policy, use Option A — the launchers bypass the block
by design, because they execute the signed Electron runtime rather than the re-packaged binary.

---

## Persisted settings

Hotlist and extension→command associations are stored by the backend in
`%APPDATA%\NukeFileManager\settings\` (`hotlist.json`, `associations.json`), **not** in
`localStorage` — the window origin changes with the random port, so browser storage would be lost on
every restart. `localStorage` is kept only as a fallback (browser dev / Tauri) and as the migration
source for data written by older versions. See
[`docs/architecture/10-settings-persistence.md`](docs/architecture/10-settings-persistence.md) for the
API contract and the two-launch validation procedure.

---

## Other ways to run

```bash
npm run dev          # Vite dev server, in-memory mock filesystem, no backend needed
npm run server       # real Node backend on 127.0.0.1 (random port, URL printed)
npm run electron:dev # build + bundle + open a native Electron window
```

See [`README.md`](README.md#development) for the full script list.
