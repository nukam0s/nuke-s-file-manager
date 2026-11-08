# Segurança e Performance

> Duas exigências não negociáveis de um file manager: **não perder ficheiros** e **não bloquear**
> em diretórios grandes. Este documento fixa as regras.

---

## 1. Segurança

### 1.1 Modelo de capabilities (Tauri v2)

O frontend só pode chamar as APIs permitidas pelo manifesto de capabilities. Como o file manager
precisa de I/O ampla, **não** expomos o plugin `fs` cru ao WebView; em vez disso, expomos **comandos
Rust próprios** que aplicam a política de segurança abaixo.

`capabilities/default.json` (mínimo necessário, sem segredos):

```jsonc
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Permissões base da janela principal",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "core:event:default",
    "core:window:default"
  ]
}
```

> O plugin `fs`/`dialog` só é adicionado se realmente necessário; por omissão a I/O é mediada
> pelos comandos do projeto.

### 1.2 Content Security Policy (tauri.conf.json)

```jsonc
"security": {
  "csp": "default-src 'self'; img-src 'self' asset: https: data:; style-src 'self' 'unsafe-inline'; script-src 'self'"
}
```

- Proíbe scripts remotos; apenas recursos locais empacotados.
- `asset:` permite servir ícones de ficheiro via protocolo de assets do Tauri.

### 1.3 Validação de caminhos (no Rust, por comando)

1. **Normalizar** (`canonicalize`) e rejeitar caminhos com bytes nulos.
2. **Nunca** resolver `..` vindo da UI de forma ingénua — validar pós‑canonicalização.
3. **Operações destrutivas:** recusar raízes/unidades (`/`, `C:\`) como alvo de `delete`/`move` em massa.
4. **Links simbólicos:** política explícita (não seguir em operações destrutivas; detetar ciclos).
5. **Confirmação dupla** para eliminação permanente (não‑lixeira) e para lotes acima de N itens.

### 1.4 Eliminação segura

- **Default = lixeira** (`trash` crate / Recycle Bin / Trash do SO).
- Eliminação permanente é opt‑in e requer confirmação explícita + resumo do que será apagado.
- Operações em lote reportam falhas parciais sem abortar (`OperationResult.errors`).

### 1.5 Segredos e configuração

- **Zero segredos** no repositório. Caminhos vêm de `app.path()` / `$HOME` em runtime.
- Ficheiros `.env*` ignorados; configuração versionada sem valores sensíveis.
- Sem telemetria/rede no MVP — reduz superfície de ataque.

### 1.6 Outras salvaguardas

- CSP restritiva + sem `eval` no frontend.
- Sanitização de nomes em `create_dir`/`rename` (caracteres inválidos por SO).
- Timeouts e cancelamento em operações longas para evitar estados presos.

## 2. Performance

### 2.1 Princípios

- O Rust faz o trabalho pesado (listar, ordenar, copiar); a UI só apresenta.
- Tudo o que é I/O potencialmente bloqueante corre fora da *main thread*.
- Nunca carregar árvores inteiras: listar **um** diretório de cada vez.

### 2.2 Estratégias por camada

| Área | Estratégia |
|---|---|
| Listagem | `tokio::task::spawn_blocking` para `read_dir`; ordenar no Rust antes de devolver |
| Diretórios enormes | *Streaming* de entradas por eventos em chunks (largura de página configurável) |
| UI com muitas linhas | **Virtualização** (TanStack Virtual): render só do viewport |
| Watcher | `notify` + **debounce** 300–500 ms por diretório; invalidar só o pane afetado |
| Cópia/mover | Stream de chunks + progresso por evento; token de cancelamento |
| Metadados | Pedir tamanho/data só do visível quando necessário (listagem “lazy” de size) |
| Estado | Stores Zustand granulares para evitar re-render global |
| Sorting | Reordenar em memória no backend (evita O(n log n) na thread de UI) |
| Memória | DTOs enxutos; não guardar ícones/binários em memória |

### 2.3 Metas mensuráveis

| Métrica | Meta |
|---|---|
| `list_dir` (dir típico, ~1k itens) | < 100 ms |
| Scroll de 10k itens | ≥ 50 fps |
| Primeiro render (app pronta) | < 1 s |
| Memória em repouso | < 150 MB |
| Cópia | throughput ≈ limite do disco (sem buffer em memória do ficheiro todo) |

### 2.4 Escalabilidade (10× sem mudar arquitetura)

- Virtualização + streaming + async cobrem diretórios de 100k+ entradas.
- Adapters isolam custos de I/O; trocar `LocalFsAdapter` por remoto não afeta a UI.
- Se surgir necessidade de fila persistente/histórico, adicionar **SQLite** como adapter de
  persistência (não no MVP), sem tocar no domínio.

## 3. Observabilidade (leve)

- Logging estruturado no Rust (`tracing`) para operações e erros (sem dados sensíveis).
- Contadores de operação (sucesso/falha/cancelado) expostos na barra de estado.
- Sem envio remoto por omissão.
