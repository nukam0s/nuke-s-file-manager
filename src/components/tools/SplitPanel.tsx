import { useState } from 'react'

import { ipc } from '../../ipc/client'
import type { FileEntry } from '../../ipc/types'
import { usePaneStore } from '../../state/paneStore'
import { ToolModal } from './ToolModal'

function dirOf(path: string): string {
  const separator = path.includes('\\') ? '\\' : '/'
  const trimmed = path.replace(/[\\/]$/, '')
  const index = trimmed.lastIndexOf(separator)
  return index > 0 ? trimmed.slice(0, index) : '.'
}

export function SplitPanel({ entry, onClose }: { entry: FileEntry; onClose: () => void }) {
  const [sizeMb, setSizeMb] = useState('10')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function run() {
    const mb = Number(sizeMb)
    if (!(mb > 0)) return
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      const res = await ipc.splitFile(entry.path, Math.floor(mb * 1024 * 1024), dirOf(entry.path))
      setResult(`${res.total} parte(s) criada(s).`)
      await usePaneStore.getState().refreshBoth()
    } catch (err: unknown) {
      setError(String((err as { message?: string })?.message ?? err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <ToolModal title="Dividir ficheiro" onClose={onClose}>
      <div className="mb-2 text-xs text-slate-400">
        {entry.name} ({entry.size} bytes)
      </div>
      <label className="mb-1 block text-xs text-slate-400">Tamanho de cada parte (MB)</label>
      <input
        autoFocus
        value={sizeMb}
        onChange={(event) => setSizeMb(event.target.value)}
        className="mb-2 w-32 rounded border border-slate-600 bg-panel px-2 py-1 text-slate-100 outline-none focus:border-sky-500"
      />
      {result ? <div className="mb-2 text-xs text-emerald-400">{result}</div> : null}
      {error ? <div className="mb-2 text-xs text-red-400">{error}</div> : null}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded border border-slate-600 px-3 py-1 text-slate-300 hover:bg-slate-700"
        >
          Fechar
        </button>
        <button
          type="button"
          onClick={() => void run()}
          disabled={busy}
          className="rounded bg-sky-600 px-3 py-1 text-white hover:bg-sky-500 disabled:opacity-50"
        >
          {busy ? '…' : 'Dividir'}
        </button>
      </div>
    </ToolModal>
  )
}
