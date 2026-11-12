# Multiapp interaction contract

User brief: save pasted webapp URLs, use favicons, stay compact and responsive. The user delegated implementation decisions. Local persistence, starter apps and JSON backup are implementation choices. No accounts or cloud sync.

## Canonical UI Map
| Capability | Canonical owner | Source of truth | Allowed variants | Verification |
|---|---|---|---|---|
| Select/Listbox | Native select in app/page.tsx | This contract | category, sort; platform-owned popup accepted | Browser keyboard and mobile |
| Form | LinkEditor, category form in app/page.tsx; lib/collection.ts validation | This contract | create/edit | Unit and browser |
| Scrollbar | app/globals.css | DESIGN.md | global | Browser |
| Toast | single status region in app/page.tsx | This contract | success/error, undo | Browser |
| CRUD | lib/collection.ts + commit in app/page.tsx | This contract | local collection | Unit and browser |
| Dialog | components/ui/dialog.tsx, Radix | This contract | editor, categories, backup | Keyboard/browser |
| Menu | components/ui/dropdown-menu.tsx, Radix | This contract | card actions | Keyboard/browser |
| Tab text | components/animated-text.tsx, GSAP | This contract | sidebar tabs, breadcrumb, collection title | Browser/reduced motion |
| Favicon | components/site-favicon.tsx | This contract | card, favorite shortcut, paste preview | Browser/provider fallback |
| Vault gate | components/vault/vault-view.tsx | This contract | create, unlock, change master passphrase | Browser |
| Vault record | components/vault/record-dialog.tsx | This contract | site credential, API key | Browser |
| Provider catalog | components/vault/vault-view.tsx | lib/ai-providers.ts | free AI providers | Browser |

## Persistence and safety
Only http/https URLs, no embedded credentials. Each mutation rereads the current localStorage snapshot and commits atomically before updating the UI. Storage events refresh other tabs; edits refuse to overwrite a changed record. Storage failure preserves the form and displays an actionable error. Corrupt storage is never silently overwritten. Import is all-or-nothing validated, merges by exact normalized URL and preserves existing records. JSON max 5 MB / 2,000 links / 100 categories. Favicon previews and cards request only the hostname from public icon endpoints (Google, DuckDuckGo) and fall back to the initial. No backend, billing, authentication or legal flow.

## Vault

The vault is a separate encrypted store (`multiapp.vault.v1`), reachable from "SEU ESPAÇO": site credentials and AI provider API keys. Records are sealed with AES-GCM-256 and the key is derived from a master passphrase with PBKDF2-HMAC-SHA256; only the salt, the IV and the ciphertext reach storage. The passphrase is never persisted, so a forgotten passphrase means unrecoverable data. The vault starts locked on every load, the derived key only lives in the open tab, and "Bloquear" discards it. Secrets are masked by default, revealed one at a time and copied through the clipboard. Vault entries never request favicons and never leave the browser. Export writes the encrypted envelope; import asks for the passphrase of the imported file and merges records without replacing the ones already stored. Limit: 500 records per vault.

## Flow ledger
Create/edit use the same modal fields and validation. Invalid submission focuses the field with a linked inline error. Closing preserves drafts until saved or explicitly canceled. Delete is reversible via a persistent Undo action; no permanent deletion workflow. Category deletion moves its links to Sem categoria and offers Undo. Search includes names, URLs, categories, ignores accents. Search/filter state lives in memory because it refers to private, browser-specific records; layout and sort preferences persist locally. Recent lists only apps actually opened here. All navigation remains on this one collection screen.

## Motion

Motion is functional, never decorative noise. The collection grid keeps its Motion layout transitions; AutoAnimate owns the lists that change with content (vault records, category manager), anime.js owns the crafted moments (catalog entrance, badge count-up, error shake, favorite pop) and GSAP owns the tab copy: the label is split into words and characters, the active tab replays a staggered entrance, hovering runs a short wave, and the breadcrumb/collection title reuse the same split text. The animation never changes the label's measured width, and a full visually hidden copy preserves the accessible name. The libraries never animate the same element. Every animation respects `prefers-reduced-motion`: with the setting on, badges simply show their final value, tab characters stay still and nothing moves.

## Accessibility and recovery
Portuguese labels. Dialog primitive provides inert background/focus trap/Escape; programmatic trigger focus is restored. Focus after deletion returns to search. Real anchors open apps in new tabs with noopener/noreferrer. Favicon fails to a letter; remote favicon providers receive only the hostname. The favicon preview appears in the capture strip and editor as soon as the URL validates. No HTML rendering from saved strings. Native select popup is intentionally platform-owned. No network loading for collection operations, synchronous local commit feedback. Initial hydration shows a stable loading state. Empty and no-results states offer the next useful action. Backup supports browser-to-browser transfer, never implies synchronization.

## Library discovery tools

Search combines whitespace-separated terms with AND. `#text` matches a category, `@domain` matches that host or its subdomains, `is:favorito` requires a favorite, and `is:nunca` requires no recorded opening. Unknown commands remain plain search text. “Esquecidos primeiro” sorts by oldest last opening, with never-opened links first; creation date breaks ties. Recent view keeps its existing last-opened order.

Focus mode is session-only and hides navigation, counts, capture and favorite shortcuts only in the library. “Sair do foco” stays visible with search and list controls. It does not modify saved data.

Markdown copying includes exactly the currently filtered library links, with escaped labels. It never includes vault data. Clipboard failures show existing error feedback. Optional tracker cleanup in the link editor removes only `utm_*`, `fbclid`, `gclid`, `dclid`, `msclkid`, `mc_cid` and `mc_eid`; other query parameters and fragments remain. The edited URL is not persisted until the normal save action.
