# Backend Portátil (Node SEA) — alternativa/legado

> **Nota:** este documento descreve o **backend portátil Node (SEA)**, agora o caminho
> **alternativo/legado**. O empacotamento principal é **Electron** — ver
> [`08-electron.md`](08-electron.md). O backend HTTP (módulos, API e segurança) é partilhado pelos dois.

> Executável único portátil: **Tauri exigia Rust+MSVC (indisponível)** → backend reimplementado em
> Node.js e empacotado com **Single Executable Application (SEA)**.

---

## 1. Módulos

| Ficheiro | Responsabilidade |
|---|---|
| [`server/main.js`](../../server/main.js) | HTTP server, rotas, SSE, assets embutidos, `/api/raw` |
| [`server/fsService.js`](../../server/fsService.js) | list/metadata/read/write/copy/move/delete/rename/mkdir/drives/home + política de conflitos + pausa/cancelar |
| [`server/toolsService.js`](../../server/toolsService.js) | search (nome/conteúdo), checksums, multi-rename, split/combine, zip, tar, compare, sync, tree, extractArchive, open, open_with |
| [`server/archiveService.js`](../../server/archiveService.js) | “arquivos como pastas”: listar/ler/extrair dentro de ZIP (`adm-zip`) e TAR (`tar`, incl. `.tar.gz`/`.tgz`) |
| [`server/remoteService.js`](../../server/remoteService.js) | FTP/FTPS/SFTP/WebDAV (conectores) + cofre de credenciais encriptado |

## 2. Seleção de backend no frontend

[`src/ipc/client.ts`](../../src/ipc/client.ts): Tauri (`__TAURI_INTERNALS__`), HTTP
(`__FM_BACKEND__ === 'http'`, injetado no HTML) ou Mock (dev browser).

## 3. API HTTP

| Método | Rota | Corpo | Resposta |
|---|---|---|---|
| GET | `/api/health` · `/api/home` · `/api/drives` | — | básico |
| GET | `/api/events` | — | SSE (`progress`, `completed`) |
| GET | `/api/raw?path=` | — | bytes do ficheiro (thumbnails/preview) |
| POST | `/api/list_dir` · `/api/get_metadata` | path… | Listing/FileEntry |
| POST | `/api/read_file` · `/api/write_file` | path, content | FileContent / FileEntry |
| POST | `/api/copy_items` · `/api/move_items` | sources, destination, **options.policy** | OperationResult |
| POST | `/api/delete_items` | paths, useTrash | OperationResult |
| POST | `/api/rename_item` · `/api/create_dir` | … | FileEntry |
| POST | `/api/pause` · `/api/resume` · `/api/cancel` | — | controlo da operação |
| POST | `/api/search` | root, query, recursive, **inContent** | SearchResult |
| POST | `/api/checksums` | paths, algorithm | ChecksumEntry[] |
| POST | `/api/multi_rename` | items | OperationResult |
| POST | `/api/split` · `/api/combine` | … | Split/Combine |
| POST | `/api/zip` · `/api/unzip` | … | OperationResult |
| POST | `/api/tar` · `/api/untar` | … | OperationResult |
| POST | `/api/extract_archive` | archive, destination | OperationResult (zip/tar nativos; rar/7z via sistema) |
| POST | `/api/archive_extract` | path (`zip::`/`tar::`), destination | OperationResult (extrai entrada/pasta do arquivo) |
| POST | `/api/compare` · `/api/sync` | left, right, direction | Compare/Sync |
| POST | `/api/tree` | root, maxDepth | TreeResult |
| POST | `/api/open` | path | boolean |
| POST | `/api/open_with` | path, command | boolean (abre com programa definido) |
| POST | `/api/remote/list` | — | `{ connections: [...] }` (sem password) |
| POST | `/api/remote/save` | connection, password | conexão (sem password) |
| POST | `/api/remote/delete` | id OU paths | apaga ligação OU ficheiros remotos |
| POST | `/api/remote/test` | connection, password | `{ ok, error? }` |
| POST | `/api/remote/connect` · `/api/remote/disconnect` | id | `{ ok }` |
| POST | `/api/remote/mkdir` | path | FileEntry remoto |
| POST | `/api/remote/rename` | path, newName | FileEntry remoto |
| POST | `/api/remote/download` | path, destination | `{ destination, size }` |
| POST | `/api/remote/upload` | localPath, destination | FileEntry remoto |

