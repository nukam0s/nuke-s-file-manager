import { create } from 'zustand'

import { ipc } from '../ipc/client'
import type { OperationResult, ProgressUpdate } from '../ipc/types'

interface OperationState {
  active: boolean
  paused: boolean
  processed: number
  total: number
  current: string
  last: OperationResult | null
  setProgress: (update: ProgressUpdate) => void
  setResult: (result: OperationResult) => void
  pause: () => Promise<void>
  resume: () => Promise<void>
  cancel: () => Promise<void>
}

export const useOperationStore = create<OperationState>((set) => ({
  active: false,
  paused: false,
  processed: 0,
  total: 0,
  current: '',
  last: null,
  setProgress: (update) =>
    set({
      active: true,
      processed: update.processed,
      total: update.total,
      current: update.current,
    }),
  setResult: (result) =>
    set({ active: false, paused: false, processed: 0, total: 0, current: '', last: result }),
  pause: async () => {
    await ipc.pauseOperation().catch(() => false)
    set({ paused: true })
  },
  resume: async () => {
    await ipc.resumeOperation().catch(() => false)
    set({ paused: false })
  },
  cancel: async () => {
    await ipc.cancelOperation().catch(() => false)
    set({ paused: false })
  },
}))
