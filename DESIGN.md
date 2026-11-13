---
version: alpha
colors:
  primary: "#7aa2ff"
  primarySoft: "#212a3d"
  background: "#16181c"
  surface: "#1d2026"
  text: "#e9edf4"
  muted: "#9aa6b8"
  border: "#2e333c"
  focusRing: "#67e8f9"
  shelf: "#101216"
  highlight: "#22d3ee"
  logoGlyph: "gradient"
typography:
  display:
    fontFamily: "Segoe UI Variable Display, Segoe UI, system-ui, sans-serif"
  body:
    fontFamily: "Segoe UI Variable Text, Segoe UI, system-ui, sans-serif"
rounded:
  card: "16px"
  control: "11px"
spacing:
  unit: "4px"
components:
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.card}"
---

## Overview
Multiapp is a personal launch shelf for Brazilian Portuguese speakers. Product register. Compact, easy to scan and practical on a phone. Signature: a charcoal rounded-square tile holding a gradient "m" that runs cyan → blue → violet → pink → coral, used as the app icon, favicon, installable manifest icon and the lockup mark; the same gradient returns on the wordmark, the primary action and the active navigation item. The canvas is a deep charcoal; the floating near-black navigation and the gradient active item anchor the workspace. Compact product headings keep the apps in view. Library, site passwords and AI keys share the same hierarchy. Avoid marketing hero sections, large decorative cards flattened by pure black, neon washes behind body copy, and gradient type outside the wordmark and the login headline.

## Colors
The frontmatter documents the runtime palette in app/globals.css :root. CSS variables are the canonical runtime owner; all UI consumes these variables, without a second theme adapter. The canvas is charcoal `#16181c`, cards are `#1d2026`, the shelf is near-black `#101216` and borders are `#2e333c`. Text is `#e9edf4` (15.1:1 on the canvas), metadata `#9aa6b8` (7.2:1) and links/icons `#7aa2ff` (7.1:1). The brand gradient is the only saturated surface: `linear-gradient(115deg, #22d3ee, #3b82f6 32%, #6366f1 56%, #a855f7 78%, #ec4899)`, used on the mark, the wordmark, the primary button and the active nav item, always with a deep ink label `#071019` (≥4.8:1 on every stop). Category dots borrow the same stops plus a coral and an emerald for variety, and their pills pair a light hue with a dark tint (8.4:1 or better). Error feedback uses `#f87171` on dark red surfaces. Focus uses `--focus-ring` (#67e8f9), 12.3:1 on the canvas, so the ring meets the 3:1 non-text minimum without relying on color alone. Gradient is an accent: no gradient body backgrounds, no gradient body text.

## Typography
Segoe UI Variable for display and body keeps Windows and phone legibility with no webfont network dependency. The display face carries tight tracking on the oversized page title; body copy stays at 14px. Portuguese accents use system fallbacks. Main heading clamp(32px, 3.3vw, 46px), stepping to 36px at 800px, 34px at 560px and 32px at 480px; card title 15px (14px on phones), body 14px, metadata 11–12px. Headings name the current workspace rather than using a two-line slogan.

## Layout
Desktop: 244px navigation inset 14px from the viewport, with a 22px radius. The main shell starts at 272px; a 76px top bar aligns with the 40px horizontal content padding. Content is capped at 1240px. A 4px rhythm unifies spacing. Summary counts use a single quiet divider. A blue-tinted capture strip precedes shortcuts and the app collection. The grid auto-fits compact tiles from a 132px minimum with a 9px gutter and a 44px row (48px on touch pointers); below 480px it uses a 152px minimum, which lands on two readable columns. List mode adds the hostname on a second line (77px rows). A tile is favicon, name, category dot, favorite badge and the menu. Below 800px navigation becomes the existing modal drawer. Below 560px favorite shortcuts become full-width rows; below 480px app cards become 94px compact rows. List mode stays a single column at every width.

## Elevation & Depth
Fine borders on near-flat charcoal surfaces with a subtle vertical gradient; cards gain a light border and a deeper shadow on pointer hover. The floating sidebar has one ambient shadow and a hairline border. Dialogs and menus sit on a stronger black shadow, and the overlay dims the page instead of blurring it. No decorative hero media: favicons are the useful images here.

## Shapes
10px tiles, 11px buttons and search fields, 10px layout toggles and 6px category labels. Favicons occupy a reserved 42px square (38px on phones) with a letter fallback. Shared primitives own modal and menu behavior. The brand mark is a 23%-radius charcoal tile with a 50/512 gradient stroke "m": 30px in the lockup, 512px as the app icon, and a maskable variant that keeps the glyph inside the 80% safe area. Favicons for the saved apps keep their reserved square.

## Components
Canonical map is in UX-CONTRACT.md. Controls have visible focus, hover and pressed states. The focus ring is `--focus-ring` at 3px, meeting 3:1 against every surface it lands on. On touch layouts every control reaches a 44px minimum target without enlarging its icon, and pointer-only effects sit behind `@media (hover: none)` so a tap never leaves a hover state behind. Counters use tabular numbers so digit changes do not shift the layout. Sidebar tab copy is split into characters by GSAP for a short entrance and pointer wave, always with a full visually hidden copy for assistive technology. Global scrollbar tokens apply to all containers. Dialogs fit viewport and scroll inside. Empty and error states keep navigation usable. Toast actions remain until dismissed or superseded. Reduced motion disables transitions and GSAP effects.

## Do's and Don'ts
Keep add/open actions obvious. Keep search and filters independent. Never imply magic: the collection belongs to the account and every device shows the same apps after sign-in. Always label the initial selection as editable starter apps. Favorites are toggled from the tile menu (with a star badge when active), so the tile keeps a 132px footprint. Never make card hover the only way to find its menu. Never place body copy on the gradient or paint a whole panel with it; the gradient belongs to the mark, the wordmark, the primary button and the active nav item. Never animate the tab labels in a way that changes their measured width or removes their accessible name.

Library utility actions use the existing secondary buttons. Focus mode keeps the same card density and centers the content at 1100px; its exit action remains in the collection toolbar. Search commands use an expandable native details element, so help stays available without dominating the library.

## Account gate
The first screen is the login. Two panels at 900px and wider: the near-black shelf with the gradient mark, the promise in two lines ("Todos os seus apps." in off-white / "Uma senha só." in the cyan-to-violet gradient), one supporting sentence, three short benefits and the "Menos abas. Mais foco." line; the charcoal panel with a `#1b1e24` card holding an underlined Entrar/Criar conta control, two labeled fields, a reveal-password button, one primary action and a text switch. Below 900px the shelf becomes a compact header (mark, eyebrow, headline) and the card follows; the benefits list is hidden rather than squeezed. Below 400px the card loses side padding, not the 44px targets. The account menu in the top bar repeats the username and holds "Importar e exportar", "Buscar mudanças de outro aparelho" and "Sair da conta". The sync status next to it names the truth: Sincronizado, Salvando… or Sem conexão — salvo neste aparelho.

