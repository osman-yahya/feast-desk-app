# Publishing a new version (Windows)

Releases go to **https://github.com/osman-yahya/feast-desk-releases** — NOT the source repo.
Existing installs auto-check for updates at startup (10 s after launch), download silently, and show an in-app banner prompting the user to restart.

## One-time setup

1. The release repo `osman-yahya/feast-desk-releases` **must be public**, otherwise clients cannot fetch `latest.yml` without an embedded token.
2. Create a GitHub Personal Access Token with `repo` scope (classic token is fine) and write access to the releases repo.
3. At the project root, create a `.env` file (it is git-ignored):
   ```
   GH_TOKEN=ghp_yourTokenHere
   ```
   `npm run publish` loads this via `dotenv-cli` — works identically on Windows, macOS, and Linux.

## Release steps

1. Bump `version` in `package.json` (semver: `1.0.1`, `1.0.2`, `1.1.0`, …).
2. Commit + push the version bump.
3. From the Windows build machine:
   ```powershell
   npm run publish
   ```
4. electron-builder builds the NSIS installer and uploads to the release repo:
   - `feast.  Desk Setup <version>.exe`
   - `latest.yml`        ← electron-updater reads this to know the latest version
   - `.blockmap`         ← enables differential updates
5. Go to https://github.com/osman-yahya/feast-desk-releases/releases and **publish the draft** (electron-builder creates it as a draft).

## What users see

- App at version N starts up, waits 10 s, checks `latest.yml`.
- If a newer version is found: downloads in the background, shows the "Downloading... X%" banner.
- When done: banner flips to "Version X is ready!" with a Restart Now button.
- On restart (or next quit), the new version installs and relaunches.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `npm run publish` errors with `GH_TOKEN not set` | Missing `.env` at project root, or the file doesn't contain `GH_TOKEN=…` |
| Clients never get the update | Check: release is **not a draft** AND `latest.yml` is a release asset |
| `electron-updater` logs 404 | Release repo is private — make it public |
| SmartScreen warns on first install | Expected — app is unsigned. User clicks "More info → Run anyway" |
| User rejected the restart prompt | Update installs automatically on next app quit (`autoInstallOnAppQuit: true`) |

## Not doing

- **Code signing** — we are not signing builds. Every new version will trigger SmartScreen on first launch. This is a known tradeoff.
- **macOS builds** — dropped. Config only targets Windows NSIS x64.
