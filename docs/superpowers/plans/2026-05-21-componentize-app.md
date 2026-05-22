# App Componentization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the monolithic 2700-line App.jsx into focused components: one per tab + TitleBar.

**Architecture:** App.jsx keeps shared state (navigation, recording orchestration, recordings cache, config) and passes it down as props. Each tab component owns its own UI state and handlers, calling up to App via callbacks for shared operations.

**Tech Stack:** React 18, Electron, no router (tab-based navigation)

---

## Files to Create/Modify

| File | Type | Responsibility |
|---|---|---|
| `src/components/TitleBar.jsx` | Create | Custom title bar with min/max/close buttons |
| `src/components/GameTab.jsx` | Create | Game process list + recording start/stop/pause |
| `src/components/RecordingsTab.jsx` | Create | Recordings list, player, batch ops, analysis |
| `src/components/MapTab.jsx` | Create | Map tool with markers, connections, role assignments |
| `src/components/StatsTab.jsx` | Create | Match history query + match data display |
| `src/App.jsx` | Modify | Remove tab-specific code, keep shared state + routing |

### State Distribution

**Stays in App (shared across tabs):**
- `activeTab`, `setActiveTab` — tab navigation
- `isMaximized`, `handleMinimize`, `handleMaximize`, `handleClose` — window controls
- `isRecording`, `setIsRecording`, `recordingTime`, `setRecordingTime` — header indicator
- `selectedGame`, `setSelectedGame`, `gameProcesses`, `setGameProcesses` — recording state
- `source`, `setSource`, `isFetchingSource`, `setIsFetchingSource`
- `mediaRecorderRef`, `recordedChunksRef`, `recordingStartTimeRef`, `timerIntervalRef`
- `compressVideosRef` — sync ref for recording
- `sourceRef`, `isRecordingRef`, `isPausedRef` — stale-closure-safe refs
- `loadGameProcesses`, `preFetchSource` — shared between GameTab and shortcuts
- Recording functions: `startMediaRecording_new`, `stopRecording`, `pauseRecording`, `resumeRecording`, `togglePauseResume`
- Shortcut handlers + useEffect to register them
- `loadRecordings`, `recordings`, `setRecordings`, `recordingsCacheRef`, `lastRefreshTimeRef` — recordings cache
- `recordingDataBuffers`, `recordingThumbnails`, `setRecordingThumbnails` — media cache
- `favoriteRecordings`, `setFavoriteRecordings`, `loadFavoriteRecordings`
- `loadingConfig`, `recordingsDir`, `setRecordingsDir`, `gamePath`, `setGamePath`, `compressVideos`, `setCompressVideos`
- `loadRecordingThumbnails`, `putRecordingDateBuffer`

**Moves to RecordingsTab (owned by component):**
- `selectedRecording`, `recordingData`, `analysisResult`, `analyzeStatus`
- `selectedRecordings`, `isSelectMode`, `startDate`, `endDate`, `showFavoritesOnly`
- `isRefreshingRecordings`, `currentPage`, `totalPages`, `recordingsPerPage`
- `listScrollPosition`, `recordingsListRef`, `scrollRAFRef`
- All recordings-specific handlers (deleteRecording, toggleFavorite, etc.)
- All recordings-specific effects + JSX

**Moves to MapTab (owned by component):**
- All 16 map-specific state variables (selectedMap, currentSequence, mapMarkers, etc.)
- All map handlers (handleMarkerMouseDown, handleConnectionStart, etc.)
- mapNameMapping constant
- All map JSX

**Moves to StatsTab (owned by component):**
- All stats-specific state (matchData, matchLoading, matchError, etc.)
- All stats handlers (fetchMatchData, fetchMatchHistory, etc.)
- Helper functions (getRoleName, getFactionName, getMapName, getModeName, etc.)
- All stats JSX

---

### Task 1: TitleBar Component

**Files:**
- Create: `src/components/TitleBar.jsx`

Move the custom title bar JSX (lines 1515-1544) into its own component.

**Props:** `isMaximized`, `onMinimize`, `onMaximize`, `onClose`

