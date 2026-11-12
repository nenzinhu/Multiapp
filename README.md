# Multiapp

Personal webapp link organizer in Brazilian Portuguese. Paste a URL, keep the
favicons — or attach your own image — organize by category and keep favorites
one click away. The whole collection lives in the browser (`localStorage`): no
account, no server database, no sync.

Built with [Next.js](https://nextjs.org) (App Router) and Tailwind CSS v4,
deployed on Vercel.

## Prerequisites

- Node.js `>=22.13.0`
- npm (the lockfile is authoritative: `npm ci` for a reproducible install)

## Commands

| Command           | What it does                                        |
| ----------------- | --------------------------------------------------- |
| `npm run dev`     | Development server on `http://localhost:3000`        |
| `npm run build`   | Production build (`.next/`)                          |
| `npm start`       | Serves the production build locally                 |
| `npm run lint`    | ESLint (Next.js core-web-vitals + TypeScript rules)  |
| `npm test`        | Unit tests for the collection, vault and icon proxy   |

## Deployment on Vercel

1. Import the repository in Vercel.
2. Keep the defaults: framework **Next.js**, build command `npm run build`,
   output directory `.next`.
3. Node.js `22.x` or newer satisfies the `engines` field in `package.json`.

Every page is statically prerendered, so the deployment needs no environment
variable, no database and no build-time secrets. The only server code is the
stateless `/api/favicon` proxy (a Vercel function) that the icon capture calls;
it keeps nothing between requests.

## Included shape

- `app/page.tsx` — the whole product UI (collection, editor dialog, card
  menu, categories, backup dialog)
- `app/layout.tsx` — document shell and metadata
- `app/globals.css` — design tokens and the custom styles of the product
- `app/chatgpt-auth.ts` — optional dispatch-owned ChatGPT sign-in helpers
- `lib/collection.ts` — the collection model: normalization, validation,
  filtering, backup merge
- `lib/vault.ts` — the encrypted vault: AES-GCM + PBKDF2, record validation,
  backup merge
- `lib/ai-providers.ts` — catalog of AI providers with a free tier
- `lib/utils.ts` — `cn()` class helper
- `components/ui/` — shadcn primitives used by the product (dialog, menu)
- `components/counter.tsx` — animated number badges
- `components/animated-text.tsx` — GSAP split-text for the sidebar tabs,
  breadcrumb and collection title
- `components/site-favicon.tsx` — app icon: the image stored with the link,
  the provider fallback and the letter fallback; used by cards and previews
- `lib/icon.ts` — icon pipeline: favicon capture through the proxy, uploaded
  image handling, square PNG encoding for storage
- `app/api/favicon/route.ts` — stateless favicon proxy used by the icon
  capture (public hosts only, 8 s budget, 512 KB cap)
- `lib/animations.ts` — anime.js helpers (entrance, shake, pop, count-up)
- `components/vault/` — the vault screens (site passwords, AI API keys)
- `vendor/shadcn-tailwind-4.13.0.css` — vendored shadcn base theme
- `public/` — logo and favicon
- `tests/` — unit tests for the collection, the vault and the icon proxy

## Data rules

- Only `http`/`https` URLs are accepted, without embedded credentials.
- Every mutation re-reads the current `localStorage` snapshot and commits
  atomically before the UI updates.
- Storage events refresh other tabs; edits refuse to overwrite a record that
  changed elsewhere.
- Corrupt storage is never silently overwritten.
- Import is all-or-nothing validated, merges by normalized URL and preserves
  existing records. Limits: 5 MB per file, 2.000 links, 100 categories.
- Favicons are requested from Google's and DuckDuckGo's public icon endpoints
  using only the hostname; the full saved URL is never sent. When both sources
  fail, the card shows the app initial. The paste strip previews the favicon
  as soon as the URL is valid, before the app is added.
- A link can also carry its own icon (`icon`), stored as a `data:image/...`
  data URL of at most 64 KB inside the record. It is either the site favicon
  captured through `/api/favicon?domain=<host>` or an uploaded image (PNG, JPG,
  WEBP, GIF, SVG or ICO, up to 2 MB) that the browser redraws as a 96×96 PNG.
  Stored icons win over the providers, work offline and travel with the JSON
  backup. Invalid, oversized or non-image values are dropped on read instead of
  breaking the collection.
- The icon proxy only reaches public hosts: IP literals, `localhost`, private,
  link-local and reserved ranges are refused before any request, redirects are
  re-checked, and the response is capped at 512 KB with a 8 s budget. It stores
  nothing and never receives the saved URL, only the hostname.
- The capture strip keeps an "Incluir favicon junto do link" preference
  (`multiapp.include-favicon`); with it on, the favicon is captured as soon as
  the pasted link opens in the editor. Changing the URL to another hostname
  drops the included image, and "Usar automático" goes back to the provider.
- The initial selection is an editable starter set, explicitly labeled as
  such.

## Ícones dos apps: favicon incluído ou imagem enviada

Every app shows an icon. There are three ways to get one:

- **Automático** (default): the card loads the site favicon from Google's and
  DuckDuckGo's public endpoints using only the hostname, and falls back to the
  app initial. Nothing is stored with the link.
- **Incluir favicon**: the editor asks the internal `/api/favicon` proxy for the
  site icon, redraws it as a 96×96 PNG and saves it inside the link. From then
  on the card uses that image — even without internet — and the JSON backup
  carries it.
- **Enviar imagem**: pick a local file (PNG, JPG, WEBP, GIF, SVG or ICO, up to
  2 MB). The browser redraws it, keeping the aspect ratio, and stores it the
  same way.

In the paste strip, "Incluir favicon junto do link" (remembered between visits)
does the capture as soon as the pasted URL opens the editor. The editor shows
the current state ("Favicon automático" or "Imagem incluída neste link"), lets
you swap the favicon, send another image or go back to automatic, and reports
failures inline, in Portuguese, without blocking the save.

## Cofre: senhas de sites e chaves de API

"SEU ESPAÇO" has two extra entries: **Senhas de sites** and **Chaves de IA**.

- The vault lives in its own `localStorage` key (`multiapp.vault.v1`) and holds
  only ciphertext: records are sealed with AES-GCM-256 and the key is derived
  from the master passphrase with PBKDF2-HMAC-SHA256 (210.000 rounds).
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
  and can be copied to the clipboard. Vault entries never request favicons, so
  no hostname leaves the browser.
- "Exportar" writes the encrypted envelope to a JSON file; "Importar" asks for
  the passphrase of the imported file and merges the records, keeping the ones
  already stored. Limits: 500 records per vault.

## Motion

Two libraries share the work, each where it is strongest:

- **GSAP** (`gsap` + `@gsap/react`) animates the copy of the sidebar tabs. The
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
