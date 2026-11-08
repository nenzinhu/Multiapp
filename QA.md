# Verification

Unit tests: node --test tests/collection.test.mjs, 6 passed. Covers normalization, unsafe schemes, credential rejection, accent-insensitive search, favorites/recent filtering, import validation and merging without replacing existing links.

TypeScript: npx tsc --noEmit passed.

Browser verified through the in-app browser at 1280x900 and 390x844: pasted example.com, generated default title, selected category through keyboard in native select, saved a favorite; edited title and reloaded; searched for edited title; removed and restored with Undo; rejected javascript URL with inline error; displayed empty search result; opened mobile navigation, created a category; switched to compact list; opened backup dialog and triggered JSON download. Favicons loaded for the initial collection. Main/card actions and dialog controls remain visible on narrow screens. Browser testing used only disposable local preview data.

Production build passed; a final build is included in the publication workflow after formatting. Static premium audit passed without findings. DESIGN.md lint had 0 errors (unused-token advisory warnings). Native-select and dialog-close/menu-trigger audit false positives were resolved by explicit ownership and direct use of the canonical Radix primitives.

Limits: no real mobile hardware/virtual-keyboard test, no screen-reader audit, no simulated browser storage quota failure or offline network test. JSON import merge and validation tested at the model level; browser file-picker import not exercised. Collection is local to each browser, without cloud synchronization. Remote favicon availability depends on the provider.
