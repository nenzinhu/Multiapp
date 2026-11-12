# Verification

Unit tests: `npm test` (`node --test`), 30 passed across `tests/collection.test.mjs`, `tests/vault.test.mjs` and `tests/favicon.test.mjs`. Covers
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
tests remain at 30/30. `npm run build` (Next.js 16.3.4) prerendered `/` and
`/_not-found` as static content. Headless Chrome (Playwright, 1280x900 and
390x844) verified the new palette at both widths with no horizontal overflow and
no console errors: the split labels (`tab-label` / `tab-char`) reach their final
state, the pointer wave moves the characters and returns them, pasting
`github.com` fills `Github · github.com` and shows the favicon in the capture
symbol and input, the editor opens with the normalized URL and the same favicon,
and `prefers-reduced-motion` keeps every character still and visible. The
favicon providers are network dependent and fall back to the app initial; real
mobile hardware and screen-reader audits remain untested.

## 2026 refresh: favicon incluído no link ou imagem enviada

TypeScript (`npx tsc --noEmit`) passed. Lint reports no errors and the same
advisory `<img>` warning. `npm test` ran 30 tests: the collection suite now
covers `isIconDataUrl` (accepted raster data URLs, rejected remote URL,
`javascript:`, `data:text/html` and values over 64 KB), the preservation of a
valid icon through `validateBackup`, the silent drop of an invalid one and the
icon carried by `mergeBackup`. The new `tests/favicon.test.mjs` covers
`hostFromDomain` (bare hostnames accepted; `localhost`, IPv4/IPv6 literals, host
with port, credentials, path and full URL rejected) and `declaredIcons`
(`apple-touch-icon` first, relative hrefs resolved, `mask-icon`, `javascript:`,
`data:` and credentialed hrefs ignored, duplicates collapsed).

`npm run build` compiled successfully: `/` and `/_not-found` stay static and
`/api/favicon` is listed as a dynamic route. The route was also exercised
against the development server with `curl`: the eight starter domains
(figma.com, github.com, notion.so, canva.com, drive.google.com, youtube.com,
open.spotify.com, chatgpt.com) returned an image between 1.1 KB and 33 KB in
0.3–0.8 s; `localhost`, `127.0.0.1`, `169.254.169.254`, `[::1]`,
`figma.com:3000` and `user@figma.com` returned 400 and an unknown domain
returned 404. A page larger than the 256 KB HTML cap (chatgpt.com) still yields
its declared icons because the HTML read is truncated instead of discarded.

Browser verified with headless Chromium driven over CDP at 1280x900 and
390x844, with no page errors: pasting `vercel.com` in the capture strip with
"Incluir favicon junto do link" checked opens the editor already showing
"Imagem incluída neste link" and a `data:image/png` preview, and the saved
record carries a 1254-character icon; uploading a 320×120 PNG shows the image
centred with its aspect ratio preserved; "Usar automático" returns to "Favicon
automático" and the provider icon; changing the URL host drops the included
image while changing only the path keeps it; a site without a public favicon
(`example.com`) shows "Este site não tem um favicon público. Envie uma imagem."
inline and still saves; unchecking the strip preference persists it in
`multiapp.include-favicon` and skips the automatic capture after a reload; the
grid, the list view and the favorite shortcuts render the stored icon.

Limits: real mobile hardware, screen readers, browser quota exhaustion and a
true offline session were not simulated (the stored icon is a data URL, so no
network is needed to render it). The proxy depends on the site answering within
the 8 s budget; sites that block bots or only declare an SVG favicon may fall
back to the inline error. Vercel function limits were not exercised in this
environment.
