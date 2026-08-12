# Entropy

**Alpha (0.1.x).** A local-first desktop workspace where the filesystem is the source of truth.

Notebook gives files meaning. Library gives files structure. Entropy never imports, copies, or claims ownership of your files. Notes are Markdown in a folder you choose. Media stays where it already lives.

If this app disappeared tomorrow, your notes and files would still be ordinary files on disk.

Site: [entropy.charlsz.tech](https://entropy.charlsz.tech) · Installers: [Charlsz/entropy-downloads](https://github.com/Charlsz/entropy-downloads/releases)

## Status

This is early software. Layout, media embeds, and Library scans can still break under heavy use. Installers are **unsigned**, so Windows SmartScreen and macOS Gatekeeper will warn.

| Works today | Not done / stubbed |
|---|---|
| Markdown notes (WYSIWYG + source) in a workspace folder | Intelligence destinations (Relationships, File Copilot) |
| Inline media and file references without importing | Code-signed / notarized installers |
| Library: Folders (List / Gallery), Large Files, Duplicates | Near-duplicates, auto-organize, cloud sync |
| Storage treemap, safe trash with undo | Replacing Finder / Explorer |
| Protected OS paths skipped by scans and reclaim | |

Product rules: [`PRODUCT.md`](PRODUCT.md) · Visual system: [`DESIGN.md`](DESIGN.md) · Agent/contributor contract: [`AGENTS.md`](AGENTS.md)

## Install

Download a Windows, macOS, or Linux build from the [releases channel](https://github.com/Charlsz/entropy-downloads/releases/latest). Prefer that page over random copies.

## Run from source

Needs [Node.js 22+](https://nodejs.org/).

```bash
git clone https://github.com/Charlsz/entropy.git
cd entropy
npm ci
npm start
```

`npm start` compiles the app, then launches Electron. More detail is in [`CONTRIBUTING.md`](CONTRIBUTING.md).

## What Entropy is not

- Not a vault that owns your files
- Not a Finder / Explorer replacement
- Not an all-in-one productivity suite
- Not an Obsidian, Refern, or WinDirStat clone

## License

[MIT](LICENSE) © Carlos Galvis
