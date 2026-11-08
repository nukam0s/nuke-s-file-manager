// Helpers for the "archives as folders" virtual path contract.
// Virtual path format: `<zip|tar>::<absoluteArchivePath>::<inner>` where `inner` uses `/`
// and may be empty (archive root). Keep in sync with server/archiveService.js.

import type { FileEntry } from '../ipc/types'

export type ArchiveType = 'zip' | 'tar'

export interface ParsedArchivePath {
  type: ArchiveType
  archive: string
  inner: string
}

function normalizeInner(value: string): string {
  return value.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '')
}

export function parseArchivePath(path: string): ParsedArchivePath | null {
  if (typeof path !== 'string') return null
  let type: ArchiveType
  if (path.startsWith('zip::')) type = 'zip'
  else if (path.startsWith('tar::')) type = 'tar'
  else return null

  const rest = path.slice(type.length + 2)
  const sep = rest.indexOf('::')
  if (sep < 0) return null
  const archive = rest.slice(0, sep)
  const inner = normalizeInner(rest.slice(sep + 2))
  return { type, archive, inner }
}

export function isArchivePath(path: string): boolean {
  return parseArchivePath(path) !== null
}

export function toArchivePath(type: ArchiveType, archive: string, inner = ''): string {
  return `${type}::${archive}::${inner}`
}

// Parent of an archive path: one level up inside the archive, or the real directory
// that contains the archive file when we're already at the archive root.
export function archiveParent(path: string): string | null {
  const parsed = parseArchivePath(path)
  if (!parsed) return null
  if (!parsed.inner) return realDirname(parsed.archive)
  const idx = parsed.inner.lastIndexOf('/')
  const parentInner = idx < 0 ? '' : parsed.inner.slice(0, idx)
  return toArchivePath(parsed.type, parsed.archive, parentInner)
}

function realDirname(p: string): string {
  const trimmed = p.replace(/[\\/]+$/, '')
  const idx = Math.max(trimmed.lastIndexOf('\\'), trimmed.lastIndexOf('/'))
  if (idx < 0) return trimmed
  const parent = trimmed.slice(0, idx)
  if (parent === '') {
    if (/^[A-Za-z]:$/.test(trimmed.slice(0, 2))) return `${trimmed.slice(0, 2)}\\`
    return trimmed.slice(0, 1) || '/'
  }
  if (/^[A-Za-z]:$/.test(parent)) return `${parent}\\`
  return parent
}

function baseName(p: string): string {
  const parts = p.replace(/[\\/]+$/, '').split(/[\\/]/)
  return parts[parts.length - 1] || p
}

// Human readable label, e.g. `a.zip › subdir` (or `a.zip` at the archive root).
export function archiveDisplayName(path: string): string {
  const parsed = parseArchivePath(path)
  if (!parsed) return path
  const archiveName = baseName(parsed.archive)
  const parts = parsed.inner.split('/').filter(Boolean)
  return [archiveName, ...parts].join(' › ')
}

const ARCHIVE_FILE_RE = /\.(zip|tar|tgz|tar\.gz)$/i

export function isArchiveFile(name: string): boolean {
  return ARCHIVE_FILE_RE.test(name)
}

// Returns the virtual archive path to enter for a real archive file, or null.
// Entries that are already inside an archive are ignored (nested archives are out of scope).
export function archivePathForEntry(entry: Pick<FileEntry, 'name' | 'path' | 'isDir'>): string | null {
  if (entry.isDir) return null
  if (isArchivePath(entry.path)) return null
  if (!isArchiveFile(entry.name)) return null
  const type: ArchiveType = /\.zip$/i.test(entry.name) ? 'zip' : 'tar'
  return toArchivePath(type, entry.path, '')
}
