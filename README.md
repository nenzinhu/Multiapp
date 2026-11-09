# Multiapp

Personal webapp link organizer in Brazilian Portuguese. Paste a URL, keep the
favicons, organize by category and keep favorites one click away. The whole
collection lives in the browser (`localStorage`): no account, no server
database, no sync.

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
| `npm test`        | Unit tests for the collection model (`node --test`)  |

## Deployment on Vercel

1. Import the repository in Vercel.
2. Keep the defaults: framework **Next.js**, build command `npm run build`,
   output directory `.next`.
3. Node.js `22.x` or newer satisfies the `engines` field in `package.json`.

Every page is statically prerendered, so the deployment needs no environment
variable, no database and no build-time secrets.

## Included shape

- `app/page.tsx` — the whole product UI (collection, editor dialog, card
  menu, categories, backup dialog)
- `app/layout.tsx` — document shell and metadata
- `app/globals.css` — design tokens and the custom styles of the product
- `app/chatgpt-auth.ts` — optional dispatch-owned ChatGPT sign-in helpers
- `lib/collection.ts` — the collection model: normalization, validation,
  filtering, backup merge
- `lib/utils.ts` — `cn()` class helper
- `components/ui/` — shadcn primitives used by the product (dialog, menu)
- `vendor/shadcn-tailwind-4.13.0.css` — vendored shadcn base theme
- `public/` — logo and favicon
- `tests/collection.test.mjs` — unit tests for the collection model

## Data rules

- Only `http`/`https` URLs are accepted, without embedded credentials.
- Every mutation re-reads the current `localStorage` snapshot and commits
  atomically before the UI updates.
- Storage events refresh other tabs; edits refuse to overwrite a record that
  changed elsewhere.
- Corrupt storage is never silently overwritten.
- Import is all-or-nothing validated, merges by normalized URL and preserves
  existing records. Limits: 5 MB per file, 2.000 links, 100 categories.
- Favicons are requested from Google's favicon endpoint using only the
  hostname; the full saved URL is never sent.
- The initial selection is an editable starter set, explicitly labeled as
  such.

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
