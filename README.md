# Multiapp

Personal webapp link organizer in Brazilian Portuguese. Paste a URL, keep the
favicons, organize by category and keep favorites one click away.

The collection belongs to an **account**: type the username and password and the
same apps open on any computer, tablet or phone. Accounts, password hashes,
sessions and the app library live in a server-side SQLite database
(`node:sqlite`), and the browser keeps only a per-account cache for a fast first
paint. The personal vault (site passwords and AI keys) stays encrypted in the
browser and never reaches the server.

Built with [Next.js](https://nextjs.org) (App Router) and Tailwind CSS v4.

## Prerequisites

- Node.js `>=22.13.0` (Node 24 recommended: `node:sqlite` is stable there)
- npm (the lockfile is authoritative: `npm ci` for a reproducible install)

## Commands

| Command           | What it does                                          |
| ----------------- | ----------------------------------------------------- |
| `npm run dev`     | Development server on `http://localhost:3000`          |
| `npm run build`   | Production build (`.next/`)                            |
| `npm start`       | Serves the production build locally                    |
| `npm run lint`    | ESLint (Next.js core-web-vitals + TypeScript rules)    |
| `npm test`        | Unit tests for collection, vault, accounts, sync and the extension |
| `npm run ext:zip` | Packs `extension/` into `public/extension/multiapp-cofre.zip` |

## Accounts, database and sync

- `POST /api/auth/register` creates the account and signs it in.
- `POST /api/auth/login` checks the pair and returns the account.
- `POST /api/auth/logout` deletes the session of that device only.
- `GET /api/auth/me` tells the UI whether the cookie still points at a session.
- `GET /api/collection` returns the whole library of the signed account.
- `GET /api/vault` / `PUT /api/vault` / `DELETE /api/vault` sync and remove the
  **sealed** vault envelope of the account (ciphertext only).
- `GET /api/health` reports the active driver (`postgres`/`sqlite`), the target
  host (never the password) and whether the database answers.
- `GET /setup` (page) renders the same diagnostics in Portuguese, with the
  platform-specific next step and the list of variables the server received.
- `PUT /api/collection` stores the whole library with a revision check.

How the pieces fit:

- Passwords are hashed with **scrypt** (N=16384, r=8, p=1, 64-byte key, random
  salt). The hash carries its own parameters, so the cost can grow later.
- Sessions use an **HttpOnly, SameSite=Lax cookie**; only the SHA-256 of the
  random token is stored, valid for 30 days. `Secure` is set whenever the
  request arrives over HTTPS.
- Sign-in is throttled per IP + username (10 failures in 10 minutes).
- The whole library is one JSON snapshot with a **revision number**. A stale
  revision answers `409` with the server copy, and the client merges instead of
  overwriting another device's edits.
- The browser keeps `multiapp.collection.v2.<userId>`, a per-account cache. The
  server copy always wins on load, and the cache is never shared between
  accounts. A collection from the previous browser-only version
  (`multiapp.collection.v1`) is migrated into the account on the first sign-in
  of an empty account.

### Database

| Variable             | Default             | Meaning                                             |
| -------------------- | ------------------- | --------------------------------------------------- |
| `DATABASE_URL`       | —                   | Postgres/Supabase URL; used when present            |
| `POSTGRES_URL` / `SUPABASE_DB_URL` | —    | Accepted aliases for `DATABASE_URL`                 |
| `POSTGRES_HOST` `POSTGRES_USER` `POSTGRES_PASSWORD` `POSTGRES_DATABASE` `POSTGRES_PORT` | — | Pieces injected by the Vercel/Supabase integrations; `PGHOST`/`PGUSER`/`PGPASSWORD`/`PGDATABASE`/`PGPORT` also work |
| `MULTIAPP_DB_FILE`   | `.data/multiapp.db` | SQLite file when no Postgres is configured          |
| `TEST_DATABASE_URL`  | —                   | Enables the Postgres integration test               |
| `PORT`               | `3000`              | Port used by `npm start`                            |

`lib/server/store.ts` picks the driver: Postgres when `DATABASE_URL` (or
`POSTGRES_URL` / `SUPABASE_DB_URL`) is set, SQLite otherwise. Both implement the
same `Storage` contract in `lib/server/accounts.ts`, and both create their
tables on first use. The SQLite file and its `-wal`/`-shm` companions hold
`users`, `sessions` and `collections`; back up that folder and the accounts move
with it.

#### Supabase

Supabase's project page offers three connection strings:

- **Direct** (`db.<ref>.supabase.co:5432`) is IPv6-only on new projects, so it
  fails on most IPv4-only hosts (and on Vercel).
- **Session pooler** (`aws-0-<region>.pooler.supabase.com:5432`).
- **Transaction pooler** (`aws-1-<region>.pooler.supabase.com:6543`) — the one
  used here; copy it from *Connect* and keep `?sslmode=require`.

The password may contain `@` or `%`; the app accepts the raw string as copied
from the dashboard and also the percent-encoded form (`@` → `%40`). A pasted
`DATABASE_URL=...` prefix or surrounding quotes are ignored, and a URL that lost
the `@` before the host is reported as such instead of a DNS error. `sslmode`
other than `disable`/`allow` turns TLS on with `rejectUnauthorized: false`, which
is what Supabase's pooler certificate requires.

Transactions in the collection write (`BEGIN` … `SELECT … FOR UPDATE` … `COMMIT`)
run on a single connection, so they are safe behind the transaction pooler. No
prepared-statement names, `LISTEN` or session state are used.

## Deployment

With `DATABASE_URL` pointing at Supabase (or any Postgres), the app runs on any
Node host — including serverless platforms such as Vercel — because no local
disk is needed. Set the variable in the hosting dashboard, deploy with the
defaults (framework **Next.js**, build `npm run build`), and the first request
creates the three tables.

Without `DATABASE_URL` the app falls back to SQLite and needs a writable disk
(VPS, Docker, Railway, Fly.io, Render with a volume). On Vercel the filesystem
is read-only and discarded between requests, so SQLite there answers `503` with
an actionable message instead of pretending to save.

## Included shape

- `app/page.tsx` — the library UI (collection, editor dialog, card menu,
  categories, backup dialog) plus the account and sync glue
- `app/layout.tsx` — document shell and metadata
- `app/globals.css` — design tokens and the custom styles of the product,
  including the account gate
- `app/api/auth/*` — register, login, logout and session probe
- `app/api/collection/route.ts` — read and write the account library
- `lib/server/db.ts` — SQLite connection, schema and file location
- `lib/server/accounts.ts` — shared types, rules, errors and the `Storage` contract
- `lib/server/sqlite-store.ts` — SQLite implementation of the storage contract
- `lib/server/postgres-store.ts` — Postgres/Supabase implementation, URL parsing,
  schema creation and TLS
- `lib/server/password.ts` — scrypt hashing and constant-time verification
- `lib/server/store.ts` — picks Postgres or SQLite from the environment
- `lib/server/http.ts` — cookies, JSON guards, session lookup, API errors
- `lib/server/rate-limit.ts` — in-memory sign-in throttle
- `lib/account.ts` — typed browser client for the API above
- `components/auth/auth-screen.tsx` — sign-in / create account screen
- `components/logo.tsx` — the four-tile mark shared by shelf and login
- `app/chatgpt-auth.ts` — optional dispatch-owned ChatGPT sign-in helpers
- `lib/collection.ts` — the collection model: normalization, validation,
  filtering, backup merge, per-account cache key
- `lib/vault.ts` — the encrypted vault: AES-GCM + PBKDF2, record validation,
  backup merge
- `lib/ai-providers.ts` — catalog of AI providers with a free tier
- `components/ui/` — shadcn primitives used by the product (dialog, menu)
- `components/counter.tsx`, `components/animated-text.tsx`,
  `components/site-favicon.tsx` — motion and favicon components
- `components/vault/` — the vault screens (site passwords, AI API keys)
- `tests/` — unit tests for the collection, the vault and the accounts

## Data rules

- Only `http`/`https` URLs are accepted, without embedded credentials.
- The server validates every snapshot with the same rules as the browser
  (`lib/collection.ts`), so a handcrafted request cannot store junk.
- Each mutation updates the local copy first and then sends the snapshot with
  the last seen revision, so the UI never waits on the network.
- Another device's write is never overwritten silently: the API answers `409`
  with the newer copy and the two are merged once before saving.
- A per-account cache keeps the first paint instant and survives a reload; the
  server copy replaces it on load, so a cleared browser loses nothing.
- Import is all-or-nothing validated, merges by normalized URL and preserves
  existing records. Limits: 5 MB per request, 2.000 links, 100 categories.
- Favicons are requested from Google's and DuckDuckGo's public icon endpoints
  using only the hostname; the full saved URL is never sent. When both sources
  fail, the card shows the app initial. The paste strip previews the favicon
  as soon as the URL is valid, before the app is added.
- The initial selection is an editable starter set, explicitly labeled as
  such.

## Cofre: senhas de sites e chaves de API

"SEU ESPAÇO" has two extra entries: **Senhas de sites** and **Chaves de IA**.

- The vault lives in its own `localStorage` key (`multiapp.vault.v1`) and holds
  only ciphertext: records are sealed with AES-GCM-256 and the key is derived
  from the master passphrase with PBKDF2-HMAC-SHA256 (210.000 rounds).
- The master passphrase is compared after `trim()` + Unicode NFKC, so a stray
  space or a decomposed accent from a phone keyboard still opens the same vault
  (the normalized form is what seals new vaults; legacy vaults are tried raw).
- The vault **is synced as ciphertext only**: the sealed envelope (salt, IV and
  AES-GCM ciphertext) is stored for the account in `vaults`, so a second device
  can unlock it with the same master passphrase. The server never receives the
  passphrase or a plaintext record, and the pinning is revision-based. A vault
  created separately on two devices has different salts; the account copy wins,
  and the local envelope is kept under `multiapp.vault.v1.conflict` instead of
  overwriting it. When that happens, **Senhas de sites** shows a "Cofre antigo
  guardado neste aparelho" banner: enter that vault's master passphrase and its
  records are decrypted locally, merged into the account (deduplicated by host +
  user) and the stash is deleted. Dismissing the banner (with Undo) also works.
- Every vault screen shows a short **vault id** (e.g. `Cofre 326efc`) plus the
  update date. Two devices showing different ids are holding different vaults,
  which is the usual reason a “same” passphrase is refused. The unlock field has
  a reveal toggle, and if the account cannot be reached the screen says so and
  offers “Tentar de novo” instead of suggesting a new vault.
- The master passphrase is never stored. If it is forgotten the records
  cannot be recovered — export the vault regularly.
- The vault starts locked on every page load and can be locked again with the
  "Bloquear" button. The derived key only lives in memory, in the open tab.
- Site credentials keep the site, the user and the password; API keys keep the
  provider, the console address and the key. Notes are optional.
- The provider catalog is a starting point: it lists AI providers with a free
  tier and links to their console. Free quotas change often, so confirm the
  limits in the provider panel.
- Secrets are masked by default (`••••••1234`), can be revealed one at a time
  and can be copied to the clipboard.
- **Login em um clique:** while the vault is unlocked, the library marks every
  app whose host has a site credential with a key button. One click **opens the
  app in a new tab** and copies the password, then shows a card with a 30-second
  countdown, a "Copiar usuário" action and "Limpar agora"; the clipboard is
  wiped when the timer ends, when the tab is closed or when the vault is locked.
  The tile menu keeps "Abrir e copiar login", "Copiar só a senha" and "Copiar
  usuário". A website cannot type into another site's login form (cross-origin
  DOM access is blocked by the browser): true autofill needs a browser extension
  or the browser's own password manager — the **Multiapp Cofre** extension
  (next section) does it. With the vault locked, the tile
  menu offers "Desbloquear e copiar login", asking for the master passphrase
  without leaving the library. Vault entries never request favicons, so
  no hostname leaves the browser.
