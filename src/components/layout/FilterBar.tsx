import { usePaneStore, type PaneSide } from '../../state/paneStore'

export function FilterBar({ side }: { side: PaneSide }) {
  const filter = usePaneStore((state) => state.panes[side].filter)
  const setFilter = usePaneStore((state) => state.setFilter)

  return (
    <div className="flex items-center gap-1 border-b border-slate-700 bg-panel px-2 py-1 text-xs">
      <span className="text-slate-500">filtrar</span>
      <input
        value={filter}
        onChange={(event) => setFilter(side, event.target.value)}
        placeholder="…"
        className="flex-1 bg-transparent text-slate-200 outline-none"
      />
      {filter ? (
        <button
          type="button"
          className="text-slate-500 hover:text-white"
          onClick={() => setFilter(side, '')}
        >
          ×
        </button>
      ) : null}
    </div>
  )
}
