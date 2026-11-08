import { useEffect, useState } from 'react'

import { ipc } from '../../ipc/client'
import type { CompareResult, CompareStatus } from '../../ipc/types'
import { ToolModal } from './ToolModal'

const COLORS: Record<CompareStatus, string> = {
  onlyLeft: 'text-amber-400',
  onlyRight: 'text-sky-400',
  different: 'text-red-400',
  same: 'text-slate-500',
}

interface ComparePanelProps {
  left: string
  right: string
  onClose: () => void
}

export function ComparePanel({ left, right, onClose }: ComparePanelProps) {
  const [result, setResult] = useState<CompareResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setResult(null)
    setError(null)
    ipc
      .compareDirs(left, right)
      .then((value) => {
        if (active) setResult(value)
      })
      .catch((err: unknown) => {
        if (active) setError(String((err as { message?: string })?.message ?? err))
      })
    return () => {
      active = false
    }
  }, [left, right])

  return (
    <ToolModal title="Comparar diretórios" onClose={onClose} width="w-[780px]">
      <div className="mb-2 grid grid-cols-2 gap-2 text-[11px] text-slate-400">
        <div className="truncate" title={left}>
          ◀ {left}
        </div>
        <div className="truncate" title={right}>
          ▶ {right}
        </div>
      </div>

      {error ? <div className="text-xs text-red-400">{error}</div> : null}
      {!result ? (
        <div className="text-xs text-slate-400">a comparar…</div>
      ) : (
        <>
          <div className="mb-2 text-xs text-slate-400">
            só esquerda: {result.onlyLeft} · só direita: {result.onlyRight} · diferentes:{' '}
            {result.different} · iguais: {result.same}
          </div>
          <div className="max-h-[50vh] divide-y divide-slate-700 overflow-auto text-[11px]">
            {result.entries.map((entry) => (
              <div key={entry.name} className="flex items-center gap-2 py-1">
                <span className={`w-24 shrink-0 ${COLORS[entry.status]}`}>{entry.status}</span>
                <span className="min-w-0 flex-1 truncate">{entry.name}</span>
                <span className="w-16 text-right text-slate-500">{entry.leftSize ?? ''}</span>
                <span className="w-16 text-right text-slate-500">{entry.rightSize ?? ''}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </ToolModal>
  )
}
