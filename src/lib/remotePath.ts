// Helpers for the "network root" virtual path contract.
// Virtual path format: `remote::<connId>::<remotePath>` where `remotePath` uses `/`.
// The bare root `remote::` (no connId) lists the saved connections as folders.
// Keep in sync with server/remoteService.js.
import type { RemoteConnection, RemoteProtocol } from '../ipc/types'

export const REMOTE_ROOT = 'remote::'

export interface ParsedRemotePath {
  connId: string
  remotePath: string
}

export function isRemotePath(path: string): boolean {
  return typeof path === 'string' && path.startsWith(REMOTE_ROOT)
}

/** True for the bare network root `remote::` (which has no connection id yet). */
export function isRemoteRoot(path: string): boolean {
  return path === REMOTE_ROOT
}

/** Normalises a remote path to an absolute, `/`-separated path without trailing slashes. */
export function normalizeRemotePath(value: string): string {
  if (typeof value !== 'string' || value === '') return '/'
  let result = value.replace(/\\/g, '/')
  if (!result.startsWith('/')) result = `/${result}`
  result = result.replace(/\/+/g, '/')
  if (result !== '/') result = result.replace(/\/+$/, '')
  return result
}

/** Parses `remote::<connId>::<remotePath>`. Returns null for the bare root or invalid input. */
export function parseRemotePath(path: string): ParsedRemotePath | null {
  if (!isRemotePath(path)) return null
  const rest = path.slice(REMOTE_ROOT.length)
  const sep = rest.indexOf('::')
  if (sep <= 0) return null
  const connId = rest.slice(0, sep)
  const remotePath = normalizeRemotePath(rest.slice(sep + 2))
  return { connId, remotePath }
}

export function toRemotePath(connId: string, remotePath = '/'): string {
  return `${REMOTE_ROOT}${connId}::${normalizeRemotePath(remotePath)}`
}

/**
 * Parent of a remote path:
 * - inside a connection, one level up
 * - at the connection root (`remote::<id>::/`) -> `remote::`
 * - at the network root (`remote::`) -> null
 */
export function remoteParent(path: string): string | null {
  if (isRemoteRoot(path)) return null
  const parsed = parseRemotePath(path)
  if (!parsed) return null
  if (parsed.remotePath === '/') return REMOTE_ROOT
  const idx = parsed.remotePath.lastIndexOf('/')
  const parentRemote = idx <= 0 ? '/' : parsed.remotePath.slice(0, idx)
  return toRemotePath(parsed.connId, parentRemote)
}

/** Basename of the final segment of a remote path (the connection id at the root). */
export function remoteBasename(path: string): string {
  const parsed = parseRemotePath(path)
  if (!parsed) {
    const parts = path.split(/[\\/]/).filter(Boolean)
    return parts.length > 0 ? parts[parts.length - 1] : path
  }
  const cleaned = parsed.remotePath.replace(/\/+$/, '')
  if (cleaned === '' || cleaned === '/') return parsed.connId
  return cleaned.slice(cleaned.lastIndexOf('/') + 1)
}

/** Joins a name onto a remote *directory* path, e.g. `remote::<id>::/docs` + `file.txt`. */
export function joinRemotePath(path: string, name: string): string {
  const parsed = parseRemotePath(path)
  if (!parsed) return path
  const base = parsed.remotePath === '/' ? '' : parsed.remotePath.replace(/\/+$/, '')
  return toRemotePath(parsed.connId, `${base}/${name}`)
}

/** Joins a name onto a local filesystem directory path, preserving the separator style. */
export function joinLocalPath(dir: string, name: string): string {
  if (!dir) return name
  if (dir.endsWith('/') || dir.endsWith('\\')) return `${dir}${name}`
  const sep = dir.includes('\\') && !dir.includes('/') ? '\\' : '/'
  return `${dir}${sep}${name}`
}

const PROTOCOL_LABELS: Record<RemoteProtocol, string> = {
  ftp: 'FTP',
  ftps: 'FTPS',
  sftp: 'SFTP',
  webdav: 'WebDAV',
}

export function remoteProtocolLabel(protocol: RemoteProtocol | string): string {
  return PROTOCOL_LABELS[protocol as RemoteProtocol] ?? String(protocol).toUpperCase()
}

type ConnectionSummary = Pick<RemoteConnection, 'id' | 'name' | 'host' | 'protocol'>

/**
 * Human readable label for a remote path, e.g. `sftp › host › /docs`.
 * Falls back to the connection id when no connection metadata is available.
 */
export function remoteDisplayName(
  path: string,
  connections?: readonly ConnectionSummary[],
): string {
  if (isRemoteRoot(path)) return 'Rede'
  const parsed = parseRemotePath(path)
  if (!parsed) return path
  const conn = connections?.find((candidate) => candidate.id === parsed.connId)
  if (!conn) return [parsed.connId, parsed.remotePath].join(' › ')
  return [conn.protocol, conn.host || conn.name, parsed.remotePath].join(' › ')
}
