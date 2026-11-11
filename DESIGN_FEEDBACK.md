# Design feedback — Multiapp

> Gerado com o rubric do plugin **design-and-refine@design-plugins 1.1.0**
> (`skills/design-lab/DESIGN_PRINCIPLES.md`, Partes 1–4, 6, 8 e 9) aplicado ao código real,
> não a um mockup. Todas as métricas abaixo foram medidas nos arquivos do repositório.

Escopo auditado: `app/page.tsx` (1.562 linhas), `components/vault/vault-view.tsx` (988),
`components/vault/record-dialog.tsx`, `app/globals.css` (2.281), `app/layout.tsx`,
`DESIGN.md`, `UX-CONTRACT.md`.

---

## 1. O que já está forte (não mexer)

| Item | Evidência | Rubric |
|---|---|---|
| Sem `transition: all` | 0 ocorrências em 2.281 linhas | Part 9 (perf) |
| `touch-action: manipulation` global | `globals.css:96` | Part 9 (mobile) |
| `prefers-reduced-motion` em 3 camadas | `1565`, `1694`, `2249` | Part 5 |
| `forced-colors` tratado | `1574–1588` | Part 6 |
| Foco devolvido ao gatilho após fechar diálogo | `page.tsx:121–127` | Part 6 / Nielsen 3 |
| `aria-live` + `role="alert"` + Undo persistente | `vault-view.tsx:868–881`, `page.tsx:963` | Nielsen 1 e 3 |
| Botões de ícone com `aria-label` | `page.tsx:134`, `vault-view.tsx:549–614` | Part 9 (a11y) |
| `sr-only` duplicando o texto animado | `page.tsx:882`, `816` | Part 6 |
| Nenhum `placeholder` como rótulo | `quick-url` tem `<label>` real (`915`) | Part 9 |
| Números tabulares no resumo | `globals.css:1632` | Part 2 (tipografia) |
| Decisão documentada de não pôr filtro na URL | `UX-CONTRACT.md:29` (dados privados) | Nielsen 4 — desvio justificado |

**Ponto de método:** o contrato em `UX-CONTRACT.md` é o melhor ativo deste projeto. Ele
antecipa e justifica decisões que o rubric normalmente reprovaria (estado fora da URL,
`select` nativo, sem sincronização). Isso é maturidade de sistema, não ruído.

---

## 2. P0 — Bloqueios de acessibilidade (medidos)

Contraste calculado com a fórmula WCAG 2.x sobre os **valores finais da cascata**
(o CSS tem 3 camadas de override: ~1–1588, ~1590–1970 e ~1975–2281).

### 2.1 Anel de foco não atinge 3:1 — o mais grave

`globals.css:121` → `outline: 3px solid #50a995`

| Par | Medido | Alvo (SC 1.4.11 / 2.4.11) |
|---|---|---|
| `#50a995` sobre `--background #f2f4ec` | **2.54:1** | 3:1 |
| `#50a995` sobre `#ffffff` | **2.82:1** | 3:1 |

Mesmo valor replicado em `.search-field:focus-within` (`671`) e no anel do card (`813`).
Como o foco visível é **a única** affordance para teclado neste app, isso é um bug real.
**Correção medida:** `#358878` → 3.83 no papel e 4.25 no branco (mantém a família do teal).
Alternativas: `#3f9282` (3.35 / 3.72, mais suave) ou `#2f7f6c` (4.33 / 4.80).

### 2.2 Texto secundário logo abaixo de AA

`--muted-foreground: #63756b` (`globals.css:12`)

| Par | Medido |
|---|---|
| sobre `--background #f2f4ec` (`.page-heading p`, `.workspace-overview`) | **4.41:1** |
| sobre `--muted #edf1e9` (estado hover) | **4.28:1** |

Falha por 0,09 — o caso clássico que passa no olho e reprova no axe.
**Correção medida:** `#5e7066` → 4.75 / 4.61 (passa nos dois). `#5b6d63` → 4.96 / 4.82 com margem.

### 2.3 Outros cinzas que reprovam

| Onde | Hex | Medido | Correção medida |
|---|---|---|---|
| `.card-domain` (`2188`) | `#7b8c80` | 3.48 em `#fcfdf9` | `#63776b` = 4.69 |
| `.collection-heading p` (`2143`) | `#687b6f` | 4.07 | `#5f7367` = 4.58 |
| `.page-footer` / `.starter-note` (`2199–2200`) | `#6d8073` | 3.80 | `#5f7367` = 4.58 |
| `.overview-note` (`2071`) | `#6f8175` | 4.29 (fundo `#ffffffb8`) | `#63776b` = 4.56 |
| `.favorite-button` inativo (`784`) | `#a0ada4` | 2.33 (ícone, alvo 3:1) | `#8a968e` = 3.07 |

