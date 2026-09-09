# Quartz

A local-first, plain-text knowledge base inspired by Obsidian. Built with Tauri v2, React, TypeScript, and Rust.

## Features

- **Local-first**: a vault is just a folder of Markdown files on disk. No database, no cloud lock-in; works with any sync solution (Git, Syncthing, Nextcloud…).
- **Bidirectional links**: `[[Note Title]]` creates clickable edges, with a **backlinks pane** for incoming references.
- **Split editor**: Markdown textarea + live HTML preview, formatting toolbar, **undo/redo** (`Ctrl+Z` / `Ctrl+Shift+Z`), find & replace (`Ctrl+F`).
- **Math**: LaTeX rendered client-side with KaTeX (`$…$`, `$$…$$`).
- **Graph view** (`Ctrl+G`): force-directed note/tag/folder graph (d3) with type, tag, folder and date filters, minimap, click-to-select / double-click-to-open, and SVG/PNG export.
- **Calendar & daily notes** (`Ctrl+Shift+C`, `Ctrl+Shift+D`): monthly grid with note indicators, configurable daily-notes folder.
- **5 languages**: Türkçe, English, Deutsch, Français, Español (auto-detected, persisted).
- **Appearance**: dark/light themes, transparent-background mode with adjustable opacity.
- **Custom shortcuts**: remappable from Settings, persisted in localStorage.
- **Fully offline**: no CDN dependencies; every asset is bundled.

## Keyboard shortcuts (defaults)

| Action | Shortcut |
|---|---|
| New note | `Ctrl+N` |
| Save note | `Ctrl+S` |
| Delete note | `Ctrl+Shift+Delete` |
| Search / find-replace | `Ctrl+F` |
| Toggle sidebar | `Ctrl+B` |
| Graph view | `Ctrl+G` |
| Toggle calendar | `Ctrl+Shift+C` |
| Today's daily note | `Ctrl+Shift+D` |
| Settings | `Ctrl+,` |
| Undo / redo | `Ctrl+Z` / `Ctrl+Shift+Z` |
| Close dialog | `Esc` |

## Platform support

- **Linux: fully supported and tested** — `.deb`, `.rpm` and `.AppImage` bundles are built from here (Ubuntu 26.04).
- **Windows / macOS: should work, not tested** — the Tauri config targets all platforms (`"targets": "all"`), so `nsis`/`msi` (Windows) and `dmg` (macOS) builds are expected to work, but no artifacts are produced or verified in this repo. Build on the target OS with `npm run tauri build` and report back.

## Prerequisites

- **Node.js** 18+ and npm
- **Rust** stable toolchain (`rustup`)
- **Linux (Tauri v2) system libs**, e.g. on Ubuntu/Debian:
  ```bash
  sudo apt install libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev patchelf
  ```

## Getting started

```bash
npm ci            # install dependencies
npm run dev       # Vite dev server (frontend only)
npm run tauri dev # full desktop app in dev mode
```

## Building

```bash
npm run tauri build
```

Bundles land in `src-tauri/target/release/bundle/` (`.deb`, `.rpm`, `.AppImage`). Install e.g. with:

```bash
sudo dpkg -i src-tauri/target/release/bundle/deb/Quartz_<version>_amd64.deb
```

The displayed app version is read at runtime from `src-tauri/tauri.conf.json` — bump `package.json`, `tauri.conf.json` and `src-tauri/Cargo.toml` together when releasing.

## Project structure

```
src/                 React frontend (components, i18n, utils, styles)
src-tauri/           Rust backend (vault file commands) + Tauri config
src-tauri/icons/     app icons (generated via `npx tauri icon`)
```

## Vault

Open any folder containing Markdown files via the startup dialog; the last-used vault path is remembered. Daily notes default to `<vault>/Daily/YYYY-MM-DD.md` (configurable in Settings).
