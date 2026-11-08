import type { FileEntry } from '../../ipc/types'
import { usePaneStore, type PaneData, type PaneSide } from '../../state/paneStore'
import { useToolStore } from '../../state/toolStore'
import { HotlistMenu } from './HotlistMenu'

function basename(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).pop() || path
}

function currentContext(): { side: PaneSide; pane: PaneData; targets: FileEntry[] } {
  const store = usePaneStore.getState()
  const side = store.active
  const pane = store.panes[side]
  const selected = pane.entries.filter((entry) => pane.selected[entry.path])
  const targets =
    selected.length > 0
      ? selected
      : pane.entries[pane.cursor]
        ? [pane.entries[pane.cursor]]
        : []
  return { side, pane, targets }
}

const BTN =
  'px-2 py-0.5 rounded border border-slate-600 text-[11px] text-slate-300 hover:bg-slate-700 disabled:opacity-40'

export function ToolBar() {
  const open = useToolStore((state) => state.open)
  const viewMode = usePaneStore((state) => state.panes[state.active].viewMode)

  function onRemote() {
    open({ kind: 'remote' })
  }

  function onSearch() {
    const store = usePaneStore.getState()
    const side = store.active
    open({ kind: 'search', side, root: store.panes[side].path })
  }

  function onChecksum() {
    const { targets } = currentContext()
    const paths = targets.filter((entry) => !entry.isDir).map((entry) => entry.path)
    if (paths.length > 0) open({ kind: 'checksum', paths })
  }

  function onZip() {
    const { pane, targets } = currentContext()
    if (targets.length === 0) return
    const name = targets.length === 1 ? `${basename(targets[0].path)}.zip` : 'arquivo.zip'
    open({
      kind: 'zip',
      sources: targets.map((entry) => entry.path),
      defaultName: name,
      basePath: pane.path,
      format: 'zip',
    })
  }

  function onTar() {
    const { pane, targets } = currentContext()
    if (targets.length === 0) return
    const base = targets.length === 1 ? basename(targets[0].path) : 'arquivo'
    open({
      kind: 'zip',
      sources: targets.map((entry) => entry.path),
      defaultName: `${base}.tar.gz`,
      basePath: pane.path,
      format: 'tar',
    })
  }

  function onExtract() {
    const { pane, targets } = currentContext()
    const archive = targets.find((entry) => /\.(zip|tar|tgz|tar\.gz)$/i.test(entry.name))
    if (archive) open({ kind: 'extract', archive: archive.path, basePath: pane.path })
  }

  function onMultiRename() {
    const { targets } = currentContext()
    if (targets.length > 0) open({ kind: 'multirename', entries: targets })
  }

  function onSplit() {
    const { targets } = currentContext()
    const file = targets.find((entry) => !entry.isDir)
    if (file) open({ kind: 'split', entry: file })
  }

  function onCompare() {
    const store = usePaneStore.getState()
    open({ kind: 'compare', left: store.panes.left.path, right: store.panes.right.path })
  }

  function onSync() {
    const store = usePaneStore.getState()
    open({ kind: 'sync', left: store.panes.left.path, right: store.panes.right.path })
  }

  function onInvert() {
    const store = usePaneStore.getState()
    store.invertSelection(store.active)
  }

  function onToggleTree() {
    const store = usePaneStore.getState()
    store.toggleView(store.active)
  }

  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-slate-700 bg-panelAlt px-2 py-1">
      <span className="mr-1 text-[11px] font-semibold text-sky-400">Nuke</span>
      <HotlistMenu />
      <button type="button" className={BTN} onClick={onRemote} title="Ligações remotas (FTP/FTPS/SFTP/WebDAV)">
        Rede
      </button>
      <button type="button" className={BTN} onClick={onSearch} title="Alt+F7">
        Pesquisar
      </button>
      <button type="button" className={BTN} onClick={onChecksum}>
        Checksums
      </button>
      <button type="button" className={BTN} onClick={onZip}>
        ZIP
      </button>
      <button type="button" className={BTN} onClick={onTar}>
        TAR
      </button>
      <button type="button" className={BTN} onClick={onExtract}>
        Extrair
      </button>
      <button type="button" className={BTN} onClick={onMultiRename}>
        Multi-rename
      </button>
      <button type="button" className={BTN} onClick={onSplit}>
        Dividir
      </button>
      <button type="button" className={BTN} onClick={onCompare}>
        Comparar
      </button>
      <button type="button" className={BTN} onClick={onSync}>
        Sincronizar
      </button>
      <button type="button" className={BTN} onClick={onInvert} title="Ctrl+I ou *">
        Inverter
      </button>
      <button type="button" className={BTN} onClick={onToggleTree} title="Alternar lista/árvore">
        {viewMode === 'tree' ? 'Lista' : 'Árvore'}
      </button>
    </div>
  )
}

export { basename }