### 2.4 Texto abaixo do piso de legibilidade

Distribuição real de `font-size` no CSS: **17 tamanhos distintos**,
com `8px ×3`, `9px ×8`, `10px ×15`, `11px ×21` — ou seja **47 declarações ≤ 11px**.
O rubric pede caption em **12–13px**; e o próprio `DESIGN.md:36` promete "metadata 12px".

Casos piores: `.category-pill` a 9px (`843`) e **8px no mobile** (`1511`), `.personal-badge` 9px
(`215`), `.eyebrow` **8px** a partir de 560px (`2269`), `kbd` 9px (`686`), `page-footer` 9px (`1545`).

### 2.5 Alvos de toque

| Elemento | CSS | Tamanho | Alvo |
|---|---|---|---|
| `.icon-button` (menu do card, fechar, favoritar) | `500–502` | **30×30** | 44×44 |
| `.icon-button.small` | `516–518` | **27×27** | 44×44 |
| `.layout-toggle button` | `637–639` | **32×29** | 44×44 |
| `.category-nav button` | `287` | min-height **38** | 44 |
| `.main-nav button` | `241` | min-height **42** | 44 |
| `.button` / `.search-field` | `1623` / `2145` | 44 ✓ | — |

Correção sem mexer no visual: manter 30px de **tinta** e ampliar a área com
`padding` + `::after { position:absolute; inset:-7px }`, ou `min-width/min-height: 44px` só em `≤800px`.

---

## 3. P1 — O sistema tem três camadas de CSS concorrentes

Esta é a causa raiz do acabamento irregular. Medições:

- **82 seletores** declarados 2+ vezes, **115 declarações redundantes** em 316 seletores.
- **3 blocos** redefinindo os mesmos componentes: `1–1588` (base), `1590–1970` ("launch shelf"),
  `1975–2281` (refino final). O bloco final é o design real; os anteriores viraram peso morto.
- **289 de 464 valores `px` em spacing/size (62%) fora da grade de 4px.** Campeões:
  `10px ×30`, `14px ×23`, `6px ×20`, `18px ×20`, `9px ×14`, `38px ×14`, `3px ×12`, `7px ×12`, `13px ×10`, `17px ×8`.
- **69 declarações de `border-radius`** com 12/13/14/15/16/18/20/22px no mesmo papel.

### 3.1 Valores que mudam conforme a linha do arquivo

| Componente | Declarações | Final | `DESIGN.md` |
|---|---|---|---|
| `.app-card` raio | 12 (`740`) → 15 (`1658`) → **18** (`2164`) → 14 mobile (`2275`) | 18 | 18 ✓ |
| `.app-card` altura mín. | 159 (`744`) → 175 (`1658`) → **178** (`2162`) → 100 mobile | 178 | ~178 ✓ |
| `.button` raio | 8 (`479`) → 10 (`1623`) → **12** (`2234`) | 12 | 12 ✓ |
| `.button` altura | 41 (`476`) → **44** (`1623`) | 44 | — |
| `.capture-box` raio | 14 (`1636`) → **20** (`2077`) → 18 (`2255`) → 16 (`2265`) | 20 | — |
| `.app-grid` gap | 14 (`735`) → 16 (`1657`) → **18** (`2160`) → 16 (`2256`) | 18 | — |
| `.sidebar` largura | 232 (`173`) → **248** (`1978`) | 248 | 248 ✓ |
| `h1` | clamp(32…48) (`1620`) → 36 (`1676`) → 34 (`2262`) → 31 (`2270`) → **29** (`2279`) → 25 (`1551`) | 6 valores | 34–54 |
| `.card-domain` | 10px (`819`) → 11 (`1662`) → **11** (`2188`) | 11 | 12 |

Diagnóstico: `DESIGN.md` **não está errado** — descreve o estado final. O problema é o CSS
guardar as versões antigas junto: qualquer edição "no lugar errado" não tem efeito, e o arquivo
sugere valores que não são os da tela. Para um projeto que se propõe a ter contrato de UI,
essa é a maior dívida.