- "Exportar" writes the encrypted envelope to a JSON file; "Importar" asks for
  the passphrase of the imported file and merges the records, keeping the ones
  already stored. Limits: 5.000 records per vault.

## Extensão do Chrome (preenchimento automático)

`extension/` is a Manifest V3 extension that fills the site login with the
credential kept in the vault. `public/extension/multiapp-cofre.zip` is the same
folder packed for manual install; `/extensao` explains the steps in Portuguese
and serves the download.

- **Install:** download the ZIP, extract `multiapp-cofre`, open
  `chrome://extensions`, enable *Modo do desenvolvedor*, click *Carregar sem
  compactação* and pick the folder. Chrome, Edge, Brave and Opera all accept it;
  it is not on the Chrome Web Store, so the developer-mode warning is expected.
  `npm run ext:zip` rebuilds the ZIP after any change in `extension/`.
- **Where the vault comes from:** the content script reads the sealed envelope
  (`multiapp.vault.v1`) from a Multiapp page — the app exposes
  `<meta name="multiapp-vault" content="1">`, so only the app answers — and hands
  it to the service worker, which caches it in `chrome.storage.local`. The
  server is never contacted: the extension works offline and with the app closed.
- **Master passphrase:** typed in the popup only. The worker derives the AES-GCM
  key (same PBKDF2 parameters as `lib/vault.ts`) and stores **the key**, not the
  passphrase, in `chrome.storage.session` — memory only, wiped when the browser
  closes and unreadable by content scripts (`TRUSTED_CONTEXTS`). A TTL
  (5 min–4 h, default 30 min) locks it on its own; "Bloquear agora" does it
  immediately. Decrypted records live in the worker's memory and are re-read
  from the envelope after any lock.
