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

## 2026 refresh: biblioteca densa (tiles ~87% menores)

Pedido: reduzir o tamanho dos cards para caber uma lista maior de apps. O card
antigo (247x176 px na largura de referencia) virou um tile compacto com favicon
22 px, nome, ponto da categoria, selo de favorito e menu.

- Grade: `minmax(132px, 1fr)` com gap de 8 px (antes 190/168 px, gap 16).
- Tile no desktop: 148x38 px em 6 colunas (antes 4 colunas de 247x176),
  ~87% menos area — mais apps por linha e por tela.
- Celular (390 px, touch): 2 colunas de 113x46 px, com `min-height: 44px` em
  `pointer: coarse` para manter o alvo de toque; nomes completos visiveis.
- Lista: linha de 77 px com o dominio na segunda linha.
- O cartao inteiro continua sendo o link (overlay `.card-link:after`); o menu
  fica em `z-index: 3`.
- Favoritar saiu do botao no topo e virou o primeiro item do menu, com selo de
  estrela no tile quando ativo. Verificado no navegador: selo 3 -> 4 e contador
  da sidebar 3 -> 4 ao favoritar o GitHub pelo menu, sem erros de console.
- O "Adicionar app" acompanhou o tamanho (linha unica, 22 px de icone).

`tsc`, `lint`, `npm test` (43) e `build` sem erros; capturas em 1280x900 e
390x844 conferidas. Sem regressao de overflow horizontal.

Limites: a medicao de "70%" foi feita por area do card contra a largura da
captura do usuario; em telas muito largas o `1fr` alarga os tiles e a densidade
cai um pouco. Nao testado em leitor de tela apos a mudanca de menu.

## 2026 refresh: tiles +15% (ajuste fino da densidade)

Pedido: aumentar uns 15% em relação aos tiles compactos anteriores. Ajuste
linear no conteudo do tile (altura, icone, fonte, paddings e menu), mantendo as
6 colunas no desktop:

| Medida | Antes | Agora |
| --- | --- | --- |
| Tile desktop | 148x38 | **147x44** (area +15%) |
| Colunas em 1280px | 6 | 6 |
| Icone / fonte / ponto | 22 / 12 / 5 | 25 / 13 / 6 |
| Menu e alvo de toque | 24 / 44 | 26 / 48 |
| Celular (390, touch) | 2 colunas de ~170x46 | 2 colunas de 171x50 |
| Lista | 77px | 79px |

O tile "Adicionar app" acompanhou (147x44, rotulo em uma linha) e a grade manteve
o gap de 9px. Medido no Chromium 1280x900 e 390x844: 6 e 2 colunas, sem
overflow horizontal, sem erros de console; `tsc`, `lint`, `npm test` (43) e
`build` sem erros.

## 2026 refresh: login em 1 clique pelo cofre

Ideia escolhida da lista: o cofre encontra o cartão do app e copia a senha sem
sair da biblioteca.

