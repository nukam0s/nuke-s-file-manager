import { useEffect, useState } from 'react'

import { ipc } from '../../ipc/client'
import type { CopyPolicy, OperationError } from '../../ipc/types'
import { isArchivePath } from '../../lib/archivePath'
import {
  isRemotePath,
  isRemoteRoot,
  joinLocalPath,
  joinRemotePath,
  parseRemotePath,
  remoteBasename,
} from '../../lib/remotePath'
import { useDialogStore } from '../../state/dialogStore'
import { useOperationStore } from '../../state/operationStore'
import { usePaneStore } from '../../state/paneStore'
import { useRemoteStore } from '../../state/remoteStore'

const TITLES: Record<string, string> = {
  mkdir: 'Nova pasta',
  rename: 'Renomear',
  delete: 'Apagar',
  copy: 'Copiar',
  move: 'Mover',
  select: 'Selecionar por padrão',
}

function toMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message)
  }
  return String(error)
}

/** A directory entry at the `remote::` network root: `remote::<id>::/` (the server root). */
function isConnectionRoot(path: string): boolean {
  const parsed = parseRemotePath(path)
  return parsed !== null && parsed.remotePath === '/'
}

/**
 * Remote <-> local transfers. Remote -> remote is out of scope and reported to the user.
 * Progress is pushed into the shared operation overlay (remote routes do not emit SSE events).
 */
async function transferRemote(
  sources: string[],
  destination: string,
  mode: 'copy' | 'move',
): Promise<void> {
  const destinationRemote = isRemotePath(destination)
  const sourcesRemote = sources.some(isRemotePath)

  if (sourcesRemote && destinationRemote) {
    window.alert('Copiar/mover entre servidores remotos não é suportado nesta versão.')
    return
  }

  const setProgress = useOperationStore.getState().setProgress
  const setResult = useOperationStore.getState().setResult
  const opId = `remote-${Date.now()}`
  const errors: OperationError[] = []
  let success = 0
  let failed = 0

  for (let index = 0; index < sources.length; index += 1) {
    const source = sources[index]
    setProgress({ opId, processed: index, total: sources.length, current: source })
    try {
      if (isRemotePath(source)) {
        // remote -> local: the destination is a local directory.
        const target = joinLocalPath(destination, remoteBasename(source))
        await ipc.remoteDownload(source, target)
        if (mode === 'move') await ipc.remoteDeleteFiles([source])
      } else {
        // local -> remote: the destination is the remote directory.
        await ipc.remoteUpload(source, destination)
        if (mode === 'move') await ipc.deleteItems([source], false)
      }
      success += 1
    } catch (error) {
      failed += 1
      errors.push({ path: source, message: toMessage(error) })
    }
  }

  setProgress({ opId, processed: sources.length, total: sources.length, current: '' })
  setResult({ opId, success, skipped: 0, failed, errors, cancelled: false })
}