**Correção (mecânica, sem mudar pixel):** consolidar numa camada única e trocar literais por
tokens — `--radius-card: 18px`, `--radius-control: 12px`, `--space-1..8` (4/8/12/16/24/32/48/64),
`--text-micro: 11px`, `--text-caption: 12px`. Isso remove ~115 declarações e trava os 62% fora de grade.

---

## 4. P2 — Heurísticas e padrões de interação

1. **Hover sem guarda (Part 9, mobile).** Zero ocorrências de `@media (hover: hover)`.
   Em touch, `:hover` fica grudado após o toque: `.app-card:hover` (`2169`),
   `.favorite-shortcut:hover` (`1654`), `.icon-button:hover` (`512`) e principalmente
   `.sidebar .main-nav button:hover { transform: translateX(2px) }` (`1999–2000`) — o item
   desloca e permanece deslocado no celular.
2. **Sem virtualização (Part 7).** `.app-grid` renderiza todos os cards; o contrato permite
   2.000 links. Acima de ~150–200 itens a rolagem engasga (rubric marca >50 sem virtualização).
3. **Contadores duplicados (Nielsen 8).** Total/favoritos/categorias aparecem no
   `.workspace-overview` (`861–899`) e de novo na sidebar (`718–739`): 3 números + 2 rótulos
   competindo antes do primeiro card.
4. **`font-variant-numeric: tabular-nums` em um só lugar** (`1632`). Os contadores da sidebar
   (`255–259`) e `.count-badge` (`609`) não têm — os dígitos dançam quando o número muda.
5. **Densidade antes do conteúdo:** o primeiro elemento é um bloco de captura escuro
   (padding 20px, gradiente radial) + 3 estatísticas + estante de favoritos. O trabalho real
   ("abrir um app") começa depois disso, contra o "compacto, fácil de escanear" de `DESIGN.md`.
6. **Pill de categoria:** `text-transform: uppercase` + `letter-spacing .04em` em 8–9px
   (`2190`, `843`, `1511`) faz o rótulo ler como decoração — e é o único lugar que informa a
   categoria no card.

---

## 5. Scorecard pelo rubric

| Eixo | Nota | Comentário |
|---|---|---|
| Nielsen 1 — status do sistema | 8/10 | toasts, `aria-live`, contadores; falta estado de carregando no favicon |
| Nielsen 3 — controle e liberdade | 9/10 | Undo em tudo, foco restaurado, Escape no diálogo |
| Nielsen 4 — consistência | 5/10 | 3 camadas de CSS, 17 tamanhos de fonte, 6 tamanhos de `h1` |
| Nielsen 6 — reconhecer em vez de lembrar | 7/10 | ícone + rótulo + `aria-current` ✓ |
| Nielsen 8 — minimalismo | 5/10 | 3 contadores duplicados + captura + estante antes da coleção |
| Tipografia | 4/10 | 47 declarações ≤11px, 8px no mobile |
| Escala de espaçamento | 3/10 | 62% fora da grade de 4px |
| Cor e contraste | 5/10 | 16 pares medidos na passada final: 10 passam, 6 falham (1 grave: anel de foco) |
| Acessibilidade | 7/10 | estrutura excelente; falha em foco, alvos e micro-texto |
| Motion | 9/10 | disciplinado, 4 bibliotecas sem colisão, reduced-motion real |
| Robustez (`Part 9`) | 7/10 | falta hover guard e virtualização |

**Média: 6,3/10.** Leitura: a **arquitetura** de UI está acima da média (contrato, a11y estrutural,
motion), o **acabamento do sistema visual** está abaixo (cascata tripla, micro-tipografia, escala).

---

## 6. Três direções que o plugin exploraria

O `design-and-refine` gera 5 variações variando hierarquia, layout, densidade, interação e expressão.
Para o Multiapp, as três que valem teste em `/__design_lab`:

- **A — Estante densa (Linear).** Cards de 148px, 4 colunas em ≥1400px, sem `.workspace-overview`
  (contadores vão para o cabeçalho da coleção), meta em 11px, um único acento (verde) com o lime
  reservado ao estado selecionado. Ganho: dobra os apps visíveis sem rolar.
- **B — Launcher visual (iOS App Library).** Favicon 56px, nome 13px, sem domínio no card,
  pill de categoria trocada por ponto colorido de 6px à esquerda do nome.
  Ganho: reconhecimento por ícone, mais rápido que ler domínio.
- **C — Ficha de catálogo (Stripe).** Lista como layout padrão, linha de 56px, colunas
  nome/domínio/categoria/ações, densidade controlada por `row-gap` de 4px.
  Ganho: único formato que escala para 300+ links sem virtualização agressiva.

