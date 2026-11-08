import type {
  ChecksumEntry,
  CombineResult,
  CompareResult,
  CopyOptions,
  DriveInfo,
  FileContent,
  FileEntry,
  ListingResult,
  OperationResult,
  ProgressUpdate,
  RenameItem,
  SearchResult,
  SortOptions,
  SplitResult,
  SyncDirection,
  SyncResult,
  RemoteConnection,
  RemoteConnectionInput,
  RemoteListResult,
  RemoteTestResult,
  RemoteTransferResult,
  TreeResult,
} from './types'

export type UnlistenFn = () => void

/// Contract shared by the Tauri backend, the portable HTTP backend and the browser mock.
export interface IpcApi {
  listDir(path: string, showHidden: boolean, sort: SortOptions): Promise<ListingResult>
  getMetadata(path: string): Promise<FileEntry>
  copyItems(sources: string[], destination: string, options?: CopyOptions): Promise<OperationResult>
  moveItems(sources: string[], destination: string, options?: CopyOptions): Promise<OperationResult>
  deleteItems(paths: string[], useTrash: boolean): Promise<OperationResult>
  renameItem(path: string, newName: string): Promise<FileEntry>
  createDir(parent: string, name: string): Promise<FileEntry>
  getDrives(): Promise<DriveInfo[]>
  getHomeDir(): Promise<string>
  onProgress(callback: (update: ProgressUpdate) => void): Promise<UnlistenFn>
  onCompleted(callback: (result: OperationResult) => void): Promise<UnlistenFn>

  // Operation control
  pauseOperation(): Promise<boolean>
  resumeOperation(): Promise<boolean>
  cancelOperation(): Promise<boolean>

  // Tools
  search(
    root: string,
    query: string,
    recursive: boolean,
    maxResults?: number,
    inContent?: boolean,
  ): Promise<SearchResult>
  readFileText(path: string): Promise<FileContent>
  writeFileText(path: string, content: string): Promise<FileEntry>
  openPath(path: string): Promise<boolean>
  openWith(path: string, command: string): Promise<boolean>
  checksums(paths: string[], algorithm: string): Promise<ChecksumEntry[]>
  multiRename(items: RenameItem[]): Promise<OperationResult>
  splitFile(path: string, partSizeBytes: number, destDir: string): Promise<SplitResult>
  combineFiles(parts: string[], output: string): Promise<CombineResult>
  packZip(sources: string[], destination: string): Promise<OperationResult>
  extractZip(archive: string, destination: string): Promise<OperationResult>
  packTar(sources: string[], destination: string): Promise<OperationResult>
  extractTar(archive: string, destination: string): Promise<OperationResult>
  extractArchive(archive: string, destination: string): Promise<OperationResult>
  /// Extracts a single archive-internal entry (virtual `zip::`/`tar::` path) to a real destination.
  extractArchiveEntry(path: string, destination: string): Promise<OperationResult>
  compareDirs(left: string, right: string): Promise<CompareResult>
  syncDirs(left: string, right: string, direction: SyncDirection): Promise<SyncResult>
  tree(root: string, maxDepth?: number): Promise<TreeResult>

  // Remote filesystems (FTP / FTPS / SFTP / WebDAV)
  remoteList(): Promise<RemoteListResult>
  remoteSave(connection: RemoteConnectionInput, password?: string): Promise<RemoteConnection>
  remoteDeleteConnection(id: string): Promise<{ ok: boolean }>
  remoteTest(connection: RemoteConnectionInput, password?: string): Promise<RemoteTestResult>
  remoteConnect(id: string): Promise<{ ok: boolean }>
  remoteDisconnect(id: string): Promise<{ ok: boolean }>
  remoteMkdir(path: string): Promise<FileEntry>
  remoteDeleteFiles(paths: string[]): Promise<OperationResult>
  remoteRename(path: string, newName: string): Promise<FileEntry>
  remoteDownload(path: string, destination: string): Promise<RemoteTransferResult>
  remoteUpload(localPath: string, destination: string): Promise<FileEntry>
}
