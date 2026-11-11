---
version: alpha
colors:
  primary: "#0e6b57"
  primarySoft: "#e2f0e6"
  background: "#f2f4ec"
  surface: "#ffffff"
  text: "#13251e"
  muted: "#5e7066"
  border: "#dde4d8"
  focusRing: "#358878"
  shelf: "#0c2a22"
  highlight: "#d8f16d"
typography:
  display:
    fontFamily: "Segoe UI Variable Display, Segoe UI, system-ui, sans-serif"
  body:
    fontFamily: "Segoe UI Variable Text, Segoe UI, system-ui, sans-serif"
rounded:
  card: "16px"
  control: "12px"
spacing:
  unit: "4px"
components:
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.card}"
---

## Overview
Multiapp is a personal launch shelf for Brazilian Portuguese speakers. Product register. Compact, easy to scan and practical on a phone. Signature: an interlocking four-tile lime mark on a deep forest shelf, repeated in the compact shortcut grid, recalling an app launcher. The canvas is warm paper with two faint atmospheric washes; navigation is the dark anchor. Avoid marketing hero sections, large decorative cards, dark neon dashboards and gradient-filled type.

## Colors
The frontmatter documents the runtime palette in app/globals.css :root. CSS variables are the canonical runtime owner; all UI consumes these variables, without a second theme adapter. Primary is forest teal, the sidebar is a deeper shelf green, highlight is a soft lime used for selection and the capture action. Surfaces are white and the page is warm paper. Category dots are expressive; category names also convey their meaning. Error feedback uses a separate dark red semantic token. Focus uses `--focus-ring` (#358878), measured at 3.83:1 against the page paper and 4.25:1 on white, so the ring meets the 3:1 non-text minimum without relying on color alone.

## Typography
Segoe UI Variable for display and body keeps Windows and phone legibility with no webfont network dependency. The display face carries tight tracking on the oversized page title; body copy stays at 14px. Portuguese accents use system fallbacks. Main heading clamp(32px, 3.5vw, 48px), stepping to 34px at 800px, 31px at 560px and 29px at 480px; card title 14px, body 14px, metadata 11–12px.

## Layout
Desktop: 248px sidebar, 64px sticky top bar, content up to 1180px. A 4px rhythm; content padding 40px top and 34px sides. A compact two-line URL capture strip precedes the collection. The grid auto-fits cards from a 168px minimum (150px below 560px) with a 14px gutter, roughly 136px high, tightening to 84px rows below 480px. Below 800px sidebar becomes a controlled drawer, content padding 20px; below 480px cards become compact rows. List mode is a second density option, not another workflow.

## Elevation & Depth
Subtle borders for static surfaces, a fine inset highlight on cards and one soft ambient shadow on the capture panel. Only menus/dialogs get meaningful shadow. No decorative hero media: favicons are the useful images here.

## Shapes
16px cards, 12px controls, pill search fields, layout toggles and category pills. Favicons occupy a reserved 38px square with a letter fallback. Shared primitives own modal and menu behavior.

## Components
Canonical map is in UX-CONTRACT.md. Controls have visible focus, hover and pressed states. The focus ring is `--focus-ring` at 3px, meeting 3:1 against every surface it lands on. On touch layouts every control reaches a 44px minimum target without enlarging its icon, and pointer-only effects sit behind `@media (hover: none)` so a tap never leaves a hover state behind. Counters use tabular numbers so digit changes do not shift the layout. Sidebar tab copy is split into characters by GSAP for a short entrance and pointer wave, always with a full visually hidden copy for assistive technology. Global scrollbar tokens apply to all containers. Dialogs fit viewport and scroll inside. Empty and error states keep navigation usable. Toast actions remain until dismissed or superseded. Reduced motion disables transitions and GSAP effects.

## Do's and Don'ts
Keep add/open actions obvious. Keep search and filters independent. Never imply cloud sync: data stays in the current browser. Always label the initial selection as editable starter apps. Never make card hover the only way to find its menu. Never animate the tab labels in a way that changes their measured width or removes their accessible name.
