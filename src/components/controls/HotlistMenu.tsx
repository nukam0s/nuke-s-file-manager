import { useState } from 'react'

import { useHotlistStore } from '../../state/hotlistStore'
import { usePaneStore } from '../../state/paneStore'

function basename(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).pop() || path
}

const BTN =
  'px-2 py-0.5 rounded border border-slate-600 text-[11px] text-slate-300 hover:bg-slate-700'

export function HotlistMenu() {
  const paths = useHotlistStore((state) => state.paths)
  const remove = useHotlistStore((state) => state.remove)
  const [open, setOpen] = useState(false)

  function jump(path: string) {
    const store = usePaneStore.getState()
    void store.navigate(store.active, path)
    setOpen(false)
  }

  return (
    <div className="relative">
      <button
        type="button"
        className={BTN}
        title="Favoritos (Ctrl+D adiciona a pasta atual)"
        onClick={() => setOpen((value) => !value)}
      >
        ★ Favoritos
      </button>
      {open ? (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-30 mt-1 max-h-80 w-96 overflow-auto rounded border border-slate-600 bg-panelAlt py-1 shadow-xl">
            {paths.length === 0 ? (
              <div className="px-3 py-2 text-xs text-slate-500">
                Sem favoritos. Usa Ctrl+D para adicionar a pasta atual.
              </div>
            ) : (
              paths.map((path) => (
                <div key={path} className="flex items-center gap-1 px-1">
                  <button
                    type="button"
                    className="min-w-0 flex-1 rounded px-2 py-1 text-left hover:bg-slate-700"
                    onClick={() => jump(path)}
                    title={path}
                  >
                    <span className="block truncate text-xs text-slate-200">
                      {basename(path)}
                    </span>
                    <span className="block truncate text-[10px] text-slate-500">{path}</span>
                  </button>
                  <button
                    type="button"
                    className="shrink-0 px-1 text-slate-500 hover:text-red-400"
                    title="Remover"
                    onClick={() => remove(path)}
                  >
                    ✕
                  </button>
                </div>
              ))
            )}
          </div>
        </>
      ) : null}
    </div>
  )
}
