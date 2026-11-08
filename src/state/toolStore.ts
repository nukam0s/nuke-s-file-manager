import { create } from 'zustand'

import type { FileEntry } from '../ipc/types'
import type { PaneSide } from './paneStore'

export type ArchiveFormat = 'zip' | 'tar'

export type Tool =
  | { kind: 'search'; side: PaneSide; root: string }
  | { kind: 'viewer'; path: string }
  | { kind: 'checksum'; paths: string[] }
  | { kind: 'zip'; sources: string[]; defaultName: string; basePath: string; format: ArchiveFormat }
  | { kind: 'extract'; archive: string; basePath: string }
  | { kind: 'multirename'; entries: FileEntry[] }
  | { kind: 'split'; entry: FileEntry }
  | { kind: 'compare'; left: string; right: string }
  | { kind: 'sync'; left: string; right: string }
  | { kind: 'properties'; entry: FileEntry }
  | { kind: 'openwith'; entry: FileEntry }
  | { kind: 'remote' }
  | null

interface ToolStore {
  tool: Tool
  open: (tool: NonNullable<Tool>) => void
  close: () => void
}

export const useToolStore = create<ToolStore>((set) => ({
  tool: null,
  open: (tool) => set({ tool }),
  close: () => set({ tool: null }),
}))
