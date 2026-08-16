# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Commands

```bash
# Development (Vite dev server + Electron, recommended)
npm run dev-electron

# Or start separately:
npm run dev      # Vite dev server on port 5173
npm start        # Build main process and start Electron

# Build
npm run build    # Vite build to dist/

# Package (Electron Builder)
npm run dist                  # Current platform installer
npm run dist:win              # Windows only
npm run dist:linux            # Linux .deb only
npm run pack-app              # Electron Builder --dir (unpacked)

# Other
npm run preview               # Vite preview of built frontend
```

## Project Architecture

### Two-Process Electron App

- **src/main/index.ts** — Electron main process entry. Handles: desktop capture, IPC handlers (recording, file ops, config, game process monitoring, window controls), GGD match data fetching, ffmpeg thumbnail generation, system tray, custom `app://` protocol for asset serving.
- **src/preload/index.ts** — Context bridge via `contextBridge.exposeInMainWorld('electronAPI', ...)`. Exposes all IPC invoke calls to the renderer. This is the ONLY bridge between main and renderer.
- **src/renderer/App.tsx** — React renderer (single-page, no router). 6 tabs: recording, recordings, map, stats/query, settings, screenshot annotation.
- **src/renderer/main.tsx** — React entry point.
- **src/renderer/utils/logger.ts** — Renderer-side logger that forwards to main process via IPC.

### Key Files

- **src/main/logger.ts** — Main process logger using Winston + DailyRotateFile. Logs to `{userData}/logs/`.
- **vite.config.js** — Vite config with React plugin, base `./` for Electron compatibility.
- **package.json** — Contains Electron Builder config under the `build` key (NSIS/DEB packaging).

### IPC Communication Pattern

Main process registers handlers via `ipcMain.handle('channel', handler)`. Preload exposes renderer calls via `ipcRenderer.invoke('channel', args)`. Renderer calls via `window.electronAPI.methodName(args)`.

### External Dependencies & Tools

- **ffmpeg** — Required at system level for thumbnail generation (not bundled).
- **GGD API** — `gaggle.fun` API for match history/data query. Requires authentication token.
- **Proxy** — Configured via `.env` (http_proxy, https_proxy, all_proxy). Used for GGD API calls.
- **ENV file** — `.env` is loaded at runtime from `app.asar/resources/.env` (packaged) or project root (dev).

### Recording Flow

1. Renderer calls `getGameProcesses()` → main process uses `ps-list` to get running processes
2. User selects process → `setRecordingTarget()` tells main which window to capture
3. Recording starts via `navigator.mediaDevices.getDisplayMedia()` → `MediaRecorder` API
4. On stop: chunks are sent through `startRecordingSession` / `appendRecordingChunk` / `finishRecordingSession` and written to disk

### Key Config Storage

Config is stored as JSON at `{userData}/config.json`. Includes: `recordingsDir`, `gamePath`, `recordingQuality`, `ggdToken`.
Favorites are stored separately at `{userData}/favorites.json`.
