# Contributing

Entropy is a local-first desktop app. Read these before changing product or UI:

1. [`AGENTS.md`](AGENTS.md) — hard constraints
2. [`PRODUCT.md`](PRODUCT.md) — who / what / why
3. [`DESIGN.md`](DESIGN.md) — palette, type, layout, motion

If a request conflicts with those docs, follow the docs. Do not implement Entropy from memory of Obsidian, Refern, Notion, or generic SaaS patterns.

## Setup

Node.js 22 or newer.

```bash
npm ci
npm start
```

Useful scripts:

| Script | What it does |
|---|---|
| `npm start` | Build renderer + main + preload, then launch Electron |
| `npm run typecheck` | TypeScript (main, preload, renderer) |
| `npm run lint` | ESLint |
| `npm test` | Markdown embed fixtures + static theme checks |
| `npm run dist:win` / `dist:mac` / `dist:linux` | Unsigned installer for the current OS |

Optional Vite HMR (two terminals): run `npx vite` in one, then in the other build main/preload and launch Electron with `ENTROPY_DEV=1` (PowerShell: `$env:ENTROPY_DEV="1"`). `npm start` is enough for most work.

`package.json` sets `"private": true` so this package is not published to npm. That is not a statement about git visibility.

## Pull requests

- One concern per PR. Match existing `feat:` / `fix:` / `docs:` / `refactor:` commit tone — explain why.
- Files stay on disk. No import flows, no automatic moves or copies.
- Palette is ink / surface / canvas / border / muted / select / accent only. Geist (Geist Mono for paths). Lucide icons.
- Notebook: no extra side panels. Context / inspector hides when empty.
- Library does not auto-scan every drive on first launch. Skip protected OS paths.
- Prefer virtualizing or aggregating over decoration. Motion ≤ 200ms, ease-out, no bounce.

## Issues

Bug reports and focused product questions are welcome. “Make it more like {other app}” is usually a no unless it maps onto `PRODUCT.md`.

Security reports: see [`SECURITY.md`](SECURITY.md). Do not file those as public issues.
