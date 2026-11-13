# Multiapp interaction contract

User brief: save pasted webapp URLs, use favicons, stay compact and responsive. Second brief: an account database so that typing username and password pulls every app on any computer or phone. The user delegated implementation decisions. Accounts, server-side sync, starter apps and JSON backup are implementation choices. The encrypted vault stays local.

## Canonical UI Map
| Capability | Canonical owner | Source of truth | Allowed variants | Verification |
|---|---|---|---|---|
| Select/Listbox | Native select in app/page.tsx | This contract | category, sort; platform-owned popup accepted | Browser keyboard and mobile |
| Form | LinkEditor, category form in app/page.tsx; lib/collection.ts validation | This contract | create/edit | Unit and browser |
| Scrollbar | app/globals.css | DESIGN.md | global | Browser |
| Toast | single status region in app/page.tsx | This contract | success/error, undo | Browser |
| CRUD | lib/collection.ts + commit in app/page.tsx | This contract | local collection | Unit and browser |
| Dialog | components/ui/dialog.tsx, Radix | This contract | editor, categories, backup | Keyboard/browser |
| Menu | components/ui/dropdown-menu.tsx, Radix | This contract | tile actions: favorite, edit, copy, remove | Keyboard/browser |
| Tab text | components/animated-text.tsx, GSAP | This contract | sidebar tabs, breadcrumb, collection title | Browser/reduced motion |
| Favicon | components/site-favicon.tsx | This contract | card, favorite shortcut, paste preview | Browser/provider fallback |
| Account gate | components/auth/auth-screen.tsx | lib/server/store.ts rules | sign in, create account, reveal password | Unit + browser |
| Sync status | save-status + account menu in app/page.tsx | lib/account.ts | sincronizado, salvando, sem conexão | Browser |
| Panel entrance | lib/panel-motion.ts (GSAP) | This contract | login, shelf, library panels | Browser/reduced motion |
| Health probe | app/api/health/route.ts + app/setup/page.tsx | lib/server/env.ts | postgres/sqlite, target host, env names | curl/browser |
| Vault gate | components/vault/vault-view.tsx | This contract | create, unlock, change master passphrase | Browser |
| Vault record | components/vault/record-dialog.tsx | This contract | site credential, API key | Browser |
| One-click login | key button in app/page.tsx + lib/vault.ts (findVaultLogin) | This contract | copy secret, copy user, clear | Browser/clipboard |
| Provider catalog | components/vault/vault-view.tsx | lib/ai-providers.ts | free AI providers | Browser |

## Persistence and safety
Only http/https URLs, no embedded credentials. The library belongs to the account: `GET /api/collection` returns the whole snapshot with its revision and `PUT /api/collection` stores it after the same validation the browser uses. Storage is Postgres when `DATABASE_URL` is set and SQLite otherwise; both share one async contract in `lib/server/accounts.ts`, create their tables on first use and answer with the same errors. Each mutation updates the local copy first, writes the per-account cache and queues one save 400 ms later; a stale revision answers 409 with the server copy, which is merged once before the retry. Losing the network keeps the edits on the device, shows "Sem conexão — salvo neste aparelho" and retries on the next change, focus or the account menu. The session is an HttpOnly SameSite=Lax cookie valid for 30 days; a 401 returns the user to the login screen with an explanation. Passwords are hashed with scrypt and sign-in is throttled per IP + username. Import is all-or-nothing validated, merges by exact normalized URL and preserves existing records. JSON max 5 MB / 2,000 links / 100 categories. Favicon previews and cards request only the hostname from public icon endpoints (Google, DuckDuckGo) and fall back to the initial. The encrypted vault never leaves the browser and is not part of the account.

## Vault

