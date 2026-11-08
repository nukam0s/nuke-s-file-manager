import { create } from 'zustand'

import type { FileEntry } from '../ipc/types'
import type { PaneSide } from './paneStore'

interface ContextMenuState {
  side: PaneSide
  entry: FileEntry | null
  x: number
  y: number
  open: (side: PaneSide, entry: FileEntry, x: number, y: number) => void
  close: () => void
}

export const useContextMenuStore = create<ContextMenuState>((set) => ({
  side: 'left',
  entry: null,
  x: 0,
  y: 0,
  open: (side, entry, x, y) => set({ side, entry, x, y }),
  close: () => set({ entry: null }),
}))
