# Agents

**Read this file before changing Entropy.** Then read `PRODUCT.md` and `DESIGN.md`. Treat them as normative. If a request conflicts with them, follow the docs and ask the user before inventing a new product direction.

## Required reading order

1. `AGENTS.md` (this file) — hard constraints and workflow
2. `PRODUCT.md` — who/what/why, non-negotiable product rules
3. `DESIGN.md` — visual system, layout, components, motion

Do not implement UI or product behavior from memory of Obsidian, Refern, Notion, or generic SaaS patterns. Implement Entropy.

## Non-negotiable principles

1. The filesystem is always the source of truth.
2. Never duplicate or move user files automatically.
3. Prefer composition over duplication.
4. Every feature must be local-first.
5. Design for large file collections (100,000+ files).
6. Performance is more important than visual effects.
7. Keep the interface minimal and distraction-free.
8. Notebook and File Inventory must feel like one application.
9. Avoid overengineering. Choose the simplest architecture that can scale.

## Hard constraints (never violate)

- **Local-first filesystem:** Entropy never imports, copies, or claims ownership of user files. Workspace holds notes/settings; media stays in place. Indexes/caches are rebuildable only.
- **No automatic file moves/copies:** User-initiated rename/move/trash/reveal only.
- **Protected OS paths:** Never trash, rename, move into, or write under Windows/macOS/Linux system trees (e.g. `Windows`, `Program Files`, `/System`, `/usr`). Duplicate scans and storage measure skip those trees so reclaim cannot target them.
- **No accounts / no required cloud:** Offline must work fully. AI is optional and never a dependency.
- **Color palette only:** `#131413`, `#1C1D1C`, `#FAFAF9`, `#C8C8C6`. No other brand/accent/status colors (including no red for delete). Light theme remaps ink/paper roles via CSS variables.
- **Typography:** One UI font — **Geist** (or Inter only if Geist is unavailable). No display/decorative font pairing.
- **Notebook:** Writing is primary. Editor occupies most of the screen. **Do not add a Linked / extra side panel in the notebook window.** Context lives in the optional right panel only, and that panel **hides when empty**. Support inline media while editing.
- **File Inventory:** Nav | Content View | Treemap. Starts at Home; does not auto-scan every drive. Content View keeps the Refern-like grid language.
- **Layout:** Panels are **resizable**, sizes are **remembered**, any panel can **collapse**. Use horizontal space; avoid wasted chrome.
- **Icons over text** for obvious chrome actions. Keep text for content identity.
- **Lucide only** for icons — outlined, consistent stroke.
- **Motion:** 150–200ms, ease-out, no bounce/elastic. Respect `prefers-reduced-motion`. Prefer no animation over decorative motion.
- **shadcn/ui + Tailwind** for primitives when possible; restyle to Entropy tokens.
- **Do not clone** Obsidian, Refern, or WinDirStat. Combine their strengths into Entropy’s identity.

## Product shape (quick map)

| Surface | Inspiration | Job |
|---|---|---|
| Notebook | Obsidian | Markdown meaning; references to real paths; inline media |
| File Inventory Content View | Refern | Grid/list of the current folder with rich previews |
| File Inventory Treemap | GrandPerspective / KDirStat + Google Maps | Size map with folder zoom; hover answers meaning questions |
| Context panel | — | Metadata / properties / previews; hide if empty |
| Top bar | — | Minimal: workspace, icon actions, window controls |

## Implementation checklist

Before shipping a UI change, confirm:

- [ ] Still only the four palette colors
- [ ] No new notebook side panels (Linked, graph chrome, etc.)
- [ ] Context panel content is contextual; empty ⇒ hidden
- [ ] Files remain at original paths; no import flow invented
- [ ] Inventory does not auto-index every drive on first launch
- [ ] Chrome uses icons + tooltips where obvious
- [ ] Spacing uses 4/8/12/16/24/32/48
- [ ] Radius 8–12px for interactive/surfaces
- [ ] Transitions ≤ 200ms, no bounce
- [ ] Designed with large libraries in mind (virtualize / aggregate)
- [ ] Matches calm, native, tool-first feel — not dashboard/social

## Anti-patterns (reject on sight)

Material Design skins · mobile-first shells · huge colorful CTAs · glassmorphism · neumorphism · purple/glow SaaS gradients · heavy borders · ribbon toolbars · floating windows everywhere · stats dashboards · dense Obsidian-style trees with tiny icons · social feed layouts · chat components unless the product explicitly needs chat · silent full-disk crawls.

## Stack notes

Electron + TypeScript · Vite React renderer · Tailwind 3 · shadcn-style Radix primitives under `src/renderer/components/ui/` · Lucide icons · main/preload IPC for filesystem.

Prefer editing existing patterns over new parallel UI systems.

## Commit-per-feature (required)

Every discrete implementation or fix gets its **own git commit**. Do not batch unrelated work.

When shipping a multi-item request (roadmap, “add A, B, and C”):

1. Implement one item
2. Commit it (`feat:` / `fix:` / `docs:` / `refactor:` — why, not only what)
3. Only then start the next item

This is how Entropy stays reviewable and undoable in history. See `.cursor/rules/commit-per-feature.mdc`.

## Inventory filter (v1)

Before adding anything to File Inventory, ask:

> Does this help me understand and clean my files faster?

- **Yes** → belongs in Inventory (exact duplicates, browsing, treemap, reclaim, safe delete).
- **Maybe useful someday / meaning / writing** → Notebook, a future extension, or not at all.

Keep Inventory as Inventory. Do not merge Notebook concepts early (e.g. “Reference in note” from Inventory chrome). Prefer performance and clarity over hover/animation overload. Defer near-duplicates, AI similarity, auto-organize rules, and dashboards.
