---
version: alpha
colors:
  primary: "#16735f"
  primarySoft: "#e6f0e8"
  background: "#f2f6f2"
  surface: "#ffffff"
  text: "#14251f"
  muted: "#5b6f65"
  border: "#dde7df"
  focusRing: "#2f8172"
  shelf: "#123b31"
  highlight: "#d9f26b"
  logoGlyph: "#123b31"
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
Multiapp is a personal launch shelf for Brazilian Portuguese speakers. Product register. Compact, easy to scan and practical on a phone. Signature: a lime rounded-square tile holding a forest "m", used as the app icon, favicon, installable manifest icon and the wordmark mark; the lime tile repeats in the active navigation item. The canvas is a cool, pale gray; the floating forest navigation and lime active item anchor the workspace. Compact product headings keep the apps in view. Library, site passwords and AI keys share the same hierarchy. Avoid marketing hero sections, large decorative cards, dark neon dashboards and gradient-filled type.

## Colors
The frontmatter documents the runtime palette in app/globals.css :root. CSS variables are the canonical runtime owner; all UI consumes these variables, without a second theme adapter. Primary is forest teal, the sidebar is a forest shelf green, highlight is a soft lime used for the active navigation item. Surfaces are white, the capture strip is pale sage and the page is cool gray. Category dots are expressive; category names also convey their meaning. Error feedback uses a separate dark red semantic token. Focus uses `--focus-ring` (#2f8172), measured at 4.27:1 against the page background and 4.66:1 on white, so the ring meets the 3:1 non-text minimum without relying on color alone. The mark is the same palette inverted: lime tile (#d9f26b) with a forest glyph (#123b31), which stays legible at 16px and on both light and dark browser chrome.

## Typography
Segoe UI Variable for display and body keeps Windows and phone legibility with no webfont network dependency. The display face carries tight tracking on the oversized page title; body copy stays at 14px. Portuguese accents use system fallbacks. Main heading clamp(32px, 3.3vw, 46px), stepping to 36px at 800px, 34px at 560px and 32px at 480px; card title 15px (14px on phones), body 14px, metadata 11–12px. Headings name the current workspace rather than using a two-line slogan.

## Layout
Desktop: 244px navigation inset 14px from the viewport, with a 22px radius. The main shell starts at 272px; a 76px top bar aligns with the 40px horizontal content padding. Content is capped at 1240px. A 4px rhythm unifies spacing. Summary counts use a single quiet divider. A sage URL capture strip precedes shortcuts and the app collection. The grid auto-fits cards from a 190px minimum with a 16px gutter and 176px minimum height. Below 800px navigation becomes the existing modal drawer. Below 560px favorite shortcuts become full-width rows; below 480px app cards become 94px compact rows. List mode stays a single column at every width.

## Elevation & Depth
Fine borders and nearly flat white surfaces; cards receive a small shadow on pointer hover. The floating sidebar has one quiet ambient shadow. Dialogs use a stronger shadow to establish their layer. No decorative hero media: favicons are the useful images here.

## Shapes
16px cards, 11px buttons and search fields, 10px layout toggles and 6px category labels. Favicons occupy a reserved 42px square (38px on phones) with a letter fallback. Shared primitives own modal and menu behavior. The brand mark is a 22%-radius tile with a 46/512 stroke "m": 30px in the lockup, 512px as the app icon, and a maskable variant that keeps the glyph inside the 80% safe area. Favicons for the saved apps keep their reserved square.

## Components
Canonical map is in UX-CONTRACT.md. Controls have visible focus, hover and pressed states. The focus ring is `--focus-ring` at 3px, meeting 3:1 against every surface it lands on. On touch layouts every control reaches a 44px minimum target without enlarging its icon, and pointer-only effects sit behind `@media (hover: none)` so a tap never leaves a hover state behind. Counters use tabular numbers so digit changes do not shift the layout. Sidebar tab copy is split into characters by GSAP for a short entrance and pointer wave, always with a full visually hidden copy for assistive technology. Global scrollbar tokens apply to all containers. Dialogs fit viewport and scroll inside. Empty and error states keep navigation usable. Toast actions remain until dismissed or superseded. Reduced motion disables transitions and GSAP effects.

## Do's and Don'ts
Keep add/open actions obvious. Keep search and filters independent. Never imply magic: the collection belongs to the account and every device shows the same apps after sign-in. Always label the initial selection as editable starter apps. Never make card hover the only way to find its menu. Never animate the tab labels in a way that changes their measured width or removes their accessible name.

Library utility actions use the existing secondary buttons. Focus mode keeps the same card density and centers the content at 1100px; its exit action remains in the collection toolbar. Search commands use an expandable native details element, so help stays available without dominating the library.

## Account gate
The first screen is the login. Two panels at 900px and wider: the deep forest shelf with the four-tile mark, the promise in two lines ("Todos os seus apps." / "Uma senha só." in the lime highlight), one supporting sentence, three short benefits and the "Menos abas. Mais foco." line; the pale panel with a white card holding a segmented Entrar/Criar conta control, two labeled fields, a reveal-password button, one primary action and a text switch. Below 900px the shelf becomes a compact header (mark, eyebrow, headline) and the card follows; the benefits list is hidden rather than squeezed. Below 400px the card loses side padding, not the 44px targets. The account menu in the top bar repeats the username and holds "Importar e exportar", "Buscar mudanças de outro aparelho" and "Sair da conta". The sync status next to it names the truth: Sincronizado, Salvando… or Sem conexão — salvo neste aparelho.

