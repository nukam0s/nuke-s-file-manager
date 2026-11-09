# Arquitetura — Índice

Documentação do **Nuke File Manager** — file manager duplo estilo Total Commander.
Empacotamento principal: **Electron** (janela nativa, `.exe` portátil). Node.js SEA mantido como
alternativa/legado e Tauri como opção nativa.

| # | Documento | Descrição |
|---|---|---|
| 00 | [`00-overview.md`](00-overview.md) | Visão geral, stack, princípios |
| 01 | [`01-specification.md`](01-specification.md) | Requisitos funcionais/não‑funcionais, paridade TC |
| 02 | [`02-architecture.md`](02-architecture.md) | Camadas, C4, hexagonal, fronteiras |
| 03 | [`03-data-flows.md`](03-data-flows.md) | Contratos IPC, fluxos, eventos |
| 04 | [`04-project-structure.md`](04-project-structure.md) | Estrutura de pastas e convenções |
| 05 | [`05-security-performance.md`](05-security-performance.md) | Capabilities, CSP, validação, performance |
| 06 | [`06-roadmap.md`](06-roadmap.md) | Fases MVP → v1 |
| 07 | [`07-node-portable.md`](07-node-portable.md) | **Backend portátil Node SEA** (alternativa/legado: build/exe/API) |
| 08 | [`08-electron.md`](08-electron.md) | **Empacotamento Electron** (janela nativa, build `.exe`) |
| 10 | [`10-settings-persistence.md`](10-settings-persistence.md) | **Persistência de definições** (hotlist/associações fora do `localStorage`) |

## Paridade funcional

Ver [`../total-commander-parity.md`](../total-commander-parity.md) para o estado real face ao Total Commander.

## Resumo do stack

- **Desktop portátil:** Electron (`release/Nuke File Manager 0.4.0.exe`) + backend HTTP local em `127.0.0.1`
- **Frontend:** React 19 + TypeScript + Vite + Tailwind + Zustand + TanStack Virtual
- **Backend opcional (nativo):** Tauri v2 + Rust (hexagonal) — requer toolchain Rust/MSVC
