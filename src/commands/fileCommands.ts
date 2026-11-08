import { ipc } from '../ipc/client'
import type { FileEntry } from '../ipc/types'
import { archivePathForEntry, parseArchivePath } from '../lib/archivePath'
import { isRemotePath, isRemoteRoot, parseRemotePath } from '../lib/remotePath'
import { useDialogStore } from '../state/dialogStore'
import { useHotlistStore } from '../state/hotlistStore'
import { usePaneStore, type PaneData, type PaneSide } from '../state/paneStore'
import { useQuickViewStore } from '../state/quickViewStore'
import { useToolStore } from '../state/toolStore'
import type { CommandId } from './commandRegistry'

function other(side: PaneSide): PaneSide {
  return side === 'left' ? 'right' : 'left'
}

function rootOf(path: string): string {
  // Ctrl+\ inside a remote connection jumps to the `remote::` network root; from there to the real root.
  if (isRemotePath(path)) return isRemoteRoot(path) ? '/' : 'remote::'
  const parsed = parseArchivePath(path)
  const real = parsed ? parsed.archive : path
  if (/^[A-Za-z]:[\\/]/.test(real)) return real.slice(0, 3)
  return '/'
}

/// Enter a directory / archive / remote entry. Remote connection roots connect best-effort first.
export async function navigateInto(side: PaneSide, entry: FileEntry): Promise<void> {
  if (entry.isDir) {
    const remote = parseRemotePath(entry.path)
    if (remote && remote.remotePath === '/') {
      await ipc.remoteConnect(remote.connId).catch(() => {})
    }
    await usePaneStore.getState().navigate(side, entry.path)
    return
  }
  const archivePath = archivePathForEntry(entry)
  if (archivePath) await usePaneStore.getState().navigate(side, archivePath)
}

function targets(pane: PaneData): FileEntry[] {
  const selected = pane.entries.filter((entry) => pane.selected[entry.path])
  if (selected.length > 0) return selected
  const cursor = pane.entries[pane.cursor]
  return cursor ? [cursor] : []
}

function cursorEntry(pane: PaneData): FileEntry | undefined {
  return pane.entries[pane.cursor]
}

export async function executeCommand(id: CommandId): Promise<void> {
  const store = usePaneStore.getState()
  const side = store.active
  const pane = store.panes[side]
  const dialog = useDialogStore.getState()
  const tools = useToolStore.getState()

  switch (id) {
    case 'TOGGLE_PANE':
      store.setActive(other(side))
      return
    case 'NAV_UP':
      await store.goUp(side)
      return
    case 'NAV_ROOT':
      if (pane.path) await store.navigate(side, rootOf(pane.path))
      return
    case 'NAV_ENTER': {
      const entry = cursorEntry(pane)
      if (!entry) return
      await navigateInto(side, entry)
      return
    }
    case 'HISTORY_BACK':
      await store.goBack(side)
      return
    case 'HISTORY_FORWARD':
      await store.goForward(side)
      return
    case 'NEW_TAB':
      await store.addTab(side)
      return
    case 'CLOSE_TAB':
      await store.closeTab(side, pane.activeTab)
      return
    case 'CURSOR_UP':
      store.moveCursor(side, -1)
      return
    case 'CURSOR_DOWN':
      store.moveCursor(side, 1)
      return
    case 'CURSOR_HOME':
      store.setCursor(side, 0)
      return
    case 'CURSOR_END':
      store.setCursor(side, Math.max(0, pane.entries.length - 1))
      return
    case 'TOGGLE_SELECT':
      store.toggleSelect(side)
      return
    case 'SELECT_ALL':
      store.selectAll(side)
      return
    case 'INVERT_SELECTION':
      store.invertSelection(side)
      return
    case 'SELECT_PATTERN':
      dialog.open({ kind: 'select', side, mode: 'select' })
      return
    case 'DESELECT_PATTERN':
      dialog.open({ kind: 'select', side, mode: 'deselect' })
      return
    case 'TOGGLE_HIDDEN':
      await store.toggleHidden(side)
      return
    case 'SEARCH':
      tools.open({ kind: 'search', side, root: pane.path })
      return
    case 'FILE_COPY': {
      const entries = targets(pane)
      if (entries.length === 0) return
      dialog.open({ kind: 'copy', side, entries, destination: store.panes[other(side)].path })
      return
    }
    case 'FILE_MOVE': {
      const entries = targets(pane)
      if (entries.length === 0) return
      dialog.open({ kind: 'move', side, entries, destination: store.panes[other(side)].path })
      return
    }
    case 'FILE_MKDIR':
      dialog.open({ kind: 'mkdir', side })
      return
    case 'FILE_DELETE': {
      const entries = targets(pane)
      if (entries.length === 0) return
      dialog.open({ kind: 'delete', side, entries })
      return
    }
    case 'FILE_RENAME': {
      const entry = cursorEntry(pane)
      if (entry) dialog.open({ kind: 'rename', side, entry })
      return
    }
    case 'FILE_VIEW': {
      const entry = cursorEntry(pane)
      if (entry && !entry.isDir) tools.open({ kind: 'viewer', path: entry.path })
      return
    }
    case 'FILE_EDIT': {
      const entry = cursorEntry(pane)
      if (entry) await ipc.openPath(entry.path).catch(() => {})
      return
    }
    case 'QUICK_VIEW': {
      useQuickViewStore.getState().toggle(cursorEntry(pane) ?? null)
      return
    }
    case 'HOTLIST_ADD': {
      useHotlistStore.getState().add(pane.path)
      return
    }
  }
}
