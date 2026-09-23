---
version: alpha
name: Entropy
description: Local-first desktop workspace — light-first library + notebook shell from Figma Entropy.
colors:
  ink: "#131413"
  surface: "#FAFAF9"
  canvas: "#FFFFFF"
  border: "#E7E6E3"
  muted: "#6B6D69"
  select: "#EEF2F8"
  accent: "#6A7BA2"
typography:
  sans:
    fontFamily: Geist
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.4
  body-prose:
    fontFamily: Geist
    fontSize: 15px
    fontWeight: 400
    lineHeight: 1.6
  label-sm:
    fontFamily: Geist
    fontSize: 11px
    fontWeight: 600
    lineHeight: 1.2
  title-md:
    fontFamily: Geist
    fontSize: 14px
    fontWeight: 600
    lineHeight: 1.3
  mono:
    fontFamily: Geist Mono
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.45
rounded:
  sm: 4px
  md: 6px
  lg: 8px
spacing:
  1: 4px
  2: 8px
  3: 12px
  4: 16px
  5: 20px
  6: 24px
  7: 48px
---

# Design

## Overview

Entropy should feel like calm native desktop software: light-first, precise, spacious, and tool-first. Notebook and Library share one app chrome — a persistent left sidebar — then branch into writing or filesystem perspectives.

**Visual thesis:** Figma Entropy — soft surfaces, hairline borders, cool select tint, mono for paths/sizes.

Overall feeling: calm · light · local · precise · no unnecessary animation · professional.

Prefer **tonal layers and hairline borders** over heavy chrome. Prefer **icons + labels** in the primary sidebar. High information density that stays readable.

## Colors

Light is the default product theme. Dark remains available via Settings as an inverted remap.

| Token | Hex | Role |
|---|---|---|
| **ink** | `#131413` | Primary text / strong icons |
| **surface** | `#FAFAF9` | Sidebar, notes list, inspector, secondary chrome |
| **canvas** | `#FFFFFF` | Main content (file table, editor, gallery cards) |
| **border** | `#E7E6E3` | Hairline borders, dividers, search outline |
| **muted** | `#6B6D69` | Secondary labels, paths, timestamps |
| **select** | `#EEF2F8` | Active nav / selected row / selected note |
| **accent** | `#6A7BA2` | Storage meter fill; sparse accent only |

Do not introduce status reds, purples, or decorative hues beyond this set. Destructive actions stay quiet (muted text / confirmation dialogs).

CSS variables: semantic aliases (`--background`, `--foreground`, `--panel`, `--select`, …) map to these tokens. Dark theme remaps surfaces/text — do not invent unrelated hex values.

## Typography

- **UI + prose:** Geist (Inter only if Geist unavailable). One sans family — no display pairing.
- **Mono:** Geist Mono for paths, sizes, keyboard hints (`⌘K`), file chips.
- Hierarchy: section labels 11px semibold uppercase; nav/items 13px; breadcrumbs 13px; editor title ≈28px; prose 15px / 1.6.
- Product scale is tight. Fixed rem sizes, not fluid marketing type.

## Layout

### Shell

1. **App sidebar** (240px) — brand, search, Workspace, Library Perspectives, Intelligence, storage footer  
2. **Main** — Notebook notes+editor, or Library content for the active perspective  
3. **Inspector** (Library, ~300px) — File Intelligence when a file is selected; hide when empty  

Rules:

- Single shared sidebar across Notebook and Library (not an icon-only rail).
- Resizable Library inspector; persist sizes; collapse when empty.
- Minimal caption bar for Electron drag + window controls only — product chrome lives in the sidebar and content headers.
- Use horizontal space; avoid stacked vertical toolbars.

### Notebook

- Sidebar → Local Notes list (240px) → writing surface.
- Large title + prose; filesystem reference chips when notes point at real paths.
- Context / File Intelligence for notes stays optional and **hides when empty**.
- No Linked / extra notebook-only side panels beyond the notes list.

### Library

Perspectives (sidebar + optional content toolbar):

| Perspective | Job |
|---|---|
| **Folders** | Breadcrumb path + file table (Name, Path, Size, Modified) |
| **Gallery** | Media card grid with sort |
| **Large Files** | Size-filtered list (`>100MB`) |
| **Duplicates** | Exact duplicate reclaim flow |
| **Recent** | Recently touched files |

Treemap / size-map remains available as a power tool where useful, but Folders + Inspector are the primary Figma layout.

### Intelligence

Sidebar entries for Relationships and File Copilot stay deferred. Do not show stub destinations, and do not invent a cloud dependency.

## Elevation & Depth

Prefer flat surfaces + `#E7E6E3` borders. Soft card chrome only for gallery tiles. No glassmorphism, neumorphism, or glow.

## Shapes

- Search / controls: **6px**
- Gallery cards: **8px**
- Perspective chips / pills for file refs: can be fully rounded
- Storage meter: **2px** radius

## Spacing

Prefer Figma-aligned steps: `4 · 8 · 12 · 16 · 20 · 24 · 48`. Sidebar section headers use 16px top padding.

## Motion

- Duration **150–200ms**
- Ease-out. **No bounce, no elastic.**
- Prefer no animation unless it clarifies state
- Honor `prefers-reduced-motion`

## Icons

- **Lucide**, outlined, stroke ≈1.75
- Sidebar items: 14px icons; brand mark 18px
- Tooltips when an icon stands alone

## Components

Prefer **shadcn/ui** primitives restyled to Entropy tokens.

| Pattern | Guidance |
|---|---|
| **Sidebar item** | Full-width row; select fill `#EEF2F8`; muted idle text |
| **Search** | White field, border `#E7E6E3`, mono hint |
| **File table** | Compact rows, mono path/size, hairline separators |
| **Inspector** | Surface panel; uppercase section labels; connection rows |
| **Gallery card** | White, bordered, 160px preview, name + mono meta |
| **Empty states** | Short, useful; teach the next action |

## Do's and Don'ts

**Do**

- Match the Figma light shell as the primary identity
- Keep Notebook and Library in one sidebar language
- Hide empty inspectors / note context
- Keep files on disk as source of truth
- Persist panel sizes; support collapse/resize

**Don't**

- Revive the four-color-only dark-first system as the primary brand
- Add Linked panels or dashboard stat strips
- Clone Obsidian / Refern / WinDirStat chrome 1:1
- Ship colorful CTAs, glass, or ribbon toolbars
- Force AI, accounts, or cloud into the core path
