---
version: alpha
colors:
  primary: "#167567"
  primarySoft: "#e6f2ed"
  background: "#f7f9f8"
  surface: "#ffffff"
  text: "#233c35"
  muted: "#64756e"
  border: "#e0e7e3"
typography:
  display:
    fontFamily: "Trebuchet MS, sans-serif"
  body:
    fontFamily: "Segoe UI, system-ui, sans-serif"
rounded:
  card: "12px"
  control: "8px"
spacing:
  unit: "4px"
components:
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.card}"
---

## Overview
Multiapp is a personal launch shelf for Brazilian Portuguese speakers. Product register. Compact, easy to scan and practical on a phone. Signature: an interlocking four-tile mint mark repeated in the compact shortcut grid, recalling an app launcher. Avoid marketing hero sections, large decorative cards, dark neon dashboards and excessive gradients.

## Colors
The frontmatter documents the runtime palette in app/globals.css :root. CSS variables are the canonical runtime owner; all UI consumes these variables, without a second theme adapter. Primary is forest teal, surfaces are white, page is soft gray-green. Category dots are expressive; category names also convey their meaning. Error feedback uses a separate dark red semantic token.

## Typography
Trebuchet MS for logo and headings adds a friendly rounded rhythm; Segoe UI/system sans for body and controls prioritizes Windows and phone legibility. No webfont network dependency. Portuguese accents use system fallbacks. Main heading 30px, card title 15px, body 14px, metadata 12px.

## Layout
Desktop: 232px sidebar, 72px top bar, content up to 1180px. A 4px rhythm; content padding 36px. A compact two-line URL capture strip precedes the collection. Grid auto-fits cards with a 210px minimum, roughly 132px high. Below 800px sidebar becomes a controlled drawer, content padding 20px; below 480px cards become compact rows. List mode is a second density option, not another workflow.

## Elevation & Depth
Subtle border for static surfaces. Only menus/dialogs get meaningful shadow. No decorative hero media: favicons are the useful images here.

## Shapes
12px cards, 8px controls, small category pills. Favicons occupy a reserved 38px square with a letter fallback. Shared primitives own modal and menu behavior.

## Components
Canonical map is in UX-CONTRACT.md. Controls have visible focus, hover and pressed states. Global scrollbar tokens apply to all containers. Dialogs fit viewport and scroll inside. Empty and error states keep navigation usable. Toast actions remain until dismissed or superseded. Reduced motion disables transitions.

## Do's and Don'ts
Keep add/open actions obvious. Keep search and filters independent. Never imply cloud sync: data stays in the current browser. Always label the initial selection as editable starter apps. Never make card hover the only way to find its menu.
