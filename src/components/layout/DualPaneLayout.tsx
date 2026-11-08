import { usePaneStore } from '../../state/paneStore'
import { useQuickViewStore } from '../../state/quickViewStore'
import { Pane } from './Pane'
import { QuickViewPanel } from './QuickViewPanel'

export function DualPaneLayout() {
  const active = usePaneStore((state) => state.active)
  const quickViewOpen = useQuickViewStore((state) => state.open)

  return (
    <div className="flex h-full w-full">
      <Pane side="left" active={active === 'left'} />
      <div className="w-px shrink-0 bg-slate-700" />
      <Pane side="right" active={active === 'right'} />
      {quickViewOpen ? (
        <>
          <div className="w-px shrink-0 bg-slate-700" />
          <QuickViewPanel />
        </>
      ) : null}
    </div>
  )
}