**Code:**
```jsx
import React from 'react';

function TitleBar({ isMaximized, onMinimize, onMaximize, onClose }) {
  return (
    <div className="custom-titlebar">
      <div className="titlebar-drag-region">
        <span className="app-title">游戏录制助手</span>
      </div>
      <div className="titlebar-controls">
        <button className="titlebar-button" onClick={onMinimize} title="最小化">
          <svg width="12" height="12" viewBox="0 0 12 12">
            <line x1="0" y1="6" x2="12" y2="6" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </button>
        <button className="titlebar-button" onClick={onMaximize} title={isMaximized ? '还原' : '最大化'}>
          {isMaximized ? (
            <svg width="12" height="12" viewBox="0 0 12 12">
              <rect x="3" y="1" width="8" height="8" fill="none" stroke="currentColor" strokeWidth="1.5" />
              <rect x="1" y="3" width="8" height="8" fill="none" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 12 12">
              <rect x="1" y="1" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          )}
        </button>
        <button className="titlebar-button close-button" onClick={onClose} title="关闭">
          <svg width="12" height="12" viewBox="0 0 12 12">
            <line x1="1" y1="1" x2="11" y2="11" stroke="currentColor" strokeWidth="1.5" />
            <line x1="11" y1="1" x2="1" y2="11" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export default TitleBar;
```

---

### Task 2: GameTab Component

**Files:**
- Create: `src/components/GameTab.jsx`
- Modify: `src/App.jsx` (remove Games tab JSX)

Move the Games tab section (lines 1592-1648). Receives all recording state + game process data as props.

**Props:**
- `gameProcesses`, `selectedGame`, `isRecording`, `isPaused`, `recordingTime`, `source`, `isFetchingSource`, `gamePath`
- `onSelectGame`, `onRefreshProcesses`, `onStartRecording`, `onStopRecording`, `onPauseResume`, `onStartGame`

---

### Task 3: RecordingsTab Component

**Files:**
- Create: `src/components/RecordingsTab.jsx`
- Modify: `src/App.jsx` (remove Recordings tab JSX + handlers)

This is the largest component. It owns recordings-specific state (UI state like pagination, selection, filters, player state) and receives cached data from App.

**Props:**
- `recordings`, `recordingThumbnails`, `favoriteRecordings`, `recordingDataBuffers`
- `onRefreshRecordings`, `onFavoriteToggle`, `onThumbnailLoad`, `onBufferUpdate`
- `setRecordings`, `setFavoriteRecordings`, `setRecordingThumbnails`

**Moved state (declared inside RecordingsTab):**
- All UI state (selectedRecording, isSelectMode, pagination, filters, etc.)
- `analysisResult`, `analyzeStatus`

**Moved handlers:**
- `deleteRecording`, `toggleFavoriteRecording`, `handleNavigateToPlayer`
- `handleReturnToList`, `loadRecordingData`, `analyzeRecording`
- All batch operations, pagination, filter handlers
- `saveFavoriteToDirectory`

---

### Task 4: MapTab Component

**Files:**
- Create: `src/components/MapTab.jsx`
- Modify: `src/App.jsx` (remove Map tab JSX + handlers)

The map tool is fully self-contained. All 16 state variables + all handlers move entirely.

**Props:** None needed (fully self-contained except `mapNameMapping` which moves into the component).

**Moves entirely:**
- All map state declarations
- `mapNameMapping` constant
- All map handlers (marker drag, connection drawing, role assignment)
- All map JSX (~400 lines including sidebar, map canvas, right panel)

---

### Task 5: StatsTab Component

**Files:**
- Create: `src/components/StatsTab.jsx`
- Modify: `src/App.jsx` (remove Stats tab JSX + handlers)

The stats/query tab is fully self-contained.

**Props:** `statsUrl` (for open in browser).

**Moves entirely:**
- All stats state declarations
- All stats handlers (fetchMatchData, fetchMatchHistory, etc.)
- All helper functions (getRoleName, getFactionName, etc.)
- All stats JSX (~460 lines)

---

### Task 6: App.jsx Reduction

**Files:**
- Modify: `src/App.jsx`

Remove all tab-specific JSX blocks and handlers. Replace with component imports.

**App.jsx after reduction retains:**
- Imports + new imports for 5 tab components + TitleBar
- Shared state declarations (activeTab, isRecording, recordings, config state, etc.)
- Shared refs (mediaRecorderRef, etc.)
- Recording orchestration functions
- Shortcut handlers + initial useEffect
- `loadingConfig`, `loadGameProcesses`, `loadRecordings`, `loadFavoriteRecordings`
- Window control handlers
- Tab resize effect
- Header JSX (tabs + recording indicator)
- `<TitleBar />` + `<main>` with `{activeTab === 'games' ? <GameTab /> : ...}`
- `export default App`

Expected final size: ~400-500 lines (down from ~2734).

---

### Self-Review

**Spec coverage:**
- TitleBar extracted ✓ (Task 1)
- GameTab extracted ✓ (Task 2)
- RecordingsTab extracted ✓ (Task 3)
- MapTab extracted ✓ (Task 4)
- StatsTab extracted ✓ (Task 5)
- App.jsx reduced ✓ (Task 6)

**Placeholder scan:** No TODOs, TBDs, or similar placeholders.

**Type consistency:** All prop names and callback signatures are consistent across tasks.
