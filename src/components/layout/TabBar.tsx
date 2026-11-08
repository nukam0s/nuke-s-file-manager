import { archiveDisplayName, isArchivePath } from '../../lib/archivePath'
import { isRemotePath, remoteDisplayName } from '../../lib/remotePath'
import { usePaneStore, type PaneSide } from '../../state/paneStore'
import { useRemoteStore } from '../../state/remoteStore'

export function TabBar({ side }: { side: PaneSide }) {
  const tabs = usePaneStore((state) => state.panes[side].tabs)
  const activeTab = usePaneStore((state) => state.panes[side].activeTab)
  const connections = useRemoteStore((state) => state.connections)
  const switchTab = usePaneStore((state) => state.switchTab)
  const closeTab = usePaneStore((state) => state.closeTab)
  const addTab = usePaneStore((state) => state.addTab)

  return (
    <div className="flex items-center gap-0.5 overflow-x-auto border-b border-slate-700 bg-panelAlt px-1 pt-1 text-[11px]">
      {tabs.map((tab, index) => {
        let name: string
        if (isArchivePath(tab)) name = archiveDisplayName(tab)
        else if (isRemotePath(tab)) name = remoteDisplayName(tab, connections)
        else name = tab.split(/[\\/]/).filter(Boolean).pop() || tab
        const active = index === activeTab
        return (
          <div
            key={`${tab}-${index}`}
            className={`flex items-center gap-1 rounded-t border border-b-0 px-2 py-0.5 ${
              active
                ? 'border-slate-600 bg-panel text-slate-100'
                : 'border-transparent bg-panelAlt text-slate-400'
            }`}
          >
            <button
              type="button"
              className="max-w-[140px] truncate"
              title={tab}
              onClick={() => void switchTab(side, index)}
            >
              {name}
            </button>
            {tabs.length > 1 ? (
              <button
                type="button"
                className="text-slate-500 hover:text-red-400"
                title="Fechar aba (Ctrl+W)"
                onClick={() => void closeTab(side, index)}
              >
                ×
              </button>
            ) : null}
          </div>
        )
      })}
      <button
        type="button"
        className="px-1 text-slate-400 hover:text-white"
        title="Nova aba (Ctrl+T)"
        onClick={() => void addTab(side)}
      >
        +
      </button>
    </div>
  )
}