- **Autofill:** the content script matches `input[type=password]`, finds the
  username field of the same form (autocomplete/name/id/placeholder heuristics,
  preferring the one before the password) and sets the values with the native
  setter plus `input`/`change` events, so React-controlled forms accept them. One
  matching credential fills by itself; several show the floating badge with the
  list (title + user). "Enviar o formulário depois de preencher" is off by
  default. Pages without a password field are left alone, and SPA navigation
  re-runs the match.
- **Domain rule** (`extension/lib/site-match.js`): the credential applies to the
  same registrable domain, so `www.` and subdomains inherit it
  (`login.exemplo.com` × `www.exemplo.com`), while `exemplo.com.malicioso.net`
  never receives the password of `exemplo.com`; IP and `localhost` match only
  exactly. API keys in the vault are never offered to a site.
- **Limits:** no two-step (e-mail → password) flow, no iframe overlay UI (frames
  are filled silently), no Firefox build and no Chrome Web Store listing. The
  browser extension is also the reason the app keeps the envelope in
  `localStorage` instead of memory only.

## Motion

## Motion

Two libraries share the work, each where it is strongest:

- **GSAP** (`gsap` + `@gsap/react`) animates the copy of the sidebar tabs and the
  entrance of the panels: `lib/panel-motion.ts` fades and lifts the children
  marked `data-panel-item` (the login story and card, the shelf navigation, the
  page heading, the summary, the capture strip, the favorites shelf and the
  collection heading) with a short stagger, then clears every inline style so
  hover and layout effects keep working. Reduced motion skips it entirely. The
  visible label is split into words and characters: the active tab replays a
  staggered entrance and hovering runs a short wave. The breadcrumb and the
  collection title reuse the same split text. The full string stays available
  to assistive technology through a visually hidden copy.
