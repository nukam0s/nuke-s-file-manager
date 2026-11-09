import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'

import type { IpcApi, UnlistenFn } from './api'
import type {
  DriveInfo,
  FileEntry,
  ListingResult,
  OperationResult,
  ProgressUpdate,
} from './types'

function notSupported(tool: string): Promise<never> {
  return Promise.reject(
    new Error(`${tool} não está disponível no build Tauri. Usa o build portátil (Node).`),
  )
}

/// IPC implementation used when running inside the Tauri WebView.
export const tauriIpc: IpcApi = {
  listDir(path, showHidden, sort) {
    return invoke<ListingResult>('list_dir', { path, showHidden, sort })
  },
  getMetadata(path) {
    return invoke<FileEntry>('get_metadata', { path })
  },
  copyItems(sources, destination) {
    return invoke<OperationResult>('copy_items', { sources, destination })
  },
  moveItems(sources, destination) {
    return invoke<OperationResult>('move_items', { sources, destination })
  },
  deleteItems(paths, useTrash) {
    return invoke<OperationResult>('delete_items', { paths, useTrash })
  },
  renameItem(path, newName) {
    return invoke<FileEntry>('rename_item', { path, newName })
  },
  createDir(parent, name) {
    return invoke<FileEntry>('create_dir', { parent, name })
  },
  getDrives() {
    return invoke<DriveInfo[]>('get_drives')
  },
  getHomeDir() {
    return invoke<string>('get_home_dir')
  },
  onProgress(callback) {
    return listen<ProgressUpdate>('operation://progress', (event) => callback(event.payload))
  },
  onCompleted(callback) {
    return listen<OperationResult>('operation://completed', (event) => callback(event.payload))
  },

  pauseOperation: () => Promise.resolve(false),
  resumeOperation: () => Promise.resolve(false),
  cancelOperation: () => Promise.resolve(false),

  // Tools are only implemented in the portable Node backend.
  search: () => notSupported('Pesquisa'),
  readFileText: () => notSupported('Viewer'),
  writeFileText: () => notSupported('Editor'),
  openPath: () => notSupported('Abrir com app padrão'),
  openWith: () => notSupported('Abrir com…'),
  checksums: () => notSupported('Checksums'),
  multiRename: () => notSupported('Multi-rename'),
  splitFile: () => notSupported('Split'),
  combineFiles: () => notSupported('Combine'),
  packZip: () => notSupported('ZIP'),
  extractZip: () => notSupported('Unzip'),
  packTar: () => notSupported('TAR'),
  extractTar: () => notSupported('Untar'),
  extractArchive: () => notSupported('Extrair arquivo'),
  extractArchiveEntry: () => notSupported('Extrair entrada de arquivo'),
  compareDirs: () => notSupported('Comparar'),
  syncDirs: () => notSupported('Sincronizar'),
  tree: () => notSupported('Árvore'),

  remoteList: () => notSupported('Ficheiros remotos'),
  remoteSave: () => notSupported('Ficheiros remotos'),
  remoteDeleteConnection: () => notSupported('Ficheiros remotos'),
  remoteTest: () => notSupported('Ficheiros remotos'),
  remoteConnect: () => notSupported('Ficheiros remotos'),
  remoteDisconnect: () => notSupported('Ficheiros remotos'),
  remoteMkdir: () => notSupported('Ficheiros remotos'),
  remoteDeleteFiles: () => notSupported('Ficheiros remotos'),
  remoteRename: () => notSupported('Ficheiros remotos'),
  remoteDownload: () => notSupported('Ficheiros remotos'),
  remoteUpload: () => notSupported('Ficheiros remotos'),

  // Settings live in the portable Node backend; the Tauri build keeps localStorage.
  getSetting: () => notSupported('Definições persistentes'),
  setSetting: () => notSupported('Definições persistentes'),
}

export type { UnlistenFn }
