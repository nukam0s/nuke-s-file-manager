import { create } from 'zustand'

import { ipc, isHttpBackend } from '../ipc/client'

const STORAGE_KEY = 'nuke.hotlist'
const SETTING_KEY = 'hotlist'
const SAVE_DELAY_MS = 350

// Coalesces rapid add/remove clicks into a single backend write.
let saveTimer: ReturnType<typeof setTimeout> | null = null
// If the user changes the list before hydration resolves, the backend snapshot is
// stale: keep the in-memory state (it is already scheduled to be written).
let touchedBeforeHydration = false

function normalize(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
}

/// Legacy/browser fallback. Also used to migrate data written by older versions
/// (before settings moved to the backend) on the first run.
function loadLocal(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return normalize(JSON.parse(raw) as unknown)
  } catch {
    return []
  }
}

function saveLocal(paths: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(paths))
  } catch {
    // ignore quota/serialization errors
  }
}

function writeBackend(paths: string[]): void {
  if (!isHttpBackend) return
  void Promise.resolve(ipc.setSetting(SETTING_KEY, paths)).catch(() => {
    // Backend unavailable: localStorage remains the fallback source of truth.
  })
}

function scheduleSave(paths: string[]): void {
  saveLocal(paths)
  if (!isHttpBackend) return
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    saveTimer = null
    writeBackend(paths)
  }, SAVE_DELAY_MS)
}

interface HotlistState {
  paths: string[]
  add: (path: string) => void
  remove: (path: string) => void
}

export const useHotlistStore = create<HotlistState>((set, get) => ({
  // Synchronous legacy load keeps the first render identical to the old behaviour.
  paths: loadLocal(),
  add: (path) => {
    const trimmed = path.trim()
    if (!trimmed || get().paths.includes(trimmed)) return
    touchedBeforeHydration = true
    const paths = [...get().paths, trimmed]
    scheduleSave(paths)
    set({ paths })
  },
  remove: (path) => {
    const current = get().paths
    if (!current.includes(path)) return
    touchedBeforeHydration = true
    const paths = current.filter((item) => item !== path)
    scheduleSave(paths)
    set({ paths })
  },
}))

/// Loads the authoritative list from the backend once, at application start.
/// - Backend has data  -> adopt it (and refresh the localStorage fallback).
/// - Backend is empty  -> migrate any legacy localStorage entries.
/// - Backend fails (dev mock / Tauri) -> keep the localStorage-backed state.
export async function hydrateHotlist(): Promise<void> {
  if (!isHttpBackend) return
  try {
    const remote = await ipc.getSetting(SETTING_KEY)
    if (Array.isArray(remote)) {
      if (touchedBeforeHydration) return
      const paths = normalize(remote)
      useHotlistStore.setState({ paths })
      saveLocal(paths)
      return
    }
    if (remote === null) {
      const local = useHotlistStore.getState().paths
      if (local.length > 0) {
        if (saveTimer) {
          clearTimeout(saveTimer)
          saveTimer = null
        }
        writeBackend(local)
      }
    }
  } catch {
    // Keep whatever localStorage supplied.
  }
}