As três devem preservar o que já funciona: sidebar escura `#0c2a22`, `--highlight #d8f16d`
como único acento quente, e a captura escura como único bloco de contraste alto da página.

---

## 7. Correções prontas (patch medido)

```css
/* globals.css — P0, todos os valores verificados por cálculo */
:root {
  --muted-foreground: #5e7066;   /* 4.41 → 4.75 no papel, 4.28 → 4.61 no muted */
  --focus-ring: #358878;         /* 2.54 → 3.83 / 2.82 → 4.25 */
}
button:focus-visible, a:focus-visible, input:focus-visible, select:focus-visible {
  outline: 3px solid var(--focus-ring);
  outline-offset: 3px;
}
.search-field:focus-within { outline-color: var(--focus-ring); }    /* 671 */
.card-link:focus-visible:after { outline-color: var(--focus-ring); } /* 813 */

.card-domain { color: #63776b; }                 /* 3.48 → 4.69  (2188) */
.collection-heading p { color: #5f7367; }        /* 4.07 → 4.58  (2143) */
.page-footer, .starter-note { color: #5f7367; }  /* 3.80 → 4.58  (2199-2200) */
.overview-note { color: #63776b; }               /* 4.29 → 4.56  (2071) */
.favorite-button { color: #8a968e; }             /* 2.33 → 3.07  (784) */

/* micro-texto: piso 11px, 12px para metadado (843, 1511, 215, 2269, 686) */
.category-pill { font-size: 11px; }
@media (max-width: 480px) { .category-pill { font-size: 10px; } }
.eyebrow { font-size: 11px; }

/* alvos de toque: 30/27/32 → 44 na área clicável, sem inflar o ícone */
@media (max-width: 800px) {
  .icon-button, .icon-button.small, .layout-toggle button { width: 44px; height: 44px; }
  .category-nav button, .main-nav button { min-height: 44px; }
}

/* hover não vaza para touch */
@media (hover: none) {
  .app-card:hover { border-color: #e2e8da; box-shadow: 0 1px 0 #fff inset, 0 2px 4px #14382a08; }
  .sidebar .main-nav button:hover,
  .sidebar .category-nav button:hover { transform: none; background: transparent; }
}
```

Fora do CSS, dois ajustes:

- `globals.css:1632` → levar `font-variant-numeric: tabular-nums` também para
  `.main-nav button small`, `.category-nav button small` e `.count-badge`.
- `DESIGN.md:39` → corrigir `34–54px` do `h1` para o que existe (`clamp(32px, 3.5vw, 48px)`,
  com 34/31/29px nos breakpoints), ou ajustar o CSS para a doc. É o único ponto de tipografia
  em que documento e tela divergem hoje.

---

## 8. Para gerar as 5 variações de verdade

Este relatório é a **fase de review** do plugin feita sobre o código. A fase de geração
(`/__design_lab`) precisa do fluxo interativo:

```powershell
npm run dev                      # terminal 1: deixe rodando
claude                           # terminal 2, na raiz do projeto
/design-and-refine:start "Grade de apps + card, preservando sidebar escura e lime"
```

Ele então detecta Next.js App Router + Tailwind 4 (via `globals.css`, já que não há
`tailwind.config.*`), infere os tokens de `:root`, entrevista, gera 5 variantes em
`.claude-design/lab/`, publica em `/__design_lab` com o overlay de feedback e, ao finalizar,
apaga tudo e escreve `DESIGN_PLAN.md`.

Confiança deste documento: **alto** nos números (recalculados por script sobre os valores finais
da cascata), **médio** nas direções de design (julgamento, não medição).

---

## 9. O que foi aplicado (P0 + micro-tipografia)

Edições feitas no **ponto efetivo** de cada declaração (sem criar uma 4ª camada), mais dois
blocos novos no fim de `globals.css` para concerns que ainda não existiam.

