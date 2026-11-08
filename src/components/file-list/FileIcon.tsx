import type { FileEntry } from '../../ipc/types'

const IMAGE = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico']
const VIDEO = ['mp4', 'mkv', 'avi', 'mov', 'webm']
const AUDIO = ['mp3', 'wav', 'flac', 'ogg', 'm4a']
const ARCHIVE = ['zip', 'rar', '7z', 'tar', 'tgz', 'gz', 'bz2']
const BINARY = ['exe', 'msi', 'app', 'sh', 'bat', 'cmd']
const TEXT = ['md', 'txt', 'log', 'ini', 'cfg']
const CODE = ['ts', 'tsx', 'js', 'jsx', 'rs', 'py', 'go', 'java', 'c', 'cpp', 'json', 'toml', 'yml', 'yaml']

function iconFor(entry: FileEntry): string {
  if (entry.isDir) return '📁'
  if (entry.isSymlink) return '🔗'
  const ext = entry.extension ?? ''
  if (IMAGE.includes(ext)) return '🖼️'
  if (VIDEO.includes(ext)) return '🎬'
  if (AUDIO.includes(ext)) return '🎵'
  if (ARCHIVE.includes(ext)) return '🗜️'
  if (BINARY.includes(ext)) return '⚙️'
  if (TEXT.includes(ext)) return '📝'
  if (CODE.includes(ext)) return '📜'
  return '📄'
}

export function FileIcon({ entry }: { entry: FileEntry }) {
  return (
    <span className="w-4 shrink-0 text-center" aria-hidden>
      {iconFor(entry)}
    </span>
  )
}
