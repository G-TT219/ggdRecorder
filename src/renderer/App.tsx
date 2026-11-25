import { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';
import './theme-command-deck.css';
import Logger from './utils/logger';
import { useRecording } from './hooks/useRecording';
import ErrorBoundary from './components/ErrorBoundary';
import SettingsTab from './components/SettingsTab';
import GameTab from './components/GameTab';
import RecordingsTab from './components/RecordingsTab';
import MapTab from './components/MapTab';
import StatsTab from './components/StatsTab';
import ScreenshotTab from './components/ScreenshotTab';
import {
  APP_ERROR_EVENT,
  APP_TOAST_EVENT,
  CommandPalette,
  RecordingDock,
  StudioTopBar,
  TopErrorToast,
  TopStatusToast,
  WorkspaceStage,
  emitAppError,
  emitAppToast,
  type AppToastPayload,
  type CommandPaletteAction,
  type StudioTheme,
} from './components/WorkspaceShell';
import type { Connection, MapMarker, Position, RoleKey } from './components/MapTab';
import type { GameProcess, Recording, RecordingThumbnails, FavoriteGroup, RecordingNotes, FavoriteRecordingGroups, RecordingQuality } from './types/electron-api';

type ActiveTab = 'games' | 'recordings' | 'settings' | 'entertainment' | 'stats' | 'review' | 'capture';

const THEME_STORAGE_KEY = 'ggd-recorder.theme.v2';
const REVIEW_SPLIT_STORAGE_KEY = 'ggd-recorder.review-split.v1';

const WORKSPACE_SHORTCUTS: Record<string, ActiveTab> = {
  '1': 'games',
  '2': 'recordings',
  '3': 'entertainment',
  '4': 'stats',
  '5': 'capture',
  '6': 'settings',
};

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

const loadInitialTheme = (): StudioTheme => {
  try {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'cream' || saved === 'noir') return saved;
  } catch {
    // Ignore storage errors.
  }
  return 'noir';
};

const loadInitialSplit = (): number => {
  try {
    const saved = Number(window.localStorage.getItem(REVIEW_SPLIT_STORAGE_KEY));
    if (Number.isFinite(saved) && saved >= 28 && saved <= 64) return saved;
  } catch {
    // Ignore storage errors.
  }
  return 44;
};

