# Roadmap e Plano de Delegação

> Fases incrementais com **TDD anchors**. Cada fase termina com critérios de aceitação verificáveis.
> A implementação é delegada a modos especializados a partir do modo Orquestrador.

---

## Fase 0 — Scaffold & Fundações

**Objetivo:** projeto Tauri v2 + React/TS/Vite a compilar e abrir janela.

- [ ] `npm create tauri-app@latest` (React + TypeScript + Vite)
- [ ] Confirmar versões: `cargo tauri info` (Tauri 2.9.x, Rust stable, Node LTS)
- [ ] Tailwind + tokens visuais densos (estilo TC)
- [ ] Esqueleto de pastas de [`04-project-structure.md`](04-project-structure.md)
- [ ] `AppError` + `Result` serializável; logging `tracing`
- [ ] CI básico (fmt, clippy, `tsc --noEmit`)

**Aceitação:** `npm run tauri dev` abre uma janela vazia sem warnings bloqueantes.

## Fase 1 — MVP (paridade essencial)

**Objetivo:** dois painéis navegáveis e operações principais.

- Backend: `FileSystemPort` + `LocalFsAdapter`; `ListingService`; `OperationService`
  (`copy_items`, `move_items`, `delete_items`, `rename_item`, `create_dir`); `DriveAdapter`.
- Comandos: `list_dir`, `get_metadata`, `copy_items`, `move_items`, `delete_items`,
  `rename_item`, `create_dir`, `get_drives`, `get_home_dir`.
- Frontend: `DualPaneLayout`, `Pane`, `FileList` (virtualizado), `FileRow`, `SortHeader`,
  `PathBar`, `DriveSelector`, `FunctionKeyBar`, `StatusBar`.
- Estado: `paneStore`, `selectionStore`, `operationStore`.
- Teclado: `useKeyboard` + `commandRegistry` (Tab, Enter, Backspace, F5–F8, Shift+F6, Ctrl+A/H).
- UX: diálogo de progresso + confirmação de eliminação (lixeira por omissão).

**Aceitação:** critérios do MVP em [`01-specification.md`](01-specification.md#6-critérios-de-aceitação-do-mvp).

## Fase 2 — v1

- Abas por painel (`TabBar`) e histórico (voltar/avançar).
- Watcher (`notify` + debounce) e auto‑refresh.
- Pesquisa recursiva streaming (`Alt+F7`) com eventos `search://*`.
- Ícones por tipo + toggle de ocultos; renomeação em linha; ver/editar (`F3`/`F4`).
- i18n PT/EN; acessibilidade (focus, aria).
- Gerar tipos TS do Rust com `ts-rs` (fonte única).

**Aceitação:** fluxos v1 cobertos por testes; watcher não gera refresh storms.

## Fase 3 — Futuro (extensível)

- `ArchiveAdapter` (zip/tar) sobre `FileSystemPort`.
- `SftpAdapter` / `WebDavAdapter` / `CloudAdapter`.
- Tema/plugins; fila persistente de operações (SQLite opcional).

---

## Plano de delegação (modos)

| Fase / Trabalho | Modo sugerido | Notas |
|---|---|---|
| Scaffold Tauri + Vite + Tailwind | `code` / `nextjs-developer`‑style | Estrutura inicial |
| Núcleo Rust hexagonal (domain/ports/services) | `rust-engineer` / `backend-developer` | TDD: testes de port + fake adapter |
| Adapters I/O (`std::fs`, `trash`, `notify`) | `rust-engineer` | `spawn_blocking`, cancelamento |
| Componentes React + virtualização | `react-specialist` / `frontend-developer` | TanStack Virtual |
| Stores + keyboard dispatcher | `react-specialist` | Zustand, command registry |
| Testes (unit/integration/e2e) | `test-automator` / `qa-expert` | Tauri mock + Vitest |
| Revisão de segurança (paths, capabilities) | `security-auditor` | Validação de caminhos, CSP |
| Revisão de arquitetura | `architect-reviewer` | Aderência às fronteiras |

## TDD anchors (exemplos)

- `ListingService` com `FakeFs` → devolve entradas ordenadas, pastas primeiro.
- `OperationService.copy` → conflito de nome produz `OperationResult.failed` sem corromper destino.
- `OperationService.delete` com `useTrash=true` → chama `TrashPort`, nunca `remove`.
- `path_guard` → rejeita `..` que escapa e raízes em operações destrutivas.
- `commandRegistry` → mapeia `F5→FILE_COPY`, `F8→FILE_DELETE`, `Tab→TOGGLE_PANE`.

## Definition of Done (por PR)

- [ ] Respeita fronteiras de [`02-architecture.md`](02-architecture.md).
- [ ] Sem segredos/hardcoded paths; paths resolvidos em runtime.
- [ ] Testes verdes + `clippy`/`tsc` limpos.
- [ ] Documentação/índice atualizados quando muda o contrato IPC.
