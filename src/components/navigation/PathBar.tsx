import { useEffect, useState } from 'react'

import { archiveDisplayName, isArchivePath } from '../../lib/archivePath'
import { isRemotePath, remoteDisplayName, remoteParent } from '../../lib/remotePath'
import { usePaneStore, type PaneSide } from '../../state/paneStore'
import { useRemoteStore } from '../../state/remoteStore'
import { DriveSelector } from './DriveSelector'

export function PathBar({ side }: { side: PaneSide }) {
  const path = usePaneStore((state) => state.panes[side].path)
  const parent = usePaneStore((state) => state.panes[side].parent)
  const historyIndex = usePaneStore((state) => state.panes[side].historyIndex)
  const historyLength = usePaneStore((state) => state.panes[side].history.length)
  const connections = useRemoteStore((state) => state.connections)
  const navigate = usePaneStore((state) => state.navigate)
  const goUp = usePaneStore((state) => state.goUp)
  const goBack = usePaneStore((state) => state.goBack)
  const goForward = usePaneStore((state) => state.goForward)

  const archive = isArchivePath(path)
  const remote = isRemotePath(path)
  const display = archive
    ? archiveDisplayName(path)
    : remote
      ? remoteDisplayName(path, connections)
      : path
  // At the `remote::` network root there is nothing to go up to, so disable the button.
  const canGoUp = remote ? remoteParent(path) !== null : Boolean(parent)
  const [value, setValue] = useState(display)
  useEffect(() => setValue(display), [display])

  return (
    <div className="flex items-center gap-1 border-b border-slate-700 bg-panelAlt px-1 py-1 text-xs">
      <button
        type="button"
        title="Voltar (Alt+←)"
        disabled={historyIndex <= 0}
        onClick={() => void goBack(side)}
        className="px-1 text-slate-400 hover:text-white disabled:opacity-30"
      >
        ←
      </button>
      <button
        type="button"
        title="Avançar (Alt+→)"
        disabled={historyIndex >= historyLength - 1}
        onClick={() => void goForward(side)}
        className="px-1 text-slate-400 hover:text-white disabled:opacity-30"
      >
        →
      </button>
      <button
        type="button"
        title="Subir (Backspace)"
        disabled={!canGoUp}
        onClick={() => void goUp(side)}
        className="px-1 text-slate-400 hover:text-white disabled:opacity-30"
      >
        ↑
      </button>
      <DriveSelector side={side} />
      <input
        className="min-w-0 flex-1 rounded border border-slate-600 bg-panel px-2 py-1 text-slate-200 outline-none focus:border-sky-500"
        value={value}
        title={path}
        spellCheck={false}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            // Virtual paths (archive/remote) show a friendly label; unchanged label reloads the
            // current virtual path, otherwise the typed value is treated as a real path.
            if ((archive || remote) && value === display) void navigate(side, path)
            else void navigate(side, value)
          }
          if (event.key === 'Escape') setValue(display)
        }}
      />
    </div>
  )
}
