import { useState } from 'react'

import { ipc } from '../../ipc/client'
import { usePaneStore } from '../../state/paneStore'
import type { ArchiveFormat } from '../../state/toolStore'
import { ToolModal } from './ToolModal'

function joinPath(base: string, name: string): string {
  const separator = base.includes('\\') ? '\\' : '/'
  return base.endsWith(separator) ? base + name : base + separator + name
}

interface ZipPanelProps {
  sources: string[]
  defaultName: string
  basePath: string
  format: ArchiveFormat
  onClose: () => void
}

export function ZipPanel({ sources, defaultName, basePath, format, onClose }: ZipPanelProps) {
  const [name, setName] = useState(defaultName)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run() {
    if (!name.trim()) return
    setBusy(true)
    setError(null)
    try {
      const destination = joinPath(basePath, name.trim())
      if (format === 'tar') await ipc.packTar(sources, destination)
      else await ipc.packZip(sources, destination)
      await usePaneStore.getState().refreshBoth()
      onClose()
    } catch (err: unknown) {
      setError(String((err as { message?: string })?.message ?? err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <ToolModal title={format === 'tar' ? 'Criar arquivo TAR' : 'Comprimir para ZIP'} onClose={onClose}>
      <div className="mb-2 text-xs text-slate-400">
        {sources.length} item(ns) → {basePath}
      </div>
      <input
        autoFocus
        value={name}
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') void run()
        }}
        className="mb-2 w-full rounded border border-slate-600 bg-panel px-2 py-1 text-slate-100 outline-none focus:border-sky-500"
      />
      {error ? <div className="mb-2 text-xs text-red-400">{error}</div> : null}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded border border-slate-600 px-3 py-1 text-slate-300 hover:bg-slate-700"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={() => void run()}
          disabled={busy}
          className="rounded bg-sky-600 px-3 py-1 text-white hover:bg-sky-500 disabled:opacity-50"
        >
          {busy ? '…' : 'Criar'}
        </button>
      </div>
    </ToolModal>
  )
}
