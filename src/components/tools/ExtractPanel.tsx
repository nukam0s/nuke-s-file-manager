import { useState } from 'react'

import { ipc } from '../../ipc/client'
import { usePaneStore } from '../../state/paneStore'
import { ToolModal } from './ToolModal'

interface ExtractPanelProps {
  archive: string
  basePath: string
  onClose: () => void
}

export function ExtractPanel({ archive, basePath, onClose }: ExtractPanelProps) {
  const [destination, setDestination] = useState(basePath)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run() {
    if (!destination.trim()) return
    setBusy(true)
    setError(null)
    try {
      await ipc.extractArchive(archive, destination.trim())
      await usePaneStore.getState().refreshBoth()
      onClose()
    } catch (err: unknown) {
      setError(String((err as { message?: string })?.message ?? err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <ToolModal title="Extrair arquivo" onClose={onClose}>
      <div className="mb-2 truncate text-xs text-slate-400" title={archive}>
        {archive}
      </div>
      <label className="mb-1 block text-xs text-slate-400">Destino</label>
      <input
        autoFocus
        value={destination}
        onChange={(event) => setDestination(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') void run()
        }}
        className="mb-2 w-full rounded border border-slate-600 bg-panel px-2 py-1 text-slate-100 outline-none focus:border-sky-500"
      />
      <div className="mb-2 text-[11px] text-slate-500">
        ZIP/TAR nativos; RAR/7z requerem 7-Zip ou WinRAR instalados.
      </div>
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
          {busy ? '…' : 'Extrair'}
        </button>
      </div>
    </ToolModal>
  )
}
