import type { IpcApi } from './api'
import { httpIpc } from './httpClient'
import { mockIpc } from './mockClient'
import { tauriIpc } from './tauriClient'

export const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

// The portable Node server injects `window.__FM_BACKEND__ = 'http'` into index.html.
export const isHttpBackend =
  typeof window !== 'undefined' && window.__FM_BACKEND__ === 'http'

export const ipc: IpcApi = isTauri ? tauriIpc : isHttpBackend ? httpIpc : mockIpc
