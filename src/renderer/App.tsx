import { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';
import Logger from './utils/logger';
import { useRecording } from './hooks/useRecording';
import ErrorBoundary from './components/ErrorBoundary';
import SettingsTab from './components/SettingsTab';
import TitleBar from './components/TitleBar';
import GameTab from './components/GameTab';
import RecordingsTab from './components/RecordingsTab';
import MapTab from './components/MapTab';
import StatsTab from './components/StatsTab';
import ScreenshotTab from './components/ScreenshotTab';
import type { Connection, MapMarker, Position, RoleKey } from './components/MapTab';
import type { GameProcess, Recording, RecordingThumbnails, FavoriteGroup, RecordingNotes, FavoriteRecordingGroups, RecordingQuality } from './types/electron-api';

type ActiveTab = 'games' | 'recordings' | 'settings' | 'entertainment' | 'stats' | 'review' | 'capture';

type PersistedMapWorkspace = {
  version: 2;
  selectedMap: number;
  currentSequence: number;
  mapMarkersByMap: Record<number, MapMarker[]>;
  roleAssignments: Record<string, RoleKey>;
  connectionsByMap: Record<number, Connection[]>;
  markerTrailsByMap: Record<number, Record<number, Position[][]>>;
  deadMarkers: Record<string, boolean>;
};

const MAP_WORKSPACE_STORAGE_KEY = 'ggd-recorder.map-workspace.v2';

const createEmptyMapWorkspace = (): PersistedMapWorkspace => ({
  version: 2,
  selectedMap: 1,
  currentSequence: 1,
  mapMarkersByMap: {},
  roleAssignments: {},
  connectionsByMap: {},
  markerTrailsByMap: {},
  deadMarkers: {},
});

const loadMapWorkspace = (): PersistedMapWorkspace => {
  try {
    const raw = window.localStorage.getItem(MAP_WORKSPACE_STORAGE_KEY);
    if (!raw) return createEmptyMapWorkspace();
    const parsed = JSON.parse(raw) as Partial<PersistedMapWorkspace>;
    if (parsed.version !== 2) return createEmptyMapWorkspace();
    return {
      ...createEmptyMapWorkspace(),
      ...parsed,
      version: 2,
    };
  } catch {
    return createEmptyMapWorkspace();
  }
};

function App() {
  const [gameProcesses, setGameProcesses] = useState<GameProcess[]>([]);
  const [selectedGame, setSelectedGame] = useState<GameProcess | null>(null);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [activeTab, setActiveTab] = useState<ActiveTab>('games');
  const [recordingsDir, setRecordingsDir] = useState('');
  const [gamePath, setGamePath] = useState('');
  const [recordingQuality, setRecordingQuality] = useState<RecordingQuality>('balanced');
  const [recordingThumbnails, setRecordingThumbnails] = useState<RecordingThumbnails>({});
  const recordingThumbnailsRef = useRef<RecordingThumbnails>({});
  useEffect(() => { recordingThumbnailsRef.current = recordingThumbnails; }, [recordingThumbnails]);
  const [isMaximized, setIsMaximized] = useState(false);
  const [favoriteRecordings, setFavoriteRecordings] = useState<string[]>([]);
  const [recordingNotes, setRecordingNotes] = useState<RecordingNotes>({});
  const [favoriteGroups, setFavoriteGroups] = useState<FavoriteGroup[]>([]);
  const [favoriteRecordingGroups, setFavoriteRecordingGroups] = useState<FavoriteRecordingGroups>({});
  const [initialMapWorkspace] = useState(loadMapWorkspace);
  const [sharedMapId, setSharedMapId] = useState(initialMapWorkspace.selectedMap);
  const [sharedMapSequence, setSharedMapSequence] = useState(initialMapWorkspace.currentSequence);
  const [sharedMapMarkersByMap, setSharedMapMarkersByMap] = useState<Record<number, MapMarker[]>>(
    initialMapWorkspace.mapMarkersByMap
  );
  const [sharedRoleAssignments, setSharedRoleAssignments] = useState<Record<string, RoleKey>>(
    initialMapWorkspace.roleAssignments
  );
  const [sharedConnectionsByMap, setSharedConnectionsByMap] = useState<Record<number, Connection[]>>(
    initialMapWorkspace.connectionsByMap
  );
  const [sharedMarkerTrailsByMap, setSharedMarkerTrailsByMap] = useState<Record<number, Record<number, Position[][]>>>(
    initialMapWorkspace.markerTrailsByMap
  );
  const [sharedDeadMarkers, setSharedDeadMarkers] = useState<Record<string, boolean>>(
    initialMapWorkspace.deadMarkers
  );
  const recordingsCacheRef = useRef<Recording[]>([]);
  const lastRefreshTimeRef = useRef(0);
  const REFRESH_DEBOUNCE_MS = 5000;
  const isRecordingRef = useRef(false);
  const selectedGameRef = useRef(selectedGame);
  const recordingQualityRef = useRef(recordingQuality);
  const {
    isRecording,
    isPaused,
    recordingTime,
    recordingError,
    startRecording,
    stopRecording,
    togglePause,
  } = useRecording({
    onRecordingSaved: () => loadRecordings(true),
  });

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const workspace: PersistedMapWorkspace = {
        version: 2,
        selectedMap: sharedMapId,
        currentSequence: sharedMapSequence,
        mapMarkersByMap: sharedMapMarkersByMap,
        roleAssignments: sharedRoleAssignments,
        connectionsByMap: sharedConnectionsByMap,
        markerTrailsByMap: sharedMarkerTrailsByMap,
        deadMarkers: sharedDeadMarkers,
      };
      try {
        window.localStorage.setItem(MAP_WORKSPACE_STORAGE_KEY, JSON.stringify(workspace));
      } catch {
        // Keep the map tool usable when storage is unavailable or full.
      }
    }, 180);

    return () => window.clearTimeout(timeoutId);
  }, [
    sharedMapId,
    sharedMapSequence,
    sharedMapMarkersByMap,
    sharedRoleAssignments,
    sharedConnectionsByMap,
    sharedMarkerTrailsByMap,
    sharedDeadMarkers,
  ]);

  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  useEffect(() => {
  }, [isPaused]);

  useEffect(() => {
    selectedGameRef.current = selectedGame;
  }, [selectedGame]);

  useEffect(() => {
    recordingQualityRef.current = recordingQuality;
  }, [recordingQuality]);

  // Format time for display (seconds to HH:mm:ss)
  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return [
      h.toString().padStart(2, '0'),
      m.toString().padStart(2, '0'),
      s.toString().padStart(2, '0')
    ].join(':');
  };

  useEffect(() => {
    // Load game processes
    loadGameProcesses();
    loadRecordings();
    loadingConfig();

    // Remove focus from any element on app load to prevent button highlight
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    // Load favorite recordings
    loadFavoriteRecordings();

    // Listen for start recording shortcut
    const handleStartRecordingShortcut = () => {
      if (selectedGameRef.current && !isRecordingRef.current) {
        startRecording(selectedGameRef.current, recordingQualityRef.current);
      }
    };

    // Listen for stop recording shortcut
    const handleStopRecordingShortcut = () => {
      if (isRecordingRef.current) {
        stopRecording();
      }
    };

    window.electronAPI.onStartRecordingShortcut(handleStartRecordingShortcut);
    window.electronAPI.onStopRecordingShortcut(handleStopRecordingShortcut);

    // Clean up event listeners
    return () => {
      window.electronAPI.removeAllListeners('start-recording-shortcut');
      window.electronAPI.removeAllListeners('stop-recording-shortcut');
    };
  }, []);

  const loadGameProcesses = async () => {
    try {
      const processes = await window.electronAPI.getGameProcesses();
      processes.sort((a, b) => {
        const aIsGGD = a.name.toLowerCase().includes('duck');
        const bIsGGD = b.name.toLowerCase().includes('duck');
        if (aIsGGD && !bIsGGD) return -1;
        if (!aIsGGD && bIsGGD) return 1;
        return 0;
      });
      setGameProcesses(processes);
      Logger.info(`Loaded ${processes.length} game processes`);
    } catch (error) {
      Logger.error('Error loading game processes:', error);
    }
  };

  const loadRecordings = async (forceRefresh = false) => {
    try {
      // Check if we should skip refresh due to debounce
      const now = Date.now();
      if (!forceRefresh && (now - lastRefreshTimeRef.current) < REFRESH_DEBOUNCE_MS) {
        Logger.info('Skipping recordings refresh (debounced)');
        return;
      }

      if (recordings == null && recordingsCacheRef.current == null) {
        const recordingsList = await window.electronAPI.getRecordings();
        recordingsCacheRef.current = recordingsList;
        setRecordings(recordingsList);

        Logger.info(`Loaded ${recordingsList.length} recordings (updated)`);
      } else {
        setRecordings(recordingsCacheRef.current);
        Logger.info(`Loaded ${recordingsCacheRef.current.length} recordings (loaded with cache)`);
        // loadRecordingThumbnails(recordingsCacheRef.current);
        const recordingsList = window.electronAPI.getRecordings();
        recordingsList.then(recordingsList => {
          // Compare new data with cache to avoid unnecessary re-renders
          const hasChanges = JSON.stringify(recordingsList) !== JSON.stringify(recordingsCacheRef.current);

          if (hasChanges) {
            // Update cache and state only if there are changes
            recordingsCacheRef.current = recordingsList;
            setRecordings(recordingsList);

            Logger.info(`Async Loaded ${recordingsList.length} recordings (updated)`);
          } else {
            Logger.info(`Async Loaded ${recordingsList.length} recordings (no changes, skipped update)`);
          }
          lastRefreshTimeRef.current = now;

        });

      }

      lastRefreshTimeRef.current = now;
    } catch (error) {
      Logger.error('Error loading recordings:', error);
    }
  };

  const loadFavoriteRecordings = async () => {
    try {
      const result = await window.electronAPI.getFavoriteRecordings();
      if (result.success) {
        setFavoriteRecordings(result.favorites || []);
        setRecordingNotes(result.notes || {});
        setFavoriteGroups(result.groups || []);
        setFavoriteRecordingGroups(result.recordingGroups || {});
      }
    } catch (error) {
      Logger.error('Error loading favorite recordings:', error);
    }
  };

  const loadRecordingThumbnails = useCallback(async (recordingsList: Recording[]) => {
    const currentThumbnails = recordingThumbnailsRef.current;
    const missingRecordings = recordingsList.filter(recording => !currentThumbnails[recording.id]);
    if (missingRecordings.length === 0) return;

    const results = await Promise.allSettled(
      missingRecordings.map(recording =>
        window.electronAPI.generateThumbnail(recording.filePath)
          .then(result => ({ id: recording.id, result }))
      )
    );

    const loadedThumbnails: RecordingThumbnails = {};
    for (const item of results) {
      if (item.status === 'fulfilled' && item.value.result.success) {
        loadedThumbnails[item.value.id] = item.value.result.data;
      } else if (item.status === 'rejected') {
        Logger.error('Error loading thumbnail:', item.reason);
      }
    }

    if (Object.keys(loadedThumbnails).length > 0) {
      setRecordingThumbnails(prev => ({ ...prev, ...loadedThumbnails }));
    }
  }, []);

  const loadingConfig = async () => {
    try {
      const result = await window.electronAPI.getAppConfig();
      if (result.success) {
        Logger.info('Config loaded successfully');
        setGamePath(result.config.gamePath || '');
        setRecordingsDir(result.config.recordingsDir || '');
        setRecordingQuality(result.config.recordingQuality || 'balanced');
      }
    } catch (error) {
      Logger.error('Error loading config:', error);
    }
  };


  // 切换标签时 yield 给浏览器事件循环，让 DOM 先刷完
  useEffect(() => {
    const timer = setTimeout(() => {}, 0);
    return () => clearTimeout(timer);
  }, [activeTab]);

  // 切换到娱乐（地图辅助工具）或战绩查询界面时调整窗口大小
  useEffect(() => {
    if (activeTab === 'review') {
      window.electronAPI.resizeWindow(1500, 900);
    } else if (activeTab === 'entertainment') {
      // 调整为适合地图工具的窗口大小（更宽更高）
      window.electronAPI.resizeWindow(1400, 1000);
    } else if (activeTab === 'stats') {
      // 战绩查询界面也需要较大窗口
      window.electronAPI.resizeWindow(1200, 800);
    } else if (activeTab === 'capture') {
      window.electronAPI.resizeWindow(1400, 900);
    } else {
      // 切换到其他标签时恢复默认大小
      window.electronAPI.resizeWindow(500, 800);
    }
  }, [activeTab]);

  // Window control functions
  const handleMinimize = () => {
    window.electronAPI.windowMinimize();
  };

  const handleMaximize = () => {
    window.electronAPI.windowMaximize();
    setIsMaximized(!isMaximized);
  };

  const handleClose = () => {
    window.electronAPI.windowClose();
  };

  const startGame = async () => {
    try {
      const result = await window.electronAPI.startGame(gamePath);
      if (!result.success) {
        alert('请先在设置中选择正确的游戏程序路径');
        Logger.error('Failed to start game');
      } else {
        Logger.info('Game started successfully');
      }
    } catch (error) {
      Logger.error('Error starting game:', error);
    }
  };

  // 通知主进程当前选中的游戏名，用于 getDisplayMedia 自动匹配窗口
  useEffect(() => {
    if (selectedGame) {
      window.electronAPI.setRecordingTarget({ name: selectedGame.name, pid: selectedGame.pid });
    }
  }, [selectedGame]);

  // Add tooltip to indicate shortcut keys
  useEffect(() => {
    const recordButton = document.querySelector<HTMLElement>('.record-button');
    const stopButton = document.querySelector<HTMLElement>('.stop-button');

    if (recordButton) {
      recordButton.title = '快捷键: Ctrl+Shift+S';
    }

    if (stopButton) {
      stopButton.title = '快捷键: Ctrl+Shift+D';
    }
  }, [isRecording]);

  return (
    <div className="app">
      <TitleBar isMaximized={isMaximized} onMinimize={handleMinimize} onMaximize={handleMaximize} onClose={handleClose} />

      <header className="app-header">
        <div className="app-header-topline">
          <div className="app-header-copy">
            <span className="app-header-eyebrow">WORKSPACE</span>
            <h1>游戏录制助手</h1>
          </div>
          {isRecording ? (
            <div className="recording-indicator">
              <span className="recording-dot"></span>
              <span>录制中</span>
              <strong>{formatTime(recordingTime)}</strong>
            </div>
          ) : (
            <div className="workspace-status">
              <span className="workspace-status-dot" aria-hidden="true" />
              本地就绪
            </div>
          )}
        </div>
        <nav className="tabs" aria-label="主功能">
          <button
            type="button"
            className={activeTab === 'games' ? 'active' : ''}
            onClick={() => setActiveTab('games')}
          >
            录制
          </button>
          <button
            type="button"
            className={activeTab === 'recordings' ? 'active' : ''}
            onClick={() => {
              setActiveTab('recordings');
              loadRecordings();
            }}
          >
            录像 <span className="tab-count">{recordings.length}</span>
          </button>
          <button
            type="button"
            className={activeTab === 'entertainment' ? 'active' : ''}
            onClick={() => setActiveTab('entertainment')}
          >
            地图
          </button>
          <button
            type="button"
            className={activeTab === 'stats' ? 'active' : ''}
            onClick={() => setActiveTab('stats')}
          >
            战绩查询
          </button>
          <button
            type="button"
            className={activeTab === 'settings' ? 'active' : ''}
            onClick={() => setActiveTab('settings')}
          >
            设置
          </button>
          <button
            type="button"
            className={activeTab === 'capture' ? 'active' : ''}
            onClick={() => setActiveTab('capture')}
          >
            截图标注
          </button>
        </nav>
        {activeTab === 'review' && (
          <button className="back-btn" onClick={() => setActiveTab('recordings')}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>
            退出复盘
          </button>
        )}
      </header>

      <ErrorBoundary>
      <main className={`app-main ${activeTab === 'review' ? 'review-mode' : ''}`}>
        <div className={`tab-pane map-pane ${activeTab === 'entertainment' || activeTab === 'review' ? 'active' : 'hidden'}`}>
          <MapTab
            selectedMap={sharedMapId}
            setSelectedMap={setSharedMapId}
            currentSequence={sharedMapSequence}
            setCurrentSequence={setSharedMapSequence}
            mapMarkersByMap={sharedMapMarkersByMap}
            setMapMarkersByMap={setSharedMapMarkersByMap}
            roleAssignments={sharedRoleAssignments}
            setRoleAssignments={setSharedRoleAssignments}
            connectionsByMap={sharedConnectionsByMap}
            setConnectionsByMap={setSharedConnectionsByMap}
            markerTrailsByMap={sharedMarkerTrailsByMap}
            setMarkerTrailsByMap={setSharedMarkerTrailsByMap}
            deadMarkers={sharedDeadMarkers}
            setDeadMarkers={setSharedDeadMarkers}
          />
        </div>
        <div className={`tab-pane recordings-pane ${activeTab === 'recordings' || activeTab === 'review' ? 'active' : 'hidden'}`}>
          <RecordingsTab
            recordings={recordings}
            recordingThumbnails={recordingThumbnails}
            favoriteRecordings={favoriteRecordings}
            recordingNotes={recordingNotes}
            favoriteGroups={favoriteGroups}
            favoriteRecordingGroups={favoriteRecordingGroups}
            onLoadThumbnails={loadRecordingThumbnails}
            onRefreshRecordings={() => loadRecordings(true)}
            onRefreshFavorites={() => loadFavoriteRecordings()}
            onEnterReview={() => setActiveTab('review')}
          />
        </div>
        <div className={`tab-pane ${activeTab === 'stats' ? 'active' : 'hidden'}`}>
          <StatsTab />
        </div>
        <div className={`tab-pane ${activeTab === 'capture' ? 'active' : 'hidden'}`}>
          <ScreenshotTab />
        </div>
        {activeTab === 'games' ? (
          <GameTab
            gameProcesses={gameProcesses}
            selectedGame={selectedGame}
            isRecording={isRecording}
            isPaused={isPaused}
            recordingError={recordingError}
            gamePath={gamePath}
            onSelectGame={setSelectedGame}
            onRefreshProcesses={loadGameProcesses}
            onStartRecording={(game) => startRecording(game, recordingQuality)}
            onStopRecording={stopRecording}
            onPauseResume={togglePause}
            onStartGame={startGame}
          />
        ) : activeTab === 'settings' ? (
          <SettingsTab
            recordingsDir={recordingsDir}
            gamePath={gamePath}
            recordingQuality={recordingQuality}
            onRecordingsDirChange={(dir) => { setRecordingsDir(dir); loadRecordings(true); }}
            onGamePathChange={(path) => setGamePath(path)}
            onRecordingQualityChange={setRecordingQuality}
          />
        ) : null}
      </main>
    </ErrorBoundary>
    </div>
  );
}

export default App;
