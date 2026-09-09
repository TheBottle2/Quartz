# Quartz

A local-first, plain-text knowledge base inspired by Obsidian. Built with Tauri v2, React, TypeScript, and Rust.

## Features

- **Local-first**: Vault is a folder of Markdown files on disk. No database, no cloud lock-in.
- **Bidirectional links**: `[[Note Title]]` creates permanent, clickable edges.
- **Backlinks pane**: Shows all notes referencing the current note.
- **Live preview**: Split-view editor with real-time Markdown → HTML rendering.
- **Auto-save**: Debounced saves (2s) while typing.
- **File-system native**: Works with any sync solution (Git, iCloud, Google Drive, Syncthing).

## Prerequisites

### Ubuntu 26.04 LTS (and derivatives)