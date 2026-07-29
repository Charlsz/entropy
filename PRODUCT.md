# Product

## Register
product

## Vision

Entropy is a **local-first workspace** built on top of the user’s existing filesystem — not a note-taking app that owns a vault, and not a file explorer replacement.

The filesystem is the single source of truth. Entropy never owns, duplicates, or moves user files unless the user explicitly asks. It builds **relationships** between notes, files, folders, and projects.

**Notebook** gives files meaning. **File Inventory** gives files structure. Entropy connects them.

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

## Users & Purpose

**Users:** Developers, students, researchers, designers, writers, photographers, and anyone managing large collections of files and ideas.

**Primary job:** Write Markdown in a workspace folder; browse and understand the real computer (starting at Home); reference any file from notes without importing it.

**First-open reaction to aim for:**  
“This helps me understand my computer and write about what matters — without taking my files away.”

## Product pillars

1. **Filesystem-native** — Workspace = folder for notes/settings. Media stays where it is. Indexes/caches are rebuildable only.
2. **Local-first & private** — Fully offline. No account. No required cloud.
3. **Meaning + structure** — Notebook (meaning) and File Inventory (structure) share one app identity.
4. **Tool-first** — Calm, minimal, native desktop, fast, spacious, professional.
5. **Optional AI** — Assistant only. Never required.

## Surfaces

| Surface | Role |
|---|---|
| **Notebook** | Markdown knowledge workspace. Notes live in the workspace folder. Notes can reference any file on any drive without copying it. Inline media while editing; full Preview available. |
| **File Inventory** | Computer-wide organizer (starts at Home; user may add drives later). Nav + Content View (grid) + Storage treemap (KDirStat / GrandPerspective spirit). Same scan root across panes. |
| **Settings** | Sparse preferences; no control-panel sprawl. |
| **Canvas** | Future section — spatial references to real files. Hidden in v1; code retained. |

## Workspace vs Inventory

- **Workspace** — Notebook home: notes, workspace settings, rebuildable metadata/index. Not the owner of user media.
- **File Inventory** — Sees the machine (Home first). Independent of which folder is the Notebook workspace.
- Notes may reference absolute paths anywhere; Entropy never copies those files into the workspace.

## Layout contract

- **Notebook:** three-column desktop — sidebar | editor | context. Context hides when empty. No Linked / extra notebook-only side panels.
- **File Inventory:** Navigation (~20%) | Content View (~40%) | Treemap (~40%), resizable and persisted. Content View keeps the existing grid language.
- Use horizontal space deliberately; maximize the working surface.
- Performance over decoration.

## Interaction principles

- Keyboard-first where it matters (search, navigation).
- Icons over text for obvious chrome actions; text for content identity and confirmations.
- Native-like shared file ops (rename, move, trash, reveal, copy path) — always explicit and confirmed when destructive.
- Every UI element must have a purpose. Prefer whitespace over borders.

## Brand personality

Calm · Minimal · Native · Fast · Precise · Local-first · Elegant · Professional

## References (spirit, not clones)

| Reference | Take |
|---|---|
| **Obsidian** | Writing, Markdown-as-files, live media while editing |
| **Refern** | Calm sidebar, media cards, comfortable Content View |
| **GrandPerspective / KDirStat / WinDirStat** | Storage treemap that makes size obvious |
| **Raycast / Linear** | Restraint, density with readability |

## Anti-references

- Cloud note apps that import everything into a proprietary vault
- Loud productivity dashboards
- Explorers that treat writing as an afterthought
- Whiteboards detached from the real filesystem
- Material / mobile-first / glass / purple-glow SaaS UIs

## Accessibility

WCAG AA contrast · visible focus rings · keyboard access for core navigation · respect `prefers-reduced-motion`.

## Non-goals

- Replacing the OS file manager entirely
- Becoming an all-in-one productivity suite
- Forcing a proprietary database as source of truth
- Auto-scanning every drive on first launch
- Requiring AI, sync, or accounts for core value
