import { create } from 'zustand'

import { ipc } from '../ipc/client'
import type { FileEntry, SortField, SortOptions } from '../ipc/types'
import { archiveParent, isArchivePath } from '../lib/archivePath'
import { isRemotePath, remoteParent } from '../lib/remotePath'

export type PaneSide = 'left' | 'right'

export interface PaneData {
  path: string
  parent: string | null
  entries: FileEntry[]
  allEntries: FileEntry[]
  filter: string
  selected: Record<string, true>
  cursor: number
  sort: SortOptions
  showHidden: boolean
  loading: boolean
  error: string | null
  tabs: string[]
  activeTab: number
  history: string[]
  historyIndex: number
  viewMode: 'list' | 'tree'
}

interface PaneStore {
  panes: Record<PaneSide, PaneData>
  active: PaneSide
  initialized: boolean
  initializing: boolean
  init: () => Promise<void>
  setActive: (side: PaneSide) => void
  load: (side: PaneSide, path?: string, record?: boolean) => Promise<void>
  reload: (side: PaneSide) => Promise<void>
  navigate: (side: PaneSide, path: string) => Promise<void>
  goUp: (side: PaneSide) => Promise<void>
  goBack: (side: PaneSide) => Promise<void>
  goForward: (side: PaneSide) => Promise<void>
  setSort: (side: PaneSide, field: SortField) => Promise<void>
  toggleHidden: (side: PaneSide) => Promise<void>
  setFilter: (side: PaneSide, filter: string) => void
  setCursor: (side: PaneSide, index: number) => void
  moveCursor: (side: PaneSide, delta: number) => void
  toggleSelect: (side: PaneSide) => void
  toggleSelectPath: (side: PaneSide, path: string) => void
  selectAll: (side: PaneSide) => void
  clearSelection: (side: PaneSide) => void
  invertSelection: (side: PaneSide) => void
  selectByPattern: (side: PaneSide, pattern: string, mode: 'select' | 'deselect') => void
  addTab: (side: PaneSide) => Promise<void>
  closeTab: (side: PaneSide, index: number) => Promise<void>
  switchTab: (side: PaneSide, index: number) => Promise<void>
  toggleView: (side: PaneSide) => void
  selectedEntries: (side: PaneSide) => FileEntry[]
  refreshBoth: () => Promise<void>
}

function emptyPane(path = ''): PaneData {
  return {
    path,
    parent: null,
    entries: [],
    allEntries: [],
    filter: '',
    selected: {},
    cursor: 0,
    sort: { field: 'name', dir: 'asc' },
    showHidden: false,
    loading: false,
    error: null,
    tabs: path ? [path] : [],
    activeTab: 0,
    history: path ? [path] : [],
    historyIndex: 0,
    viewMode: 'list',
  }
}

function applyFilter(entries: FileEntry[], filter: string): FileEntry[] {
  if (!filter) return entries
  const needle = filter.toLowerCase()
  return entries.filter((entry) => entry.name.toLowerCase().includes(needle))
}

function toMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message)
  }
  return String(error)
}

function globToRegExp(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.')
  return new RegExp(`^${escaped}$`, 'i')
}

