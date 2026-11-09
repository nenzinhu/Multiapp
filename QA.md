# Verification

Unit tests: `npm test` (node --test tests/collection.test.mjs), 8 passed. Covers
URL normalization (missing scheme, host:port), unsafe schemes, credential
rejection, domain based default name, accent-insensitive search, favorites and
recent filtering, backup validation and merging without replacing existing
links, and the starter selection.

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

Limits: no real mobile hardware/virtual-keyboard test, no screen-reader audit,
no simulated browser storage quota failure or offline network test. JSON import
merge and validation tested at the model level; browser file-picker import not
exercised. Collection is local to each browser, without cloud synchronization.
Remote favicon availability depends on the provider.
