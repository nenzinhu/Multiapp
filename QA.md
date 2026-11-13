# Verification

Unit tests: `npm test` (node --test tests/collection.test.mjs tests/vault.test.mjs), 18 passed. Covers
URL normalization (missing scheme, host:port), unsafe schemes, credential
rejection, domain based default name, accent-insensitive search, favorites and
recent filtering, backup validation and merging without replacing existing
links, and the starter selection. The vault suite covers the AES-GCM round
trip, refusal of a wrong master passphrase, re-sealing and passphrase change,
record and payload validation, merge without duplicates, secret masking and
domain reading.

TypeScript: `npx tsc --noEmit` passed.

Lint: `npm run lint` reports no errors (one advisory warning for the remote
favicon `<img>`).

Production build: `npm run build` (Next.js 16.3.4) compiled successfully and
prerendered `/` and `/_not-found` as static content. The same command runs on
Vercel, so the deployment no longer depends on the removed `scripts/` helpers.

Browser verified through the production build at 1280x900 and 390x844: the
starter collection renders with favicons, category counts and the quick-add
strip; the sidebar, the grid and the mobile layout keep every action visible.
Data stays in the browser `localStorage`, so no server state is required.

Vault verified in the browser at 1280x900 and 390x844: creating the vault with
a master passphrase, storing a site credential and a provider API key, masking
and revealing the secret, copying it, deleting with undo, locking, and the
behaviour after a reload (locked again, wrong passphrase refused, right
passphrase restores the records). The stored envelope was inspected and holds
ciphertext only — the secret never appears in plain text. The provider catalog
lists 20 providers with their console links, and the key saved for a provider
is marked as saved in the catalog.

Motion verified in the browser: AutoAnimate runs FLIP transitions on the vault
list (the row is animated on add and on remove, and the undo brings it back),
the provider catalog enters with a staggered fade from anime.js, the badges
count up and keep their value when the section is revisited, the master
passphrase error shakes the gate and the favorite star pops. The reduced
motion preference was not simulated in a browser session.

Limits: no real mobile hardware/virtual-keyboard test, no screen-reader audit,
no simulated browser storage quota failure or offline network test. The vault
was not audited against a cryptographic review, and the free tiers listed in
the provider catalog change over time. JSON import
merge and validation tested at the model level; browser file-picker import not
exercised. Collection is local to each browser, without cloud synchronization.
Remote favicon availability depends on the provider.

## 2026 refresh: editorial forest, GSAP tabs, favicon preview

TypeScript (`npx tsc --noEmit`) passed. Lint reports no errors and one advisory
warning for the remote favicon `<img>` in `components/site-favicon.tsx`. Unit
tests remain at 18/18. `npm run build` (Next.js 16.3.4) prerendered `/` and
`/_not-found` as static content. Headless Chrome (Playwright, 1280x900 and
390x844) verified the new palette at both widths with no horizontal overflow and
no console errors: the split labels (`tab-label` / `tab-char`) reach their final
state, the pointer wave moves the characters and returns them, pasting
`github.com` fills `Github · github.com` and shows the favicon in the capture
symbol and input, the editor opens with the normalized URL and the same favicon,
and `prefers-reduced-motion` keeps every character still and visible. The
favicon providers are network dependent and fall back to the app initial; real
mobile hardware and screen-reader audits remain untested.

## 2026 refresh: conta, banco de dados e sincronização

Pedido: "um banco de dados que quando digitar o usuário e senha puxa todos os
apps, independente do computador ou mobile". Entrega: contas com usuário e
senha, biblioteca por conta em SQLite (`node:sqlite`), sessão em cookie HttpOnly
e sincronização por snapshot com revisão.

Unidade: `npm test` com 39 testes aprovados (15 novos em `tests/accounts`). Cobrem
hash scrypt e verificação em tempo constante, sal único, senha acentuada em NFD,
unicidade de usuário sem diferenciar maiúsculas, regras de usuário e senha,
rejeição de credenciais sem revelar qual campo falhou, sessão criada/lida/
apagada, sessão expirada, coleção vazia na revisão 0, normalização do payload
(`figma.com` → `https://figma.com/`), conflito de revisão sem sobrescrever o
outro aparelho, payload inválido preservando a cópia anterior, isolamento entre
contas e leitura da mesma coleção a partir de uma segunda sessão.

