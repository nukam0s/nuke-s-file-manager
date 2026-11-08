import { useState } from 'react'

import { ipc } from '../../ipc/client'
import type { FileEntry } from '../../ipc/types'
import { useAssociationsStore } from '../../state/associationsStore'
import { ToolModal } from '../tools/ToolModal'

export function OpenWithDialog({ entry, onClose }: { entry: FileEntry; onClose: () => void }) {
  const getFor = useAssociationsStore((state) => state.getFor)
  const set = useAssociationsStore((state) => state.set)
  const [command, setCommand] = useState(getFor(entry.extension) ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const ext = entry.extension

  async function handleSubmit() {
    if (!command.trim()) return
    setBusy(true)
    setError(null)
    try {
      if (ext) set(ext, command.trim())
      await ipc.openWith(entry.path, command.trim())
      onClose()
    } catch (err) {
      setError(String((err as { message?: string })?.message ?? err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <ToolModal title={`Abrir com…: ${entry.name}`} onClose={onClose} width="w-[520px]">
      <div className="text-xs text-slate-400">
        <p className="mb-2">
          Extensão:{' '}
          <span className="text-slate-200">{ext ? `.${ext}` : '(sem extensão)'}</span>
        </p>
        <label className="mb-1 block text-slate-300">Caminho do executável</label>
        <input
          autoFocus
          value={command}
          onChange={(event) => setCommand(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') void handleSubmit()
            if (event.key === 'Escape') onClose()
          }}
          placeholder="ex.: C:\Program Files\Notepad++\notepad++.exe"
          className="mb-2 w-full rounded border border-slate-600 bg-panel px-2 py-1 text-slate-100 outline-none focus:border-sky-500"
        />
        {ext ? (
          <p className="mb-2 text-[11px] text-slate-500">
            A associação para .{ext} será guardada automaticamente.
          </p>
        ) : null}
        {error ? <p className="mb-2 text-xs text-red-400">{error}</p> : null}
      </div>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          className="rounded border border-slate-600 px-3 py-1 text-slate-300 hover:bg-slate-700 disabled:opacity-40"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={busy || !command.trim()}
          className="rounded bg-sky-600 px-3 py-1 font-medium text-white hover:bg-sky-500 disabled:opacity-40"
        >
          {busy ? '…' : 'Abrir'}
        </button>
      </div>
    </ToolModal>
  )
}
