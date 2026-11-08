import { useOperationStore } from '../../state/operationStore'

export function OperationOverlay() {
  const active = useOperationStore((state) => state.active)
  const paused = useOperationStore((state) => state.paused)
  const processed = useOperationStore((state) => state.processed)
  const total = useOperationStore((state) => state.total)
  const current = useOperationStore((state) => state.current)
  const pause = useOperationStore((state) => state.pause)
  const resume = useOperationStore((state) => state.resume)
  const cancel = useOperationStore((state) => state.cancel)

  if (!active) return null

  const percent = total > 0 ? Math.round((processed / total) * 100) : 0

  return (
    <div className="fixed bottom-24 left-1/2 z-30 w-[440px] -translate-x-1/2 rounded border border-slate-600 bg-panelAlt p-3 text-xs shadow-2xl">
      <div className="mb-1 flex justify-between">
        <span className="text-slate-200">{paused ? 'Em pausa…' : 'A processar…'}</span>
        <span className="text-slate-400">
          {processed}/{total}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded bg-slate-700">
        <div className="h-full bg-sky-500 transition-all" style={{ width: `${percent}%` }} />
      </div>
      <div className="mt-1 truncate text-slate-500">{current}</div>
      <div className="mt-2 flex justify-end gap-2">
        {paused ? (
          <button
            type="button"
            onClick={() => void resume()}
            className="rounded border border-emerald-500 px-2 py-0.5 text-emerald-300 hover:bg-emerald-900/40"
          >
            Retomar
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void pause()}
            className="rounded border border-amber-500 px-2 py-0.5 text-amber-300 hover:bg-amber-900/40"
          >
            Pausar
          </button>
        )}
        <button
          type="button"
          onClick={() => void cancel()}
          className="rounded border border-red-500 px-2 py-0.5 text-red-300 hover:bg-red-900/40"
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}
