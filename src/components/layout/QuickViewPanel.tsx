import { useEffect, useState } from 'react'

import { ipc, isHttpBackend } from '../../ipc/client'
import type { FileContent } from '../../ipc/types'
import { formatSize } from '../../lib/format'
import { usePaneStore } from '../../state/paneStore'
import { useQuickViewStore } from '../../state/quickViewStore'

const IMAGE_EXT = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'ico']

export function QuickViewPanel() {
  const close = useQuickViewStore((state) => state.close)
  const entry = usePaneStore((state) => {
    const pane = state.panes[state.active]
    return pane.entries[pane.cursor]
  })
  const [data, setData] = useState<FileContent | null>(null)
  const [error, setError] = useState<string | null>(null)

  const isImage = Boolean(entry && !entry.isDir && IMAGE_EXT.includes(entry.extension ?? ''))

  useEffect(() => {
    let active = true
    setData(null)
    setError(null)
    if (!entry || entry.isDir || isImage) return
    ipc
      .readFileText(entry.path)
      .then((result) => {
        if (active) setData(result)
      })
      .catch((err: unknown) => {
        if (active) setError(String((err as { message?: string })?.message ?? err))
      })
    return () => {
      active = false
    }
  }, [entry, isImage])

  return (
    <div className="flex w-80 shrink-0 flex-col border-l border-slate-700 bg-panelAlt">
      <div className="flex items-center justify-between border-b border-slate-700 px-2 py-1 text-xs">
        <span className="min-w-0 truncate font-semibold text-slate-200">Quick view</span>
        <button
          type="button"
          className="shrink-0 text-slate-400 hover:text-white"
          title="Fechar (Ctrl+Q)"
          onClick={close}
        >
          ✕
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-2">
        {!entry ? (
          <div className="text-xs text-slate-500">Nenhum ficheiro selecionado.</div>
        ) : entry.isDir ? (
          <div className="text-xs text-slate-500">É uma pasta.</div>
        ) : isImage ? (
          isHttpBackend ? (
            <img
              src={`/api/raw?path=${encodeURIComponent(entry.path)}`}
              alt={entry.name}
              className="max-w-full rounded"
            />
          ) : (
            <div className="text-xs text-slate-500">
              Pré-visualização de imagem disponível no backend HTTP.
            </div>
          )
        ) : error ? (
          <div className="text-xs text-red-400">{error}</div>
        ) : !data ? (
          <div className="text-xs text-slate-400">a carregar…</div>
        ) : (
          <>
            <div className="mb-1 text-[10px] text-slate-500">
              {formatSize(data.size)}
              {data.truncated ? ' · truncado a 2 MB' : ''}
              {data.binary ? ' · binário' : ''}
            </div>
            {data.binary ? (
              <div className="text-xs text-amber-400">
                (conteúdo binário — não é possível pré-visualizar)
              </div>
            ) : (
              <pre className="whitespace-pre-wrap text-[11px] leading-4 text-slate-300">
                {data.content}
              </pre>
            )}
          </>
        )}
      </div>
    </div>
  )
}
