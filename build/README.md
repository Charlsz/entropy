# Signing & installer brand assets (optional).

`icon.png` (512×512) is used by electron-builder for Windows / macOS / Linux installers.
Window chrome still uses repo-root `Entropy.png` via `extraResources`.

When you are ready to sign installers:

- **macOS:** Apple Developer ID certificate + notarization credentials as GitHub Actions secrets (`CSC_LINK`, `CSC_KEY_PASSWORD`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`). Then remove `mac.identity: null` and set `CSC_IDENTITY_AUTO_DISCOVERY` appropriately in the workflow.
- **Windows:** Authenticode certificate as `CSC_LINK` / `CSC_KEY_PASSWORD` (or configure Azure Trusted Signing).
- **Linux:** no code signing required for AppImage/deb for private testing.
