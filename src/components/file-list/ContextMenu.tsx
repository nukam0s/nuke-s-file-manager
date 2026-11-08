import { navigateInto } from '../../commands/fileCommands'
import { ipc } from '../../ipc/client'
import { isRemotePath } from '../../lib/remotePath'
import { useAssociationsStore } from '../../state/associationsStore'
import { useContextMenuStore } from '../../state/contextMenuStore'
import { useDialogStore } from '../../state/dialogStore'
import { useToolStore } from '../../state/toolStore'

const ITEM = 'block w-full px-3 py-1 text-left text-xs text-slate-200 hover:bg-slate-700'

export function ContextMenu() {
  const side = useContextMenuStore((state) => state.side)
  const entry = useContextMenuStore((state) => state.entry)
  const x = useContextMenuStore((state) => state.x)
  const y = useContextMenuStore((state) => state.y)
  const close = useContextMenuStore((state) => state.close)

  if (!entry) return null

  async function onOpen() {
    close()
    // Remote entries open inside the file manager (connect + navigate) rather than the OS.
    if (isRemotePath(entry!.path)) {
      await navigateInto(side, entry!)
      return
    }
    await ipc.openPath(entry!.path).catch(() => {})
  }

  function onView() {
    close()
    useToolStore.getState().open({ kind: 'viewer', path: entry!.path })
  }

  function onRename() {
    close()
    useDialogStore.getState().open({ kind: 'rename', side, entry: entry! })
  }

  function onDelete() {
    close()
    useDialogStore.getState().open({ kind: 'delete', side, entries: [entry!] })
  }

  function onCopyPath() {
    close()
    void navigator.clipboard.writeText(entry!.path).catch(() => {})
  }

  function onProperties() {
    close()
    useToolStore.getState().open({ kind: 'properties', entry: entry! })
  }

  async function onOpenWith() {
    close()
    const assoc = useAssociationsStore.getState().getFor(entry!.extension)
    if (assoc) {
      await ipc.openWith(entry!.path, assoc).catch(() => {})
    } else {
      useToolStore.getState().open({ kind: 'openwith', entry: entry! })
    }
  }

  return (
    <div
      className="fixed inset-0 z-50"
      onClick={close}
      onContextMenu={(event) => {
        event.preventDefault()
        close()
      }}
    >
      <div
        className="absolute min-w-48 rounded border border-slate-600 bg-panelAlt py-1 shadow-2xl"
        style={{
          left: Math.max(0, Math.min(x, window.innerWidth - 200)),
          top: Math.max(0, Math.min(y, window.innerHeight - 280)),
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" className={ITEM} onClick={() => void onOpen()}>
          Abrir (F4)
        </button>
        <button type="button" className={ITEM} onClick={onView}>
          Ver (F3)
        </button>
        <button type="button" className={ITEM} onClick={onRename}>
          Renomear (F2)
        </button>
        <button type="button" className={ITEM} onClick={onDelete}>
          Apagar (F8)
        </button>
        <div className="my-1 border-t border-slate-700" />
        <button type="button" className={ITEM} onClick={onCopyPath}>
          Copiar caminho
        </button>
        <button type="button" className={ITEM} onClick={onProperties}>
          Propriedades
        </button>
        <button type="button" className={ITEM} onClick={() => void onOpenWith()}>
          Abrir com…
        </button>
      </div>
    </div>
  )
}