- **AutoAnimate** (`@formkit/auto-animate`) watches the lists that change with
  content — the vault records and the category manager — and animates the
  additions, removals and reorders with FLIP transitions. It uses the Web
  Animations API, so nothing is left behind in the DOM.
- **anime.js** (`animejs`) handles the crafted moments: the staggered entrance
  of the provider catalog, the count-up of the badges ("8 apps na coleção"), the
  shake when the master passphrase is wrong and the pop of the favorite star.
- The library grid keeps its existing Motion layout animations, so the two
  never fight over the same element.
- Every animation respects `prefers-reduced-motion`: with the setting on,
  numbers simply appear, tab text stays still and nothing moves.

## Optional Dispatch-Owned ChatGPT Sign-In

`app/chatgpt-auth.ts` provides helpers for sites that need optional or
required ChatGPT sign-in:

- `getChatGPTUser()` for optional signed-in UI.
- Use the returned `userId` as the stable user key for user-owned records; do
  not use email as a durable identifier.
- `requireChatGPTUser(returnTo)` for server-rendered pages that should send
  anonymous visitors through Sign in with ChatGPT.
- In a Server Component, start sign-in with
  `<a href={chatGPTSignInPath(returnTo)} target="_top">`. The auth helper
  module is server-only; do not import it into a Client Component.
- Do not use `fetch`, XHR, a client-side router, or a framework link that can
  prefetch the sign-in route. SIWC must start as a top-level navigation.
- Never request the AuthAPI authorization endpoint directly. The dispatch-owned
  `/signin-with-chatgpt` route must start the SIWC flow.
- Use `chatGPTSignOutPath(returnTo)` for browser sign-out links or actions.
- Pass a same-origin relative `returnTo` path for the destination after
  sign-in or sign-out. The helper validates and safely encodes it.
- Mark protected pages with `export const dynamic = "force-dynamic"` because
  they depend on per-request identity headers.

Dispatch owns `/signin-with-chatgpt`, `/signout-with-chatgpt`, `/callback`, the
OAuth cookies, and identity header injection. Do not implement app routes for
those reserved paths.

## Learn More

