# Multiapp

Personal webapp link organizer in Brazilian Portuguese. The user asked for pasted URL capture, favicon icons, compact organization and responsive mobile/desktop behavior, and delegated remaining choices.

Implemented: automatic domain-based name, editable names/URLs/categories, favorites, recent opens, search, sort, grid/list, custom categories, local persistence, reversible removal, JSON backup export/import with merge and duplicate prevention.

Data lives in browser localStorage. No authentication, server database or synchronization of collections. Hosted Site remains owner-private. Initial apps are explicitly identified as an editable starter selection. Favicons request only the URL hostname from Google's favicon endpoint; the full saved URL is not sent.

Developer commands: npm run dev; npx tsc --noEmit; npm test; npm run lint; npm run build. Runtime uses Next.js 16 (App Router) deployed on Vercel. See QA.md for observed verification and limitations.