API: verificada com `curl` contra o build de produção (`npm start`, banco em
`/tmp`). `GET /api/auth/me` anônimo → `{"user":null}`; cadastro devolve 201 com
cookie `HttpOnly`; `PUT /api/collection` grava a revisão 1; um segundo jar de
cookies entra com o mesmo par (usuário em maiúsculas) e recebe a mesma coleção;
`PUT` com revisão antiga responde 409 com a cópia do servidor; senha errada →
401 com mensagem genérica; `POST /api/auth/logout` limpa o cookie e a coleção
passa a responder 401; 11 tentativas erradas seguidas terminam em 429.

Navegador (Playwright, Chromium, 1280x900 e 390x844): a tela de login abre em
ambos os tamanhos, criar conta entra direto na biblioteca com a seleção inicial
de 8 apps, adicionar `linear.app` mostra "Linear" e "Sincronizado", um contexto
novo de celular entra com o mesmo usuário e vê os 9 apps, o menu da conta mostra
`marina` com "Sair da conta", sair volta ao login, senha errada mostra "Usuário
ou senha incorretos", e recarregar a página no desktop mantém os 9 apps. Nenhum
erro de console além do 401 esperado da senha errada.

Limites: sem aparelho físico, sem auditoria de leitor de tela, sem teste de duas
abas editando ao mesmo tempo (o caminho de conflito foi coberto no nível de API e
de unidade). O limite de tentativas é em memória, por instância do processo. O
banco fica em disco: em hospedagem serverless (Vercel) é preciso um volume
persistente ou um driver externo, caso contrário a API responde 503. O cofre de
senhas e chaves de IA continua local e não sincroniza.

## 2026 refresh: Postgres (Supabase) como banco real

Pedido: usar o banco Postgres do Supabase como armazenamento. O host direto
`db.hoeqxhogarzuotthlyxh.supabase.co` só publica AAAA (IPv6), sem registro A, e
este ambiente não tem rota IPv6; a conexão foi feita pelo pooler IPv4
`aws-1-us-east-1.pooler.supabase.com:6543` com o usuário
`postgres.hoeqxhogarzuotthlyxh` e `sslmode=require`. A URL fica em `.env.local`
(ignorado pelo git) e em nenhum arquivo versionado.

Arquitetura: o armazenamento virou um contrato assíncrono em
`lib/server/accounts.ts` com duas implementações — `sqlite-store.ts` (local, sem
dependências) e `postgres-store.ts` (`pg`, pool, DDL idempotente). `store.ts`
escolhe pelo ambiente, então rotas, telas e testes usam a mesma API.

Unidade: `npm test` com 40 testes aprovados e 1 ignorado sem
`TEST_DATABASE_URL`. Cobrem o parser de URL (senha com `@` cru, `%40`
codificado, `sslmode=disable`), além de todos os casos anteriores migrados para
a API assíncrona.

Integração real: `TEST_DATABASE_URL` apontando para o Supabase criou o schema
temporário `multiapp_test`, criou as tabelas, cadastrou conta, rejeitou usuário
duplicado e senha errada, autenticou, abriu duas sessões, gravou a coleção na
revisão 1, recusou revisão antiga com 409, leu a mesma coleção pela segunda
sessão, isolou outra conta e apagou a sessão. O schema foi removido ao final
(2/2 aprovados).

API no build de produção conectada ao Supabase (`npm start`, `.env.local`):
cadastro 201, `PUT /api/collection` revisão 1, segundo cookie jar lendo a mesma
coleção, 409 com a cópia atual, logout 401. Conferido direto no Postgres: as
linhas de `users`, `sessions` e `collections` existiam (marina.pg com 1.422 bytes
de snapshot e 2 sessões).

