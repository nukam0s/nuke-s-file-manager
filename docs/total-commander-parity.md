# Paridade com o Total Commander

> Referência oficial: <https://www.ghisler.com/featurel.htm>
>
> **Documento v0.5 — matriz granular.** Fotografia do código: [`package.json`](../package.json:4)
> declara **0.4.0**; verificação feita em **2026-11-09**. Onde não houve confirmação no
> código-fonte ou em documentação pública, o item diz **a verificar** em vez de ser assumido.

Legenda: ✅ implementado · 🟡 parcial/limitado · ❌ em falta · ⚠️ a verificar

> Esta matriz descreve **comportamento e funcionalidade**, não expressão: não reproduz
> textos, ícones, layouts nem ativos do Total Commander. Ver
> [§8 Método legal-safe](#8-método-legal-safe-de-paridade).

## 1. Interface e navegação

| Funcionalidade | Estado | Notas |
|---|:---:|---|
| Dois painéis independentes | ✅ | `Tab` comuta; estado próprio por painel ([`paneStore.ts`](../src/state/paneStore.ts:103)) |
| Abas por painel | ✅ | `Ctrl+T` / `Ctrl+W`, clique na aba; fecho só com >1 aba ([`TabBar.tsx`](../src/components/layout/TabBar.tsx:6)) |
| Histórico voltar/avançar | ✅ | `Alt+←` / `Alt+→`, por painel |
| Barra de caminho editável | ✅ | `Enter` navega, `Esc` repõe; caminhos virtuais mostram rótulo ([`PathBar.tsx`](../src/components/navigation/PathBar.tsx:32)) |
| Filtro rápido | ✅ | subcadeia (não glob), por painel ([`paneStore.ts`](../src/state/paneStore.ts:82)) |
| Seletor de unidades | ✅ | letras de unidade + entrada “Rede”; espaço livre não é lido (`total`/`free` = 0) ([`DriveSelector.tsx`](../src/components/navigation/DriveSelector.tsx:17)) |
| Barra de teclas de função | ✅ | F2..F8, sem variantes `Shift`/`Alt` ([`FunctionKeyBar.tsx`](../src/components/controls/FunctionKeyBar.tsx:10)) |
| Barra de ferramentas | ✅ | Rede, Pesquisar, Checksums, ZIP, TAR, Extrair, Multi-rename, Dividir, Comparar, Sincronizar, Inverter, Árvore ([`ToolBar.tsx`](../src/components/controls/ToolBar.tsx:110)) |
| Vista em árvore | ✅ | expansão lazy, um nível por pedido ([`TreeView.tsx`](../src/components/tools/TreeView.tsx:14)) |
| Drag & drop | ✅ | HTML5 entre painéis e para pastas; largar = mover, `Ctrl`/`Alt` = copiar; política fixa `overwrite`, sem diálogo ([`FileList.tsx`](../src/components/file-list/FileList.tsx:37)) |
| Thumbnails | 🟡 | miniatura de 16 px na linha (imagens), só no backend HTTP; **não** é um modo de vista ([`FileRow.tsx`](../src/components/file-list/FileRow.tsx:36)) |
| Quick view | ✅ | `Ctrl+Q`; texto ≤2 MB; imagens via `/api/raw` (backend HTTP) ([`QuickViewPanel.tsx`](../src/components/layout/QuickViewPanel.tsx:11)) |
| Hotlist | 🟡 | lista plana em `localStorage`; sem submenus nem entradas por ficheiro; persistência entre arranques **a verificar** (origem com porta aleatória) ([`HotlistMenu.tsx`](../src/components/controls/HotlistMenu.tsx:13)) |
| Linha de comando | 🟡 | interpreta apenas um caminho (navegar); não executa comandos ([`CommandLine.tsx`](../src/components/controls/CommandLine.tsx:5)) |
| Split vertical/horizontal | ❌ | grelha fixa lado a lado; sem alternância de orientação nem redimensionador |
| Modos de vista (brief/full/details/thumbnails) | ❌ | o estado só admite `list` e `tree` ([`paneStore.ts`](../src/state/paneStore.ts:78)) |
| Ordenação por colunas | 🟡 | nome/tamanho/modificado (asc/desc, pastas primeiro); “extensão” existe no backend mas não na UI ([`SortHeader.tsx`](../src/components/file-list/SortHeader.tsx:4)) |
| Esquemas de cor | ❌ | paleta fixa (Tailwind slate/sky) |
| Colunas personalizadas | ❌ | três colunas fixas |
| Barra de estado | ✅ | caminho, nº de itens, nº selecionados, painel ativo ([`StatusBar.tsx`](../src/components/layout/StatusBar.tsx:3)) |
| Ícones nativos | 🟡 | emoji por tipo + miniatura; sem ícones do sistema ([`FileIcon.tsx`](../src/components/file-list/FileIcon.tsx:11)) |

## 2. Operações de ficheiros

| Funcionalidade | Estado | Notas |
|---|:---:|---|
| Copiar / Mover | ✅ | recursivo (`fs.cp`), fallback `EXDEV`; destino por omissão = o outro painel ([`fsService.js`](../server/fsService.js:195)) |
| Apagar | 🟡 | lixeira da app em `%TEMP%` (recuperável), não a Reciclagem do Windows; em remoto é definitivo ([`fsService.js`](../server/fsService.js:266)) |
| Renomear / Nova pasta | ✅ | diálogo; rejeita separadores e NUL |
| Multi-rename | ✅ | procurar/substituir (texto ou regex) com pré-visualização; sem contadores, máscaras ou tokens de data ([`MultiRenamePanel.tsx`](../src/components/tools/MultiRenamePanel.tsx:8)) |
| Ver (`F3`) | 🟡 | viewer de texto ≤2 MB, UTF-8, deteta binário; sem escolha de encoding nem hex ([`ViewerPanel.tsx`](../src/components/tools/ViewerPanel.tsx:7)) |
| Editar (`F4`) | 🟡 | abre com a app predefinida do SO; não há editor interno ([`fileCommands.ts`](../src/commands/fileCommands.ts:149)) |
| ZIP / TAR | ✅ | criar e extrair: `adm-zip`; TAR/TGZ via `tar` ([`toolsService.js`](../server/toolsService.js:182)) |
| RAR / 7z | 🟡 | apenas **extracção**, via `7z`/`unrar` no PATH; não cria nem navega como pasta ([`toolsService.js`](../server/toolsService.js:403)) |
| Split / Combine | 🟡 | dividir tem UI ([`SplitPanel.tsx`](../src/components/tools/SplitPanel.tsx:15)); combinar existe no backend/IPC mas **sem UI** |
| Checksums | ✅ | MD5/SHA-1/SHA-256; sem SHA-512/CRC32 nem verificação contra ficheiro de hashes |
| Comparar diretórios | 🟡 | 1 nível, nome + tamanho; não compara conteúdo ([`toolsService.js`](../server/toolsService.js:264)) |
| Sincronizar diretórios | 🟡 | recursivo, uma direção; copia em falta ou com tamanho diferente; não remove extra nem é bidirecional ([`toolsService.js`](../server/toolsService.js:307)) |
| Fila de operações | ❌ | uma operação activa de cada vez; sem fila nem execução em segundo plano |
| Pausar/Retomar/Cancelar | ✅ | local (copiar/mover/apagar) via `/api/pause`, `/api/resume`, `/api/cancel` + SSE ([`main.js`](../server/main.js:219), [`OperationOverlay.tsx`](../src/components/dialogs/OperationOverlay.tsx:3)); ❌ em transferências remotas |
| Diálogo de conflitos | 🟡 | política global no diálogo (sobrescrever/ignorar/renomear); sem decisão ficheiro-a-ficheiro; DnD força `overwrite` ([`DialogHost.tsx`](../src/components/dialogs/DialogHost.tsx:242)) |
| Wipe / destruir | ❌ | sem apagamento seguro |
| Atributos | ❌ | `attributes` é derivado (`D`/`A`); mostrado em Propriedades, sem escrita (chmod/attrib) ([`PropertiesModal.tsx`](../src/components/dialogs/PropertiesModal.tsx:38)) |
| Comentários / descrições | ❌ | sem descritores por ficheiro |
| Long paths (>260) | ⚠️ | sem prefixo `\\?\` explícito; depende do runtime — **a verificar** |
| Links / symlinks | 🟡 | deteta e rotula (`isSymlink`, “Ligação simbólica”); não cria links; semântica de cópia **a verificar** |
| Desfazer | ❌ | sem undo |
| Preservar datas/ACL | ⚠️ | não explicitado; comportamento de `fs.cp`/`fs.rename` **a verificar** |
| Arquivos vistos como pastas | ✅ | navegar dentro de ZIP/TAR (incl. `.tar.gz`/`.tgz`) sem extrair; ler/pré-visualizar/extrair para fora ([`archiveService.js`](../server/archiveService.js:188)) |
| Escrever dentro do arquivo | ❌ | cópia para dentro, apagar ou renomear entradas não são suportados |
| Arquivos aninhados | ❌ | sem ZIP/TAR dentro de outro arquivo (ver §10) |

## 3. Seleção

| Funcionalidade | Estado | Notas |
|---|:---:|---|
| Seleção múltipla | 🟡 | `Espaço` marca e avança; checkbox na linha; sem `Shift`+clique (intervalo) nem `Ctrl`+clique ([`paneStore.ts`](../src/state/paneStore.ts:271)) |
| Selecionar tudo / inverter | ✅ | `Ctrl+A`; `Ctrl+I` e `*` invertem |
| Por padrão / desmarcar padrão | ✅ | `+` / `-`; glob `*` e `?`, case-insensitive ([`paneStore.ts`](../src/state/paneStore.ts:95)) |
| Selecionar mesma extensão | ❌ | sem comando dedicado |
| Restaurar seleção | ❌ | a seleção é limpa ao navegar/recarregar |
| Só ficheiros / só pastas | ❌ | sem filtro de seleção por tipo |
| Guardar/carregar seleção | ❌ | sem ficheiro de seleção |
| Contagem de selecionados | ✅ | visível na barra de estado |

## 4. Listagem e visualização

| Funcionalidade | Estado | Notas |
|---|:---:|---|
| Colunas nome/tamanho/data | ✅ | tamanho de pasta mostrado como `<DIR>` |
| Ordenação por coluna | ✅ | clique no cabeçalho, asc/desc, pastas primeiro |
| Ordenação por extensão | ❌ | sem coluna na UI |
| Ocultos | 🟡 | apenas dotfiles; atributo “oculto” do Windows não é lido; `Ctrl+H` |
| Thumbnails | 🟡 | ver §1 (miniatura na linha, não vista de miniaturas) |
| Árvore | ✅ | por painel, expansão lazy |
| Quick view / painel de preview | ✅ | `Ctrl+Q`; texto via `/api/read_file`, imagens via `/api/raw`; sem PDF/áudio/vídeo/Office |
| Viewer (F3) com encodings | 🟡 | só UTF-8, ≤2 MB; sem CP1252/Latin-1, hex ou busca |
| Comparar por conteúdo | ❌ | a comparação é por nome/tamanho |
| Esquema de cores | ❌ | fixo |
| Colunas personalizadas | ❌ | fixo |

## 5. Pesquisa e utilitários

| Funcionalidade | Estado | Notas |
|---|:---:|---|
| Pesquisa recursiva por nome | ✅ | `Alt+F7`, subcadeia case-insensitive, limite 2000 ([`toolsService.js`](../server/toolsService.js:23)) |
| Pesquisa por conteúdo | 🟡 | whitelist de extensões de texto, ≤1 MB, UTF-8 |
| Regex / wildcards na pesquisa | ❌ | sem modo regex/glob (o multi-rename tem regex, a pesquisa não) |
| Pesquisar dentro de arquivos | ❌ | não pesquisa em ZIP/TAR |
| Enviar resultados para a lista | ❌ | clicar abre a pasta do resultado e fecha o painel ([`SearchPanel.tsx`](../src/components/tools/SearchPanel.tsx:25)) |
| Cancelar pesquisa | ❌ | corre até ao fim |
| Hotlist / favoritos | 🟡 | `Ctrl+D` adiciona o caminho atual; menu “★ Favoritos” navega/remove |
| Associações / menu de contexto | ✅ | Abrir, Ver, Renomear, Apagar, Copiar caminho, Propriedades, Abrir com…; associações por extensão em `localStorage` ([`ContextMenu.tsx`](../src/components/file-list/ContextMenu.tsx:65)) |
| Gestor de ligações | ✅ | criar/editar/testar/apagar; palavra-passe cifrada AES-256-GCM ([`RemotePanel.tsx`](../src/components/network/RemotePanel.tsx:1)) |
| FTP / FTPS / SFTP / WebDAV | ✅ | montados como pastas virtuais `remote::…`; copiar/mover remoto↔local ([`remoteService.js`](../server/remoteService.js:233)) |
| Transferências em segundo plano | ❌ | overlay modal, sequencial ([`DialogHost.tsx`](../src/components/dialogs/DialogHost.tsx:45)) |
| Retomar transferências | ❌ | sem `REST`/resume; transferência recomeça do zero |
| Remoto→remoto | ❌ | aviso explícito; apenas remoto↔local |
| Limites de largura de banda | ❌ | não existem |
| Multi-idioma | ❌ | UI em português, sem i18n |

## 6. Extras e extensibilidade

| Funcionalidade | Estado | Notas |
|---|:---:|---|
| Plugins (WCX/WDX/WFX) | ❌ | **fora do âmbito** (hosting de DLLs/binários de terceiros) |
| Multi-plataforma | 🟡 | empacotamento Windows; o código é cross-platform, mas caminhos/atalhos noutros SO não estão validados |
| Modo portátil (ini junto ao exe) | 🟡 | `.exe` portátil único ([`package.json`](../package.json:51)), mas definições ficam no `localStorage` da janela e o cofre em `%APPDATA%`; **não** há `.ini` ao lado do executável |
| Parâmetros de linha de comandos | ❌ | não implementados/documentados |
| Ficheiro de configuração | ❌ | sem equivalente a um `.ini` central |
| Scripting / hooks | ❌ | sem automação pelo utilizador |

---

## 7. Mapa de atalhos (Total Commander → Nuke)

Só atalhos **documentados e correntes** do TC; quando a equivalência do lado do TC não
foi confirmada, a linha diz **a verificar** em vez de inventar. Nuke confirmado em
[`commandRegistry.ts`](../src/commands/commandRegistry.ts:39) e [`fileCommands.ts`](../src/commands/fileCommands.ts:50).

| Atalho no TC (por omissão) | Na nossa app | Estado / lacuna |
|---|---|---|
| `Tab` — comutar painel | `Tab` | ✅ |
| `Ctrl+U` — trocar os diretórios dos dois painéis | — | ❌ atalho documentado do TC, não implementado |
| `F3` — ver | `F3` | ✅ (viewer limitado, §4) |
| `F4` — editar | `F4` | 🟡 abre a app predefinida |
| `F5` — copiar | `F5` | ✅ (destino = outro painel) |
| `F6` — mover | `F6` | ✅ |
| `Shift+F6` — renomear | `F2` | ✅ equivalente |
| `F2` — atualizar listagem | `F2` = **renomear** | ❌ conflito de tecla; não há atalho de refresh |
| `F7` — nova pasta | `F7` | ✅ |
| `F8` / `Del` — apagar | `F8` / `Del` | ✅ (lixeira da app) |
| `Alt+F7` — pesquisar | `Alt+F7` | ✅ (nome ou conteúdo) |
| `Ctrl+Q` — quick view | `Ctrl+Q` | ✅ |
| `Ctrl+D` — hotlist | `Ctrl+D` (adiciona) | 🟡 menu está no botão “★ Favoritos” |
| `Ctrl+\` — raiz | `Ctrl+\` | ✅ |
| `Ctrl+H` — ocultos | `Ctrl+H` | ✅ (apenas dotfiles) |
| `Ctrl+A` — selecionar tudo | `Ctrl+A` | ✅ |
| `Ctrl+I` — inverter seleção | `Ctrl+I` | ✅ na app; equivalência TC **a verificar** |
| `*` (teclado numérico) — inverter | `*` | ✅ |
| `+` / `-` — marcar/desmarcar por máscara | `+` / `-` | ✅ (diálogo de padrão) |
| `Insert` — marcar e avançar | `Espaço` | ✅ equivalente; `Insert` não está ligado |
| `Backspace` — subir um nível | `Backspace` | ✅ |
| `Enter` — abrir/executar | `Enter` | 🟡 abre pastas/arquivos/remoto; ficheiros não executam |
| `Alt+←` / `Alt+→` — histórico | `Alt+←` / `Alt+→` | ✅ |
| `Alt+F5` — comprimir | — | ❌ (botões ZIP/TAR) |
| `Alt+F9` — extrair | — | ❌ (botão Extrair) |
| `Alt+Enter` — propriedades | — | ❌ (menu de contexto) |
| `Ctrl+T` / `Ctrl+W` — nova/fechar aba | `Ctrl+T` / `Ctrl+W` | ✅ na app; equivalência TC **a verificar** (versão) |
| `Ctrl+F3`…`Ctrl+F6` — ordenar por nome/tamanho/data/extensão | — | ❌ (só clique no cabeçalho); atalhos TC **a verificar** |
| `Shift+F4` — criar ficheiro | — | ❌ |

Atalhos extra da app sem gémeo no TC: `Ctrl+W` fecha aba, `Ctrl+T` cria aba, `Esc` repõe a
barra de caminho.

---

## 8. Método legal-safe de paridade

Como esta matriz é construída, para manter a paridade **funcional** sem copiar **expressão**:

- **Fontes permitidas:** documentação pública (página de funcionalidades e ajuda oficial) e
  observação do comportamento da versão de avaliação.
- **Proibido:** descompilar, fazer engenharia inversa de binários, extrair recursos, ler
  instaladores ou formatos internos, e copiar textos de ajuda.
- **Proibido:** copiar ícones, imagens, temas, fontes, dimensões, disposição de diálogos,
  nomes de menus ou quaisquer cadeias de UI proprietárias.
- **Princípio:** ideias, funcionalidades e comportamentos não são expressão protegida; a
  implementação, os textos e os ativos desta app são originais.
- **Regra de prova:** se uma funcionalidade do TC não está documentada, não é reclamada; se o
  nosso estado não foi confirmado no código, não recebe ✅. O resultado é “a verificar”.

---

## 9. Fora do âmbito / deliberadamente não clonado

- **Subsistema de plugins** (WCX/WDX/WFX) — hosting de DLLs/binários de terceiros.
- **Aparência exacta** — layout, cores, ícones, fontes, espaçamentos e animações do TC.
- **Ativos e strings proprietários** — textos de ajuda, nomes de menus, imagens, sons.
- **Formato de configuração do TC** — ficheiros `.ini`/chaves internas e a sua semântica.
- **Instalador, marca e empacotamento** do produto original.
- **Emulação byte-a-byte** de diálogos ou de fluxos de UI.

---

## 10. Resumo (v0.5)

**Entregue e verificado no código:** dois painéis, abas, histórico, filtro rápido, barra de
caminho, seletor de unidades (incl. “Rede”), barra de teclas F2–F8, toolbar, árvore lazy,
drag & drop, miniaturas na linha, quick view, linha de comando (navegação), multi-seleção por
`Espaço`/checkbox, selecionar tudo/inverter/por padrão, cópia/movimento recursivos com
política de conflito, apagar para lixeira da app, renomear/nova pasta, multi-rename com regex,
viewer F3 (texto), F4 via app predefinida, ZIP/TAR criar e extrair, RAR/7z extrair via sistema,
dividir ficheiros, checksums, comparar (1 nível), sincronizar (uma direção), pausar/retomar/
cancelar em operações locais, arquivos ZIP/TAR como pastas, pesquisa por nome e conteúdo,
menu de contexto + associações, hotlist e FTP/FTPS/SFTP/WebDAV com cofre cifrado.

**Em falta (ordem de impacto):**
1. `Ctrl+U` para trocar painéis e uma tecla de refresh (`F2` está ocupado por renomear).
2. Fila de operações e transferências em segundo plano; retomar transferências.
3. Copiar/mover **remoto→remoto**.
4. Wipe seguro; atributos e comentários/descritores.
5. Modos de vista brief/full/details/thumbnails, colunas personalizadas, esquemas de cor e
   split vertical/horizontal.
6. Pesquisa com regex/glob, dentro de arquivos, resultados→lista e cancelamento.
7. Comparar por conteúdo e sincronização bidirecional com remoção.
8. Combinar ficheiros na UI (backend já existe).
9. Plugins, multi-idioma, `.ini` portátil e parâmetros de linha de comandos.
10. Arquivos aninhados e escrita dentro de arquivos.

**A verificar (não afirmado como feito):**
- Persistência de hotlist/associações entre arranques — a origem inclui uma porta aleatória
  ([`main.cjs`](../electron/main.cjs:104)), pelo que o `localStorage` pode não sobreviver.
- Caminhos >260 caracteres (sem prefixo `\\?\`).
- Semântica de cópia de symlinks e preservação de datas/ACL.
- Equivalência dos atalhos TC marcados na §7 (`Ctrl+I`, `Ctrl+T`/`Ctrl+W`, `Ctrl+F3`…`Ctrl+F6`).
- Suporte a RAR/7z como pasta (não implementado; viabilidade por confirmar).

**Validação existente:** `scripts/smoke-batch3.mjs`, `scripts/smoke-archive.mjs` e
`scripts/smoke-remote.mjs` (PASS). Alterações futuras devem actualizar esta matriz e a versão
do documento em conjunto.
