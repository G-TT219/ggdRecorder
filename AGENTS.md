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

- **electron-main.js** — Electron main process. Handles: desktop capture, IPC handlers (recording, file ops, config, game process monitoring, window controls), Google Gemini AI analysis, GGD match data fetching, ffmpeg video compression/thumbnails, system tray, custom `app://` protocol for asset serving.
- **preload.js** — Context bridge via `contextBridge.exposeInMainWorld('electronAPI', ...)`. Exposes all IPC invoke calls to the renderer. This is the ONLY bridge between main and renderer.
- **src/App.jsx** — React renderer (single-page, no router). 5 tabs: game recording, recordings playback, map tool, stats/query, settings. All state in a single `useState`-heavy component (~2970 lines).
- **src/main.jsx** — React entry point.
- **src/utils/logger.js** — Renderer-side logger that forwards to main process via IPC.

### Key Files

- **logger.js** — Main process logger using Winston + DailyRotateFile. Logs to `{userData}/logs/`.
- **video_analysis.js** — Standalone script for Google Gemini video analysis. Can be used independently of the main app.
- **vite.config.js** — Vite config with React plugin, base `./` for Electron compatibility.
- **package.json** — Contains Electron Builder config under the `build` key (NSIS/DEB packaging).

### IPC Communication Pattern

Main process registers handlers via `ipcMain.handle('channel', handler)`. Preload exposes renderer calls via `ipcRenderer.invoke('channel', args)`. Renderer calls via `window.electronAPI.methodName(args)`.

### External Dependencies & Tools

- **ffmpeg** — Required at system level for video compression and thumbnail generation (not bundled).
- **Google Gemini API** — AI video analysis. Requires user-provided API key and proxy for some regions.
- **GGD API** — `gaggle.fun` API for match history/data query. Requires authentication token.
- **Proxy** — Configured via `.env` (http_proxy, https_proxy, all_proxy). Used for Gemini API and GGD API calls.
- **ENV file** — `.env` is loaded at runtime from `app.asar/resources/.env` (packaged) or project root (dev).

### Recording Flow

1. Renderer calls `getGameProcesses()` → main process uses `ps-list` to get running processes
2. User selects process → `preFetchSource()` → `desktopCapturer.getSources()` to get screen source ID
3. Recording starts via `navigator.mediaDevices.getUserMedia()` with desktop capture constraints → `MediaRecorder` API
4. On stop: chunks assembled into Blob → ArrayBuffer sent to main process via `saveRecording()` → written to filesystem (optionally compressed via ffmpeg)

### Key Config Storage

Config is stored as JSON at `{userData}/config.json`. Includes: `recordingsDir`, `gamePath`, `compressVideos`, `apiKey` (Gemini), `ggdToken`.
Favorites are stored separately at `{userData}/favorites.json`.
