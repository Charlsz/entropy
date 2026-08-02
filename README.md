# Entropy

I just want a better way to organize my ideas and files.

In a more complex way:

This application is a notebook designed to bridge the gap between human thinking and the computer's filesystem. It combines the freedom and permanence of a physical notebook with the organization and accessibility of modern file management, without replacing either.

Instead of treating images, PDFs, videos, code files, or other documents as simple attachments, they become first-class elements of the notebook. Every page can naturally contain writing, sketches, diagrams, references, media, and existing files from the user's computer, all living together in the same context.

The notebook doesn't try to replace the filesystem. Files remain in their original locations and formats, while the notebook provides the meaning around them. It answers questions like why this file matters, how it relates to other ideas, and what the user was thinking when they collected it.

Every notebook is simply a folder on the user's computer. Pages are stored in open formats (such as Markdown), original assets remain untouched, and any indexing or search database exists only as a rebuildable cache. If the application disappeared tomorrow, the user's notebook and files would still be completely accessible.

The experience should feel closer to writing in a real book than editing a document. A page is free to become whatever the idea requires: mostly text, mostly visuals, or a seamless mixture of both. Images are not secondary, files are not hidden behind links, and writing is not constrained by rigid document structures.

The philosophy is that thinking and organizing should happen in the same place. Today's computers separate notes, images, PDFs, files, whiteboards, and references into different applications, forcing users to reconstruct context themselves. This application reunites those pieces into a single environment where knowledge grows naturally while remaining organized, searchable, and entirely owned by the user.

It is intentionally calm. It does not aim to become an all-in-one productivity platform or replace every application. Instead, it focuses on one idea: giving people a beautiful, durable place where their thoughts and their files can coexist as naturally as they would on a real desk or inside a physical notebook.

## Building installers

Local (unsigned):

```bash
npm run dist:win    # Windows NSIS
npm run dist:mac    # macOS DMG
npm run dist:linux  # Linux AppImage + deb
```

CI builds the same targets when you push a version tag (`v0.1.0`, `v1.0.0`, …). Workflow: `.github/workflows/build-installers.yml`.

- Uploads **GitHub Actions artifacts only** (kept 30 days)
- Does **not** create a GitHub Release
- Does **not** publish to any store
- Installers are **unsigned** until certificates are configured (see `build/README.md`)

```bash
# After this packaging setup is on the default branch:
git tag v0.1.0
git push origin v0.1.0
# Then download artifacts from the Actions run. Confirm before sharing.
```
