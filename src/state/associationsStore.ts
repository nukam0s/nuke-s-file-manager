import { create } from 'zustand'

import { ipc, isHttpBackend } from '../ipc/client'

const STORAGE_KEY = 'nuke.associations'
const SETTING_KEY = 'associations'
const SAVE_DELAY_MS = 350

export type Associations = Record<string, string>

let saveTimer: ReturnType<typeof setTimeout> | null = null
let touchedBeforeHydration = false

function normalizeExtension(extension: string | null | undefined): string | null {
  if (!extension) return null
  return extension.replace(/^\./, '').toLowerCase()
}

function normalize(value: unknown): Associations {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const result: Associations = {}
  for (const [key, command] of Object.entries(value as Record<string, unknown>)) {
    if (typeof command === 'string') result[key.toLowerCase()] = command
  }
  return result
}

/// Legacy/browser fallback, also used to migrate pre-backend data on first run.
function loadLocal(): Associations {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    return normalize(JSON.parse(raw) as unknown)
  } catch {
    return {}
  }
}

function saveLocal(associations: Associations): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(associations))
  } catch {
    // ignore quota/serialization errors
  }
}

function writeBackend(associations: Associations): void {
  if (!isHttpBackend) return
  void Promise.resolve(ipc.setSetting(SETTING_KEY, associations)).catch(() => {
    // Backend unavailable: localStorage remains the fallback source of truth.
  })
}

function scheduleSave(associations: Associations): void {
  saveLocal(associations)
  if (!isHttpBackend) return
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    saveTimer = null
    writeBackend(associations)
  }, SAVE_DELAY_MS)
}

interface AssociationsState {
  associations: Associations
  getFor: (extension: string | null | undefined) => string | undefined
  set: (extension: string, command: string) => void
  remove: (extension: string) => void
}

export const useAssociationsStore = create<AssociationsState>((set, get) => ({
  associations: loadLocal(),
  getFor: (extension) => {
    const key = normalizeExtension(extension)
    return key ? get().associations[key] : undefined
  },
  set: (extension, command) => {
    const key = normalizeExtension(extension)
    if (!key || !command.trim()) return
    touchedBeforeHydration = true
    const associations = { ...get().associations, [key]: command.trim() }
    scheduleSave(associations)
    set({ associations })
  },
  remove: (extension) => {
    const key = normalizeExtension(extension)
    if (!key || !(key in get().associations)) return
    touchedBeforeHydration = true
    const associations = { ...get().associations }
    delete associations[key]
    scheduleSave(associations)
    set({ associations })
  },
}))

/// Loads associations from the backend once at start; migrates legacy
/// localStorage values when the backend has never stored anything.
export async function hydrateAssociations(): Promise<void> {
  if (!isHttpBackend) return
  try {
    const remote = await ipc.getSetting(SETTING_KEY)
    if (remote && typeof remote === 'object' && !Array.isArray(remote)) {
      if (touchedBeforeHydration) return
      const associations = normalize(remote)
      useAssociationsStore.setState({ associations })
      saveLocal(associations)
      return
    }
    if (remote === null) {
      const local = useAssociationsStore.getState().associations
      if (Object.keys(local).length > 0) {
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