Como funciona: ao desbloquear o cofre, os registros ficam em memória
(`lib/vault.ts`, `rememberVaultRecords`) e a biblioteca assina esse estado com
`useSyncExternalStore`. `findVaultLogin` casa host exato (ignorando `www.`) e só
considera registros `kind: "site"` com usuário e segredo. O tile ganha um botão
de chave; o menu ganha "Copiar login do cofre" (ou "Desbloquear e copiar
login" quando bloqueado, que abre um diálogo de senha mestra e copia na hora).

Clipboard: a senha vai para a área de transferência e um cartão fixo mostra
`senha copiada · limpa em 30s`, com "Copiar usuário" e "Limpar agora". A limpeza
confere se o conteúdo ainda é o nosso antes de apagar, e também roda em
`pagehide` e no bloqueio do cofre. Nada é renderizado: só cópia.

Verificado no Chromium com permissões de clipboard (1280x900):

| Passo | Resultado |
| --- | --- |
| Cofre criado + credencial do GitHub guardada | 1 botão de chave no tile do GitHub |
| Clique na chave | clipboard = `senha-super-secreta-1`; cartão com "limpa em 30s" |
| Recarregar a página (cofre bloqueado) | 0 chaves; menu mostra "Desbloquear e copiar login" |
| Desbloquear pelo diálogo | clipboard = a mesma senha |
| "Limpar agora" | clipboard vazio |

Testes: `findVaultLogin` cobre `www.`, subdomínio diferente, chave de API
excluída, usuário vazio e URL vazia (44 passando, 1 integração Postgres
ignorada). `tsc`, `lint` e `build` sem erros.

Limites: permissão de clipboard varia por navegador (Safari pode pedir gesto a
mais); a cópia sequencial usuário+senha não é possível — a senha fica no
clipboard e o usuário tem um botão próprio. O segredo permanece na memória da
aba por até 30s enquanto o cartão está aberto.

## 2026 refresh: importar senhas do navegador (CSV e JSON)

Pedido: trazer as senhas do Google, Edge e outros para o app, aceitando CSV e
JSON, montando o banco de senhas do cofre.

Implementação: `lib/password-import.ts` (detecção de formato, CSV RFC 4180 com
aspas/quebras/`;`/tab/BOM, mapeamento de colunas em pt/en, JSON do Bitwarden,
backup do Multiapp, array genérico e objeto único), `mergeImportedRecords`
(deduplica por host + usuário respeitando o teto) e
`components/vault/import-dialog.tsx` (arquivo até 5 MB ou texto colado, prévia
com contagens e amostra sem senha). O cofre subiu de 500 para 5.000 registros.

Testes de unidade (9 novos, 53 no total): CSV do Chrome com BOM, aspas e vírgula
dentro do campo, `android://` ignorado e duplicata no mesmo arquivo; LastPass com
`grouping` virando nota; Bitwarden CSV; CSV genérico com `;` e cabeçalho em
português; Bitwarden JSON com nota segura ignorada; JSON criptografado recusado
com explicação; backup do Multiapp ignorando chaves de API; array genérico, JSON
inválido e arquivo sem linhas válidas; merge por host+usuário sem sobrescrever.

Navegador (Chromium 1280x900, build de produção):

| Passo | Resultado |
| --- | --- |
| Colar CSV do Chrome (3 linhas, 1 `android://`) | prévia "3 lidas · 2 prontas · 1 ignorada" com GitHub/Figma |
| Importar | 2 linhas no cofre + toast "2 credenciais importadas" |
| Voltar à biblioteca | 2 botões de chave (GitHub e Figma) |
| Importar o mesmo CSV de novo | "0 prontas · 2 já existiam" e botão desabilitado |
| Bitwarden JSON pelo seletor de arquivo | "1 pronta · 1 ignorada (nota)" e 1 registro no cofre |

`tsc`, `lint` (só o aviso do favicon remoto), `npm test` (53 casos, 1 integração
Postgres ignorada) e `build` sem erros.

Limites: sem importação de `.1pux` (1Password só via CSV) e sem CSV criptografado
do Bitwarden. Senhas não são exibidas na prévia; o arquivo importado não fica em
disco (lido em memória). Sem teste com arquivo real de 5.000 linhas.

## 2026 refresh: cofre sincronizado entre aparelhos (zero-knowledge)

Pedido: fazer a ideia #5 — o cofre sai de um navegador só sem entregar segredo ao
servidor.

Desenho: o servidor guarda apenas o **envelope selado** (`salt`, `iv`, `data` do
AES-GCM, `updatedAt`) por conta, com revisão. A senha mestra nunca sai do
dispositivo; a chave é derivada de PBKDF2 no navegador. Ao abrir a seção, o app
reconcilia:

- sem cópia remota → envia a local (ou nada, se também não houver);
- remota mais nova → adota no `localStorage` e mantém o cofre bloqueado para
  desbloquear com a senha mestra;
- local mais nova → envia com a revisão atual;
- empate → mantém a local. Conflito de revisão (409) devolve o envelope atual e o
  cliente adota se for mais novo, senão reenvia uma vez.

Superfície: `GET/PUT/DELETE /api/vault`, `vaults` nas duas implementações de
armazenamento (SQLite e Postgres), `pullVault`/`pushVault` no cliente e o status
na faixa do cofre (“Verificando…”, “Salvando…”, “Criptografado e sincronizado”,
“Só neste aparelho — sem conexão”).

Testes: envelope com revisão, conflito, remoção, validação (versão, campos
vazios, `updatedAt` inválido, 4 MB) e isolamento entre contas (56 passando, 1
integração Postgres ignorada). Build, `tsc` e `lint` sem erros.

Verificação em dois navegadores (Chromium, 1280x900 e 390x844), SQLite local:

| Passo | Resultado |
| --- | --- |
| Aparelho A: cria cofre e guarda GitHub | status “Criptografado e sincronizado” |
| `GET /api/vault` no A | revisão 2, envelope de 404 bytes, **sem o texto da senha** |
| Aparelho B (contexto novo): entra na mesma conta | cofre “Cofre bloqueado” (envelope remoto adotado) |
| B desbloqueia com a mesma senha mestra | 1 registro: GitHub · github.com · ••••••-123 |
| B volta à biblioteca | botão de chave no tile do GitHub |
| Arquivo SQLite (`sync.db` e `-wal`) | 0 ocorrências da senha em texto |

Limites: cofres criados separadamente em dois aparelhos têm sais diferentes; a
política é “o mais recente vence”, então o mais antigo precisa ser desbloqueado
com a senha mestra dele para ser reenviado. Sem teste com Postgres real neste
recurso (o pooler do Supabase estava em timeout durante a sessão). O `DELETE` do
vault remoto existe na API mas ainda não tem botão na interface.

## 2026 refresh: “senha mestra incorreta” no celular

Relato: no mobile a senha mestra era recusada mesmo sendo “a mesma” do desktop.
Duas causas foram encontradas e tratadas:

1. **Bytes diferentes com a mesma senha digitada**: a derivação PBKDF2 usava o
   texto cru. Teclado de celular costuma acrescentar espaço no fim e pode emitir
   acento decomposto (NFD) onde o desktop usou NFC. Agora o cofre normaliza com
   `trim()` + `NFKC` ao criar/trocar a senha e, ao desbloquear, tenta a forma
   normalizada, a aparada e a original — cofres antigos continuam abrindo.
2. **Cofre diferente no aparelho**: se o celular já tinha um cofre local com
   outra senha mestra, a sincronização podia empurrá-lo para a conta. Agora, se o
   `salt` for diferente, a cópia da conta vence, o envelope local é guardado em
   `multiapp.vault.v1.conflict` e o app avisa. A tela bloqueada também explica
   quando o cofre veio de outro aparelho.

Ajustes de teclado: `#vault-unlock`, `#passphrase-input`, `#passphrase-confirm` e
`#vault-passphrase` ganharam `autoCapitalize="none"`, `autoCorrect="off"` e
`spellCheck={false}`; o portão só oferece “Criar cofre” depois que a conta
responde (antes ficava “Preparando o cofre…”), evitando criar um segundo cofre
por engano. A mensagem de erro agora lembra de maiúsculas/acentos/espaços e do
caso “veio de outro aparelho”.

Teste de unidade novo: cofre criado com acento NFC abre com a versão NFD; senha
criada com espaço no fim abre sem o espaço e com espaços dos dois lados;
maíscula/minúscula continua sendo erro (57 passando, 1 integração ignorada).

Verificação em dois navegadores (Chromium, 390x844 e 1280x900): o celular cria o
cofre com `"mestre-forte-1 "` (espaço no fim) e sincroniza; o desktop digita
`"mestre-forte-1"` e **abre** os registros, com a tela bloqueada explicando “Este
cofre veio da sua conta…”. Sem erros de console.

Limites: maiúsculas continuam relevantes; se a pessoa realmente usou outra
senha mestra ao criar o cofre no celular, aquele cofre não abre o da conta — a
cópia local fica guardada para recuperação manual, sem interface de restauração.

## 2026 refresh: recuperar o cofre antigo de um aparelho

Complemento do ajuste anterior: quando o aparelho tem um cofre com `salt`
diferente, a sincronização guarda o envelope em `multiapp.vault.v1.conflict` e a
cópia da conta vence. Agora existe uma saída para não perder aqueles registros.

- Banner âmbar em **Senhas de sites**: “Cofre antigo guardado neste aparelho” com
  **Recuperar** e um botão de descarte (com Desfazer).
- `decryptVault(stored, passphrase)` abre o envelope antigo **sem mexer na sessão**
  (a chave/salt do cofre atual continuam valendo para salvar), então os registros
  são mesclados por host+usuário (`mergeImportedRecords`), salvos e sincronizados
  e o stash é apagado.
- `clearConflictingVault()` remove o stash; o descarte usa o mesmo toast com
  Desfazer para recolocar o envelope.

Teste de unidade novo: `decryptVault` devolve os registros de um cofre com outra
senha mestra, **não** desbloqueia a sessão (o cofre atual continua selando) e
recusa senha errada (58 passando, 1 integração ignorada).

Verificação no Chromium: conta A cria um cofre com `antiga-forte-1` e a credencial
Notion; essa envelope é injetada como conflito na conta B, que cria um cofre novo
com `atual-forte-1` e a credencial Figma. O banner aparece, **Recuperar** com a
senha antiga traz “1 registro trazido do cofre antigo”, a lista passa a ter
Figma + Notion (2 linhas), o banner desaparece e o console fica limpo.

Limites: a mesclagem mantém a versão já existente quando host+usuário coincidem
(não compara a senha); não há restauração de chaves de API de um stash para a
seção de provedores além do merge normal (elas entram no cofre e aparecem na
seção).

## 2026 refresh: diagnóstico de “senha mestra incorreta” no aparelho

Depois de normalizar a senha e proteger o cofre da conta, o caso restante é
“mesma senha, aparelhos diferentes”. Para isso o cofre agora se identifica:

- `vaultId(envelope)` gera um código curto (FNV-1a do `salt|iv`, 6 hex) mostrado
  como **“Cofre 326efc · atualizado em dd/mm/aaaa”** no portão bloqueado e no
  topo do cofre aberto. Se os dois aparelhos mostram códigos diferentes, são
  cofres diferentes (outra senha mestra) — não é erro de digitação.
- O campo da senha mestra ganhou **mostrar senha** (olho) no portão.
- Se `/api/vault` falha ao abrir a seção, o estado é **“Não foi possível falar com
  a sua conta”** com **Tentar de novo**, e o botão “Criar cofre” não aparece —
  antes, a pessoa podia criar um segundo cofre sem perceber.
- Conflito de revisão no envio (`pushSealed`) agora guarda o envelope local com
  `stashConflictingVault` antes de adotar o remoto, então o cofre recém-criado
  vira recuperável em vez de desaparecer.

Verificação (Chromium, 1280x900 e 390x844): conta A cria o cofre e o desktop B
entra na mesma conta — os dois mostram **o mesmo código** (`326efc`); o olho
aparece no portão. Com `/api/vault` bloqueado por `route.abort`, o portão mostra
“Não foi possível falar com a sua conta”, **zero** botões “Criar cofre”, e depois
de “Tentar de novo” (rota liberada) passa para “Crie seu cofre”. Sem erros de
console; `tsc`, `lint`, 58 testes e `build` ok.

Limites: o código identifica o cofre, não a pessoa; sem a senha mestra correta
não há como abrir um envelope (por design). Se o aparelho tinha um cofre próprio
e ele foi descartado antes desta versão, não há como recuperá-lo.

## 2026 refresh: abrir o site já com a senha copiada

Pedido: apertar no cartão da senha e entrar no site com usuário e senha. Um site
não pode preencher o formulário de outro domínio (o navegador bloqueia acesso
cross-origin); o que dá para fazer sem extensão é abrir o site e deixar a senha
pronta no clipboard. Foi o que passou a acontecer:

- O botão de chave do tile **abre o app em nova aba** e copia a senha no mesmo
  gesto (a abertura acontece antes do `await` para não ser bloqueada como popup).
- Menu do tile: **Abrir e copiar login**, **Copiar só a senha** e **Copiar
  usuário**; o cartão de clipboard continua com contagem de 30s e limpeza.
- Nada de URL com `usuario:senha@host` (rejeitada pela validação) nem tentativa de
  preencher formulário alheio.

Verificação (Chromium 1280x900, permissões de clipboard): com credencial do
GitHub e a chave no tile, o clique abriu **1 nova aba** e o clipboard ficou com
`senha-local-login-1`; o menu mostrou os sete itens, incluindo as três ações de
login; sem erros de console.

Testes: 58 passando; `tsc`, `lint` e `build` ok.

Limites: preenchimento automático real exige extensão de navegador (ou o gerenciador
do próprio navegador). O app não guarda a senha em campos de terceiros e continua
sem acesso a outras origens.

## 2026 refresh: extensão do Chrome preenche as senhas sozinha

O limite registrado na entrega anterior ("preenchimento automático real exige
extensão") virou produto: `extension/` é uma extensão Manifest V3, embalada em
`public/extension/multiapp-cofre.zip` e explicada em `/extensao` com o botão de
download.

Unidade — `npm test`: 70 testes, 69 passando e 1 pulado (Postgres sem
`TEST_DATABASE_URL`). A suíte nova (`tests/extension.test.mjs`, 11 casos) cobre:
abertura do envelope criado por `lib/vault.ts` com a cripto da extensão, recusa
da senha mestra errada, `trim()` + NFKC (acento decomposto), reabertura pela
chave exportada, envelope inválido, normalização de host, casamento de domínio
(incluindo `exemplo.com.maliciosos.net`, IP, `localhost` e `co.ao`), filtro de
credenciais de site, manifesto V3 apontando para arquivos existentes, checagem
de sintaxe de todo `.js` e o ZIP publicado contendo todos os arquivos.

Tipos e lint: `npx tsc --noEmit` sem erros; `npx eslint .` sem erros (só o aviso
antigo de `<img>` do favicon). Build: `npm run build` compilou e prerenderizou
`/extensao` como estática.

Ponta a ponta em Chromium 156 headless (`node scripts/verify-extension.mjs`, que
instala a pasta com `--load-extension` e conversa por CDP): o service worker
carregou; com o cofre fechado o status veio `locked`; a extensão leu o envelope
da aba do Multiapp; senha mestra errada voltou com "Senha mestra incorreta"; a
certa abriu 1 credencial; o site de teste casou com o registro; **usuário e
senha foram preenchidos sozinhos** no formulário e o selo apareceu; depois de
"Bloquear", a página recarregada ficou sem preenchimento.

Interface verificada no build de produção a 1280x900 e no popup a 320x470
(2x): o popup bloqueado mostra só a senha mestra, "Procurar o cofre" e "Abrir o
Multiapp"; o aberto mostra a contagem, o id do cofre, o interruptor de
preenchimento automático, o envio de formulário (desligado) e o prazo de
bloqueio; o cofre no app ganhou a faixa "Preencher senhas no Chrome" com o link
"Como instalar"; `/extensao` lista os sete passos, o aviso de modo do
desenvolvedor e serve o ZIP (200, 28 KB, 12 arquivos).

Limites: a extensão não está na Chrome Web Store (instalação manual, aviso de
modo do desenvolvedor é esperado); não cobre fluxo de duas etapas
(e-mail → senha) nem login dentro de iframe com interface própria (o iframe é
preenchido em silêncio); sem build para Firefox/Safari; o envio automático do
formulário vem desligado; sem a senha mestra o cofre continua irrecuperável; e a
chave aberta vive só na memória do navegador (fechar o Chrome exige digitar a
senha de novo).
