# Arquitetura Detalhada

> Estilo: **Clean Architecture / Hexagonal** no Rust + **feature modular** no React.
> Regra de ouro: as dependências apontam **sempre para dentro** (domínio não conhece infraestrutura).

---

## 1. Vista em camadas

```mermaid
graph TD
  subgraph Presentation["Presentation (Web / React)"]
    UI["Componentes: DualPane · FileList · PathBar · FunctionKeyBar · StatusBar"]
    HOOKS["Hooks + Keyboard Command Dispatcher"]
  end

  subgraph State["Frontend State (Zustand)"]
    P["paneStore"]
    S["selectionStore"]
    O["operationStore"]
    H["historyStore"]
  end

  subgraph Contract["IPC Contract"]
    CLIENT["typed invoke client"]
    DTO["Shared DTOs (TS mirror of Rust)"]
  end

  subgraph Backend["Rust Backend (Tauri)"]
    CMD["Commands (thin handlers)"]
    SVC["Application Services"]
    DOM["Domain: models + ports (traits)"]
    AD["Adapters: LocalFs · Trash · Drive · Watcher"]
  end

  UI --> HOOKS
  UI --> State
  HOOKS --> State
  State --> CLIENT
  CLIENT --> DTO
  CLIENT -->|invoke| CMD
  CMD --> SVC
  SVC --> DOM
  SVC --> AD
  AD -. implementa .-> DOM
  AD -->|emit events| CLIENT
```

## 2. Vista de contentores (C4 nível 2)

```mermaid
graph TB
  User([Utilizador])

  subgraph Desktop["Aplicação Tauri (processo único)"]
    direction TB
    WV["WebView<br/>React SPA"]
    Rust["Rust Core<br/>IPC · Serviços · I/O"]
  end

  subgraph Ext["Sistemas externos"]
    FS[("Filesystem do SO")]
    Bin[("Lixeira / Recycle Bin")]
  end

  User --> WV
  WV <-->|JSON invoke / events| Rust
  Rust <-->|std::fs, notify| FS
  Rust -->|trash-rs| Bin
```

## 3. Backend hexagonal (ports & adapters)

O domínio declara *traits* (ports). Os adapters implementam‑nos. Serviços orquestram casos de uso.
Isto permite adicionar SFTP/arquivos/cloud **sem alterar** domínio, serviços ou UI.

```mermaid
graph LR
  subgraph Domain["Domain (Rust puro)"]
    MODEL["FileEntry · DriveInfo · OperationResult"]
    PORTS["ports: FileSystemPort · TrashPort · DrivePort · WatcherPort"]
  end
  subgraph Services["Application Services"]
    LS["ListingService"]
    OPS["OperationService"]
    SEARCH["SearchService (v1)"]
  end
  subgraph Adapters["Infrastructure Adapters"]
    LFS["LocalFsAdapter"]
    TA["TrashAdapter"]
    DA["DriveAdapter"]
    WA["WatcherAdapter"]
  end

  LS --> PORTS
  OPS --> PORTS
  SEARCH --> PORTS
  LFS -. impl .-> PORTS
  TA -. impl .-> PORTS
  DA -. impl .-> PORTS
  WA -. impl .-> PORTS
```

## 4. Frontend — árvore de componentes

```mermaid
graph TD
  App --> DualPaneLayout
  DualPaneLayout --> PaneLeft["Pane (esquerdo)"]
  DualPaneLayout --> PaneRight["Pane (direito)"]
  DualPaneLayout --> StatusBar
  DualPaneLayout --> CommandLine

  PaneLeft --> TabBar
  PaneLeft --> PathBar
  PaneLeft --> FileList
  PaneLeft --> FunctionKeyBar

  FileList --> SortHeader
  FileList --> VirtualRows
  VirtualRows --> FileRow
  FileRow --> FileIcon
```

## 5. Fronteiras e responsabilidades

| Módulo | Responsabilidade | Não pode depender de |
|---|---|---|
| `domain` (Rust) | Modelos, regras, *traits* (ports) | infraestrutura, tauri, UI |
| `services` (Rust) | Casos de uso (listar, copiar, mover…) | tauri/ui, apenas ports |
| `adapters` (Rust) | I/O concreta (`std::fs`, `notify`, `trash`) | UI, componentes React |
| `commands` (Rust) | Handlers `#[tauri::command]` finos: validam + delegam | lógica de negócio |
| `ipc` (TS) | Wrappers tipados de `invoke`/`listen` | componentes |
| `state` (TS) | Estado de UI por domínio (Zustand) | detalhes de SO |
| `components` (TS) | Renderização e interação | `invoke` direto (usa `ipc` via stores/commands) |

## 6. Regras de dependência

1. `domain` é **puro**: sem `tauri`, sem `tokio`, sem `std::fs`.
2. `services` dependem **apenas** de `domain::ports` (injeção via `Box<dyn Port>` ou genéricos).
3. `commands` são a **única** porta de entrada do frontend; são finos e sem regra de negócio.
4. Componentes React nunca chamam `invoke` diretamente — passam por `ipc` + `state` + `commands`.
5. Eventos do backend → `ipc` → stores; a UI reage ao estado, não a payloads crus.

## 7. Extensibilidade (como crescer sem reescrever)

- **Novo backend de ficheiros (SFTP/WebDAV):** novo *adapter* que implementa `FileSystemPort`;
  a UI e os serviços não mudam.
- **Arquivos (zip/tar):** `ArchiveAdapter` + `FileSystemPort` virtual.
- **Sincronização/cloud:** `CloudAdapter` + fila de operações.
- **Temas/plugins:** tema via Tailwind tokens; plugins futuros via API de comandos.

> Implementado no backend portátil (Node SEA): `server/archiveService.js` (arquivos como pastas,
> caminhos `zip::`/`tar::`) e `server/remoteService.js` (FTP/FTPS/SFTP/WebDAV, caminhos
> `remote::`). Ver [`07-node-portable.md`](07-node-portable.md).