| Correção | Onde | Antes | Depois | Medido |
|---|---|---|---|---|
| Token de texto secundário | `globals.css:12` | `#63756b` | `#5e7066` | 4.41 → **4.75** (papel) / 4.28 → **4.61** (muted) |
| Token + regra de foco | `15–16`, `123` | `#50a995` | `var(--focus-ring) #358878` | 2.54 → **3.83** / 2.82 → **4.25** |
| Foco do campo de busca | `673` | `2px #50a995` | `3px var(--focus-ring)` | idem |
| Foco do card | `815` | `#50a995` | `var(--focus-ring)` | idem |
| `.favorite-button` inativo | `786` | `#a0ada4` | `#8a968e` | 2.33 → 3.07 (alvo 3) |
| `.card-domain` | `2191` | `#7b8c80` | `#63776b` | 3.48 → **4.69** |
| `.collection-heading p` | `2146` | `#687b6f` | `#5f7367` | 4.07 → **4.58** |
| `.page-footer` / `.starter-note` | `2202–2203` | `#6d8073` | `#5f7367` | 3.80 → **4.58** |
| `.overview-note` | `2073` | `#6f8175` | `#63776b` | 4.29 → **4.56** |
| `.category-pill` | `845`, `1513` | 9px / 8px | 11px / 10px | piso de legibilidade |
| `.eyebrow` (base, ≤800, final) | `455`, `1322`, `2044` | 9 / 8 / 9px | 11px | idem |
| `.personal-badge` | `217` | 9px | 10px | idem |
| `.search-field kbd` | `688` | 9px | 11px | idem |
| `.save-status` | `1305` | 9px | 11px | idem |
| `.page-footer` (≤480) | `1547`, `1551` | 9px | 11px | idem |
| `tabular-nums` nos contadores | `1607–1610`, `2143` | ausente | presente | dígitos não dançam |
| Alvos de 44px no toque | `2288–2305` (novo) | 30/27/32/38/42px | 44px em `≤800px` | WCAG 2.5.5 |
| Hover em tela de toque | `2307–2333` (novo) | `:hover` grudava | `@media (hover: none)` | sem estado preso |
| `DESIGN.md` | frontmatter, `34`, `37`, `49` | — | doc alinhada ao CSS | sem divergência |

**Resultado da verificação automatizada:** `font-size` de 1 dígito → **0**;
`#50a995` → **0**; `#63756b` → **0**; contrastes **11/11 passam**.

**Fila de validação:** `npx tsc --noEmit` → 0 erros · `npm run lint` → 0 erros
(1 warning pré-existente de `<img>` em `site-favicon.tsx`) · `npm test` → **18/18** ·
`next build` → compilado em 604ms, 3 páginas estáticas, CSS final contendo os novos valores.

### 9.1 Densidade dos mosaicos de app (pedido posterior)

Os cards estavam grandes: no desktop a grade travava em 5 colunas de ~210px e o card tinha
178px de altura fixa. Refeito:

| Métrica | Antes | Depois |
|---|---|---|
| Coluna mínima da grade | `minmax(210px, 1fr)` | `minmax(168px, 1fr)` (150px entre 481–560px) |
| Colunas a 1440px de janela | 5 | **6** |
| Largura do card a 1440px | ~210px | **~176px** |
| Altura mínima do card | 178px | **136px** (conteúdo fecha em ~142px) |
| Gutter | 18px | **14px** |
| Padding interno | 20px | **16px** |
| Raio do card | 18px | **16px** |
| Favicon no card | 44px | **38px** |
| Título do card | 15px | **14px** |
| Espaço antes do rodapé do card | 18px | **12px** |
| Card no mobile (≤480) | 100px / favicon 38 | **84px / favicon 34**, gap interno 10px |
| `.add-card` | 178px | **136px** (76px no mobile) |
| Grade ≥1500px | `repeat(4, 1fr)` fixo | `auto-fill minmax(168px, 1fr)` |

Área por card: 210×178 ≈ **37.400px²** → 176×142 ≈ **25.000px² (−33%)**. Em 700px de altura
de conteúdo, passam de ~15 para ~24 cards visíveis (+60%).

Nota de cascata: a regra de 150px ficou em `@media (min-width: 481px) and (max-width: 560px)`
de propósito — dentro do bloco de 560px ela sobrescreveria o `1fr` do layout compacto de
celular e quebraria a linha única documentada em `DESIGN.md`.

## 10. O que ficou pendente (decisão de design, não bug)


1. **Consolidar as 3 camadas de CSS** (82 seletores duplicados, 115 declarações redundantes).
   É mecânico, mas exige revisão visual tela a tela — melhor fazer junto do `/design_lab`.
2. **Virtualização** da grade acima de ~150 cards (contrato permite 2.000).
3. **Contadores duplicados** e densidade antes do conteúdo (relacionado às direções A/B/C).
4. **Rodar o fluxo do plugin** para gerar e comparar as 5 variações em `/__design_lab`.