Navegador (Playwright, 1280x900 e 390x844) contra o Postgres: criar conta abre a
biblioteca com 8 apps e "Sincronizado", adicionar `supabase.com` mostra
"Supabase", o mesmo login no viewport de celular vê o app criado no desktop e
nenhum erro de console apareceu.

Limpeza: as contas de teste (`teste.pg`, `marina.pg`) e suas sessões/coleções
foram apagadas; o banco ficou com 0 contas e 0 coleções, com as tabelas criadas
no schema `public`.

Limites: a URL direta (IPv6) não foi testada; o pooler de transação foi o único
caminho validado. Sem `DATABASE_URL` o app continua usando SQLite. O pool tem no
máximo 4 conexões por processo e o limite de tentativas de login segue em
memória, por instância.

## 2026 refresh: novo logo, ícone e paleta

Pedido: criar um logo novo e um favicon para usar como ícone, e aplicar essas
cores ao design. O mark é um tile lime (#d9f26b) de cantos 22% com um "m"
floresta (#123b31), desenhado em SVG (traço 46/512, pontas arredondadas) e
reutilizado no lockup, no favicon, no ícone instalável e no iPhone.

Arquivos: `public/multiapp.svg`, `public/favicon.svg`, `app/icon.svg`,
`public/icon-192.png`, `public/icon-512.png`, `public/icon-maskable-512.png`,
`app/apple-icon.png`, `app/manifest.ts`, `components/logo.tsx` (SVG inline) e
`app/layout.tsx` (theme-color, manifest, Apple web app).

Paleta aplicada aos tokens de `app/globals.css`: fundo `#f2f6f2`, texto
`#14251f`, primária `#16735f`, primária suave `#e6f0e8`, borda `#dde7df`,
muted `#5b6f65`, shelf `#123b31`, highlight `#d9f26b`. Contrastes medidos: texto
14.64:1 no fundo, muted 5.38:1 no branco, primária 5.75:1 no branco, anel de
foco 4.27:1 no fundo e 4.66:1 no branco, lime 9.95:1 no shelf e texto do shelf
11.21:1.

Build: `npx tsc --noEmit`, `npm run lint` (só o aviso conhecido do favicon
remoto), `npm run build` e `npm test` (41 casos) sem erros. `/icon.svg`,
`/icon-192.png`, `/apple-icon.png` e `/manifest.webmanifest` respondem 200 com o
content-type certo; o manifest traz `standalone`, `pt-BR`, `theme_color
#123b31` e os três ícones.

Navegador (Chromium, 1280x900 e 390x844): o lockup aparece na entrada e na
sidebar com o novo mark em 30px, o mark não distorce (`width`/`height` 30), o
`theme-color` é `#123b31`, e o favicon foi conferido em 16, 32 e 64 px — o "m"
continua legível no menor tamanho. Telas de entrada e biblioteca revisadas nas
duas larguras sem overflow e sem erros de console.

Limites: o icon maskable não foi testado em um launcher Android real; a
instalação PWA foi verificada pelo manifest servido, não pelo prompt de
instalação. `favicon.ico` não é gerado (o `app/icon.svg` cobre navegadores
modernos).

## 2026 refresh: paleta da arte da marca (charcoal + gradiente)

Pedido: usar a paleta da imagem da marca e aplicar o mesmo logo/favicon. A arte
traz fundo charcoal, palavra "Multiapp" com gradiente e um favicon de tile
escuro com um "M" em gradiente ciano → azul → violeta → rosa → coral.

Marca: o SVG (e os PNGs 192/512/maskable/iPhone) passou a ser um tile charcoal
`#262b33` com o "m" em gradiente (`#22d3ee`, `#3b82f6`, `#8b5cf6`, `#ec4899`,
`#fb7185`) e traço 50/512; o wordmark usa o mesmo gradiente via
`background-clip: text`. O favicon é o mesmo arquivo do logo.

Tema: os tokens de `app/globals.css` viraram escuros — canvas `#16181c`,
superfícies `#1d2026`, shelf `#101216`, bordas `#2e333c`, texto `#e9edf4`,
metadados `#9aa6b8`, links `#7aa2ff` e foco `#67e8f9`. Uma camada "brand skin"
no fim do arquivo aplica o gradiente na ação primária, no avatar, no item ativo
da navegação, na captura, nos cards e na tela de entrada, além de escurecer
toasts, banners, selects nativos (`color-scheme: dark`) e campos.

Contrastes medidos: texto 15.14:1 no canvas e 13.90:1 na superfície; muted
7.21:1 / 6.62:1; links 7.14:1; foco 12.26:1; rótulo escuro do botão gradiente
10.59:1 (ciano), 5.20:1 (azul), 4.84:1 (violeta) e 5.43:1 (rosa); pills de
categoria de 8.40:1 a 11.40:1; erro 5.90:1. Nenhum texto de corpo sobre o
gradiente.

Build: `npx tsc --noEmit`, `npm run lint` (só o aviso do favicon remoto),
`npm run build` e `npm test` (41 casos) sem erros. `/icon.svg`, `/icon-192.png`,
`/apple-icon.png` e `/manifest.webmanifest` seguem respondendo 200; manifest e
`theme-color` agora usam `#16181c`.

Navegador (Chromium, 1280x900 e 390x844): entrada (normal, criar conta e erro),
biblioteca, cofre bloqueado, menu da conta, diálogo de app, diálogo de backup e
lista foram revisados no tema escuro, sem overflow e sem erros de console. O
favicon foi conferido em 16/32/64 px e continua legível.

Limites: a arte original é um mockup 3D com brilhos e uma textura hexagonal que
não foi reproduzida pixel a pixel — o mark adapta o motivo "M" em gradiente para
SVG. Sem teste em launcher Android real nem em barra de navegador com tema
claro/escuro real.

## 2026 refresh: cadastro falhando + entradas de painel com GSAP

Relato: "ao cadastrar a senha falhou". O fluxo foi reproduzido localmente e
estava correto nos dois drivers; a falha vem do ambiente, não do formulário.
Três caminhos foram testados com o build de produção:

| Cenário | Resultado |
| --- | --- |
| `DATABASE_URL` do pooler (Supabase) | `POST /api/auth/register` 201, `/api/health` ok |
| sem `DATABASE_URL`, `MULTIAPP_DB_FILE` gravável | 201, health `storage: sqlite` |
| `DATABASE_URL` com o host direto `db.<ref>.supabase.co` | 503 com mensagem que nomeia o host e pede o pooler (porta 6543) |

Correções de robustez: o driver SQLite passou a ser importado sob demanda
(`import()` dentro de `getStore`), então um deploy só-Postgres funciona mesmo em
Node 18/20, onde `node:sqlite` não existe; `getStore()` virou assíncrono e todas
as rotas aguardam; a mensagem de erro agora distingue URL ausente, host IPv6,
senha recusada e disco somente leitura; e `GET /api/health` responde com driver,
alvo (sem senha) e latência para diagnosticar em um clique. README ganhou a
tabela de troubleshooting.

Animação: `lib/panel-motion.ts` usa GSAP (`gsap.context`, `power3.out`) para a
entrada dos painéis marcados com `data-panel-item` — história e cartão do login,
navegação da sidebar, título da página, resumo, faixa de captura, prateleira de
favoritos e cabeçalho da coleção. Cada execução limpa `opacity/transform`
(`clearProps`) para não brigar com hover nem com o layout do Motion.

Verificação da animação no navegador: amostrando `opacity` a cada 40 ms, o
cabeçalho do cartão vai de 0.13 a 1 em ~0.6 s e termina sem estilo inline; com
`prefers-reduced-motion: reduce` a opacidade fica em 1 o tempo todo e nenhum
estilo inline é criado; na biblioteca a faixa de captura vai de 0 a 1 depois do
login. Build, `tsc`, `lint` (só o aviso do favicon remoto) e `npm test` (41
casos) sem erros.

Limites: o erro original no ambiente do usuário não pôde ser observado
diretamente (sem acesso ao painel de deploy); a conclusão vem dos três cenários
reproduzidos e do novo `/api/health`.

## 2026 refresh: mensagem "sem DATABASE_URL nem SQLite"

O usuário relatou exatamente a mensagem nova de 503. A causa é de ambiente: o
host recebeu o deploy sem `DATABASE_URL` e roda uma versão de Node sem
`node:sqlite`, então nenhum dos dois drivers estava disponível. O app não tem
como criar uma conta sem banco — a correção é configurar a variável no painel.

Para tirar o usuário do escuro, o diagnóstico passou a existir em dois lugares:

- `GET /api/health` (JSON): driver ativo, alvo sem senha, plataforma detectada,
  latência e o mapa de variáveis que o processo realmente recebeu (só nomes).
- `GET /setup` (página pt-BR): status legível, o mesmo mapa e o passo a passo com
  o nome do painel da plataforma (Vercel, Railway, Render, Fly.io, Netlify,
  Koyeb) — a instrução muda conforme `VERCEL`, `RAILWAY_ENVIRONMENT`, `RENDER`,
  `FLY_APP_NAME`, `NETLIFY` ou `KOYEB_APP_NAME`.

Também passaram a ser aceitas as variáveis que as integrações injetam sem URL:
`POSTGRES_HOST`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DATABASE`,
`POSTGRES_PORT` e a família `PG*`. Assim um deploy criado pela integração
Vercel + Supabase conecta sem renomear nada.

Verificação com o build de produção:

| Cenário | `/api/health` | Cadastro |
| --- | --- | --- |
| `DATABASE_URL` do pooler | ok, postgres, 336 ms | 201 |
| sem URL e sem SQLite (host antigo) | 503 com dica por plataforma | 503 com a mesma dica |
| `POSTGRES_*` do pooler, sem `DATABASE_URL` | ok, postgres, 308 ms | 201 |
| `DATABASE_URL` inválida | 503, alvo "DATABASE_URL invalida" | 503 |
| sem banco, Node 24 (SQLite local) | ok, sqlite | 201 |

A página `/setup` foi capturada nos três estados (sqlite ok, postgres ok e URL
inválida) e mostra status, driver, alvo, plataforma, erro e variáveis.
`tsc`, `lint` (só o aviso do favicon remoto), `npm test` (41) e `build` sem erros.

Limites: o painel do usuário não é acessível daqui, então a variável precisa ser
criada por ele; `/setup` não escreve nada, apenas lê o ambiente do processo.

## 2026 refresh: valor do DATABASE_URL colado errado na Vercel

O valor enviado pelo usuário era
`postgresql://postgres.<ref>:***Nei@6280760aws-1-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require`:
faltava o `@` entre a senha e o host, e a senha tem `@` (que precisa virar `%40`
numa URL). O parser antigo aceitava a string, tomava o último `@` como
separador e tentava resolver o host `6280760aws-1-...`, terminando em ENOTFOUND.

Correções: `parseDatabaseUrl` agora ignora um prefixo `KEY=` e aspas ao redor do
valor (copiar/colar de painel), e detecta host começando por dígitos seguidos de
letra — o sintoma de `@` perdido — devolvendo uma mensagem que mostra o formato
correto e lembra do `%40`. `/api/health` e `/setup` exibem também o usuário
resolvido, para conferir a URL sem expor a senha.

Verificado com o build de produção, exatamente o valor do usuário: 503 com
`code: database-url-invalid` e a mensagem do `@`; `/setup` renderiza o mesmo
texto em destaque. Com o valor corrigido
(`...:***Nei%406280760@aws-1-us-east-1.pooler.supabase.com:6543/...`) o health
responde ok, alvo e usuário corretos, e `POST /api/auth/register` devolve 201.
`npm test` agora com 43 casos (novos: prefixo `KEY=`, valor entre aspas, senha
com `@` cru e URL sem o `@`). `tsc`, `lint` e `build` sem erros.

Limites: a correção do valor na Vercel é manual (o app só diagnostica); a senha
segue a mesma, então vale rotacioná-la depois.
