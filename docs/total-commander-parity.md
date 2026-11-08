# Paridade com o Total Commander

> Referência oficial: <https://www.ghisler.com/featurel.htm>
> Estado real da app (v0.4). Ainda **não** é paridade total, mas cobre já a maioria das
> operações do dia-a-dia e várias ferramentas avançadas.

Legenda: ✅ implementado · 🟡 parcial · ❌ em falta

## 1. Interface e navegação

| Funcionalidade | Estado | Notas |
|---|:---:|---|
| Dois painéis independentes | ✅ | comutar com `Tab` |
| Abas por painel | ✅ | `Ctrl+T` / `Ctrl+W`, clique na aba |
| Histórico voltar/avançar | ✅ | `Alt+←` / `Alt+→` |
| Barra de caminho editável | ✅ | |
| Filtro rápido | ✅ | por painel |
| Seletor de unidades | ✅ | `C:`, `D:`… |
| Barra de teclas de função | ✅ | F2..F8 |
| Barra de ferramentas | ✅ | utils: search, checksums, ZIP/TAR, sync, etc. |
| Vista em árvore | ✅ | botão “Árvore” (expansão lazy) |
| Drag & drop entre painéis | ✅ | arrastar ficheiros para o outro painel (Ctrl/Alt = copiar) |
| Thumbnails de imagens | ✅ | preview via `/api/raw` (imagens) |
| Linha de comando | 🟡 | navegação por caminho |
| Temas / ícones nativos | 🟡 | ícones emoji + thumbs |

## 2. Operações de ficheiros

| Funcionalidade | Estado | Notas |
|---|:---:|---|
| Copiar / Mover | ✅ | recursivo; **política de conflito** (sobrescrever/ignorar/renomear) |
| Apagar | 🟡 | lixeira da app (tmp), não a Reciclagem do Windows |
| Renomear / Nova pasta | ✅ | |
| Multi-rename | ✅ | procurar/substituir (texto/regex) com preview |
| Ver (`F3`) | ✅ | viewer de texto (≤2 MB) + abrir com app padrão |
| Editar (`F4`) | ✅ | abre com app padrão do SO |
| ZIP / TAR | ✅ | comprimir/extrair; TAR via `tar` |
| RAR / 7z | 🟡 | extração via 7-Zip/WinRAR do sistema (se `7z`/`unrar` no PATH) |
| Split/Combine | ✅ | |
| Checksums | ✅ | MD5/SHA-1/SHA-256 |
| Comparar diretórios | ✅ | 1 nível |
| Sincronizar diretórios | ✅ | esquerda→direita / direita→esquerda (recursivo) |
| Fila de operações com pausa | ✅ | Pausar/Retomar/Cancelar durante a operação |
| Conflitos (diálogo) | ✅ | política escolhida no diálogo copiar/mover |
| Arquivos vistos como pastas | ✅ | navegar dentro de ZIP/TAR (incl. `.tar.gz`/`.tgz`) sem extrair; ler/preview/extrair para fora. Sem ZIP-dentro-de-ZIP nem copiar para dentro |

## 3. Seleção

| Funcionalidade | Estado | Notas |
|---|:---:|---|
| Seleção múltipla | ✅ | `Espaço`, caixa |
| Selecionar tudo / inverter | ✅ | `Ctrl+A` / `Ctrl+I` / `*` |
| Por padrão / desmarcar padrão | ✅ | `+` / `-` (ex.: `*.txt`) |

## 4. Listagem e visualização

| Funcionalidade | Estado | Notas |
|---|:---:|---|
| Colunas nome/tamanho/data | ✅ | |
| Ordenação por coluna | ✅ | pastas primeiro |
| Ocultos | 🟡 | dotfiles; atributo “oculto” do Windows não tratado |
| Thumbnails | ✅ | imagens |
| Árvore | ✅ | por painel |
| Quick view / painel de preview | ✅ | `Ctrl+Q`; texto via `/api/read_file`, imagens via `/api/raw` |

## 5. Pesquisa e utilitários

| Funcionalidade | Estado | Notas |
|---|:---:|---|
| Pesquisa recursiva por nome | ✅ | `Alt+F7`, limite 2000 |
| Pesquisa por conteúdo | ✅ | texto (≤1 MB) em ficheiros de texto |
| Hotlist / favoritos | ✅ | `Ctrl+D` adiciona o caminho atual; menu “★ Favoritos” para saltar/remover |
| Associações / menu de contexto | ✅ | clique direito: Abrir, Ver, Renomear, Apagar, Copiar caminho, Propriedades, Abrir com…; associações por extensão persistentes |
| FTP / FTPS / SFTP / WebDAV | ✅ | conectores remotos + painel “Rede”; copiar/mover remoto↔local (remoto→remoto não) |

## 6. Extensibilidade

| Funcionalidade | Estado |
|---|:---:|
| Plugins (WCX/WDX/WFX) | ❌ | **fora do âmbito MVP** (subsistema de hosting de DLLs/binários de terceiros) |
| Multi-plataforma | 🟡 (app Electron nativa Windows; código cross-platform) |

---

## Resumo (v0.4)

**Entregue:** abas, histórico, filtro rápido, árvore, drag & drop, thumbnails de imagens,
pesquisa por nome e **conteúdo**, checksums, ZIP/TAR, RAR/7z (via sistema), multi-rename,
split/combine, comparar e **sincronizar** diretórios, **fila com pausar/retomar/cancelar**,
**política de conflitos**, **quick view (`Ctrl+Q`)**, **hotlist (`Ctrl+D`)**, **menu de
contexto + associações por extensão**, **arquivos como pastas** (ZIP/TAR) e
**FTP/FTPS/SFTP/WebDAV**. Validado por `scripts/smoke-batch3.mjs`, `scripts/smoke-archive.mjs`
e `scripts/smoke-remote.mjs` (PASS).

**Em falta / limites conhecidos:**
- Copiar/mover **remoto→remoto** (suportado apenas remoto↔local)
- Arquivos **aninhados** (ZIP dentro de ZIP) e **copiar para dentro** do arquivo
- Plugins (WCX/WDX/WFX) — **fora do âmbito MVP** (subsistema de hosting de DLLs/binários de
  terceiros, não planeado para o executável portátil atual)
