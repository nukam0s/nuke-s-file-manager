import type { DragEvent, MouseEvent as ReactMouseEvent } from 'react'

import { isHttpBackend } from '../../ipc/client'
import type { FileEntry } from '../../ipc/types'
import { formatDate, formatSize } from '../../lib/format'
import { FileIcon } from './FileIcon'

const IMAGE_EXT = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg']

interface FileRowProps {
  entry: FileEntry
  isCursor: boolean
  isSelected: boolean
  onClick: () => void
  onDoubleClick: () => void
  onToggle: () => void
  onDragStart?: (event: DragEvent<HTMLDivElement>) => void
  onDragOver?: (event: DragEvent<HTMLDivElement>) => void
  onDrop?: (event: DragEvent<HTMLDivElement>) => void
  onContextMenu?: (event: ReactMouseEvent<HTMLDivElement>) => void
}

export function FileRow({
  entry,
  isCursor,
  isSelected,
  onClick,
  onDoubleClick,
  onToggle,
  onDragStart,
  onDragOver,
  onDrop,
  onContextMenu,
}: FileRowProps) {
  const background = isSelected ? 'bg-sky-900/60' : isCursor ? 'bg-slate-700/70' : ''
  const showThumb =
    isHttpBackend && !entry.isDir && IMAGE_EXT.includes(entry.extension ?? '')

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onContextMenu={onContextMenu}
      className={`flex h-[26px] cursor-default items-center gap-2 px-2 text-xs hover:bg-slate-700/40 ${background}`}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
    >
      <button
        type="button"
        title="Selecionar"
        onClick={(event) => {
          event.stopPropagation()
          onToggle()
        }}
        className={`h-3 w-3 shrink-0 rounded-sm border ${
          isSelected ? 'border-sky-400 bg-sky-500' : 'border-slate-500 bg-transparent'
        }`}
      />
      {showThumb ? (
        <img
          src={`/api/raw?path=${encodeURIComponent(entry.path)}`}
          alt=""
          loading="lazy"
          className="h-4 w-4 shrink-0 rounded object-cover"
        />
      ) : (
        <FileIcon entry={entry} />
      )}
      <span className="min-w-0 flex-1 truncate" title={entry.name}>
        {entry.name}
      </span>
      <span className="w-20 shrink-0 text-right text-slate-400">
        {entry.isDir ? '<DIR>' : formatSize(entry.size)}
      </span>
      <span className="w-36 shrink-0 text-right text-slate-500">
        {formatDate(entry.modified)}
      </span>
    </div>
  )
}
