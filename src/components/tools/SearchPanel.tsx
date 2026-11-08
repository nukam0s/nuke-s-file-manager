import { useState } from 'react'

import { ipc } from '../../ipc/client'
import type { FileEntry } from '../../ipc/types'
import { formatSize } from '../../lib/format'
import { usePaneStore } from '../../state/paneStore'
import { ToolModal } from './ToolModal'

function parentOf(path: string): string {
  const separator = path.includes('\\') ? '\\' : '/'
  const trimmed = path.replace(/[\\/]$/, '')
  const index = trimmed.lastIndexOf(separator)
  return index > 0 ? trimmed.slice(0, index) : '\\'
}

export function SearchPanel({ root, onClose }: { root: string; onClose: () => void }) {
  const [query, setQuery] = useState('')
  const [recursive, setRecursive] = useState(true)
  const [inContent, setInContent] = useState(false)
  const [entries, setEntries] = useState<FileEntry[]>([])
  const [truncated, setTruncated] = useState(false)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run() {
    if (!query.trim()) return
    setRunning(true)
    setError(null)
    try {
      const result = await ipc.search(root, query.trim(), recursive, 2000, inContent)
      setEntries(result.entries)
      setTruncated(result.truncated)
    } catch (err: unknown) {
      setError(String((err as { message?: string })?.message ?? err))
    } finally {
      setRunning(false)
    }
  }

  function pick(entry: FileEntry) {
    const store = usePaneStore.getState()
    const side = store.active
    void store.navigate(side, entry.isDir ? entry.path : parentOf(entry.path))
    onClose()
  }

  return (
    <ToolModal title={`Pesquisar em ${root}`} onClose={onClose} width="w-[780px]">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') void run()
          }}
          placeholder="texto / nome"
          className="min-w-[200px] flex-1 rounded border border-slate-600 bg-panel px-2 py-1 text-slate-100 outline-none focus:border-sky-500"
        />
        <label className="flex items-center gap-1 text-xs text-slate-400">
          <input
            type="checkbox"
            checked={recursive}
            onChange={(event) => setRecursive(event.target.checked)}
          />
          recursivo
        </label>
        <label className="flex items-center gap-1 text-xs text-slate-400">
          <input
            type="checkbox"
            checked={inContent}
            onChange={(event) => setInContent(event.target.checked)}
          />
          conteúdo
        </label>
        <button
          type="button"
          onClick={() => void run()}
          disabled={running}
          className="rounded bg-sky-600 px-3 py-1 text-white hover:bg-sky-500 disabled:opacity-50"
        >
          {running ? '…' : 'Pesquisar'}
        </button>
      </div>

      {error ? <div className="mb-2 text-xs text-red-400">{error}</div> : null}
      <div className="text-xs text-slate-400">
        {entries.length} resultado(s){truncated ? ' (truncado)' : ''}
      </div>

      <div className="mt-1 divide-y divide-slate-700">
        {entries.map((entry) => (
          <button
            key={entry.path}
            type="button"
            onClick={() => pick(entry)}
            className="flex w-full items-center gap-2 px-1 py-1 text-left text-xs hover:bg-slate-700/50"
          >
            <span>{entry.isDir ? '📁' : '📄'}</span>
            <span className="min-w-0 flex-1 truncate" title={entry.path}>
              {entry.name}
            </span>
            <span className="w-16 text-right text-slate-500">
              {entry.isDir ? '' : formatSize(entry.size)}
            </span>
            <span className="w-72 truncate text-right text-slate-500" title={entry.path}>
              {entry.path}
            </span>
          </button>
        ))}
      </div>
    </ToolModal>
  )
}
