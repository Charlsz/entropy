---
version: alpha
name: Entropy
description: Local-first desktop workspace — Obsidian writing × Refern organization, four-color restrained system.
colors:
  ink: "#131413"
  ink-2: "#1C1D1C"
  paper: "#FAFAF9"
  paper-2: "#C8C8C6"
  background: "{colors.ink}"
  foreground: "{colors.paper}"
  surface: "{colors.ink-2}"
  muted: "{colors.paper-2}"
  border: "{colors.ink-2}"
  ring: "{colors.paper-2}"
typography:
  sans:
    fontFamily: Geist
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.5
  body-prose:
    fontFamily: Geist
    fontSize: 15px
    fontWeight: 400
    lineHeight: 1.75
  label-sm:
    fontFamily: Geist
    fontSize: 11px
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: 0.08em
  title-md:
    fontFamily: Geist
    fontSize: 13px
    fontWeight: 500
    lineHeight: 1.3
  mono:
    fontFamily: Geist Mono
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.45
rounded:
  sm: 8px
  md: 10px
  lg: 12px
spacing:
  1: 4px
  2: 8px
  3: 12px
  4: 16px
  5: 24px
  6: 32px
  7: 48px
components:
  button-icon:
    backgroundColor: transparent
    textColor: "{colors.paper-2}"
    rounded: "{rounded.sm}"
    size: 32px
  card-media:
    backgroundColor: "{colors.ink-2}"
    textColor: "{colors.paper}"
    rounded: "{rounded.lg}"
    padding: 0px
  panel:
    backgroundColor: "{colors.ink-2}"
    textColor: "{colors.paper}"
    rounded: "{rounded.md}"
---

# Design

## Overview

Entropy should feel like native desktop software for people who think in files and notes: calm, minimal, fast, spacious, and professional. Tool-first — not social, not dashboard, not marketing.

**Visual thesis:** Obsidian’s writing focus + Refern’s file elegance, with Entropy’s own quiet identity.

Overall feeling: calm · minimal · native · fast · no unnecessary animation · spacious · professional.

Prefer **whitespace over borders**. Prefer **icons over text** when the action is obvious. High information density that stays readable. Every element earns its place.

## Colors

**Only these four colors.** No accents, status reds, purples, or decorative hues.

| Token | Hex | Role |
|---|---|---|
| **ink** | `#131413` | Main background, chrome, primary surface (dark theme) |
| **ink-2** | `#1C1D1C` | Secondary surface — panels, cards, hover fills |
| **paper** | `#FAFAF9` | Primary text / icons on ink (dark theme) |
| **paper-2** | `#C8C8C6` | Secondary text, muted labels, soft emphasis |

Destructive actions use the same palette (e.g. quieter paper-2 styling), never a separate danger color.

Light theme remaps ink/paper roles (surfaces become paper tones, text becomes ink) via CSS variables — do not invent new hex values beyond derived mixes of these four.

## Typography

- **One family:** Geist for all UI and prose. If Geist cannot load, Inter is the only allowed fallback — still one family, no pairing.
- Mono: Geist Mono (or system mono) for code and paths.
- Product scale: tight (≈1.125–1.2). Fixed rem sizes, not fluid display type.
- Editor prose ≈15px / comfortable line-height; measure ≈65–75ch in the writing column.
- Section labels: small, semibold, slight tracking — sparse, not shouty.

## Layout

### Shell

Three columns on desktop:

1. **Sidebar** (Refern-leaning) — navigation, folders, file list with breathing room  
2. **Main** — editor or files grid; owns most of the width  
3. **Context** — metadata / properties / preview; **collapse and hide when empty**

Rules:

- Resizable panels; persist sizes; any panel collapsible.
- Top bar minimal: workspace name + icon actions (search, settings) + window controls. No ribbon.
- Icon rail may sit at the far left for section switching (Notebook / Files / Canvas / Settings).
- Use horizontal space; avoid stacked vertical chrome that wastes the writing surface.

### Notebook

- Obsidian-like: large writing area, comfortable line width, tabs, edit / split / preview.
- **No Linked panel. No extra notebook side panels.**
- Writing is always the primary task.

### Sidebar

- Closer to Refern than Obsidian: clean, generous spacing, simple icons, soft hover, rounded selection.
- Folders breathe — avoid dense trees with tiny icons.
- Nice indentation; file/folder previews where useful.

### Files

- Native filesystem behaviors: drag-drop, multi-select, context menus, grid/list, breadcrumbs, previews.
- Cards (Refern-inspired): large rounded corners (10–12px), soft shadow only if needed, clear hierarchy, small titles, subtle hover (150–200ms).
- Files never leave their original paths.

### Context panel

Contextual only: file info, metadata, properties, linked references, image info, optional AI suggestions. No clutter. Hide when empty.

## Elevation & Depth

Prefer **tonal layers** (ink vs ink-2) over heavy shadows. Soft card shadow allowed for media cards only — subtle, not Material elevation stacks. No glassmorphism, no neumorphism, no glow.

## Shapes

Corner radius **8–12px** for controls, panels, and cards.

- Controls / inputs: ~8px  
- Panels / menus: ~10px  
- Media cards: ~12px  

No pill-everything. No oversized rounded-full chrome except tiny indicators if needed.

## Spacing

Strict **8px system** (with 4px half-step):

`4 · 8 · 12 · 16 · 24 · 32 · 48`

Align to this scale. Don’t invent 7px / 13px / 20px spacing ad hoc.

## Motion

- Duration **150–200ms**
- Ease-out (quart/quint). **No bounce, no elastic.**
- Use for: sidebar expand, folder open, hover, drag indicator, panel fade
- Default to **no animation** unless it clarifies state
- Honor `prefers-reduced-motion`

## Icons

- **Lucide**, outlined, consistent stroke (~1.75)
- Icons for obvious chrome; tooltips for discoverability
- No colorful illustrations or emoji as UI

## Components

Prefer **shadcn/ui** primitives restyled to Entropy tokens.

| Pattern | Guidance |
|---|---|
| **Buttons** | Quiet ghost/secondary for chrome; primary sparingly (paper on ink). Icon buttons for toolbars. |
| **Inputs** | Low-contrast borders (ink-2); focus ring paper-2. |
| **Tabs** | Compact; icon triggers for edit/split/preview. |
| **Menus / dialogs** | Flat ink surfaces; no heavy shadow theater. |
| **Cards** | Media/folder cards in Files — not generic dashboard cards elsewhere. |
| **Empty states** | Short, useful; teach the next action. |
| **Tooltips** | Required when replacing labels with icons. |

## Do's and Don'ts

**Do**

- Keep the four-color system absolute
- Let the editor dominate notebook layout
- Hide empty context panels
- Use icons for chrome; text for names and confirmations
- Match Refern calm in the sidebar and Obsidian focus in the editor
- Persist panel sizes; support collapse/resize
- Keep files on disk as source of truth

**Don't**

- Add Linked or other notebook-only extra panels
- Introduce new colors (including semantic red/green/purple)
- Clone Obsidian’s dense tree or Refern’s product chrome 1:1
- Ship ribbons, glass, neumorphism, gradients, or dashboard stat strips
- Use chat/message UI components unless the feature is explicitly chat
- Animate for decoration
- Force AI, accounts, or cloud into the core path
