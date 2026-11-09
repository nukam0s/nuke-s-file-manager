// Shared DTOs. Keep in sync with the Node backend (server/) and the Rust domain.

export type SortField = 'name' | 'extension' | 'size' | 'modified'
export type SortDir = 'asc' | 'desc'

export interface SortOptions {
  field: SortField
  dir: SortDir
}

export interface FileEntry {
  name: string
  path: string
  isDir: boolean
  isSymlink: boolean
  size: number
  modified: string | null
  extension: string | null
  attributes: string
}

export interface DriveInfo {
  path: string
  label: string
  kind: string
  total: number
  free: number
}

export interface ListingResult {
  parent: string | null
  entries: FileEntry[]
}

export interface OperationError {
  path: string
  message: string
}

export interface OperationResult {
  opId: string
  success: number
  skipped: number
  failed: number
  errors: OperationError[]
  cancelled: boolean
}

export interface ProgressUpdate {
  opId: string
  processed: number
  total: number
  current: string
}

export type CopyPolicy = 'overwrite' | 'skip' | 'rename'

export interface CopyOptions {
  policy: CopyPolicy
}

// --- Tools ---

export interface FileContent {
  path: string
  content: string
  truncated: boolean
  binary: boolean
  size: number
}

export interface SearchResult {
  entries: FileEntry[]
  truncated: boolean
}

export interface ChecksumEntry {
  path: string
  algorithm: string
  hash: string
  size: number
  error?: string
}

export interface RenameItem {
  path: string
  newName: string
}

export interface SplitResult {
  parts: string[]
  total: number
}

export interface CombineResult {
  output: string
  size: number
}

export type CompareStatus = 'onlyLeft' | 'onlyRight' | 'different' | 'same'

export interface CompareEntry {
  name: string
  leftPath?: string
  rightPath?: string
  status: CompareStatus
  leftSize?: number
  rightSize?: number
}

export interface CompareResult {
  entries: CompareEntry[]
  onlyLeft: number
  onlyRight: number
  different: number
  same: number
}

export type SyncDirection = 'leftToRight' | 'rightToLeft'

export interface SyncEntry {
  path: string
  action: string
}

export interface SyncResult {
  copied: number
  skipped: number
  failed: number
  entries: SyncEntry[]
  errors: OperationError[]
}

export interface TreeResult {
  name: string
  path: string
  isDir: boolean
  children: TreeResult[] | null
}

// --- Remote filesystems (FTP / FTPS / SFTP / WebDAV) ---

export type RemoteProtocol = 'ftp' | 'ftps' | 'sftp' | 'webdav'

export interface RemoteConnection {
  id: string
  name: string
  protocol: RemoteProtocol
  host: string
  port: number
  username: string
  secure: boolean
  ftpsImplicit: boolean
  rootPath: string
  createdAt: string
}

export interface RemoteConnectionInput {
  id?: string
  name: string
  protocol: RemoteProtocol
  host: string
  port: number
  username: string
  secure: boolean
  ftpsImplicit?: boolean
  rootPath?: string
  createdAt?: string
}

export interface RemoteListResult {
  connections: RemoteConnection[]
}

export interface RemoteTestResult {
  ok: boolean
  error?: string
}

export interface RemoteTransferResult {
  destination: string
  size: number
}

// --- Persistent settings (hotlist / extension associations) ---

/// Response of `GET /api/settings?key=<key>`. `value` is `null` when unset.
export interface SettingReadResult {
  value: unknown
}

/// Response of `POST /api/settings`.
export interface SettingWriteResult {
  ok: boolean
}
