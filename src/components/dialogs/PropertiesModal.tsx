import { useEffect, useState } from 'react'

import { ipc } from '../../ipc/client'
import type { FileEntry } from '../../ipc/types'
import { formatDate, formatSize } from '../../lib/format'
import { ToolModal } from '../tools/ToolModal'

function toMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message)
  }
  return String(error)
}

export function PropertiesModal({ entry, onClose }: { entry: FileEntry; onClose: () => void }) {
  const [meta, setMeta] = useState<FileEntry | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setMeta(null)
    setError(null)
    ipc
      .getMetadata(entry.path)
      .then((result) => {
        if (active) setMeta(result)
      })
      .catch((err: unknown) => {
        if (active) setError(toMessage(err))
      })
    return () => {
      active = false
    }
  }, [entry.path])

  const data = meta ?? entry

  const rows: Array<[string, string]> = [
    ['Nome', data.name],
    ['Caminho', data.path],
    ['Tipo', data.isDir ? 'Pasta' : data.isSymlink ? 'Ligação simbólica' : 'Ficheiro'],
    ['Tamanho', data.isDir ? '<DIR>' : formatSize(data.size)],
    ['Modificado', formatDate(data.modified)],
    ['Extensão', data.extension ?? '—'],
    ['Atributos', data.attributes],
  ]

  return (
    <ToolModal title={`Propriedades: ${data.name}`} onClose={onClose} width="w-[440px]">
      {error ? (
        <div className="text-xs text-red-400">{error}</div>
      ) : (
        <div className="grid grid-cols-[120px_1fr] gap-x-2 gap-y-1 text-xs">
          {rows.map(([label, value]) => (
            <div key={label} className="contents">
              <div className="text-slate-500">{label}</div>
              <div className="min-w-0 break-all text-slate-200">{value}</div>
            </div>
          ))}
        </div>
      )}
    </ToolModal>
  )
}
