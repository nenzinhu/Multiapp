# Multiapp

## Conta e sincronização

Cada pessoa entra com usuário e senha; a biblioteca inteira vem da conta, então
o mesmo login abre os mesmos apps no computador, no tablet e no celular. O
cadastro pede usuário (3–32 caracteres) e senha (8–200); a senha é guardada com
scrypt e a sessão fica em um cookie HttpOnly de 30 dias. Uma conta nova herda a
coleção antiga deste navegador ou a seleção inicial editável. Duas edições
simultâneas em aparelhos diferentes são mescladas antes de salvar, com um aviso
discreto.

O cofre pessoal (senhas de sites e chaves de IA) continua criptografado no
navegador e não é sincronizado.

## Produto

Personal webapp link organizer in Brazilian Portuguese. The user asked for pasted URL capture, favicon icons, compact organization and responsive mobile/desktop behavior, and delegated remaining choices.

Implemented: automatic domain-based name, editable names/URLs/categories, favorites, recent opens, search, sort, grid/list, custom categories, reversible removal, JSON backup export/import with merge and duplicate prevention. The visual layer is an editorial forest shelf (paper canvas, deep sidebar, lime accent) with GSAP split-text motion on the sidebar tabs, breadcrumb and collection title. Pasting a URL previews the site favicon (Google/DuckDuckGo hostname lookup, initial fallback) before the app is added.

Cofre pessoal (em "SEU ESPAÇO"): senhas de sites e chaves de API guardadas em um cofre criptografado (AES-GCM + PBKDF2) neste navegador, com senha mestra que nunca é guardada, bloqueio manual, revelação e cópia de segredos, exportação/importação criptografada e um catálogo de provedores de IA com plano gratuito para guardar chaves.

Data lives in a server-side SQLite database (`node:sqlite`) owned by the account: users, scrypt password hashes, sessions and one JSON snapshot per account with a revision number. The browser keeps a per-account cache only. Accounts are required; the login screen is the first screen. The vault stays encrypted in the browser. Favicons request only the URL hostname from Google's favicon endpoint; the full saved URL is not sent.

Developer commands: npm run dev; npx tsc --noEmit; npm test; npm run lint; npm run build. Runtime uses Next.js 16 (App Router) on a Node.js host with a writable disk for `MULTIAPP_DB_FILE`. See QA.md for observed verification and limitations.
