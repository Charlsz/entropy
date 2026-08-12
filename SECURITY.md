# Security

Entropy is a local Electron app. It can list, preview, rename, move, and trash files the user asks it to. That access is the product — not a hidden capability.

## Report a vulnerability

Use [GitHub Security Advisories](https://github.com/Charlsz/entropy/security/advisories/new) on this repository, or contact the maintainer privately via GitHub (@Charlsz).

Do not open a public issue for a vulnerability.

Please include:

- Entropy version (`package.json` / installer tag) and OS
- What an attacker (or a malicious note/path) can do
- Steps to reproduce, without exploit payloads aimed at other people’s machines

## What we already treat as out of bounds

- Trashing, renaming, moving into, or writing under protected OS trees (Windows, Program Files, `/System`, `/usr`, and similar). Duplicate scans and storage measure skip those trees.
- Automatic file moves or copies. Destructive actions need an explicit user confirmation.
- Remote code or accounts. Core features must work offline. There is no required cloud backend.

## Unsigned builds

Official installers on [Charlsz/entropy-downloads](https://github.com/Charlsz/entropy-downloads/releases) may be unsigned until certificates are configured. Prefer that channel. Windows and macOS will warn; that is expected for alpha.
