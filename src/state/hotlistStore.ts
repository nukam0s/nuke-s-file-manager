import { create } from 'zustand'

const STORAGE_KEY = 'nuke.hotlist'

function load(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string')
      : []
  } catch {
    return []
  }
}

function persist(paths: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(paths))
  } catch {
    // ignore quota/serialization errors
  }
}

interface HotlistState {
  paths: string[]
  add: (path: string) => void
  remove: (path: string) => void
}

export const useHotlistStore = create<HotlistState>((set, get) => ({
  paths: load(),
  add: (path) => {
    const trimmed = path.trim()
    if (!trimmed || get().paths.includes(trimmed)) return
    const paths = [...get().paths, trimmed]
    persist(paths)
    set({ paths })
  },
  remove: (path) => {
    const paths = get().paths.filter((item) => item !== path)
    persist(paths)
    set({ paths })
  },
}))
