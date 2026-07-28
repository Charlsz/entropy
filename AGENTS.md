# Agents

**Read this file before changing Entropy.** Then read `PRODUCT.md` and `DESIGN.md`. Treat them as normative. If a request conflicts with them, follow the docs and ask the user before inventing a new product direction.

## Required reading order

1. `AGENTS.md` (this file) — hard constraints and workflow
2. `PRODUCT.md` — who/what/why, non-negotiable product rules
3. `DESIGN.md` — visual system, layout, components, motion

Do not implement UI or product behavior from memory of Obsidian, Refern, Notion, or generic SaaS patterns. Implement Entropy.

## Hard constraints (never violate)

- **Local-first filesystem:** Entropy never imports, copies, or claims ownership of user files. Workspaces are folders. Notes are Markdown on disk. Caches are rebuildable only.
- **No accounts / no required cloud:** Offline must work fully. AI is optional and never a dependency.
- **Color palette only:** `#212121`, `#242424`, `#F8F8FF`, `#F4F4FF`. No other brand/accent/status colors (including no red for delete).
- **Typography:** One UI font — **Geist** (or Inter only if Geist is unavailable). No display/decorative font pairing.
- **Notebook:** Writing is primary. Editor occupies most of the screen. **Do not add a Linked / extra side panel in the notebook window.** Context lives in the optional right panel only, and that panel **hides when empty**.
- **Layout:** Three-column desktop shell — sidebar | main | context. Panels are **resizable**, sizes are **remembered**, any panel can **collapse**. Use horizontal space; avoid wasted chrome.
- **Icons over text** for obvious chrome actions (search, settings, view toggles, inspector actions). Keep text for content identity (file names, notes, breadcrumbs, settings labels, confirmations).
- **Lucide only** for icons — outlined, consistent stroke. No colorful illustrations.
- **Motion:** 150–200ms, ease-out, no bounce/elastic. Respect `prefers-reduced-motion`. Prefer no animation over decorative motion.
- **shadcn/ui + Tailwind** for primitives when possible; restyle to Entropy tokens. Prefer whitespace over borders.
- **Do not clone** Obsidian or Refern. Combine their strengths into Entropy’s identity.

## Product shape (quick map)

| Surface | Inspiration | Job |
|---|---|---|
| Sidebar | Refern | Browse folders/files with breathing space, previews, soft selection |
| Center editor | Obsidian | Focused Markdown writing, tabs, comfortable line width |
| Files grid | Refern | Large rounded media/folder cards, grid/list, breadcrumbs |
| Context panel | — | Metadata / properties / previews only; hide if empty |
| Top bar | Obsidian / Refern | Minimal: workspace, icon actions, window controls |
| Canvas | — | Spatial references to real files; not a detached whiteboard vault |

## Implementation checklist

Before shipping a UI change, confirm:

- [ ] Still only the four palette colors
- [ ] No new notebook side panels (Linked, graph chrome, etc.)
- [ ] Context panel content is contextual; empty ⇒ hidden
- [ ] Files remain at original paths; no import flow invented
- [ ] Chrome uses icons + tooltips where obvious
- [ ] Spacing uses 4/8/12/16/24/32/48
- [ ] Radius 8–12px for interactive/surfaces
- [ ] Transitions ≤ 200ms, no bounce
- [ ] Keyboard paths still work for the changed flow
- [ ] Matches calm, native, tool-first feel — not dashboard/social

## Anti-patterns (reject on sight)

Material Design skins · mobile-first shells · huge colorful CTAs · glassmorphism · neumorphism · purple/glow SaaS gradients · heavy borders · ribbon toolbars · floating windows everywhere · stats dashboards · dense Obsidian-style trees with tiny icons · social feed layouts · chat components unless the product explicitly needs chat.

## Stack notes

Electron + TypeScript · Vite React renderer · Tailwind 3 · shadcn-style Radix primitives under `src/renderer/components/ui/` · Lucide icons · main/preload IPC for filesystem.

Prefer editing existing patterns over new parallel UI systems.
