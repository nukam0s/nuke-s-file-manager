import { usePaneStore, type PaneSide } from '../../state/paneStore'
import { FileList } from '../file-list/FileList'
import { PathBar } from '../navigation/PathBar'
import { TreeView } from '../tools/TreeView'
import { FilterBar } from './FilterBar'
import { TabBar } from './TabBar'

interface PaneProps {
  side: PaneSide
  active: boolean
}

export function Pane({ side, active }: PaneProps) {
  const setActive = usePaneStore((state) => state.setActive)
  const loading = usePaneStore((state) => state.panes[side].loading)
  const error = usePaneStore((state) => state.panes[side].error)
  const viewMode = usePaneStore((state) => state.panes[side].viewMode)
  const path = usePaneStore((state) => state.panes[side].path)

  return (
    <div
      onMouseDown={() => setActive(side)}
      className={`flex min-w-0 flex-1 flex-col ${
        active ? 'outline outline-1 -outline-offset-1 outline-sky-500' : ''
      }`}
    >
      <TabBar side={side} />
      <PathBar side={side} />
      <FilterBar side={side} />
      {error ? <div className="px-2 py-1 text-[11px] text-red-400">{error}</div> : null}
      <div className="relative min-h-0 flex-1">
        {viewMode === 'tree' ? (
          <TreeView side={side} root={path} />
        ) : (
          <FileList side={side} />
        )}
        {loading ? (
          <div className="absolute right-2 top-1 text-[10px] text-slate-400">a carregar…</div>
        ) : null}
      </div>
    </div>
  )
}
