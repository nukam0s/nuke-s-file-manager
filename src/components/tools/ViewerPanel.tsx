import { useEffect, useState } from 'react'

import { ipc } from '../../ipc/client'
import type { FileContent } from '../../ipc/types'
import { ToolModal } from './ToolModal'

export function ViewerPanel({ path, onClose }: { path: string; onClose: () => void }) {
  const [data, setData] = useState<FileContent | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setData(null)
    setError(null)
    ipc
      .readFileText(path)
      .then((result) => {
        if (active) setData(result)
      })
      .catch((err: unknown) => {
        if (active) setError(String((err as { message?: string })?.message ?? err))
      })
    return () => {
      active = false
    }
  }, [path])

  const name = path.split(/[\\/]/).pop()

  return (
    <ToolModal title={`Ver: ${name}`} onClose={onClose} width="w-[840px]">
      {error ? (
        <div className="text-xs text-red-400">{error}</div>
      ) : !data ? (
        <div className="text-xs text-slate-400">a carregar…</div>
      ) : (
        <>
          <div className="mb-1 flex items-center gap-2 text-xs text-slate-400">
            <span>{data.size} bytes</span>
            {data.truncated ? <span className="text-amber-400">(truncado a 2 MB)</span> : null}
            {data.binary ? <span className="text-amber-400">(binário)</span> : null}
            <button
              type="button"
              className="ml-auto rounded border border-slate-600 px-2 py-0.5 hover:bg-slate-700"
              onClick={() => void ipc.openPath(path)}
            >
              Abrir com app padrão
            </button>
          </div>
          <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap rounded bg-panel p-2 text-[11px] leading-4 text-slate-300">
            {data.binary ? '(conteúdo binário — usa “Abrir com app padrão”)' : data.content}
          </pre>
        </>
      )}
    </ToolModal>
  )
}
