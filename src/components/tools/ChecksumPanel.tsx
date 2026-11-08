import { useEffect, useState } from 'react'

import { ipc } from '../../ipc/client'
import type { ChecksumEntry } from '../../ipc/types'
import { ToolModal } from './ToolModal'

export function ChecksumPanel({ paths, onClose }: { paths: string[]; onClose: () => void }) {
  const [algorithm, setAlgorithm] = useState('sha256')
  const [entries, setEntries] = useState<ChecksumEntry[]>([])
  const [running, setRunning] = useState(false)

  useEffect(() => {
    let active = true
    setRunning(true)
    ipc
      .checksums(paths, algorithm)
      .then((result) => {
        if (active) setEntries(result)
      })
      .finally(() => {
        if (active) setRunning(false)
      })
    return () => {
      active = false
    }
  }, [paths, algorithm])

  return (
    <ToolModal title="Checksums" onClose={onClose} width="w-[780px]">
      <div className="mb-2 flex items-center gap-2 text-xs">
        <span className="text-slate-400">Algoritmo:</span>
        <select
          value={algorithm}
          onChange={(event) => setAlgorithm(event.target.value)}
          className="rounded border border-slate-600 bg-panel px-1 py-1 text-slate-200"
        >
          <option value="sha256">SHA-256</option>
          <option value="sha1">SHA-1</option>
          <option value="md5">MD5</option>
        </select>
        {running ? <span className="text-slate-500">a calcular…</span> : null}
      </div>

      <table className="w-full text-left text-[11px]">
        <thead className="text-slate-400">
          <tr>
            <th className="py-1">Ficheiro</th>
            <th>Hash</th>
            <th className="text-right">Bytes</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry, index) => (
            <tr key={`${entry.path}-${index}`} className="border-t border-slate-700">
              <td className="max-w-[220px] truncate py-1" title={entry.path}>
                {entry.path.split(/[\\/]/).pop()}
              </td>
              <td className="max-w-[340px] truncate font-mono text-slate-300" title={entry.hash}>
                {entry.error ? `erro: ${entry.error}` : entry.hash}
              </td>
              <td className="text-right text-slate-500">{entry.size}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </ToolModal>
  )
}
