import { create } from 'zustand'

import { ipc } from '../ipc/client'
import type { RemoteConnection, RemoteConnectionInput, RemoteTestResult } from '../ipc/types'

function toMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message)
  }
  return String(error)
}

interface RemoteStore {
  connections: RemoteConnection[]
  loading: boolean
  loaded: boolean
  error: string | null
  /** Loads saved connections. Pass `force` to bypass the in-memory cache. */
  load: (force?: boolean) => Promise<void>
  save: (connection: RemoteConnectionInput, password?: string) => Promise<RemoteConnection>
  remove: (id: string) => Promise<void>
  test: (connection: RemoteConnectionInput, password?: string) => Promise<RemoteTestResult>
  connectionFor: (id: string) => RemoteConnection | undefined
}

export const useRemoteStore = create<RemoteStore>((set, get) => ({
  connections: [],
  loading: false,
  loaded: false,
  error: null,

  load: async (force = false) => {
    if (get().loading) return
    if (get().loaded && !force) return
    set({ loading: true, error: null })
    try {
      const result = await ipc.remoteList()
      set({ connections: result.connections, loaded: true, loading: false })
    } catch (error) {
      set({ error: toMessage(error), loaded: true, loading: false })
    }
  },

  save: async (connection, password) => {
    const saved = await ipc.remoteSave(connection, password)
    set((state) => {
      const connections = state.connections.slice()
      const index = connections.findIndex((candidate) => candidate.id === saved.id)
      if (index >= 0) connections[index] = saved
      else connections.push(saved)
      return { connections, loaded: true }
    })
    return saved
  },

  remove: async (id) => {
    await ipc.remoteDeleteConnection(id)
    set((state) => ({
      connections: state.connections.filter((candidate) => candidate.id !== id),
    }))
  },

  test: (connection, password) => ipc.remoteTest(connection, password),

  connectionFor: (id) => get().connections.find((candidate) => candidate.id === id),
}))
