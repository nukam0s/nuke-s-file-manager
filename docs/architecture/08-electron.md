# Empacotamento Electron

> Janela nativa, **sem browser e sem consola**, num único `.exe` portátil para Windows. O backend
> Node corre embutido no processo Electron em `127.0.0.1` (porta aleatória) e o renderer é servido
> a partir dessa origem.

---

## 1. Objetivo

- Um único ficheiro: `release/Nuke File Manager 0.4.0.exe` (~105 MB), sem instalação.
- Janela nativa (`BrowserWindow`) — **sem menu de aplicação, sem consola de servidor, sem browser**.
- Backend HTTP local reutilizado do SEA, sem mudanças na API.
- Encerramento limpo: ao fechar a janela, o servidor é parado (`will-quit`).

## 2. Ficheiros

| Ficheiro | Responsabilidade |
|---|---|
| [`electron/main.cjs`](../../electron/main.cjs) | Main process: single-instance lock, `Menu.setApplicationMenu(null)`, arranca o backend, cria a `BrowserWindow` e carrega o URL do backend |
| [`server/main.js`](../../server/main.js) | `createAppServer(opts)` (exportado) — cria/inicia o HTTP server sem assumir ser o entry point do processo |
| [`scripts/bundle-server.mjs`](../../scripts/bundle-server.mjs) | Embute `dist/` em `server/assets.generated.js` (injetando `window.__FM_BACKEND__="http"`) e gera `build/server.cjs` via esbuild (CJS) |
| `build/server.cjs` | Bundle CJS do backend, `require()`-ido pelo `electron/main.cjs` |

## 3. Fluxo de arranque

1. [`electron/main.cjs`](../../electron/main.cjs) pede **single-instance lock**; uma segunda
   instância fecha-se.
2. `Menu.setApplicationMenu(null)` remove o menu (sem barra de menu, sem superfície de consola).
3. `createAppServer({ host: '127.0.0.1', port: 0, openBrowser: false })` arranca o backend numa
   **porta aleatória livre** e devolve `{ server, port, url, close }`.
4. Cria a `BrowserWindow` com `contextIsolation: true`, `nodeIntegration: false`.
5. `win.loadURL(serverHandle.url)` carrega `http://127.0.0.1:<porta>/`.
6. O renderer usa [`src/ipc/httpClient.ts`](../../src/ipc/httpClient.ts) com
   `window.location.origin` como base — sem portas fixas, sem CORS.
7. `window-all-closed` → `app.quit()`; `will-quit` fecha o servidor antes de sair.

## 4. Build

```bash
npm install
npm run build:electron
```

Equivalente a:

```bash
npm run build            # tsc --noEmit && vite build  (frontend)
npm run bundle:server    # scripts/bundle-server.mjs -> server/assets.generated.js + build/server.cjs
electron-builder --win portable
```

Output: **`release/Nuke File Manager 0.4.0.exe`** (~105 MB, único `.exe` portátil).

O asar inclui apenas `electron/**` e `build/server.cjs` (sem `node_modules`); `npmRebuild: false`.

## 5. Configuração electron-builder

De [`package.json`](../../package.json) (bloco `"build"`):

| Chave | Valor |
|---|---|
| `appId` | `com.nukefm.app` |
| `productName` | `Nuke File Manager` |
| `win.target` | `portable` |
| `files` | `electron/**`, `build/server.cjs`, `!node_modules/**` |
| `npmRebuild` | `false` |

## 6. Segurança

- `contextIsolation: true`, `nodeIntegration: false` no `webPreferences` da janela.
- Backend em `127.0.0.1` (não exposto à rede), porta aleatória por execução.
- Single-instance lock evita múltiplos servidores/janelas.
- Cofre de credenciais remoto encriptado (AES-256-GCM) — ver
  [`07-node-portable.md`](07-node-portable.md).

## 7. Limitações e notas

- O `.exe` **não está assinado**: SmartScreen/WDAC/AppLocker podem bloqueá-lo em alguns ambientes
  (assinatura de código é uma pendência).
- O **SEA** (`build/NukeFileManager.exe`) mantém-se como alternativa/legado — ver
  [`07-node-portable.md`](07-node-portable.md).
- `node server/main.js` continua a servir para dev e smoke tests.