export function DialogHost() {
  const dialog = useDialogStore((state) => state.dialog)
  const close = useDialogStore((state) => state.close)
  const [text, setText] = useState('')
  const [policy, setPolicy] = useState<CopyPolicy>('overwrite')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setText(dialog?.kind === 'rename' ? dialog.entry.name : '')
    setPolicy('overwrite')
    setBusy(false)
  }, [dialog])

  if (!dialog) return null

  const isPrompt = dialog.kind === 'mkdir' || dialog.kind === 'rename' || dialog.kind === 'select'
  const panePath = usePaneStore.getState().panes[dialog.side].path
  const entries = 'entries' in dialog ? dialog.entries : []

  let description = ''
  if (dialog.kind === 'delete') {
    const remoteDelete = entries.some((entry) => isRemotePath(entry.path))
    const connectionsOnly = entries.length > 0 && entries.every((entry) => isConnectionRoot(entry.path))
    description = connectionsOnly
      ? `${entries.length} ligação(ões) serão apagadas.`
      : remoteDelete
        ? `${entries.length} item(ns) serão apagados permanentemente (remoto).`
        : `${entries.length} item(ns) serão enviados para a lixeira.`
  } else if (dialog.kind === 'copy' || dialog.kind === 'move') {
    description = `${entries.length} item(ns) para ${dialog.destination}`
  } else if (dialog.kind === 'select') {
    description =
      dialog.mode === 'select'
        ? 'Marca os itens cujo nome corresponde ao padrão (ex.: *.txt).'
        : 'Desmarca os itens cujo nome corresponde ao padrão.'
  }

  const preview = entries
    .slice(0, 5)
    .map((entry) => entry.name)
    .join(', ')
  const more = entries.length > 5 ? ` +${entries.length - 5}` : ''

  const title =
    dialog.kind === 'select' && dialog.mode === 'deselect'
      ? 'Desmarcar por padrão'
      : TITLES[dialog.kind]

  async function handleConfirm() {
    if (!dialog) return
    if (isPrompt && !text.trim()) return

    const refresh = usePaneStore.getState().refreshBoth
    setBusy(true)
    try {
      if (dialog.kind === 'mkdir') {
        if (isRemoteRoot(panePath)) {
          window.alert('Não é possível criar pastas na raiz «Rede». Abre uma ligação primeiro.')
          return
        }
        if (isRemotePath(panePath)) await ipc.remoteMkdir(joinRemotePath(panePath, text.trim()))
        else await ipc.createDir(panePath, text.trim())
        await refresh()
      } else if (dialog.kind === 'rename') {
        if (isRemotePath(dialog.entry.path)) {
          if (isConnectionRoot(dialog.entry.path)) {
            window.alert('Renomear ligações não é suportado aqui. Edita o nome no painel «Rede».')
            return
          }
          await ipc.remoteRename(dialog.entry.path, text.trim())
        } else {
          await ipc.renameItem(dialog.entry.path, text.trim())
        }
        await refresh()
      } else if (dialog.kind === 'delete') {
        const paths = dialog.entries.map((entry) => entry.path)
        // Connection entries at the `remote::` root delete the saved connection, never the server root.
        const connectionRoots = paths.filter(isConnectionRoot)
        const remoteFiles = paths.filter((path) => isRemotePath(path) && !isConnectionRoot(path))
        const localFiles = paths.filter((path) => !isRemotePath(path))
        for (const path of connectionRoots) {
          const parsed = parseRemotePath(path)
          if (parsed) await ipc.remoteDeleteConnection(parsed.connId)
        }
        if (connectionRoots.length > 0) await useRemoteStore.getState().load(true)
        if (remoteFiles.length > 0) await ipc.remoteDeleteFiles(remoteFiles)
        if (localFiles.length > 0) await ipc.deleteItems(localFiles, true)
        await refresh()
      } else if (dialog.kind === 'copy' || dialog.kind === 'move') {
        const sources = dialog.entries.map((entry) => entry.path)
        const hasRemote = sources.some(isRemotePath) || isRemotePath(dialog.destination)
        if (hasRemote) {
          await transferRemote(sources, dialog.destination, dialog.kind)
        } else if (sources.some(isArchivePath)) {
          // Copying entries out of an archive extracts them to the real destination.
          for (const source of sources) {
            if (isArchivePath(source)) {
              await ipc.extractArchiveEntry(source, dialog.destination)
            } else if (dialog.kind === 'copy') {
              await ipc.copyItems([source], dialog.destination, { policy })
            } else {
              await ipc.moveItems([source], dialog.destination, { policy })
            }
          }
        } else if (dialog.kind === 'copy') {
          await ipc.copyItems(sources, dialog.destination, { policy })
        } else {
          await ipc.moveItems(sources, dialog.destination, { policy })
        }
        await refresh()
      } else if (dialog.kind === 'select') {
        usePaneStore.getState().selectByPattern(dialog.side, text.trim(), dialog.mode)
      }
      close()
    } catch (error) {
      console.error(error)
    } finally {
      setBusy(false)
    }
  }

  const placeholder =
    dialog.kind === 'mkdir'
      ? 'Nome da pasta'
      : dialog.kind === 'rename'
        ? 'Novo nome'
        : 'padrão (ex.: *.txt)'

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50">
      <div className="w-[440px] rounded border border-slate-600 bg-panelAlt p-4 text-sm shadow-2xl">
        <h2 className="mb-3 text-base font-semibold text-slate-100">{title}</h2>

        {isPrompt ? (
          <input
            autoFocus
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void handleConfirm()
              if (event.key === 'Escape') close()
            }}
            className="mb-3 w-full rounded border border-slate-600 bg-panel px-2 py-1 text-slate-100 outline-none focus:border-sky-500"
            placeholder={placeholder}
          />
        ) : (
          <div className="mb-3 text-xs text-slate-400">
            <p>{description}</p>
            <p className="mt-1 truncate text-slate-500">
              {preview}
              {more}
            </p>
            {dialog.kind === 'copy' || dialog.kind === 'move' ? (
              <label className="mt-2 flex items-center gap-2">
                Se existir:
                <select
                  value={policy}
                  onChange={(event) => setPolicy(event.target.value as CopyPolicy)}
                  className="rounded border border-slate-600 bg-panel px-1 py-0.5 text-slate-200"
                >
                  <option value="overwrite">sobrescrever</option>
                  <option value="skip">ignorar</option>
                  <option value="rename">renomear</option>
                </select>
              </label>
            ) : null}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={close}
            disabled={busy}
            className="rounded border border-slate-600 px-3 py-1 text-slate-300 hover:bg-slate-700 disabled:opacity-40"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={busy || (isPrompt && !text.trim())}
            className="rounded bg-sky-600 px-3 py-1 font-medium text-white hover:bg-sky-500 disabled:opacity-40"
          >
            {busy ? '…' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  )
}
