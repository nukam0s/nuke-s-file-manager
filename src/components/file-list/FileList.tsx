import { useEffect, useRef } from 'react'
import type { DragEvent } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'

import { navigateInto } from '../../commands/fileCommands'
import { ipc } from '../../ipc/client'
import type { FileEntry } from '../../ipc/types'
import { useContextMenuStore } from '../../state/contextMenuStore'
import { usePaneStore, type PaneSide } from '../../state/paneStore'
import { FileRow } from './FileRow'
import { SortHeader } from './SortHeader'

const DRAG_TYPE = 'application/x-fm-paths'

export function FileList({ side }: { side: PaneSide }) {
  const entries = usePaneStore((state) => state.panes[side].entries)
  const cursor = usePaneStore((state) => state.panes[side].cursor)
  const selected = usePaneStore((state) => state.panes[side].selected)
  const panePath = usePaneStore((state) => state.panes[side].path)
  const setCursor = usePaneStore((state) => state.setCursor)
  const toggleSelectPath = usePaneStore((state) => state.toggleSelectPath)
  const setActive = usePaneStore((state) => state.setActive)

  const parentRef = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: entries.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 26,
    overscan: 12,
  })

  useEffect(() => {
    if (entries.length > 0) virtualizer.scrollToIndex(cursor, { align: 'auto' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursor, entries.length])

  function startDrag(event: DragEvent<HTMLDivElement>, entry: FileEntry) {
    const selectedPaths = Object.keys(selected)
    const paths = selected[entry.path] && selectedPaths.length > 0 ? selectedPaths : [entry.path]
    event.dataTransfer.setData(DRAG_TYPE, JSON.stringify(paths))
    event.dataTransfer.effectAllowed = 'copyMove'
  }

  function dropInto(event: DragEvent<HTMLDivElement>, targetDir: string) {
    event.preventDefault()
    event.stopPropagation()
    let paths: string[] = []
    try {
      paths = JSON.parse(event.dataTransfer.getData(DRAG_TYPE) || '[]') as string[]
    } catch {
      paths = []
    }
    if (paths.length === 0) return
    const copy = event.ctrlKey || event.altKey
    const action = copy
      ? ipc.copyItems(paths, targetDir, { policy: 'overwrite' })
      : ipc.moveItems(paths, targetDir, { policy: 'overwrite' })
    void action
      .then(() => usePaneStore.getState().refreshBoth())
      .catch(() => {})
  }

  return (
    <div className="flex h-full flex-col">
      <SortHeader side={side} />
      <div
        ref={parentRef}
        className="min-h-0 flex-1 overflow-auto"
        onMouseDown={() => setActive(side)}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => dropInto(event, panePath)}
      >
        <div style={{ height: virtualizer.getTotalSize(), position: 'relative', width: '100%' }}>
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const entry = entries[virtualRow.index]
            return (
              <div
                key={entry.path}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: virtualRow.size,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <FileRow
                  entry={entry}
                  isCursor={virtualRow.index === cursor}
                  isSelected={Boolean(selected[entry.path])}
                  onClick={() => setCursor(side, virtualRow.index)}
                  onDoubleClick={() => {
                    setActive(side)
                    void navigateInto(side, entry)
                  }}
                  onToggle={() => toggleSelectPath(side, entry.path)}
                  onDragStart={(event) => startDrag(event, entry)}
                  onDragOver={
                    entry.isDir
                      ? (event) => {
                          event.preventDefault()
                          event.stopPropagation()
                        }
                      : undefined
                  }
                  onDrop={
                    entry.isDir ? (event) => dropInto(event, entry.path) : undefined
                  }
                  onContextMenu={(event) => {
                    setActive(side)
                    setCursor(side, virtualRow.index)
                    useContextMenuStore
                      .getState()
                      .open(side, entry, event.clientX, event.clientY)
                  }}
                />
              </div>
            )
          })}
        </div>
        {entries.length === 0 ? (
          <div className="p-4 text-center text-xs text-slate-500">(pasta vazia)</div>
        ) : null}
      </div>
    </div>
  )
}