function App() {
  const [gameProcesses, setGameProcesses] = useState<GameProcess[]>([]);
  const [selectedGame, setSelectedGame] = useState<GameProcess | null>(null);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [activeTab, setActiveTab] = useState<ActiveTab>('games');
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [topError, setTopError] = useState('');
  const [statusToast, setStatusToast] = useState<AppToastPayload | null>(null);
  const [theme, setTheme] = useState<StudioTheme>(loadInitialTheme);
  const [miniMode, setMiniMode] = useState(false);
  const [reviewSplitRatio, setReviewSplitRatio] = useState<number>(loadInitialSplit);
  const [isDraggingSplit, setIsDraggingSplit] = useState(false);
  const [pendingRecordingId, setPendingRecordingId] = useState<string | null>(null);
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

  const mainStageRef = useRef<HTMLElement | null>(null);
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
    onRecordingSaved: () => {
      loadRecordings(true);
      emitAppToast('录像已写入本地录像影院', 'success', '录制完成');
    },
  });

  // Sync theme to document root for scrollbars & native popups
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Ignore storage errors.
    }
  }, [theme]);

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
        // Ignore storage errors.
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

  useEffect(() => { isRecordingRef.current = isRecording; }, [isRecording]);
  useEffect(() => { selectedGameRef.current = selectedGame; }, [selectedGame]);
  useEffect(() => { recordingQualityRef.current = recordingQuality; }, [recordingQuality]);

  useEffect(() => {
    window.electronAPI.updateRecordingFloatState({
      isRecording,
      isPaused,
      recordingTime,
      gameName: selectedGame?.name || '',
    });
  }, [isRecording, isPaused, recordingTime, selectedGame?.name]);

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
    const handleAppToast = (event: Event) => {
      const detail = (event as CustomEvent<AppToastPayload>).detail;
      if (!detail?.message) return;
      setStatusToast(detail);
      window.setTimeout(() => {
        setStatusToast(current => (current?.id === detail.id ? null : current));
      }, 3200);
    };
    window.addEventListener(APP_ERROR_EVENT, handleAppError);
    window.addEventListener(APP_TOAST_EVENT, handleAppToast);
    return () => {
      window.removeEventListener(APP_ERROR_EVENT, handleAppError);
      window.removeEventListener(APP_TOAST_EVENT, handleAppToast);
    };
  }, []);

  useEffect(() => {
    if (recordingError) emitAppError(recordingError);
  }, [recordingError]);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return [h, m, s].map(v => String(v).padStart(2, '0')).join(':');
  };

  const navigateWorkspace = (workspace: ActiveTab) => {
    setCommandPaletteOpen(false);
    if (miniMode && (workspace === 'review' || workspace === 'entertainment' || workspace === 'stats' || workspace === 'capture')) {
      setMiniMode(false);
      window.electronAPI.resizeWindow(1240, 820);
    }
    setActiveTab(workspace);
    if (workspace === 'recordings') loadRecordings();
  };

  useEffect(() => {
    const handleCommandShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setCommandPaletteOpen(open => !open);
        return;
      }
      if (event.key === 'Escape') {
        setCommandPaletteOpen(false);
        return;
      }
      if ((event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey) {
        const target = event.target as HTMLElement | null;
        if (target?.closest('input, textarea, select')) return;
        const nextWorkspace = WORKSPACE_SHORTCUTS[event.key];
        if (nextWorkspace) {
          event.preventDefault();
          navigateWorkspace(nextWorkspace);
        }
      }
    };
    window.addEventListener('keydown', handleCommandShortcut);
    return () => window.removeEventListener('keydown', handleCommandShortcut);
  }, [miniMode]);

  useEffect(() => {
    loadGameProcesses();
    loadRecordings();
    loadingConfig();
    loadFavoriteRecordings();

    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    const handleStartRecordingShortcut = () => {
      if (selectedGameRef.current && !isRecordingRef.current) {
        startRecording(selectedGameRef.current, recordingQualityRef.current);
      }
    };

    const handleStopRecordingShortcut = () => {
      if (isRecordingRef.current) {
        stopRecording();
      }
    };

    window.electronAPI.onStartRecordingShortcut(handleStartRecordingShortcut);
    window.electronAPI.onStopRecordingShortcut(handleStopRecordingShortcut);

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
      // Auto-lock Goose Goose Duck if detected and nothing is selected yet
      if (!selectedGameRef.current) {
        const ggd = processes.find(p => p.name.toLowerCase().includes('duck'));
        if (ggd) setSelectedGame(ggd);
      }
      Logger.info(`Loaded ${processes.length} game processes`);
    } catch (error) {
      Logger.error('Error loading game processes:', error);
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

  const loadRecordings = async (forceRefresh = false) => {
    try {
      const now = Date.now();
      if (!forceRefresh && (now - lastRefreshTimeRef.current) < REFRESH_DEBOUNCE_MS) {
        Logger.info('Skipping recordings refresh (debounced)');
        return;
      }

      if (recordings == null && recordingsCacheRef.current == null) {
        const recordingsList = await window.electronAPI.getRecordings();
        recordingsCacheRef.current = recordingsList;
        setRecordings(recordingsList);
        loadRecordingThumbnails(recordingsList.slice(0, 4));
        Logger.info(`Loaded ${recordingsList.length} recordings (updated)`);
      } else {
        setRecordings(recordingsCacheRef.current);
        Logger.info(`Loaded ${recordingsCacheRef.current.length} recordings (loaded with cache)`);
        const recordingsList = window.electronAPI.getRecordings();
        recordingsList.then(list => {
          const hasChanges = JSON.stringify(list) !== JSON.stringify(recordingsCacheRef.current);
          if (hasChanges) {
            recordingsCacheRef.current = list;
            setRecordings(list);
            loadRecordingThumbnails(list.slice(0, 4));
            Logger.info(`Async Loaded ${list.length} recordings (updated)`);
          } else {
            Logger.info(`Async Loaded ${list.length} recordings (no changes, skipped update)`);
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

  const handleRecordingQualityChange = async (quality: RecordingQuality) => {
    if (quality === recordingQuality) return;
    const prev = recordingQuality;
    setRecordingQuality(quality);
    const result = await window.electronAPI.setRecordingQualityConfig(quality);
    if (!result.success) {
      setRecordingQuality(prev);
      emitAppError('保存画质预设失败');
    } else {
      const labels: Record<RecordingQuality, string> = {
        performance: '流畅 (30 FPS)',
        balanced: '均衡 (60 FPS)',
        quality: '高清 (60 FPS+)',
      };
      emitAppToast(`录制画质已切换为 ${labels[quality]}`, 'success');
    }
  };

  const handleToggleTheme = () => {
    setTheme(prev => {
      const next: StudioTheme = prev === 'noir' ? 'cream' : 'noir';
      emitAppToast(next === 'cream' ? '已切换至奶油桌游浅色风' : '已切换至暖黑侦探俱乐部', 'info', '主题切换');
      return next;
    });
  };

  const handleToggleMiniMode = () => {
    setMiniMode(prev => {
      const next = !prev;
      if (next) {
        if (activeTab !== 'games' && activeTab !== 'recordings' && activeTab !== 'settings') {
          setActiveTab('games');
        }
        window.electronAPI.resizeWindow(460, 760);
        emitAppToast('已切换为迷你侧边录制窗', 'info');
      } else {
        window.electronAPI.resizeWindow(1240, 820);
        emitAppToast('已恢复完整宽屏演播室', 'info');
      }
      return next;
    });
  };

  // Draggable split divider for Review Mode
  const handleStartSplitDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDraggingSplit(true);
    const stage = mainStageRef.current;
    if (!stage) return;

    const handleMove = (moveEvent: PointerEvent) => {
      const rect = stage.getBoundingClientRect();
      if (rect.width <= 0) return;
      const pct = ((moveEvent.clientX - rect.left) / rect.width) * 100;
      const clamped = Math.max(28, Math.min(64, Math.round(pct * 10) / 10));
      setReviewSplitRatio(clamped);
    };

    const handleUp = () => {
      setIsDraggingSplit(false);
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      setReviewSplitRatio(current => {
        try {
          window.localStorage.setItem(REVIEW_SPLIT_STORAGE_KEY, String(current));
        } catch {
          // Ignore storage errors.
        }
        return current;
      });
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
  };

  const handleMinimize = () => window.electronAPI.windowMinimize();
  const handleMaximize = () => {
    window.electronAPI.windowMaximize();
    setIsMaximized(!isMaximized);
  };
  const handleClose = () => window.electronAPI.windowClose();

  const startGame = async () => {
    try {
      const result = await window.electronAPI.startGame(gamePath);
      if (!result.success) {
        emitAppError('请先在设置中选择正确的游戏程序路径');
      } else {
        emitAppToast('正在启动游戏程序…', 'success', '启动游戏');
      }
    } catch (error) {
      Logger.error('Error starting game:', error);
      emitAppError('启动游戏失败，请检查路径配置');
    }
  };

  const openRecordingsDirectory = async () => {
    if (!recordingsDir) {
      const r = await window.electronAPI.getRecordingsDir();
      if (r.success && r.recordingsDir) {
        await window.electronAPI.openDir(r.recordingsDir);
        return;
      }
    }
    if (recordingsDir) {
      await window.electronAPI.openDir(recordingsDir);
    }
  };

  useEffect(() => {
    if (selectedGame) {
      window.electronAPI.setRecordingTarget({ name: selectedGame.name, pid: selectedGame.pid });
    }
  }, [selectedGame]);

  const recordingTimeLabel = formatTime(recordingTime);

  const commandActions: CommandPaletteAction[] = [
    { id: 'go-record', label: '打开录制台', detail: '双栏导播台与窗口雷达', shortcut: 'Ctrl+1', icon: 'record', category: '工作区', keywords: 'record capture game 录制 游戏', run: () => navigateWorkspace('games') },
    { id: 'go-library', label: '打开录像影院', detail: '16:9 海报库与时间戳复盘笔记', shortcut: 'Ctrl+2', icon: 'film', category: '工作区', keywords: 'library video replay 录像 回放 影院', run: () => navigateWorkspace('recordings') },
    { id: 'go-annotate', label: '打开推理沙盘', detail: '13 张鹅鸭杀地图标记、连线与轨迹', shortcut: 'Ctrl+3', icon: 'map', category: '工作区', keywords: 'map annotate deduction 地图 标注 推理 沙盘', run: () => navigateWorkspace('entertainment') },
    { id: 'go-stats', label: '打开战绩档案', detail: '查询 Gaggle 生涯统计与回合投票', shortcut: 'Ctrl+4', icon: 'chart', category: '工作区', keywords: 'stats gaggle match 战绩 统计', run: () => navigateWorkspace('stats') },
    { id: 'go-capture', label: '打开截图标注', detail: '框选桌面区域并绘制批注', shortcut: 'Ctrl+5', icon: 'image', category: '工作区', keywords: 'screenshot capture 截图 批注', run: () => navigateWorkspace('capture') },
    { id: 'go-review', label: '进入分屏复盘模式', detail: '左侧录像影院 + 右侧推理沙盘（可拖拽调宽）', icon: 'split', category: '复盘', keywords: 'review split 复盘 分屏', run: () => navigateWorkspace('review') },
    { id: 'go-settings', label: '打开系统设置', detail: '保存路径、录制画质与引擎诊断', shortcut: 'Ctrl+6', icon: 'settings', category: '工作区', keywords: 'settings config 设置 编码', run: () => navigateWorkspace('settings') },
    {
      id: 'toggle-theme',
      label: theme === 'noir' ? '切换为奶油桌游浅色主题' : '切换为暖黑侦探深色主题',
      detail: '暖黑黑胶俱乐部 ↔ 温润奶油桌游绘本风',
      icon: theme === 'noir' ? 'sun' : 'moon',
      category: '外观',
      keywords: 'theme dark light cream noir 主题 浅色 深色 配色',
      run: handleToggleTheme,
    },
    {
      id: 'toggle-mini',
      label: miniMode ? '恢复完整宽屏演播室' : '切换为迷你侧边录制窗',
      detail: miniMode ? '恢复 1240×820 宽屏双栏工作台' : '收拢为 460×760 轻量录制小窗',
      icon: miniMode ? 'maximize' : 'minimize',
      category: '外观',
      keywords: 'mini compact window 迷你 小窗 宽屏',
      run: handleToggleMiniMode,
    },
    {
      id: 'refresh-processes',
      label: '刷新窗口雷达',
      detail: '重新扫描运行中的游戏进程',
      icon: 'refresh',
      category: '快捷',
      keywords: 'refresh process 刷新 进程',
      run: () => {
        loadGameProcesses();
        emitAppToast('已刷新窗口雷达', 'info');
      },
    },
    ...(gamePath ? [{
      id: 'launch-game',
      label: '一键启动游戏',
      detail: gamePath,
      icon: 'rocket' as const,
      category: '快捷',
      keywords: 'launch start game 启动 游戏',
      run: startGame,
    }] : []),
    ...(!isRecording && selectedGame ? [{
      id: 'start-recording',
      label: `开始录制 ${selectedGame.name}`,
      detail: '立即启动高帧率画面与声音捕捉',
      shortcut: 'Ctrl+Shift+S',
      icon: 'record' as const,
      category: '录制',
      keywords: 'start record 开始 录制',
      run: () => startRecording(selectedGame, recordingQuality),
    }] : []),
    ...(isRecording ? [
      {
        id: 'toggle-pause',
        label: isPaused ? '继续当前录制' : '暂停当前录制',
        detail: `${selectedGame?.name || '当前游戏'} · ${recordingTimeLabel}`,
        icon: (isPaused ? 'play' : 'pause') as 'play' | 'pause',
        category: '录制',
        keywords: 'pause resume 暂停 继续',
        run: togglePause,
      },
      {
        id: 'stop-recording',
        label: '结束录制并保存',
        detail: '保存录像文件至本地录像影院',
        shortcut: 'Ctrl+Shift+D',
        icon: 'stop' as const,
        category: '录制',
        keywords: 'stop finish 结束 停止 录制',
        run: stopRecording,
      },
    ] : []),
  ];

  const handleOpenRecentRecording = (rec: Recording, enterReview = false) => {
    setPendingRecordingId(rec.id);
    navigateWorkspace(enterReview ? 'review' : 'recordings');
  };

  return (
    <div
      className={`app studio-app ${isRecording ? 'is-recording' : ''} ${miniMode ? 'is-mini' : ''}`}
      data-theme={theme}
    >
      <StudioTopBar
        activeWorkspace={activeTab}
        recordingsCount={recordings.length}
        isRecording={isRecording}
        isPaused={isPaused}
        recordingTimeLabel={recordingTimeLabel}
        theme={theme}
        miniMode={miniMode}
        isMaximized={isMaximized}
        onNavigate={navigateWorkspace}
        onToggleTheme={handleToggleTheme}
        onToggleMiniMode={handleToggleMiniMode}
        onOpenCommand={() => setCommandPaletteOpen(true)}
        onMinimize={handleMinimize}
        onMaximize={handleMaximize}
        onClose={handleClose}
      />

      <div className="studio-canvas">
        <WorkspaceStage>
          <ErrorBoundary>
            <main
              ref={mainStageRef}
              className={`app-main ${activeTab === 'review' ? 'review-mode' : ''} ${isDraggingSplit ? 'is-resizing-split' : ''}`}
              style={
                activeTab === 'review'
                  ? ({ '--review-split-left': `${reviewSplitRatio}%` } as React.CSSProperties)
                  : undefined
              }
            >
              <div className={`tab-pane workspace-pane recordings-pane ${activeTab === 'recordings' || activeTab === 'review' ? 'active' : 'hidden'}`}>
                <RecordingsTab
                  recordings={recordings}
                  recordingThumbnails={recordingThumbnails}
                  favoriteRecordings={favoriteRecordings}
                  recordingNotes={recordingNotes}
                  favoriteGroups={favoriteGroups}
                  favoriteRecordingGroups={favoriteRecordingGroups}
                  initialSelectedRecordingId={pendingRecordingId}
                  isReviewMode={activeTab === 'review'}
                  onConsumeInitialRecording={() => setPendingRecordingId(null)}
                  onLoadThumbnails={loadRecordingThumbnails}
                  onRefreshRecordings={() => loadRecordings(true)}
                  onRefreshFavorites={() => loadFavoriteRecordings()}
                  onEnterReview={() => navigateWorkspace('review')}
                />
              </div>

              {activeTab === 'review' && (
                <div
                  className="review-split-handle"
                  role="separator"
                  aria-orientation="vertical"
                  aria-label="拖拽调整录像与地图分屏比例"
                  title="左右拖拽调整分屏比例"
                  onPointerDown={handleStartSplitDrag}
                >
                  <span aria-hidden="true" />
                </div>
              )}

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
                  recordingTimeLabel={recordingTimeLabel}
                  recordingError={recordingError}
                  gamePath={gamePath}
                  recordingsDir={recordingsDir}
                  recordingQuality={recordingQuality}
                  recentRecordings={recordings}
                  recordingThumbnails={recordingThumbnails}
                  miniMode={miniMode}
                  onSelectGame={setSelectedGame}
                  onRefreshProcesses={loadGameProcesses}
                  onStartRecording={game => startRecording(game, recordingQuality)}
                  onStopRecording={stopRecording}
                  onPauseResume={togglePause}
                  onStartGame={startGame}
                  onRecordingQualityChange={handleRecordingQualityChange}
                  onOpenRecordingsDir={openRecordingsDirectory}
                  onOpenCapture={() => navigateWorkspace('capture')}
                  onOpenLibrary={() => navigateWorkspace('recordings')}
                  onOpenRecording={handleOpenRecentRecording}
                />
              ) : activeTab === 'settings' ? (
                <SettingsTab
                  recordingsDir={recordingsDir}
                  gamePath={gamePath}
                  recordingQuality={recordingQuality}
                  onRecordingsDirChange={dir => { setRecordingsDir(dir); loadRecordings(true); }}
                  onGamePathChange={path => setGamePath(path)}
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
        onOpenLibrary={() => navigateWorkspace('recordings')}
      />
      <TopErrorToast message={topError} onClose={() => setTopError('')} />
      <TopStatusToast toast={statusToast} onClose={() => setStatusToast(null)} />
      <CommandPalette
        open={commandPaletteOpen}
        actions={commandActions}
        onClose={() => setCommandPaletteOpen(false)}
      />
    </div>
  );
}

export default App;
