# Especificação Funcional

> Paridade funcional com o Total Commander, faseada. Este documento define **o que** o sistema
> faz; a arquitetura que define **como** está em [`02-architecture.md`](02-architecture.md).

---

## 1. Âmbito e objetivos

- **In scope (MVP):** gestão local de ficheiros em dois painéis, navegação por teclado,
  operações de cópia/mover/renomear/criar pasta/apagar, ordenação, seleção múltipla.
- **Out of scope (MVP):** FTP/SFTP, extração de arquivos, plugins, sincronização cloud,
  packing/unpacking. Ficam previstos como *adapters* futuros.

## 2. Personas / cenários

| Persona | Necessidade principal |
|---|---|
| Power user de desktop | Navegar e operar ficheiros 100% por teclado, rapidamente |
| Developer / sysadmin | Comparar diretórios entre painéis e mover ficheiros em lote |
| Utilizador casual | Interface clara com ações previsíveis e segurança em eliminações |

## 3. Requisitos funcionais (RF)

### 3.1 Navegação e painéis
- **RF-01** Dois painéis (esquerdo/direito) independentes, com foco alternável (`Tab`).
- **RF-02** Cada painel tem caminho atual, histórico (voltar/avançar) e *breadcrumb*/path bar editável.
- **RF-03** Entrar em diretório (`Enter`), subir (`Backspace` / `..`), ir para raiz (`Ctrl+\`).
- **RF-04** Seleção de unidade/disco (`Alt+F1` esquerdo, `Alt+F2` direito).
- **RF-05** Abas por painel (`Ctrl+T` nova, `Ctrl+W` fechar) — *fase v1*.

### 3.2 Listagem e visualização
- **RF-06** Colunas: Nome, Extensão, Tamanho, Data de modificação, Atributos.
- **RF-07** Ordenação por qualquer coluna (asc/desc), pastas primeiro por omissão.
- **RF-08** Alternar ficheiros ocultos (`Ctrl+H`).
- **RF-09** Ícones por tipo de ficheiro (pasta, ficheiro, link simbólico).
- **RF-10** Barra de estado: nº de itens, nº selecionados, tamanho total, espaço livre.

### 3.3 Seleção
- **RF-11** Selecionar linha (`Espaço`/`Insert`), estender (`Shift+↑/↓`), selecionar tudo (`Ctrl+A`).
- **RF-12** Inverter/limpar seleção (`Num *`, `Ctrl+D`), seleção por padrão (`+`/`-`).

### 3.4 Operações de ficheiros
- **RF-13** **Copiar** (`F5`) do painel ativo para o passivo, com barra de progresso.
- **RF-14** **Mover** (`F6`) idem.
- **RF-15** **Criar pasta** (`F7`).
- **RF-16** **Apagar** (`F8`) — por omissão para a lixeira; confirmação para eliminação permanente.
- **RF-17** **Renomear** (`Shift+F6` / `F2`).
- **RF-18** **Ver** (`F3`) e **editar** (`F4`) — *fase v1* para editor externo.
- **RF-19** Operações em lote sobre a seleção; conflitos de nome → diálogo substituir/manter/renomear.
- **RF-20** Cancelar operação em curso (progresso cancelável).

### 3.5 Pesquisa e reatividade
- **RF-21** Pesquisa recursiva (`Alt+F7`) com streaming de resultados — *fase v1*.
- **RF-22** Auto‑refresh de painel quando o SO altera o diretório (watcher, debounced) — *fase v1*.

### 3.6 Utilitários
- **RF-23** Linha de comando/atalho de caminho na base da janela.
- **RF-24** Barra de teclas de função visível (F1..F8) com rótulos contextuais.

## 4. Requisitos não‑funcionais (RNF)

| ID | Requisito | Meta |
|---|---|---|
| RNF-01 | Responsividade de navegação | Listar diretório típico < 100 ms |
| RNF-02 | Diretórios grandes | UI fluida com 100k+ entradas (virtualização) |
| RNF-03 | Segurança destrutiva | Lixeira por omissão + confirmação explícita |
| RNF-04 | Portabilidade | Windows, macOS, Linux |
| RNF-05 | Pegada | Binário e memória baixos (vantagem Tauri vs Electron) |
| RNF-06 | Acessibilidade | Navegação total por teclado, focus rings visíveis |
| RNF-07 | i18n | Textos externalizáveis (PT/EN iniciais) |
| RNF-08 | Sem segredos | Zero credenciais/valores de ambiente no código |

## 5. Restrições técnicas

- **C-01** O WebView não acede diretamente ao filesystem arbitrário → **toda** a I/O de ficheiros passa pelo Rust via `invoke`.
- **C-02** Modelo de permissões/capabilities do Tauri v2 aplica‑se; comandos próprios validam caminhos.
- **C-03** Diferenças de SO: letras de unidade (Windows) vs *mount points* (Unix) tratadas no `DriveAdapter`.
- **C-04** Operações de I/O potencialmente bloqueantes correm fora da *main thread* (`spawn_blocking`).

## 6. Critérios de aceitação do MVP

1. Abrir a app e ver dois painéis com o diretório *home* carregado.
2. Navegar em ambos os painéis apenas com teclado.
3. Copiar (`F5`) e mover (`F6`) uma seleção múltipla entre painéis com progresso.
4. Criar pasta (`F7`), renomear (`Shift+F6`) e apagar para lixeira (`F8`) com confirmação.
5. Ordenar por nome/tamanho/data e alternar ocultos.
6. Lista de 10k ficheiros mantém scroll fluido (≥ 50 fps).
