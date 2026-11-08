import type { SortField } from '../../ipc/types'
import { usePaneStore, type PaneSide } from '../../state/paneStore'

export function SortHeader({ side }: { side: PaneSide }) {
  const sort = usePaneStore((state) => state.panes[side].sort)
  const setSort = usePaneStore((state) => state.setSort)

  const arrow = (field: SortField) =>
    sort.field === field ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : ''

  return (
    <div className="flex h-6 items-center gap-2 border-b border-slate-700 bg-panelAlt px-2 text-[11px] text-slate-400">
      <span className="w-8 shrink-0" />
      <button
        type="button"
        className="flex-1 text-left hover:text-slate-200"
        onClick={() => void setSort(side, 'name')}
      >
        Nome{arrow('name')}
      </button>
      <button
        type="button"
        className="w-20 shrink-0 text-right hover:text-slate-200"
        onClick={() => void setSort(side, 'size')}
      >
        Tam.{arrow('size')}
      </button>
      <button
        type="button"
        className="w-36 shrink-0 text-right hover:text-slate-200"
        onClick={() => void setSort(side, 'modified')}
      >
        Modificado{arrow('modified')}
      </button>
    </div>
  )
}
