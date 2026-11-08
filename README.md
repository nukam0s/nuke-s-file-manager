# Nuke File Manager

A **dual-pane, keyboard-first file manager** inspired by [Total Commander](https://www.ghisler.com/),
shipped as a **portable native Electron app** for Windows (single `.exe`, no browser, no console).

> Feature coverage vs. Total Commander: [`docs/total-commander-parity.md`](docs/total-commander-parity.md).

---

## Features (v0.4)

- Two panes, **tabs**, **history**, **quick filter**, **tree view**, **drag & drop**.
- Virtualized list, sortable columns, **image thumbnails**, hidden toggle.
- File ops: copy, move, rename, new folder, delete (app trash), with **conflict policy**
  (overwrite / skip / rename) and **pause / resume / cancel**.
- **Search** by name and **by file content** (`Alt+F7`).
- **Viewer (F3)**, **open with default app (F4)**.
- **Checksums**, **ZIP**, **TAR**, **extract** (ZIP/TAR native; RAR/7z via system 7-Zip/WinRAR),
  **multi-rename**, **split/combine**, **compare** and **synchronize** directories.
- **Quick view (`Ctrl+Q`)** — preview the selected file (text via `/api/read_file`, images via `/api/raw`).
- **Hotlist (`Ctrl+D`)** — bookmark the current path; jump/remove from the ★ Favoritos menu.
- **Context menu + associations** — right-click (Open, View, Rename, Delete, Copy path,
  Properties, **Open with…**); persistent per-extension "open with" programs.
- **Archives as folders** — browse inside ZIP and TAR (incl. `.tar.gz`/`.tgz`) without extracting.
- **FTP / FTPS / SFTP / WebDAV** — remote connectors + "Rede" panel; credentials encrypted
  (AES-256-GCM).
- **Plugins (WCX/WDX/WFX): out of scope** for the portable MVP (no third-party DLL/binary hosting).

## Run the app

This repository ships **source only** — the compiled artifacts (`build/`, `release/`, `dist/`,
`server/assets.generated.js`) are generated locally and are **not versioned**.

1. Build the portable app (see [Build](#build)) — output lands in `release/`.
2. Double-click `release/Nuke File Manager <version>.exe`.
3. A native window opens — **no browser, no console** — with the UI served by the embedded backend
   at `http://127.0.0.1:<port>/` (random free loopback port).

### ⚠️ The `.exe` is unsigned

The portable executable is produced by `electron-builder` **without a code-signing certificate**.
electron-builder rewrites the PE header, which voids the signature that Electron's own binary
carries, so the result is untrusted on a clean Windows install:

- **SmartScreen** may show *"Windows protected your PC"* → *More info* → *Run anyway*.
- **Smart App Control / WDAC** (Windows 11, enforced on some corporate or fresh installs) may block
  it outright, with no override in the UI.
- Some AV/EDR products will quarantine it on first run.

**Code signing is the outstanding item for real distribution.** Until a certificate is available,
treat the `.exe` as a local build artifact, not a release. See
[`docs/architecture/09-packaging-signing.md`](docs/architecture/09-packaging-signing.md).

Notes: portable Electron app (~105 MB unpacked), deletion goes to an app trash in temp
(recoverable).

## Build

Requirements: **Node.js 20+** (LTS) and npm on Windows x64.

```bash
npm install
npm run build:electron   # -> release/Nuke File Manager <version>.exe
```

Pipeline: React build (`npm run build`) → embed assets + bundle server
([`scripts/bundle-server.mjs`](scripts/bundle-server.mjs): generates `server/assets.generated.js` +
`build/server.cjs`) → `electron-builder --win portable` → `release/Nuke File Manager <version>.exe`.

Everything under `build/`, `release/`, `dist/` and `server/assets.generated.js` is **generated** and
ignored by git — delete them at any time and re-run the build.

See [`docs/architecture/08-electron.md`](docs/architecture/08-electron.md) for the full Electron
packaging details.

Legacy alternative: `npm run build:sea` still produces `build/NukeFileManager.exe` (Node SEA) — see
[`docs/architecture/07-node-portable.md`](docs/architecture/07-node-portable.md).

## Development

```bash
npm install
npm run dev          # Vite dev server with in-memory mock filesystem
npm run typecheck    # tsc --noEmit
npm test             # Vitest
npm run build        # type-check + production frontend build
npm run server       # run the real Node backend (node server/main.js)
npm run electron:dev # native Electron window (build + bundle + electron .)
```

The backend binds to `127.0.0.1` on a random free port and prints the URL on startup.

### Windows launcher scripts (this-machine dev helpers)

`Iniciar Nuke File Manager.vbs` and `Iniciar Nuke File Manager.bat` are **convenience wrappers for
local development only** — they are *not* a distribution mechanism and are not needed by end users.

They start the plain Electron runtime from `node_modules/electron/dist/electron.exe` against the
packaged `release/win-unpacked/resources/app.asar`. That runtime is still signed by the Electron
project, so it bypasses the WDAC/Smart App Control block that affects the unsigned portable `.exe`.
Both require a prior `npm install` **and** `npm run build:electron`; see [`RUN.md`](RUN.md).

## Smoke tests (against a running backend)

Run against the Node backend (`node server/main.js`) or the bundle:

```bash
set FM_NO_OPEN=1&set FM_PORT=18080&node server\main.js
node scripts/smoke.mjs && node scripts/smoke-ops.mjs && node scripts/smoke-tools.mjs && node scripts/smoke-batch3.mjs && node scripts/smoke-archive.mjs && node scripts/smoke-remote.mjs
```

## Keyboard shortcuts

| Key | Action |
|---|---|
| `Tab` | Toggle active pane |
| `↑` `↓` `Home` `End` | Move cursor |
| `Space` | Toggle selection (and advance) |
| `Ctrl+A` / `Ctrl+I` / `*` | Select all / invert |
| `+` / `-` | Select / deselect by pattern |
| `Ctrl+H` | Toggle hidden |
| `Enter` / `Backspace` | Open directory / go up |
| `Ctrl+\` | Root |
| `Alt+←` / `Alt+→` | History back / forward |
| `Ctrl+T` / `Ctrl+W` | New / close tab |
| `Alt+F7` | Search (name or content) |
| `F3` / `F4` | View / open with default app |
| `F5` / `F6` | Copy / Move to other pane |
| `F7` / `F2` | New folder / rename |
| `F8` / `Delete` | Delete (app trash) |
| `Ctrl+Q` | Toggle quick view / preview |
| `Ctrl+D` | Add current path to favorites |
| Right-click | Context menu (open / view / rename / delete / copy path / open with…) |

> Remote connections panel: toolbar button **Rede** (no dedicated keyboard shortcut).

## Project structure

```text
electron/             Electron main process (native window, single-instance lock)
  main.cjs            creates the window, starts the backend on a random port, loads it
server/               Portable Node backend
  main.js             HTTP server, routes, SSE, /api/raw, createAppServer()
  fsService.js        fs ops + conflict policy + pause/cancel
  toolsService.js     search, checksums, zip/tar, split, compare, sync, tree, extract, open, open-with
  archiveService.js   archives-as-folders (ZIP/TAR virtual paths)
  remoteService.js    FTP/FTPS/SFTP/WebDAV + encrypted credential vault
scripts/              build-sea + bundle-server + smoke tests
  bundle-server.mjs   embeds dist assets + bundles server -> build/server.cjs
src/                  React frontend (tabs, tools, tree, dnd, stores, ipc)
src-tauri/            Optional native Tauri backend (Rust, legacy)
build/                [generated, git-ignored] legacy SEA artifacts
release/              [generated, git-ignored] Electron output
docs/                 architecture + Total Commander parity
```

Only `electron/`, `server/`, `scripts/`, `src/`, `src-tauri/`, `docs/` and the root config files are
versioned.

## Security

Backend binds to `127.0.0.1`; paths validated; destructive ops refuse roots; delete defaults to a
recoverable app trash. Remote credentials are stored encrypted (AES-256-GCM) in a local vault; no
secrets hardcoded.

The vault (`vault.json` + `vault.key`) lives outside the repository (under `%APPDATA%`) and is
additionally git-ignored, together with `.env*`, certificates and private keys.

See [`docs/architecture/08-electron.md`](docs/architecture/08-electron.md) (packaging) and
[`docs/architecture/07-node-portable.md`](docs/architecture/07-node-portable.md) (backend/SEA).

## License

Released under the [MIT License](LICENSE) — Copyright (c) 2026 Nuke File Manager contributors.

The license can be changed by the maintainers if a different model is preferred; if so, update
`LICENSE` and this section together.
