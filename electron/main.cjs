// Electron main process: hosts the local HTTP backend and renders it in a native window.

// ---------------------------------------------------------------------------
// ELECTRON_RUN_AS_NODE resilience guard
// ---------------------------------------------------------------------------
// Some shells, CI images and endpoint-management agents export
// ELECTRON_RUN_AS_NODE=1 at machine/session level. In that mode the Electron
// binary boots as plain Node: `require('electron')` is no longer intercepted and
// resolves to the npm shim, i.e. a *string* (the binary path) instead of the API
// object. Destructuring `app` then yields undefined and the process dies before
// any window exists — the app "starts and silently disappears".
//
// IMPORTANT: `process.versions.electron` is still populated in Node mode, so it
// cannot be used as the detector. Requiring the module and inspecting the result
// is the only reliable signal.
const ELECTRON_RELAUNCH_SENTINEL = 'NUKE_FM_ELECTRON_RELAUNCH'

function loadElectronApi() {
  try {
    const loaded = require('electron')
    return loaded && typeof loaded === 'object' && loaded.app ? loaded : null
  } catch {
    return null
  }
}

function resolveElectronBinary() {
  try {
    const resolved = require('electron')
    // Node mode: the shim exports the absolute path of the Electron binary.
    if (typeof resolved === 'string' && resolved.length > 0) return resolved
  } catch {
    // Packaged app without node_modules: fall through to the running binary.
  }
  // A packaged build is already running from its Electron executable.
  return process.execPath
}

const electronApi = loadElectronApi()

if (!electronApi) {
  const { spawn } = require('node:child_process')
  const nodePath = require('node:path')

  if (process.env[ELECTRON_RELAUNCH_SENTINEL] === '1') {
    // Second pass still has no Electron API: the relaunch target is not a real
    // Electron runtime. Fail loudly instead of looping forever.
    console.error('[nuke-fm] relaunch did not yield an Electron runtime; aborting.')
    process.exit(1)
  }

  const electronBinary = resolveElectronBinary()
  const childEnv = { ...process.env }
  // NOTE: Electron treats this variable as presence-based, so an empty string
  // would still trigger Node mode — the key must be removed entirely.
  delete childEnv.ELECTRON_RUN_AS_NODE
  childEnv[ELECTRON_RELAUNCH_SENTINEL] = '1'

  // Electron needs the *app root* (the folder holding package.json), i.e. the
  // parent of this `electron/` directory — not __dirname itself.
  const appRoot = nodePath.resolve(__dirname, '..')

  const child = spawn(electronBinary, [appRoot, ...process.argv.slice(2)], {
    env: childEnv,
    detached: false,
    stdio: 'inherit',
    windowsHide: false,
  })

  child.on('error', (error) => {
    console.error('[nuke-fm] failed to relaunch under Electron:', error)
    process.exit(1)
  })

  // App lifetime follows the child so launchers observe a meaningful exit code.
  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal)
      return
    }
    process.exit(code === null ? 0 : code)
  })

  // Stop executing this module; the relaunched child owns the app from here on.
  return
}

const { app, BrowserWindow, Menu } = electronApi

const { createAppServer } = require('../build/server.cjs')

let serverHandle = null

// Single-instance lock: a second launch should quit instead of spawning a
// duplicate server + window.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.whenReady().then(async () => {
    // No application menu (no menu bar, no console surface).
    Menu.setApplicationMenu(null)

    // Start the backend on a random free port; the window origin is the backend URL.
    serverHandle = await createAppServer({ host: '127.0.0.1', port: 0, openBrowser: false })

    const win = new BrowserWindow({
      width: 1280,
      height: 800,
      autoHideMenuBar: true,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
      },
    })

    win.loadURL(serverHandle.url)
  })

  app.on('window-all-closed', () => {
    app.quit()
  })

  app.on('will-quit', (event) => {
    if (!serverHandle) return
    event.preventDefault()
    const { server } = serverHandle
    serverHandle = null
    if (typeof server.closeAllConnections === 'function') server.closeAllConnections()
    server.close(() => app.quit())
  })
}
