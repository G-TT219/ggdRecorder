import React, { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';
import Logger from './utils/logger';
import SettingsTab from './components/SettingsTab';
import TitleBar from './components/TitleBar';
import GameTab from './components/GameTab';
import RecordingsTab from './components/RecordingsTab';
import MapTab from './components/MapTab';
import StatsTab from './components/StatsTab';

function App() {
  const [gameProcesses, setGameProcesses] = useState([]);
  const [selectedGame, setSelectedGame] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordings, setRecordings] = useState([]);
  const [activeTab, setActiveTab] = useState('games'); // 'games', 'recordings', 'settings', 'entertainment', or 'stats'
  const [recordingsDir, setRecordingsDir] = useState('');
  const [recordingTime, setRecordingTime] = useState(0);
  // apiKey and ggdToken moved to SettingsTab
  const [gamePath, setGamePath] = useState('');
  const [compressVideos, setCompressVideos] = useState(false);
  const [recordingThumbnails, setRecordingThumbnails] = useState({}); // New state for thumbnails
  const [isMaximized, setIsMaximized] = useState(false); // Window maximized state
  const [favoriteRecordings, setFavoriteRecordings] = useState([]); // Favorite recordings
  const compressVideosRef = useRef(compressVideos);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const recordingStartTimeRef = useRef(null);
  const timerIntervalRef = useRef(null);
  const recordingsCacheRef = useRef([]); // Cache for recordings list
  const lastRefreshTimeRef = useRef(0); // Last refresh timestamp
  const REFRESH_DEBOUNCE_MS = 5000; // Minimum time between refreshes (2 seconds)
  // Refs for states that will be accessed in callbacks to avoid stale closures
  const isRecordingRef = useRef(isRecording);
  const isPausedRef = useRef(isPaused);

  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  // Update the ref whenever the state changes
  useEffect(() => {
    compressVideosRef.current = compressVideos;
  }, [compressVideos]);

  // Format time for display (seconds to HH:mm:ss)
  const formatTime = (seconds) => {
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
    if (document.activeElement) {
      document.activeElement.blur();
    }

    window.electronAPI.onStopRecording(() => {
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
      }
    });

    // Load favorite recordings
    loadFavoriteRecordings();

    // Listen for start recording shortcut
    const handleStartRecordingShortcut = () => {
      if (selectedGame && !isRecordingRef.current) {
        startMediaRecording_new(selectedGame);
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
      window.electronAPI.removeAllListeners('stop-recording');
      window.electronAPI.removeAllListeners('start-recording-shortcut');
      window.electronAPI.removeAllListeners('stop-recording-shortcut');
    };
  }, []);

  const loadGameProcesses = async () => {
    try {
      const processes = await window.electronAPI.getGameProcesses();
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
      }
    } catch (error) {
      Logger.error('Error loading favorite recordings:', error);
    }
  };

  const loadRecordingThumbnails = useCallback(async (recordingsList) => {
    const missingRecordings = recordingsList.filter(recording => !recordingThumbnails[recording.id]);
    if (missingRecordings.length === 0) return;

    const loadedThumbnails = {};
    for (const recording of missingRecordings) {
      try {
        const result = await window.electronAPI.generateThumbnail(recording.filePath);
        if (result.success) {
          loadedThumbnails[recording.id] = result.data;
        }
      } catch (error) {
        Logger.error('Error loading thumbnail for:', recording.id, error);
      }
    }

    if (Object.keys(loadedThumbnails).length > 0) {
      setRecordingThumbnails(prev => ({ ...prev, ...loadedThumbnails }));
    }
  }, [recordingThumbnails]);

  const loadingConfig = async () => {
    try {
      const result = await window.electronAPI.getAppConfig();
      if (result.success) {
        Logger.info('Config loaded successfully');
        setGamePath(result.config.gamePath || '');
        setRecordingsDir(result.config.recordingsDir || '');
        setCompressVideos(result.config.compressVideos || false);
      }
    } catch (error) {
      Logger.error('Error loading config:', error);
    }
  };


  const startMediaRecording_new = async (game) => {
    if (!game) {
      Logger.error('No game selected');
      return;
    }
    const sourceName = game.name;
    try {
      Logger.info('Trying getDisplayMedia API...');
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1920, max: 3840 },
          height: { ideal: 1080, max: 2160 },
          frameRate: { ideal: 60, max: 60 },
          cursor: 'always'
        }
      });
      Logger.info('getDisplayMedia succeeded');

      const videoTrack = stream.getVideoTracks()[0];
      const settings = videoTrack.getSettings();
      Logger.info('Actual recording resolution: ' + settings.width + 'x' + settings.height + '@' + settings.frameRate + 'fps');

      const supportedMimeTypes = [
        'video/webm;codecs=vp9',
        'video/webm;codecs=vp8',
        'video/webm'
      ];

      let mimeType = 'video/webm';
      for (const type of supportedMimeTypes) {
        if (MediaRecorder.isTypeSupported(type)) {
          mimeType = type;
          Logger.info('Using codec: ' + type);
          break;
        }
      }

      let options = { mimeType };
      if (mimeType !== 'video/webm') {
        try {
          options = { mimeType, videoBitsPerSecond: 8000000 };
          new MediaRecorder(stream, options);
          Logger.info('Using high bitrate: 8Mbps');
        } catch (e) {
          Logger.warn('videoBitsPerSecond not supported, using default bitrate');
          options = { mimeType };
        }
      }

      mediaRecorderRef.current = new MediaRecorder(stream, options);
      recordedChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = async () => {
        const blob = new Blob(recordedChunksRef.current, { type: mimeType });
        const buffer = await blob.arrayBuffer();

        const now = new Date();
        const chinaTime = new Intl.DateTimeFormat('zh-CN', {
          timeZone: 'Asia/Shanghai',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        }).format(now);

        const filename = sourceName + '_' + chinaTime.replace(/[/: ]/g, '-') + '.webm';
        const shouldCompress = compressVideosRef.current;

        const result = await window.electronAPI.saveRecording(buffer, filename, shouldCompress);
        if (result.success) {
          if (result.warning) { Logger.info(result.warning); }
          loadRecordings(true);
          Logger.info('Recording saved: ' + filename);
        } else {
          Logger.error('Failed to save recording:', result.error);
        }

        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setIsPaused(false);
      recordingStartTimeRef.current = Date.now();
      timerIntervalRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - recordingStartTimeRef.current) / 1000);
        setRecordingTime(elapsed);
      }, 1000);
      Logger.info('High-quality media recording started successfully');
    } catch (error) {
      Logger.error('Error starting media recording:', error);
    }
  };

  const stopRecording = async () => {
    try {
      const result = await window.electronAPI.stopRecording();
      if (result.success) {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
        }
        setIsRecording(false);
        setIsPaused(false);
        // Clear the timer
        if (timerIntervalRef.current) {
          clearInterval(timerIntervalRef.current);
          timerIntervalRef.current = null;
        }
        setRecordingTime(0);
        Logger.info('Recording stopped');
      } else {
        Logger.error('Failed to stop recording:', result.message);
      }
    } catch (error) {
      Logger.error('Error stopping recording:', error);
    }
  };

  // 优化：切换标签时重置非活动标签的滚动位置
  useEffect(() => {
    // 延迟执行，确保 DOM 已更新
    const timer = setTimeout(() => {}, 0);
    return () => clearTimeout(timer);
  }, [activeTab]);

  // 切换到娱乐（地图辅助工具）或战绩查询界面时调整窗口大小
  useEffect(() => {
    if (activeTab === 'entertainment') {
      // 调整为适合地图工具的窗口大小（更宽更高）
      window.electronAPI.resizeWindow(1400, 900);
    } else if (activeTab === 'stats') {
      // 战绩查询界面也需要较大窗口
      window.electronAPI.resizeWindow(1200, 800);
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
        Logger.error('Failed to start game:', result.message);
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
      window.electronAPI.setRecordingTarget(selectedGame.name);
    }
  }, [selectedGame]);

  // Add tooltip to indicate shortcut keys
  useEffect(() => {
    const recordButton = document.querySelector('.record-button');
    const stopButton = document.querySelector('.stop-button');

    if (recordButton) {
      recordButton.title = '快捷键: Ctrl+Shift+S';
    }

    if (stopButton) {
      stopButton.title = '快捷键: Ctrl+Shift+D';
    }
  }, [isRecording]);

  const pauseRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      // Pause the timer
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      Logger.info('Recording paused');
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      // Resume the timer
      timerIntervalRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - recordingStartTimeRef.current) / 1000);
        setRecordingTime(elapsed);
      }, 1000);
      Logger.info('Recording resumed');
    }
  };

  const togglePauseResume = () => {
    if (isPaused) {
      resumeRecording();
    } else {
      pauseRecording();
    }
  };

  return (
    <div className="app">
      <TitleBar isMaximized={isMaximized} onMinimize={handleMinimize} onMaximize={handleMaximize} onClose={handleClose} />

      <header className="app-header">
        <h1>游戏录制助手</h1>
        <div className="tabs">
          <button
            className={activeTab === 'games' ? 'active' : ''}
            onClick={() => setActiveTab('games')}
          >
            游戏录制
          </button>
          <button
            className={activeTab === 'recordings' ? 'active' : ''}
            onClick={() => {
              setActiveTab('recordings');
              loadRecordings();
            }}
          >
            录像回放 ({recordings.length})
          </button>
          <button
            className={activeTab === 'entertainment' ? 'active' : ''}
            onClick={() => setActiveTab('entertainment')}
          >
            地图
          </button>
          <button
            className={activeTab === 'stats' ? 'active' : ''}
            onClick={() => setActiveTab('stats')}
          >
            战绩查询
          </button>
          <button
            className={activeTab === 'settings' ? 'active' : ''}
            onClick={() => setActiveTab('settings')}
          >
            设置
          </button>
        </div>
        {isRecording && (
          <div className="recording-indicator">
            <span className="recording-dot"></span>
            <span>正在录制中...({formatTime(recordingTime)})</span>
          </div>
        )}
      </header>

      <main className="app-main">
        {activeTab === 'games' ? (
          <GameTab
            gameProcesses={gameProcesses}
            selectedGame={selectedGame}
            isRecording={isRecording}
            isPaused={isPaused}
            gamePath={gamePath}
            onSelectGame={setSelectedGame}
            onRefreshProcesses={loadGameProcesses}
            onStartRecording={startMediaRecording_new}
            onStopRecording={stopRecording}
            onPauseResume={togglePauseResume}
            onStartGame={startGame}
          />
        ) : activeTab === 'recordings' ? (
          <RecordingsTab
            recordings={recordings}
            recordingThumbnails={recordingThumbnails}
            favoriteRecordings={favoriteRecordings}
            onLoadThumbnails={loadRecordingThumbnails}
            onRefreshRecordings={() => loadRecordings(true)}
            onRefreshFavorites={() => loadFavoriteRecordings()}
          />
        ) : activeTab === 'entertainment' ? (
          <MapTab />
        ) : activeTab === 'stats' ? (
          <StatsTab />
        ) : (
          <SettingsTab
            recordingsDir={recordingsDir}
            gamePath={gamePath}
            compressVideos={compressVideos}
            onRecordingsDirChange={(dir) => { setRecordingsDir(dir); loadRecordings(true); }}
            onGamePathChange={(path) => setGamePath(path)}
            onCompressVideosChange={(checked) => setCompressVideos(checked)}
          />
        )}
      </main>
    </div>
  );
}

export default App;