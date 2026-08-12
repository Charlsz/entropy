# Releases

Installers ship on **this repository’s** [GitHub Releases](https://github.com/Charlsz/entropy/releases) when a version tag is pushed.

## Flow

1. Merge work to `main`.
2. Tag and push: `git tag vX.Y.Z && git push origin vX.Y.Z` (match `package.json` version).
3. Workflow **Build installers**:
   - Builds Windows / macOS / Linux on GitHub-hosted runners
   - Uploads Actions artifacts (30 days)
   - Publishes `.exe` / `.dmg` / `.AppImage` / `.deb` as GitHub Release `vX.Y.Z` on `Charlsz/entropy`

Site and README download buttons should link to:

`https://github.com/Charlsz/entropy/releases/latest`

or a direct asset URL:

`https://github.com/Charlsz/entropy/releases/download/vX.Y.Z/Entropy-X.Y.Z-win-x64.exe`

`GITHUB_TOKEN` is enough — no extra PAT. The workflow has `contents: write` so it can create the release on this repo.

## Signing

Unsigned builds warn on Windows/macOS. When ready, see `build/README.md` for certificate secrets; publishing to this repo’s Releases stays the same.
