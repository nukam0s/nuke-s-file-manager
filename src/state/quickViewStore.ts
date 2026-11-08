import { create } from 'zustand'

import type { FileEntry } from '../ipc/types'

interface QuickViewState {
  open: boolean
  entry: FileEntry | null
  toggle: (entry?: FileEntry | null) => void
  close: () => void
}

export const useQuickViewStore = create<QuickViewState>((set) => ({
  open: false,
  entry: null,
  toggle: (entry) =>
    set((state) =>
      state.open
        ? { open: false, entry: null }
        : { open: true, entry: entry ?? state.entry },
    ),
  close: () => set({ open: false, entry: null }),
}))
