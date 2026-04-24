# Windows build walkthrough

How to clone and compile feast. Desk on a fresh Windows machine.

The app is currently **Windows-only**. Target: Windows 10 / 11, x64.

---

## 1. Install prerequisites

Install in this order:

1. **Git for Windows** — https://git-scm.com/download/win
   (Accept defaults; it gives you `git` and Git Bash)

2. **Node.js 20 LTS** — https://nodejs.org/
   Verify:
   ```powershell
   node --version    # should be v20.x
   npm --version
   ```

3. **Visual Studio Build Tools 2022** — needed to compile `better-sqlite3`'s native `.node` binding.
   - Download: https://visualstudio.microsoft.com/visual-cpp-build-tools/
   - In the installer, select the **"Desktop development with C++"** workload. This pulls in MSVC, Windows SDK, and CMake — everything `node-gyp` needs.
   - Reboot after install.

4. **Python 3** — usually already present. Verify `python --version`. If missing, install from https://www.python.org/ (check "Add Python to PATH").

---

## 2. Clone the source repo

```powershell
cd C:\dev                      # or wherever you keep code
git clone https://github.com/osman-yahya/feast-desk-app.git
cd feast-desk-app
```

> Two repos are involved:
> - **Source** (private): `osman-yahya/feast-desk-app` — you clone this
> - **Releases** (public): `osman-yahya/feast-desk-releases` — `npm run publish` uploads installers here, and `electron-updater` on user machines fetches from here. Do **not** clone the releases repo for development.
>
> Since the source repo is private, `git clone` will prompt for credentials. Use a Personal Access Token (the same one you'll use for publishing) or sign in via Git Credential Manager.

---

## 3. Install dependencies

```powershell
npm install
```

This also runs `postinstall` → `electron-rebuild -f -w better-sqlite3`, which compiles the SQLite native binding against Electron's Node ABI. **If this step fails, the app will crash on launch with a "node_module_version mismatch" error.** Do not skip it.

If you ever see that error later (e.g. after changing Electron version), just re-run:
```powershell
npm run postinstall
```

---

## 4. Run in dev

```powershell
npm run dev
```

Vite serves the renderer with HMR, Electron launches the main window, DevTools opens detached. You're ready to develop.

---

## 5. Build an installer locally (no publish)

```powershell
npm run package
```

This produces `dist/feast.  Desk Setup <version>.exe`. Double-click to test-install.

SmartScreen will show **"Windows protected your PC"** because the installer is unsigned. Click "More info → Run anyway". This warning appears on every unsigned version — expected.

---

## 6. Publish a new version (uploads to the release repo)

See `PUBLISH_NEW_VERSION.md` for the full release flow. Quick version:

1. Create a `.env` file at the project root (git-ignored, never commit it):
   ```
   GH_TOKEN=ghp_yourTokenHere
   ```
   The token needs `repo` scope and write access to `osman-yahya/feast-desk-releases`.

2. Bump `version` in `package.json`, commit, then:
   ```powershell
   npm run publish
   ```

`npm run publish` loads `.env` via `dotenv-cli`, so the same `.env` works on macOS, Linux, and Windows without changing anything.

---

## Common gotchas on Windows

| Problem | Fix |
|---|---|
| `MSB8020` / `cannot find v143 build tools` during `npm install` | VS Build Tools C++ workload not installed. Re-run the VS installer. |
| `gyp ERR! find Python` | Install Python 3 and add to PATH. |
| `node_module_version 115 vs 127` on launch | Run `npm run postinstall` to rebuild native modules against current Electron. |
| `electron-builder` hangs forever on `signing` | We are not signing — but leftover `CSC_*` or `WIN_CSC_*` env vars confuse it. Clear them: `Remove-Item Env:WIN_CSC_LINK`. |
| Path too long errors under `node_modules` | Enable long paths: run `git config --system core.longpaths true` in admin PowerShell, and in regedit set `HKLM\SYSTEM\CurrentControlSet\Control\FileSystem\LongPathsEnabled=1`. |
| `npm run publish` uploads but clients don't update | The release is a **draft** by default — go to the releases page on the release repo and click "Publish release". |

---

## Not doing (intentional)

- **No code signing.** Every unsigned build triggers SmartScreen on first run for end users. They click "More info → Run anyway" once per install. We accept this for now.
- **No macOS or Linux builds.** The mac target was removed from `electron-builder.config.js`. If you need those later, add them back, but Windows is the only supported platform right now.
