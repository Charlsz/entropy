# Entropy

<img src="docs/app-icon.png" alt="Entropy" width="128" height="128" style="border-radius: 22px; margin-bottom: 8px;">

A local-first workspace for notes and files on macOS, Windows, and Linux. Alpha.

![macOS](https://img.shields.io/badge/platform-macOS-lightgrey) ![Windows](https://img.shields.io/badge/platform-Windows-blue) ![Linux](https://img.shields.io/badge/platform-Linux-orange)

[Website](https://entropy.charlsz.tech) · [Releases](https://github.com/Charlsz/entropy/releases)

Notebook gives files meaning. Library gives files structure. The filesystem stays the source of truth — Entropy never imports, copies, or claims ownership of your files.

## Features

- **Local-first** — No account, no required cloud, fully offline
- **Filesystem-native** — Notes are plain `.md` files in a folder you choose. Media stays where it already lives
- **WYSIWYG Markdown** — Rich editing that round-trips to Markdown on disk
- **Inline media** — Images, video, PDFs, and file references in a note without attaching copies
- **Reading view** — Switch between live editing and a calm preview of the same note
- **Workspaces** — Open or create notebook folders; recent workspaces stay on this machine
- **Library** — Browse from Home. Folders as a list or gallery, large files, exact duplicates
- **Storage treemap** — See what is using space. First launch does not crawl every drive
- **File intelligence** — Preview and connections when a file is selected; the inspector hides when empty
- **Safe file ops** — Rename, move, reveal, copy path, trash with undo. Destructive actions are confirmed
- **Protected OS paths** — Scans and reclaim skip system trees so they cannot be targeted
- **Calm chrome** — Light-first shell, dark theme and density in Settings

## Installation

Installers are **unsigned** until certificates are configured. Windows SmartScreen and macOS Gatekeeper will warn; that is expected for alpha.

Download from [Releases](https://github.com/Charlsz/entropy/releases) on this repository.

### macOS

1. Download the latest `.dmg` from [Releases](https://github.com/Charlsz/entropy/releases)
2. Open the DMG and drag Entropy to Applications
3. Open Entropy from Applications (you may need to allow it under Privacy & Security)

### Windows

Download the latest `.exe` installer from [Releases](https://github.com/Charlsz/entropy/releases) and run it.

### Linux

Download the latest `.AppImage` or `.deb` from [Releases](https://github.com/Charlsz/entropy/releases).

### From source

**Prerequisites:** [Node.js 22+](https://nodejs.org/)

```bash
git clone https://github.com/Charlsz/entropy.git
cd entropy
npm ci
npm start
```

`npm start` compiles the app, then launches Electron.

Unsigned installers for the current OS:

```bash
npm run dist:win     # Windows NSIS
npm run dist:mac     # macOS DMG
npm run dist:linux   # Linux AppImage + deb
```

## Keyboard shortcuts

| Shortcut | Action |
| --- | --- |
| `Cmd+K` | Search |
| `Cmd+S` | Save note |
| `Cmd+[` / `Cmd+]` | Back / forward |
| `Alt+←` / `Alt+→` | Back / forward |
| `Cmd+B` / `Cmd+I` | Bold / italic |

On Windows and Linux, use `Ctrl` instead of `Cmd`.

## Built with

[Electron](https://www.electronjs.org/) · [React](https://react.dev/) · [TipTap](https://tiptap.dev/) · [Tailwind CSS](https://tailwindcss.com/) · [Vite](https://vite.dev/) · [Lucide](https://lucide.dev/)

## Contributing

Entropy is early. Issues and small PRs are welcome when they match [`PRODUCT.md`](PRODUCT.md) and [`DESIGN.md`](DESIGN.md). Read [`CONTRIBUTING.md`](CONTRIBUTING.md) and [`AGENTS.md`](AGENTS.md) before changing product or UI.

## License

[MIT](LICENSE) © Carlos Galvis
