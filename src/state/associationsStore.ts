import { create } from 'zustand'

const STORAGE_KEY = 'nuke.associations'

export type Associations = Record<string, string>

function normalizeExtension(extension: string | null | undefined): string | null {
  if (!extension) return null
  return extension.replace(/^\./, '').toLowerCase()
}

function load(): Associations {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const result: Associations = {}
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value === 'string') result[key.toLowerCase()] = value
    }
    return result
  } catch {
    return {}
  }
}

function persist(associations: Associations): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(associations))
  } catch {
    // ignore quota/serialization errors
  }
}

interface AssociationsState {
  associations: Associations
  getFor: (extension: string | null | undefined) => string | undefined
  set: (extension: string, command: string) => void
  remove: (extension: string) => void
}

export const useAssociationsStore = create<AssociationsState>((set, get) => ({
  associations: load(),
  getFor: (extension) => {
    const key = normalizeExtension(extension)
    return key ? get().associations[key] : undefined
  },
  set: (extension, command) => {
    const key = normalizeExtension(extension)
    if (!key || !command.trim()) return
    const associations = { ...get().associations, [key]: command.trim() }
    persist(associations)
    set({ associations })
  },
  remove: (extension) => {
    const key = normalizeExtension(extension)
    if (!key) return
    const associations = { ...get().associations }
    delete associations[key]
    persist(associations)
    set({ associations })
  },
}))
