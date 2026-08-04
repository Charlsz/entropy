# Public downloads channel

Entropy source stays in the **private** `Charlsz/entropy` repo.
Installers ship on the **public** [`Charlsz/entropy-downloads`](https://github.com/Charlsz/entropy-downloads) releases page.

## Flow

1. Merge work to `main` in `Charlsz/entropy`.
2. Tag and push: `git tag vX.Y.Z && git push origin vX.Y.Z` (match `package.json` version).
3. Workflow **Build installers**:
   - Builds Windows / macOS / Linux on GitHub-hosted runners
   - Uploads private Actions artifacts (30 days)
   - Publishes `.exe` / `.dmg` / `.AppImage` / `.deb` to `Charlsz/entropy-downloads` as GitHub Release `vX.Y.Z`

Site download buttons should link to:

`https://github.com/Charlsz/entropy-downloads/releases/latest`

or a direct asset URL:

`https://github.com/Charlsz/entropy-downloads/releases/download/vX.Y.Z/Entropy-X.Y.Z-win-x64.exe`

## One-time secret setup (`ENTROPY_DOWNLOADS_TOKEN`)

`GITHUB_TOKEN` cannot create releases in another repository. Add a PAT:

1. GitHub → **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate**.
2. Token name: `entropy-downloads-publish` (or similar).
3. Expiration: your choice (rotate before it expires).
4. Resource owner: **Charlsz**.
5. Repository access: **Only select repositories** → `entropy-downloads`.
6. Permissions → Repository permissions:
   - **Contents**: Read and write  
   - **Metadata**: Read-only (automatic)
7. Generate, copy the token once.
8. Open **Charlsz/entropy** → **Settings → Secrets and variables → Actions → New repository secret**
   - Name: `ENTROPY_DOWNLOADS_TOKEN`
   - Value: the PAT

Until this secret exists, the `Publish to entropy-downloads` job will fail with a clear error; platform packaging jobs still succeed and leave Actions artifacts.

### Optional CLI

```bash
# After creating the fine-grained PAT:
gh secret set ENTROPY_DOWNLOADS_TOKEN --repo Charlsz/entropy
# paste token when prompted
```

## Bootstrap / re-publish without a new tag

To copy an existing private release onto the public channel from your machine (while logged into `gh`):

```bash
gh release download v0.1.0 --repo Charlsz/entropy --dir /tmp/entropy-v0.1.0 --pattern "*.exe" --pattern "*.dmg" --pattern "*.AppImage" --pattern "*.deb"
gh release create v0.1.0 \
  --repo Charlsz/entropy-downloads \
  --title "Entropy 0.1.0" \
  --notes "Official Entropy 0.1.0 installers." \
  /tmp/entropy-v0.1.0/*
```

Or use Actions: re-run the failed publish job after the secret is set, or delete and re-push the tag (careful — only for unreleased tags).

## Signing

Unsigned builds warn on Windows/macOS. When ready, see `build/README.md` for certificate secrets; publishing to `entropy-downloads` stays the same.