> `/api/list_dir`, `/api/get_metadata`, `/api/read_file` e `/api/raw` são **archive-aware** e
> **remote-aware**: resolvem caminhos `zip::`, `tar::` e `remote::` antes de cair no fs local.

### 3.1 Caminhos virtuais

| Esquema | Formato | Descrição |
|---|---|---|
| ZIP | `zip::<real>::<inner>` | entrada dentro de um ZIP; `inner` usa `/` |
| TAR | `tar::<real>::<inner>` | entrada dentro de um TAR (incl. `.tar.gz`/`.tgz`) |
| Remoto | `remote::<connId>::<remotePath>` | item remoto; `remotePath` absoluto, `/`-separated |
| Raiz da rede | `remote::` | lista as ligações guardadas como pastas |

## 4. Controle de operações (pausa/cancelar)

As operações de lote (`copy/move/delete`) aceitam um objeto de controlo partilhado; entre itens
verificam `paused`/`cancelled`. O frontend expõe **Pausar / Retomar / Cancelar** no overlay de
progresso (`operationStore`). Operação única ativa de cada vez.

## 5. Política de conflitos

`copy_items`/`move_items` recebem `options.policy`:
- `overwrite` — sobrescreve
- `skip` — ignora existentes (conta `skipped`)
- `rename` — cria `nome (1).ext`, `nome (2).ext`, …

## 6. Build SEA (legado)

[`scripts/build-sea.mjs`](../../scripts/build-sea.mjs): `npm run build` → embutir `dist/` em
base64 → `esbuild` bundle (inclui `adm-zip`, `tar`, `basic-ftp`, `ssh2-sftp-client`/`ssh2`,
`webdav`) → blob SEA → `postject` no `node.exe`.

> **Empacotamento principal:** o `.exe` final é agora gerado pelo **Electron** via
> `npm run bundle:server` (gera `server/assets.generated.js` + `build/server.cjs`) e
> `electron-builder` — ver [`08-electron.md`](08-electron.md).
>
> Avisos esperados: `tarNs.default` indefinido (usa `tarNs`) e `signature corrupted` (postject).
> Fallback: pasta portátil com `node.exe` + `main.cjs` + `.bat`.

## 7. Segurança

Bind `127.0.0.1`; validação de caminhos; operações destrutivas recusam raízes; lixeira da app;
`/api/raw` serve apenas ficheiros existentes; sem segredos hardcoded.

Credenciais remotas: cofre em `%APPDATA%/NukeFileManager/vault.json` + chave `vault.key`,
encriptação **AES-256-GCM** (IV + tag + ciphertext). As passwords nunca são devolvidas pela API
(`/api/remote/list` e `/api/remote/save` devolvem apenas campos sem password). **Best-effort**:
quem conseguir ler `vault.json` e `vault.key` consegue decifrar — não substitui o DPAPI/Keychain.

## 8. Executar e testar

Backend em dev (sem empacotar) ou via bundle do servidor:

```bash
node server/main.js
# ou: npm run bundle:server && node build/server.cjs
```

Smoke tests (contra `node server/main.js`):

```bash
set FM_NO_OPEN=1&set FM_PORT=18080&node server\main.js
node scripts/smoke.mjs
node scripts/smoke-ops.mjs
node scripts/smoke-tools.mjs
node scripts/smoke-batch3.mjs
node scripts/smoke-archive.mjs
node scripts/smoke-remote.mjs
```

> A app final é o `.exe` Electron (`release/Nuke File Manager 0.4.0.exe`) — ver
> [`08-electron.md`](08-electron.md). Para o SEA legado: `npm run build:sea` →
> `build/NukeFileManager.exe`.

## 9. Limitações

- `.exe` de consola, sem assinatura (SmartScreen).
- Lixeira da aplicação (tmp), não a Reciclagem.
- RAR/7z só com 7-Zip/WinRAR no sistema.
- Copiar/mover **remoto→remoto** não suportado (apenas remoto↔local).
- Arquivos **aninhados** (ZIP dentro de ZIP) e **copiar para dentro** do arquivo não suportados.
- Plugins (WCX/WDX/WFX) **fora do âmbito** (hosting de DLLs/binários de terceiros).
