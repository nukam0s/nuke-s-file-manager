import { useState } from 'react'

import { ipc } from '../../ipc/client'
import type { SyncDirection, SyncResult } from '../../ipc/types'
import { usePaneStore } from '../../state/paneStore'
import { ToolModal } from './ToolModal'

interface SyncPanelProps {
  left: string
  right: string
  onClose: () => void
}

export function SyncPanel({ left, right, onClose }: SyncPanelProps) {
  const [direction, setDirection] = useState<SyncDirection>('leftToRight')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<SyncResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function run() {
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      const res = await ipc.syncDirs(left, right, direction)
      setResult(res)
      await usePaneStore.getState().refreshBoth()
    } catch (err: unknown) {
      setError(String((err as { message?: string })?.message ?? err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <ToolModal title="Sincronizar diretórios" onClose={onClose} width="w-[720px]">
      <div className="mb-2 space-y-1 text-[11px] text-slate-400">
        <div className="truncate" title={left}>
          ◀ {left}
        </div>
        <div className="truncate" title={right}>
          ▶ {right}
        </div>
      </div>

      <div className="mb-2 flex items-center gap-2 text-xs">
        <span className="text-slate-400">Direção:</span>
        <select
          value={direction}
          onChange={(event) => setDirection(event.target.value as SyncDirection)}
          className="rounded border border-slate-600 bg-panel px-1 py-1 text-slate-200"
        >
          <option value="leftToRight">esquerda → direita</option>
          <option value="rightToLeft">direita → esquerda</option>
        </select>
        <button
          type="button"
          onClick={() => void run()}
          disabled={busy}
          className="ml-auto rounded bg-sky-600 px-3 py-1 text-white hover:bg-sky-500 disabled:opacity-50"
        >
          {busy ? '…' : 'Sincronizar'}
        </button>
      </div>

      <div className="mb-2 text-[11px] text-slate-500">
        Copia ficheiros em falta ou com tamanho diferente (recursivo).
      </div>

      {error ? <div className="text-xs text-red-400">{error}</div> : null}
      {result ? (
        <>
          <div className="mb-2 text-xs text-slate-400">
            copiados: {result.copied} · ignorados: {result.skipped} · falhas: {result.failed}
          </div>
          <div className="max-h-[45vh] divide-y divide-slate-700 overflow-auto text-[11px]">
            {result.entries.map((entry) => (
              <div key={entry.path} className="truncate py-1 text-slate-400" title={entry.path}>
                <span className="text-emerald-400">{entry.action}</span> {entry.path}
              </div>
            ))}
          </div>
        </>
      ) : null}
    </ToolModal>
  )
}
