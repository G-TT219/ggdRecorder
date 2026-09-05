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
import { APP_ERROR_EVENT, CommandPalette, ContextBar, RecordingDock, TopErrorToast, WorkspaceRail, WorkspaceStage, emitAppError, type CommandPaletteAction } from './components/WorkspaceShell';
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
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [topError, setTopError] = useState('');
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

  // Keep the independent recording control surface in sync while the main window is hidden.
  useEffect(() => {
    window.electronAPI.updateRecordingFloatState({
      isRecording,
      isPaused,
      recordingTime,
      gameName: selectedGame?.name || '',
    });
  }, [isRecording, isPaused, recordingTime, selectedGame?.name]);

  // Actions originate in the floating window and must be executed by this renderer,
  // where the MediaRecorder instance lives.
  useEffect(() => {
    const unsubscribe = window.electronAPI.onRecordingFloatAction(action => {
      if (action === 'toggle-pause') togglePause();
      if (action === 'stop') stopRecording();
    });
    return unsubscribe;
  }, [stopRecording, togglePause]);

  useEffect(() => {
    const handleAppError = (event: Event) => {
      const message = (event as CustomEvent<{ message?: string }>).detail?.message;
      if (!message) return;
      setTopError(message);
      window.setTimeout(() => setTopError(current => current === message ? '' : current), 4000);
    };
    window.addEventListener(APP_ERROR_EVENT, handleAppError);
    return () => window.removeEventListener(APP_ERROR_EVENT, handleAppError);
  }, []);

  useEffect(() => {
    if (recordingError) emitAppError(recordingError);
  }, [recordingError]);

  useEffect(() => {
    const handleCommandShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setCommandPaletteOpen(open => !open);
      }
      if (event.key === 'Escape') setCommandPaletteOpen(false);
    };
    window.addEventListener('keydown', handleCommandShortcut);
    return () => window.removeEventListener('keydown', handleCommandShortcut);
  }, []);

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

  const navigateWorkspace = (workspace: ActiveTab) => {
    setCommandPaletteOpen(false);
    setActiveTab(workspace);
    if (workspace === 'recordings') loadRecordings();
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

  // 复盘工作区统一使用同一尺寸，避免在地图、战绩和截图之间切换时跳变。
  useEffect(() => {
    if (activeTab === 'review' || activeTab === 'entertainment' || activeTab === 'stats' || activeTab === 'capture') {
      // 统一给地图高度留出完整画布，同时满足表格和截图工作区的宽度。
      window.electronAPI.resizeWindow(1400, 1000);
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

  const commandActions: CommandPaletteAction[] = [
    { id: 'go-record', label: '打开录制', detail: '选择游戏并开始捕捉', shortcut: '⌘1', run: () => navigateWorkspace('games') },
    { id: 'go-library', label: '打开录像库', detail: '浏览、筛选和复盘录像', shortcut: '⌘2', run: () => navigateWorkspace('recordings') },
    { id: 'go-annotate', label: '打开标注工作区', detail: '地图、截图与玩家关系', shortcut: '⌘3', run: () => navigateWorkspace('entertainment') },
    { id: 'go-stats', label: '打开战绩分析', detail: '查看对局与玩家数据', shortcut: '⌘4', run: () => navigateWorkspace('stats') },
    { id: 'go-settings', label: '打开设置', detail: '管理应用偏好和连接', shortcut: '⌘5', run: () => navigateWorkspace('settings') },
    ...(isRecording ? [{ id: 'stop-recording', label: '结束录制', detail: '保存当前录像并打开录像库', shortcut: '⌘⇧D', run: stopRecording }] : []),
  ];

  return (
    <div className="app">
      <TitleBar isMaximized={isMaximized} onMinimize={handleMinimize} onMaximize={handleMaximize} onClose={handleClose} />
      <div className="workspace-shell">
        <WorkspaceRail
          activeWorkspace={activeTab}
          recordingsCount={recordings.length}
          isRecording={isRecording}
          onNavigate={navigateWorkspace}
        />
        <WorkspaceStage>
          <ContextBar
            activeWorkspace={activeTab}
            isRecording={isRecording}
            onNavigate={navigateWorkspace}
            onOpenCommand={() => setCommandPaletteOpen(true)}
          />
          <ErrorBoundary>
          <main className={`app-main ${activeTab === 'review' ? 'review-mode' : ''}`}>
        <div className={`tab-pane workspace-pane map-pane ${activeTab === 'entertainment' || activeTab === 'review' ? 'active' : 'hidden'}`}>
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
        <div className={`tab-pane workspace-pane recordings-pane ${activeTab === 'recordings' || activeTab === 'review' ? 'active' : 'hidden'}`}>
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
        <div className={`tab-pane workspace-pane stats-pane ${activeTab === 'stats' ? 'active' : 'hidden'}`}>
          <StatsTab />
        </div>
        <div className={`tab-pane workspace-pane capture-pane ${activeTab === 'capture' ? 'active' : 'hidden'}`}>
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
        </WorkspaceStage>
      </div>
      <RecordingDock
        isRecording={isRecording}
        isPaused={isPaused}
        recordingTime={recordingTime}
        selectedGameName={selectedGame?.name}
        formatTime={formatTime}
        onTogglePause={togglePause}
        onStop={stopRecording}
        onOpenLibrary={() => {
          setActiveTab('recordings');
          loadRecordings();
        }}
      />
      <TopErrorToast message={topError} onClose={() => setTopError('')} />
      <CommandPalette
        open={commandPaletteOpen}
        actions={commandActions}
        onClose={() => setCommandPaletteOpen(false)}
      />
    </div>
  );
}

export default App;