export const usePaneStore = create<PaneStore>((set, get) => ({
  panes: { left: emptyPane(), right: emptyPane() },
  active: 'left',
  initialized: false,
  initializing: false,

  init: async () => {
    if (get().initialized || get().initializing) return
    set({ initializing: true })
    try {
      const home = await ipc.getHomeDir().catch(() => '/')
      set({ panes: { left: emptyPane(home), right: emptyPane(home) } })
      await Promise.all([get().load('left'), get().load('right')])
      set({ initialized: true })
    } finally {
      set({ initializing: false })
    }
  },

  setActive: (side) => set({ active: side }),

  load: async (side, path, record = false) => {
    const pane = get().panes[side]
    const target = path ?? pane.path
    if (!target) return

    set((state) => ({
      panes: { ...state.panes, [side]: { ...state.panes[side], loading: true, error: null } },
    }))

    try {
      const result = await ipc.listDir(target, pane.showHidden, pane.sort)
      set((state) => {
        const current = state.panes[side]
        const entries = applyFilter(result.entries, current.filter)
        const tabs = current.tabs.slice()
        if (tabs.length === 0) tabs.push(target)
        tabs[current.activeTab] = target

        let history = current.history.slice()
        let historyIndex = current.historyIndex
        if (record) {
          history = history.slice(0, historyIndex + 1)
          if (history[history.length - 1] !== target) history.push(target)
          historyIndex = history.length - 1
        }
        if (history.length === 0) {
          history = [target]
          historyIndex = 0
        }

        return {
          panes: {
            ...state.panes,
            [side]: {
              ...current,
              path: target,
              parent: result.parent,
              allEntries: result.entries,
              entries,
              selected: {},
              cursor: 0,
              loading: false,
              tabs,
              history,
              historyIndex,
            },
          },
        }
      })
    } catch (error) {
      set((state) => ({
        panes: {
          ...state.panes,
          [side]: { ...state.panes[side], loading: false, error: toMessage(error) },
        },
      }))
    }
  },

  reload: async (side) => get().load(side, undefined, false),

  navigate: async (side, path) => get().load(side, path, true),

  goUp: async (side) => {
    const pane = get().panes[side]
    if (isArchivePath(pane.path)) {
      const target = archiveParent(pane.path)
      if (target) await get().load(side, target, true)
      return
    }
    if (isRemotePath(pane.path)) {
      // Inside a connection -> up one level; connection root -> `remote::`; `remote::` -> stop.
      const target = remoteParent(pane.path)
      if (target) await get().load(side, target, true)
      return
    }
    if (pane.parent) await get().load(side, pane.parent, true)
  },

  goBack: async (side) => {
    const pane = get().panes[side]
    if (pane.historyIndex <= 0) return
    const target = pane.history[pane.historyIndex - 1]
    set((state) => ({
      panes: {
        ...state.panes,
        [side]: { ...state.panes[side], historyIndex: pane.historyIndex - 1 },
      },
    }))
    await get().load(side, target, false)
  },

  goForward: async (side) => {
    const pane = get().panes[side]
    if (pane.historyIndex >= pane.history.length - 1) return
    const target = pane.history[pane.historyIndex + 1]
    set((state) => ({
      panes: {
        ...state.panes,
        [side]: { ...state.panes[side], historyIndex: pane.historyIndex + 1 },
      },
    }))
    await get().load(side, target, false)
  },

  setSort: async (side, field) => {
    const pane = get().panes[side]
    const dir = pane.sort.field === field && pane.sort.dir === 'asc' ? 'desc' : 'asc'
    set((state) => ({
      panes: { ...state.panes, [side]: { ...state.panes[side], sort: { field, dir } } },
    }))
    await get().load(side, undefined, false)
  },

  toggleHidden: async (side) => {
    set((state) => ({
      panes: {
        ...state.panes,
        [side]: { ...state.panes[side], showHidden: !state.panes[side].showHidden },
      },
    }))
    await get().load(side, undefined, false)
  },

  setFilter: (side, filter) => {
    set((state) => {
      const pane = state.panes[side]
      const entries = applyFilter(pane.allEntries, filter)
      return {
        panes: { ...state.panes, [side]: { ...pane, filter, entries, cursor: 0 } },
      }
    })
  },

  setCursor: (side, index) => {
    const pane = get().panes[side]
    const clamped = Math.max(0, Math.min(index, pane.entries.length - 1))
    set((state) => ({
      panes: { ...state.panes, [side]: { ...state.panes[side], cursor: clamped } },
    }))
  },

  moveCursor: (side, delta) => {
    const pane = get().panes[side]
    get().setCursor(side, pane.cursor + delta)
  },

  toggleSelect: (side) => {
    const pane = get().panes[side]
    const entry = pane.entries[pane.cursor]
    if (!entry) return
    get().toggleSelectPath(side, entry.path)
    get().moveCursor(side, 1)
  },

  toggleSelectPath: (side, path) => {
    set((state) => {
      const pane = state.panes[side]
      const selected = { ...pane.selected }
      if (selected[path]) delete selected[path]
      else selected[path] = true
      return { panes: { ...state.panes, [side]: { ...pane, selected } } }
    })
  },

  selectAll: (side) => {
    set((state) => {
      const pane = state.panes[side]
      const selected: Record<string, true> = {}
      for (const entry of pane.entries) selected[entry.path] = true
      return { panes: { ...state.panes, [side]: { ...pane, selected } } }
    })
  },

  clearSelection: (side) => {
    set((state) => ({
      panes: { ...state.panes, [side]: { ...state.panes[side], selected: {} } },
    }))
  },

  invertSelection: (side) => {
    set((state) => {
      const pane = state.panes[side]
      const selected: Record<string, true> = {}
      for (const entry of pane.entries) {
        if (!pane.selected[entry.path]) selected[entry.path] = true
      }
      return { panes: { ...state.panes, [side]: { ...pane, selected } } }
    })
  },

  selectByPattern: (side, pattern, mode) => {
    const matcher = globToRegExp(pattern || '*')
    set((state) => {
      const pane = state.panes[side]
      const selected = { ...pane.selected }
      for (const entry of pane.entries) {
        const matches = matcher.test(entry.name)
        if (matches && mode === 'select') selected[entry.path] = true
        if (matches && mode === 'deselect') delete selected[entry.path]
      }
      return { panes: { ...state.panes, [side]: { ...pane, selected } } }
    })
  },

  addTab: async (side) => {
    const pane = get().panes[side]
    set((state) => {
      const tabs = [...state.panes[side].tabs, state.panes[side].path]
      return {
        panes: { ...state.panes, [side]: { ...state.panes[side], tabs, activeTab: tabs.length - 1 } },
      }
    })
    await get().load(side, pane.path, false)
  },

  closeTab: async (side, index) => {
    const pane = get().panes[side]
    if (pane.tabs.length <= 1) return
    const tabs = pane.tabs.filter((_, i) => i !== index)
    let activeTab = pane.activeTab
    if (index < activeTab) activeTab -= 1
    if (activeTab >= tabs.length) activeTab = tabs.length - 1
    set((state) => ({
      panes: { ...state.panes, [side]: { ...state.panes[side], tabs, activeTab } },
    }))
    await get().load(side, tabs[activeTab], false)
  },

  switchTab: async (side, index) => {
    const pane = get().panes[side]
    if (index < 0 || index >= pane.tabs.length) return
    set((state) => ({
      panes: { ...state.panes, [side]: { ...state.panes[side], activeTab: index } },
    }))
    await get().load(side, pane.tabs[index], false)
  },

  toggleView: (side) => {
    set((state) => ({
      panes: {
        ...state.panes,
        [side]: {
          ...state.panes[side],
          viewMode: state.panes[side].viewMode === 'list' ? 'tree' : 'list',
        },
      },
    }))
  },

  selectedEntries: (side) => {
    const pane = get().panes[side]
    return pane.entries.filter((entry) => pane.selected[entry.path])
  },

  refreshBoth: async () => {
    await Promise.all([get().load('left', undefined, false), get().load('right', undefined, false)])
  },
}))