The vault is a separate encrypted store (`multiapp.vault.v1`), reachable from "SEU ESPAÇO": site credentials and AI provider API keys. Records are sealed with AES-GCM-256 and the key is derived from a master passphrase with PBKDF2-HMAC-SHA256; only the salt, the IV and the ciphertext reach storage. The passphrase is never persisted, so a forgotten passphrase means unrecoverable data. The vault starts locked on every load, the derived key only lives in the open tab, and "Bloquear" discards it. The sealed envelope (salt + IV + ciphertext) is also stored for the signed account and reconciled on load: the newer copy wins, a device with local-only data pushes it, and the server never sees the passphrase or a plaintext record. Passphrases are compared after trim + NFKC so a mobile keyboard space or a decomposed accent does not lock the owner out; a local vault sealed with another salt never overwrites the account copy (it is stashed for recovery). Conflict answers 409 with the current envelope and the client adopts the newer one. Secrets are masked by default, revealed one at a time and copied through the clipboard. While unlocked, the library exposes a key button on every app whose host matches a site credential: one click copies the password, a floating card shows the 30-second countdown with "Copiar usuário" and "Limpar agora", and the clipboard is cleared on timeout, tab close or lock. Locked vault: the tile menu asks for the master passphrase in a dialog and copies right after unlocking. Vault entries never request favicons and never leave the browser. Export writes the encrypted envelope; importing a backup asks for the passphrase of the file. A second import path accepts the CSV/JSON of Chrome, Edge, Google, LastPass, Bitwarden, 1Password and generic tables (or a Multiapp backup), previewing how many are new, duplicated by host+username or ignored before writing. Limit: 5.000 records per vault, 5 MB per file.

## Flow ledger
Create/edit use the same modal fields and validation. Invalid submission focuses the field with a linked inline error. Closing preserves drafts until saved or explicitly canceled. Delete is reversible via a persistent Undo action; no permanent deletion workflow. Category deletion moves its links to Sem categoria and offers Undo. Search includes names, URLs, categories, ignores accents. Search/filter state lives in memory because it refers to private, browser-specific records; layout and sort preferences persist locally. Recent lists only apps actually opened here. All navigation remains on this one collection screen.

## Motion

Motion is functional, never decorative noise. The collection grid keeps its Motion layout transitions; AutoAnimate owns the lists that change with content (vault records, category manager), anime.js owns the crafted moments (catalog entrance, badge count-up, error shake) and GSAP owns the tab copy plus the panel entrances: `lib/panel-motion.ts` fades and lifts the elements marked `data-panel-item` (login story and card, shelf navigation, page heading, summary, capture strip, favorites shelf, collection heading) with a short stagger, clears the inline styles at the end and does nothing when `prefers-reduced-motion` is on. The tab label is split into words and characters, the active tab replays a staggered entrance, hovering runs a short wave, and the breadcrumb/collection title reuse the same split text. The animation never changes the label's measured width, and a full visually hidden copy preserves the accessible name. The libraries never animate the same element. Every animation respects `prefers-reduced-motion`: with the setting on, badges simply show their final value, tab characters stay still and nothing moves.

## Accessibility and recovery
Portuguese labels. Dialog primitive provides inert background/focus trap/Escape; programmatic trigger focus is restored. Focus after deletion returns to search. Real anchors open apps in new tabs with noopener/noreferrer. Favicon fails to a letter; remote favicon providers receive only the hostname. The favicon preview appears in the capture strip and editor as soon as the URL validates. No HTML rendering from saved strings. Native select popup is intentionally platform-owned. Collection edits render immediately and sync in the background, so the UI never waits on the network. Initial hydration shows a stable loading state while the session cookie is checked, then the account library. Empty and no-results states offer the next useful action. Backup remains an explicit JSON copy and no longer claims to be the only copy.

## Library discovery tools

Search combines whitespace-separated terms with AND. `#text` matches a category, `@domain` matches that host or its subdomains, `is:favorito` requires a favorite, and `is:nunca` requires no recorded opening. Unknown commands remain plain search text. “Esquecidos primeiro” sorts by oldest last opening, with never-opened links first; creation date breaks ties. Recent view keeps its existing last-opened order.

Focus mode is session-only and hides navigation, counts, capture and favorite shortcuts only in the library. “Sair do foco” stays visible with search and list controls. It does not modify saved data.

Markdown copying includes exactly the currently filtered library links, with escaped labels. It never includes vault data. Clipboard failures show existing error feedback. Optional tracker cleanup in the link editor removes only `utm_*`, `fbclid`, `gclid`, `dclid`, `msclkid`, `mc_cid` and `mc_eid`; other query parameters and fragments remain. The edited URL is not persisted until the normal save action.
