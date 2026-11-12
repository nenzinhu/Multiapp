---
version: alpha
colors:
  primary: "#167460"
  primarySoft: "#e7f0ea"
  background: "#f5f7f6"
  surface: "#ffffff"
  text: "#19352c"
  muted: "#5e7066"
  border: "#dfe7e2"
  focusRing: "#358878"
  shelf: "#143c32"
  highlight: "#d8f16d"
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
Multiapp is a personal launch shelf for Brazilian Portuguese speakers. Product register. Compact, easy to scan and practical on a phone. Signature: an interlocking four-tile lime mark on a deep forest shelf, repeated in the compact shortcut grid, recalling an app launcher. The canvas is a cool, pale gray; the floating forest navigation and lime active item anchor the workspace. Compact product headings keep the apps in view. Library, site passwords and AI keys share the same hierarchy. Avoid marketing hero sections, large decorative cards, dark neon dashboards and gradient-filled type.

## Colors
The frontmatter documents the runtime palette in app/globals.css :root. CSS variables are the canonical runtime owner; all UI consumes these variables, without a second theme adapter. Primary is forest teal, the sidebar is a forest shelf green, highlight is a soft lime used for the active navigation item. Surfaces are white, the capture strip is pale sage and the page is cool gray. Category dots are expressive; category names also convey their meaning. Error feedback uses a separate dark red semantic token. Focus uses `--focus-ring` (#358878), measured at 3.95:1 against the page background and 4.25:1 on white, so the ring meets the 3:1 non-text minimum without relying on color alone.

## Typography
Segoe UI Variable for display and body keeps Windows and phone legibility with no webfont network dependency. The display face carries tight tracking on the oversized page title; body copy stays at 14px. Portuguese accents use system fallbacks. Main heading clamp(32px, 3.3vw, 46px), stepping to 36px at 800px, 34px at 560px and 32px at 480px; card title 15px (14px on phones), body 14px, metadata 11–12px. Headings name the current workspace rather than using a two-line slogan.

## Layout
Desktop: 244px navigation inset 14px from the viewport, with a 22px radius. The main shell starts at 272px; a 76px top bar aligns with the 40px horizontal content padding. Content is capped at 1240px. A 4px rhythm unifies spacing. Summary counts use a single quiet divider. A sage URL capture strip precedes shortcuts and the app collection. The grid auto-fits cards from a 190px minimum with a 16px gutter and 176px minimum height. Below 800px navigation becomes the existing modal drawer. Below 560px favorite shortcuts become full-width rows; below 480px app cards become 94px compact rows. List mode stays a single column at every width.

## Elevation & Depth
Fine borders and nearly flat white surfaces; cards receive a small shadow on pointer hover. The floating sidebar has one quiet ambient shadow. Dialogs use a stronger shadow to establish their layer. No decorative hero media: favicons are the useful images here.

## Shapes
16px cards, 11px buttons and search fields, 10px layout toggles and 6px category labels. Favicons occupy a reserved 42px square (38px on phones) with a letter fallback. Shared primitives own modal and menu behavior.

## Components
Canonical map is in UX-CONTRACT.md. Controls have visible focus, hover and pressed states. The focus ring is `--focus-ring` at 3px, meeting 3:1 against every surface it lands on. On touch layouts every control reaches a 44px minimum target without enlarging its icon, and pointer-only effects sit behind `@media (hover: none)` so a tap never leaves a hover state behind. Counters use tabular numbers so digit changes do not shift the layout. Sidebar tab copy is split into characters by GSAP for a short entrance and pointer wave, always with a full visually hidden copy for assistive technology. Global scrollbar tokens apply to all containers. Dialogs fit viewport and scroll inside. Empty and error states keep navigation usable. Toast actions remain until dismissed or superseded. Reduced motion disables transitions and GSAP effects.

## Do's and Don'ts
Keep add/open actions obvious. Keep search and filters independent. Never imply cloud sync: data stays in the current browser. Always label the initial selection as editable starter apps. Never make card hover the only way to find its menu. Never animate the tab labels in a way that changes their measured width or removes their accessible name.

Library utility actions use the existing secondary buttons. Focus mode keeps the same card density and centers the content at 1100px; its exit action remains in the collection toolbar. Search commands use an expandable native details element, so help stays available without dominating the library.
