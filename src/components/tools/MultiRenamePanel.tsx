import { useMemo, useState } from 'react'

import { ipc } from '../../ipc/client'
import type { FileEntry } from '../../ipc/types'
import { usePaneStore } from '../../state/paneStore'
import { ToolModal } from './ToolModal'

export function MultiRenamePanel({ entries, onClose }: { entries: FileEntry[]; onClose: () => void }) {
  const [find, setFind] = useState('')
  const [replace, setReplace] = useState('')
  const [useRegex, setUseRegex] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const preview = useMemo(
    () =>
      entries.map((entry) => {
        let name = entry.name
        if (find) {
          try {
            name = useRegex
              ? entry.name.replace(new RegExp(find, 'g'), replace)
              : entry.name.split(find).join(replace)
          } catch {
            name = entry.name
          }
        }
        return { entry, newName: name }
      }),
    [entries, find, replace, useRegex],
  )

  async function run() {
    const items = preview
      .filter((item) => item.newName && item.newName !== item.entry.name)
      .map((item) => ({ path: item.entry.path, newName: item.newName }))
    if (items.length === 0) return
    setBusy(true)
    setError(null)
    try {
      await ipc.multiRename(items)
      await usePaneStore.getState().refreshBoth()
      onClose()
    } catch (err: unknown) {
      setError(String((err as { message?: string })?.message ?? err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <ToolModal title="Multi-rename" onClose={onClose} width="w-[720px]">
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
        <input
          value={find}
          onChange={(event) => setFind(event.target.value)}
          placeholder="procurar"
          className="rounded border border-slate-600 bg-panel px-2 py-1 text-slate-100 outline-none focus:border-sky-500"
        />
        <span className="text-slate-500">→</span>
        <input
          value={replace}
          onChange={(event) => setReplace(event.target.value)}
          placeholder="substituir"
          className="rounded border border-slate-600 bg-panel px-2 py-1 text-slate-100 outline-none focus:border-sky-500"
        />
        <label className="flex items-center gap-1 text-slate-400">
          <input
            type="checkbox"
            checked={useRegex}
            onChange={(event) => setUseRegex(event.target.checked)}
          />
          regex
        </label>
      </div>

      <div className="max-h-[45vh] divide-y divide-slate-700 overflow-auto text-[11px]">
        {preview.map(({ entry, newName }) => (
          <div key={entry.path} className="flex gap-2 py-1">
            <span className="min-w-0 flex-1 truncate text-slate-400">{entry.name}</span>
            <span className="text-slate-500">→</span>
            <span
              className={`min-w-0 flex-1 truncate ${
                newName !== entry.name ? 'text-sky-300' : 'text-slate-500'
              }`}
            >
              {newName}
            </span>
          </div>
        ))}
      </div>

      {error ? <div className="mt-2 text-xs text-red-400">{error}</div> : null}
      <div className="mt-3 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded border border-slate-600 px-3 py-1 text-slate-300 hover:bg-slate-700"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={() => void run()}
          disabled={busy || !find}
          className="rounded bg-sky-600 px-3 py-1 text-white hover:bg-sky-500 disabled:opacity-50"
        >
          {busy ? '…' : 'Renomear'}
        </button>
      </div>
    </ToolModal>
  )
}
