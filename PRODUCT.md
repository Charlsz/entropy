# Product

## Register
product

## Vision

Entropy is a local-first desktop workspace that helps people organize their digital life **without taking ownership of their files**. It works alongside the existing filesystem: folders, documents, images, videos, and notes remain in their original locations and formats. Entropy provides a cleaner way to browse, connect, and work with them.

It bridges traditional file explorers and knowledge tools: Obsidian’s focused Markdown writing plus Refern’s elegant file organization, in one modern desktop app — without cloning either.

Core principle: **computers should feel like personal tools again.** Files stay yours. The workspace stays fast and private. Software adapts to how you already organize work.

## Users & Purpose

**Users:** Developers, students, researchers, designers, writers, photographers, and anyone managing large collections of files and ideas.

**Primary job:** Open a folder as a workspace; write Markdown; browse and preview real files; connect work in context — without importing or duplicating anything.

**First-open reaction to aim for:**  
“This feels like Obsidian’s focused editor combined with Refern’s beautiful organization, but with its own clean identity.”

## Product pillars

1. **Filesystem-native** — Workspace = folder. Notes = `.md` on disk. Media stays where it is. Indexes/caches are rebuildable only.
2. **Local-first & private** — Fully offline. No account. No required cloud. User data belongs to the user.
3. **Notes + files together** — Writing and organization share one workspace; files are not afterthoughts or attachments.
4. **Tool-first** — Calm, minimal, native desktop, fast, spacious, professional. Built for creators and knowledge workers, not social feeds.
5. **Optional AI** — Assistant only. Never required. Never replaces the user’s workflow.

## Surfaces

| Surface | Role |
|---|---|
| **Notebook** | Primary writing. Large editor, tabs, Markdown. Occupies most of the screen. |
| **Files** | Refern-like organization: sidebar + media grid/list, previews, breadcrumbs, native FS behaviors. |
| **Canvas** | Spatial arrangement of references to real files/notes — not a proprietary board vault. |
| **Settings** | Sparse preferences; no control-panel sprawl. |

## Layout contract

- **Three-column desktop layout:** sidebar | main | context.
- Panels are **resizable**, sizes are **persisted**, any panel can **collapse**.
- Use horizontal space deliberately; minimize chrome; maximize the working surface.
- **Notebook:** no “Linked” panel and no extra notebook-only side panels. Relationships and metadata belong in the **context panel**, which **hides when empty**.
- **Context panel** shows only contextual info: file metadata, properties, previews, recent references, optional AI suggestions. Avoid clutter.

## Interaction principles

- Keyboard-first where it matters (search, navigation).
- Icons over text for obvious chrome actions; text for content identity and confirmations.
- Native scrolling; drag-and-drop and multi-select in Files; context menus.
- Every UI element must have a purpose. Prefer whitespace over borders. Remove visual noise.

## Brand personality

Calm · Minimal · Native · Fast · Precise · Local-first · Elegant · Professional

## References (take the spirit, not the clone)

| Reference | Take |
|---|---|
| **Obsidian** | Writing experience, Markdown-as-files, large editor, split panes, keyboard-first |
| **Refern** | Sidebar calm, card design, visual hierarchy, file organization, comfortable spacing |
| **Raycast** | Dense quiet chrome, fast search feel |
| **Linear** | Restraint, density with readability, product polish |
| **Arc** | Spatial chrome without dashboard clutter |

## Anti-references

- Cloud note apps that import everything into a proprietary vault
- Loud productivity dashboards (cards, stats strips, purple gradients)
- File explorers that treat writing as an afterthought
- Whiteboards detached from the real filesystem
- Material / mobile-first / glass / neumorphic / ribbon / social-app UIs
- Chat-product chrome unless chat is an explicit product need

## Accessibility

WCAG AA contrast for text · visible focus rings · keyboard access for core navigation · respect `prefers-reduced-motion`.

## Non-goals

- Replacing the OS file manager
- Becoming an all-in-one productivity suite
- Forcing a proprietary database as source of truth
- Requiring AI, sync, or accounts for core value
