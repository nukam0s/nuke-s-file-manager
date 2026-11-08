import { create } from 'zustand'

import type { FileEntry } from '../ipc/types'
import type { PaneSide } from './paneStore'

export type DialogState =
  | { kind: 'mkdir'; side: PaneSide }
  | { kind: 'rename'; side: PaneSide; entry: FileEntry }
  | { kind: 'delete'; side: PaneSide; entries: FileEntry[] }
  | { kind: 'copy'; side: PaneSide; entries: FileEntry[]; destination: string }
  | { kind: 'move'; side: PaneSide; entries: FileEntry[]; destination: string }
  | { kind: 'select'; side: PaneSide; mode: 'select' | 'deselect' }
  | null

interface DialogStore {
  dialog: DialogState
  open: (dialog: NonNullable<DialogState>) => void
  close: () => void
}

export const useDialogStore = create<DialogStore>((set) => ({
  dialog: null,
  open: (dialog) => set({ dialog }),
  close: () => set({ dialog: null }),
}))
