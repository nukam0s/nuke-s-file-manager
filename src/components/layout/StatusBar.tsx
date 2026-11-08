import { usePaneStore } from '../../state/paneStore'

export function StatusBar() {
  const active = usePaneStore((state) => state.active)
  const pane = usePaneStore((state) => state.panes[state.active])

  const selectedCount = Object.keys(pane.selected).length
  const total = pane.entries.length

  return (
    <div className="flex items-center justify-between border-t border-slate-700 bg-panelAlt px-2 py-0.5 text-[11px] text-slate-400">
      <span className="min-w-0 truncate">{pane.path || '—'}</span>
      <span className="shrink-0">
        {total} itens · {selectedCount} selecionados · painel:{' '}
        {active === 'left' ? 'esquerdo' : 'direito'}
      </span>
    </div>
  )
}
