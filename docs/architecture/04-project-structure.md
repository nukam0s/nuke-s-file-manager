# Estrutura de Projeto (Modular)

> Estrutura alvo após o *scaffold*. Cada ficheiro/módulo tem uma responsabilidade única.
> Nenhuma pasta contém segredos; configuração sensível vem de runtime/`env`, nunca commitada.

```text
.
├─ src-tauri/                      # Backend Rust (Tauri v2)
│  ├─ Cargo.toml
│  ├─ build.rs
│  ├─ tauri.conf.json              # janela, CSP, bundle (sem segredos)
│  ├─ capabilities/
│  │  └─ default.json              # permissões mínimas (event/core)
│  ├─ icons/
│  └─ src/
│     ├─ main.rs                   # bootstrap do runtime
│     ├─ lib.rs                    # builder, setup, registo de comandos
│     ├─ error.rs                  # AppError serializável (code/message/path)
│     ├─ commands/                 # handlers finos (#[tauri::command])
│     │  ├─ mod.rs
│     │  ├─ fs_commands.rs         # list_dir, copy, move, delete, rename, mkdir
│     │  ├─ system_commands.rs     # get_drives, get_home_dir, cancel_operation
│     │  └─ search_commands.rs     # search, watch_dir (v1)
│     ├─ domain/                   # PURO: sem tauri, sem fs, sem tokio
│     │  ├─ mod.rs
│     │  ├─ models.rs              # FileEntry, DriveInfo, OperationResult
│     │  ├─ ports.rs               # traits: FileSystemPort, TrashPort, DrivePort, WatcherPort
│     │  └─ operations.rs          # regras (conflito de nomes, ordenação)
│     ├─ services/                 # casos de uso; dependem só de ports
│     │  ├─ mod.rs
│     │  ├─ listing_service.rs
│     │  ├─ operation_service.rs
│     │  └─ search_service.rs      # (v1)
│     └─ adapters/                 # implementações concretas
│        ├─ mod.rs
│        ├─ local_fs.rs            # std::fs / tokio::fs + spawn_blocking
│        ├─ trash_adapter.rs       # crate `trash`
│        ├─ drive_adapter.rs       # unidades por SO
│        └─ watcher.rs             # crate `notify` + debounce
│
├─ src/                            # Frontend React + TypeScript
│  ├─ main.tsx
│  ├─ App.tsx
│  ├─ index.css                    # tokens Tailwind
│  ├─ components/
│  │  ├─ layout/
│  │  │  ├─ DualPaneLayout.tsx
│  │  │  ├─ Pane.tsx
│  │  │  └─ StatusBar.tsx
│  │  ├─ file-list/
│  │  │  ├─ FileList.tsx           # TanStack Virtual
│  │  │  ├─ FileRow.tsx
│  │  │  ├─ FileIcon.tsx
│  │  │  └─ SortHeader.tsx
│  │  ├─ navigation/
│  │  │  ├─ PathBar.tsx
│  │  │  ├─ TabBar.tsx             # (v1)
│  │  │  └─ DriveSelector.tsx
│  │  └─ controls/
│  │     ├─ FunctionKeyBar.tsx     # F1..F8
│  │     └─ CommandLine.tsx
│  ├─ state/
│  │  ├─ paneStore.ts              # path, entries, sort, focus
│  │  ├─ selectionStore.ts
│  │  ├─ operationStore.ts         # progresso, cancelamento
│  │  └─ historyStore.ts
│  ├─ ipc/
│  │  ├─ client.ts                 # wrappers tipados de invoke/listen
│  │  └─ types.ts                  # DTOs (ou gerados por ts-rs)
│  ├─ commands/
│  │  ├─ commandRegistry.ts        # mapa tecla → commandId
│  │  └─ fileCommands.ts           # implementação das ações
│  ├─ hooks/
│  │  ├─ useKeyboard.ts
│  │  └─ useDirectory.ts
│  └─ i18n/
│     ├─ pt.ts
│     └─ en.ts
│
├─ docs/architecture/              # esta documentação
├─ package.json
├─ tsconfig.json
├─ vite.config.ts
├─ tailwind.config.js              # (se Tailwind v3) / CSS-first no v4
└─ README.md
```

## Convenções

- **Rust:** `snake_case` para funções/módulos; `PascalCase` para tipos; erros via `AppError`.
- **TS:** `PascalCase` componentes; `camelCase` hooks/funções; stores `useXStore`.
- **Comandos IPC:** `verbo_substantivo` em `snake_case` (`copy_items`, `list_dir`).
- **Eventos:** `namespace://ação` (`fs://changed`, `operation://progress`).
- **Sem segredos:** chaves/URLs sensíveis só via `env` de runtime; `.env*` no `.gitignore`.

## Estrutura inicial (MVP) vs crescimento

| Fase | Pastas ativas |
|---|---|
| MVP | `commands` (fs/system), `services` (listing/operation), `adapters` (local_fs/trash/drive), frontend layout/file-list/state/ipc/commands |
| v1 | + `watcher`, `search`, `TabBar`, i18n completo |
| Futuro | + `adapters/sftp`, `adapters/archive`, `adapters/cloud` (implementam os mesmos ports) |
