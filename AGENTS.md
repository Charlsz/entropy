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
8. Notebook and Library must feel like one application.
9. Avoid overengineering. Choose the simplest architecture that can scale.

## Hard constraints (never violate)

- **Local-first filesystem:** Entropy never imports, copies, or claims ownership of user files. Workspace holds notes/settings; media stays in place. Indexes/caches are rebuildable only.
- **No automatic file moves/copies:** User-initiated rename/move/trash/reveal only.
- **Protected OS paths:** Never trash, rename, move into, or write under Windows/macOS/Linux system trees (e.g. `Windows`, `Program Files`, `/System`, `/usr`). Duplicate scans and storage measure skip those trees so reclaim cannot target them.
- **No accounts / no required cloud:** Offline must work fully. AI is optional and never a dependency.
- **Color palette (Figma Entropy):** `#131413` ink · `#FAFAF9` surface · `#FFFFFF` canvas · `#E7E6E3` border · `#6B6D69` muted · `#EEF2F8` select · `#6A7BA2` accent. No status reds/purples. Dark theme remaps via CSS variables.
- **Typography:** One UI font — **Geist** (or Inter only if Geist is unavailable). Geist Mono for paths/sizes/hints. No display/decorative font pairing.
- **Notebook:** Writing is primary. Shared app sidebar → Local Notes list → editor. **Do not add a Linked / extra side panel.** Optional right context **hides when empty**. Support inline media while editing.
- **Library** (code: `inventory`): Shared app sidebar with perspectives — Folders (List/Gallery), Large Files, Duplicates. Starts at Home; does not auto-scan every drive. File Intelligence inspector shows when a file is selected.
- **Layout:** Shared **App sidebar** (240px) across surfaces. Content panels are **resizable**, sizes **remembered**, inspector **collapses when empty**. Use horizontal space; avoid wasted chrome.
- **Sidebar uses icons + text**; icon-only chrome elsewhere when the action is obvious.
- **Lucide only** for icons — outlined, consistent stroke.
- **Motion:** 150–200ms, ease-out, no bounce/elastic. Respect `prefers-reduced-motion`. Prefer no animation over decorative motion.
- **shadcn/ui + Tailwind** for primitives when possible; restyle to Entropy tokens.
- **Do not clone** Obsidian, Refern, or WinDirStat. Combine their strengths into Entropy’s identity.

## Product shape (quick map)

| Surface | Inspiration | Job |
|---|---|---|
| App sidebar | Figma Entropy | Workspace switch, Library perspectives, Intelligence stubs, storage |
| Notebook | Obsidian + Figma | Markdown meaning; notes list; references to real paths; inline media |
| Library Folders | Figma table | Path breadcrumb + file rows; List | Gallery toggle in chrome |
| Library Gallery | Refern / Figma | Media card grid — a Folders view mode, not a separate nav item |
| File Intelligence | Figma inspector | Connections, preview; hide when nothing selected |
| Caption bar | Electron | Drag region + settings + window controls only |

## Implementation checklist

Before shipping a UI change, confirm:

- [ ] Palette tokens match DESIGN.md (ink/surface/canvas/border/muted/select/accent)
- [ ] Shared App sidebar — no parallel icon-rail navigation
- [ ] No new notebook side panels (Linked, graph chrome, etc.)
- [ ] Inspector / context content is contextual; empty ⇒ hidden
- [ ] Files remain at original paths; no import flow invented
- [ ] Library does not auto-index every drive on first launch
- [ ] Spacing aligns to 4/8/12/16/20/24/48
- [ ] Radius ~4–8px for chrome; gallery cards ~8px
- [ ] Transitions ≤ 200ms, no bounce
- [ ] Designed with large libraries in mind (virtualize / aggregate)
- [ ] Matches calm, light-first, tool-first feel — not dashboard/social

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

## Library filter (v1)

Before adding anything to Library, ask:

> Does this help me understand and clean my files faster?

- **Yes** → belongs in Library (exact duplicates, browsing, gallery, large files, reclaim, safe delete, file intelligence).
- **Maybe useful someday / meaning / writing** → Notebook, Intelligence stubs, a future extension, or not at all.

Keep Library as Library. Prefer performance and clarity over hover/animation overload. Defer near-duplicates, auto-organize rules, and dashboards. Intelligence nav may ship as “Coming soon”.