- [Next.js documentation](https://nextjs.org/docs)
- [Tailwind CSS v4](https://tailwindcss.com/docs)
- [shadcn/ui](https://ui.shadcn.com)

## Troubleshooting sign-up

If "Criar conta" answers with an error, open `/api/health` first:

| `health` says | What to do |
| --- | --- |
| `ok: true, storage: "postgres"` | The database is fine; the error is in the form (password under 8 characters, username already taken, and so on). |
| `ok: false, code: "ENOTFOUND"`, target `db.<ref>.supabase.co` | You copied the direct URL, which is IPv6-only. Use *Connect → Transaction pooler* (`aws-1-<region>.pooler.supabase.com:6543`) and keep `?sslmode=require`. |
| `ok: false, code: "28P01"` | Wrong database password in `DATABASE_URL`. |
| `storage: "sqlite"`, `databaseUrl: "ausente"` on a serverless host | There is no persistent disk. Set `DATABASE_URL` in the hosting dashboard and redeploy. |
| `storage: "sqlite"` with a read-only filesystem error | Point `MULTIAPP_DB_FILE` at a writable volume, or move to Postgres. |
| `Este servidor não tem banco de dados configurado` | The host received neither a Postgres URL nor a `node:sqlite` runtime. Set `DATABASE_URL` in the hosting panel and redeploy; `/setup` shows the platform-specific path and which variables arrived. |
| `A URL do banco perdeu o '@' entre a senha e o host` | The value lost the separator before the host. The format is `postgresql://USER:PASSWORD@HOST:6543/postgres?sslmode=require`; an `@` inside the password must be written `%40`. |

`DATABASE_URL` is read at runtime; after changing it in the hosting panel, a new
deployment (or a restart, on a long-running server) picks it up. The SQLite
driver is imported lazily, so a Postgres-only deployment also runs on Node 18/20
where `node:sqlite` does not exist.

## Importar senhas de outros gerenciadores

Em **Senhas de sites → Importar senhas** (cofre aberto) você traz as senhas que
já existem no navegador ou em outro gerenciador. Tudo é lido **neste navegador**,
mostra uma prévia com o que entra, o que já existia e o que foi ignorado, e é
salvo **criptografado** no cofre — nada vai para o servidor.

| Origem | Como exportar | Formato |
| --- | --- | --- |
| Chrome / Edge / Google | `chrome://password-manager/settings` → Exportar senhas | `Chrome Passwords.csv` |
| LastPass | Vault → Advanced Options → Export | `.csv` |
| Bitwarden | Tools → Export vault → `.csv` ou `.json` (sem senha) | `.csv` / `.json` |
| 1Password | File → Export → CSV | `.csv` |
| Multiapp | Cofre → Exportar | `.json` (backup do cofre) |
| Outro | qualquer tabela com colunas de site/usuário/senha | `.csv` |

O leitor aceita `,`, `;` ou tabulação; cabeçalhos em português ou inglês; aspas e
quebras de linha dentro de campos; BOM do Excel; e URLs sem `https://`. Linhas
com `android://`/`chrome://` (apps do celular e páginas internas) são ignoradas.
Duplicatas são detectadas por **host + usuário** — o que já está no cofre não é
sobrescrito. Limites: 5 MB por arquivo e 5.000 registros no cofre. O botão
**Backup** continua sendo o backup criptografado do próprio cofre.

## Brand and icons

- `components/logo.tsx` — inline SVG lockup (mark + `multiapp.`), themed by
  `--logo-tile` and `--logo-glyph`
- `public/multiapp.svg`, `public/favicon.svg`, `app/icon.svg` — the vector mark
  (lime tile, forest "m")
- `public/icon-192.png`, `public/icon-512.png`, `public/icon-maskable-512.png`,
  `app/apple-icon.png` — raster icons for install, Android maskable and iOS
- `app/manifest.ts` — web manifest (`standalone`, forest theme color, pt-BR)
- `app/layout.tsx` — `theme-color`, Apple web app metadata and icon links

Palette (runtime tokens in `app/globals.css`, documented in `DESIGN.md`):
charcoal canvas `#16181c`, cards `#1d2026`, shelf `#101216`, text `#e9edf4`,
metadata `#9aa6b8`, links `#7aa2ff`, focus ring `#67e8f9` (12.3:1). The brand
gradient `#22d3ee → #3b82f6 → #6366f1 → #a855f7 → #ec4899` is reserved for the
mark, the wordmark, the primary button and the active navigation item.

Icons are generated from `public/multiapp.svg`; keep the SVG and the PNGs in
sync when the mark changes.
