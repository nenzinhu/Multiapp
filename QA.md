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
