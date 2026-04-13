import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import Logger from './utils/logger';

function App() {
  const [gameProcesses, setGameProcesses] = useState([]);
  const [selectedGame, setSelectedGame] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordings, setRecordings] = useState([]);
  const [activeTab, setActiveTab] = useState('games'); // 'games', 'recordings', 'settings', or 'entertainment'
  const [selectedRecording, setSelectedRecording] = useState(null);
  const [recordingData, setRecordingData] = useState(null);
  const [recordingDataBuffers, setRecordingDataBuffers] = useState([]);
  const [recordingsDir, setRecordingsDir] = useState('');
  const [recordingTime, setRecordingTime] = useState(0);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [analyzeStatus, setAnalyzeStatus] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [gamePath, setGamePath] = useState('');
  const [entertainmentUrl, setEntertainmentUrl] = useState('https://www.bilibili.com');
  const [compressVideos, setCompressVideos] = useState(false);
  const [source, setSource] = useState(null)
  const [isFetchingSource, setIsFetchingSource] = useState(false);
  const [recordingThumbnails, setRecordingThumbnails] = useState({}); // New state for thumbnails
  const [selectedRecordings, setSelectedRecordings] = useState([]); // For batch operations
  const [isSelectMode, setIsSelectMode] = useState(false); // Batch selection mode
  const [startDate, setStartDate] = useState(''); // Filter start date
  const [endDate, setEndDate] = useState(''); // Filter end date
  const [isMaximized, setIsMaximized] = useState(false); // Window maximized state
  const [favoriteRecordings, setFavoriteRecordings] = useState([]); // Favorite recordings
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false); // Filter to show only favorites
  const compressVideosRef = useRef(compressVideos);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const recordingStartTimeRef = useRef(null);
  const timerIntervalRef = useRef(null);
  // Refs for states that will be accessed in callbacks to avoid stale closures
  const sourceRef = useRef(source);
  const isRecordingRef = useRef(isRecording);
  const isPausedRef = useRef(isPaused);

  // Update refs when states change
  useEffect(() => {
    sourceRef.current = source;
  }, [source]);

  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  const MAX_LT = 3

  const putRecordingDateBuffer = (filePath, data) => {
    const newBuffers = [...recordingDataBuffers];
    const index = newBuffers.findIndex(buffer => buffer.filePath === filePath);
    if (index == -1) {
      if (newBuffers.length >= MAX_LT) {
        newBuffers.shift()
      }
      newBuffers.push({ filePath, data });
      setRecordingDataBuffers(newBuffers);
    }
  };

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
    loadApiKey();

    window.electronAPI.onStopRecording(() => {
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
      }
    });

    // Load favorite recordings
    loadFavoriteRecordings();

    // Listen for start recording shortcut
    const handleStartRecordingShortcut = () => {
      if (sourceRef.current && !isRecordingRef.current) {
        startMediaRecording(sourceRef.current);
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
      window.electronAPI.removeAllListeners('source-id-selected');
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

  const loadRecordings = async () => {
    try {
      const recordingsList = await window.electronAPI.getRecordings();
      setRecordings(recordingsList);
      Logger.info(`Loaded ${recordingsList.length} recordings`);
      // Load thumbnails for recordings
      loadRecordingThumbnails(recordingsList);
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

  // Function to load thumbnails for all recordings
  const loadRecordingThumbnails = async (recordingsList) => {
    const thumbnails = { ...recordingThumbnails };
    for (const recording of recordingsList) {
      try {
        // Skip if thumbnail already loaded
        if (thumbnails[recording.id]) continue;
        const result = await window.electronAPI.generateThumbnail(recording.filePath);
        if (result.success) {
          thumbnails[recording.id] = result.data;
        }
      } catch (error) {
        Logger.error('Error loading thumbnail for:', recording.id, error);
      }
    }
    setRecordingThumbnails(thumbnails);
  };

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

  const loadRecordingData = async (filePath) => {
    try {
      const result = await window.electronAPI.readRecording(filePath);
      if (result.success) {
        setRecordingData(`data:video/webm;base64,${result.data}`);
        putRecordingDateBuffer(filePath, `data:video/webm;base64,${result.data}`)
      }
    } catch (error) {
      Logger.error('Error loading recording data:', error);
    }
  };

  const startMediaRecording = async (source) => {
    if (!source) {
      Logger.error('No game selected');
      return;
    }
    const { sourceId, sourceName } = source
    try {
      // 获取用户媒体权限，包括音频和视频
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          mandatory: {
            chromeMediaSource: 'desktop'
          }
        },
        video: {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: sourceId,
          }
        }
      });
      mediaRecorderRef.current = new MediaRecorder(stream);
      recordedChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = async () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        const buffer = await blob.arrayBuffer();

        // Generate filename with timestamp in China timezone
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

        const filename = `${sourceName}_${chinaTime.replace(/[/: ]/g, '-')}.webm`;

        // Check if compression is enabled in settings
        // We need to get the current value of compressVideos from the ref
        // since this function was created with a closure around the initial value
        const shouldCompress = compressVideosRef.current;

        const result = await window.electronAPI.saveRecording(buffer, filename, shouldCompress);
        if (result.success) {
          if (result.warning) {
            Logger.info(result.warning);
          }
          loadRecordings(); // Refresh recordings list
          Logger.info(`Recording saved: ${filename}`);
        } else {
          Logger.error('Failed to save recording:', result.error);
        }

        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setIsPaused(false);
      // Start the timer
      recordingStartTimeRef.current = Date.now();
      timerIntervalRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - recordingStartTimeRef.current) / 1000);
        setRecordingTime(elapsed);
      }, 1000);
      Logger.info('Media recording started');
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

  const deleteRecording = async (recording) => {
    try {
      // Check if recording is favorited and show extra confirmation
      const isFavorite = favoriteRecordings.includes(recording.id);
      if (isFavorite) {
        const confirmed = window.confirm(`⚠️ ${recording.name} 已被收藏\n\n确定要删除这个收藏的录像吗？此操作不可恢复。`);
        if (!confirmed) {
          return;
        }
      }

      const result = await window.electronAPI.deleteRecording(recording.id);
      if (result.success) {
        Logger.info('Recording deleted successfully');
        loadRecordings(); // Refresh recordings list
        loadFavoriteRecordings(); // Refresh favorites
        if (selectedRecording && selectedRecording.id === recording.id) {
          setSelectedRecording(null);
          setRecordingData(null);
        }
        // Remove from selected recordings if present
        setSelectedRecordings(selectedRecordings.filter(r => r.id !== recording.id));
      } else {
        Logger.error('Failed to delete recording:', result.error);
      }
    } catch (error) {
      Logger.error('Error deleting recording:', error);
    }
  };

  const toggleFavoriteRecording = async (recording) => {
    try {
      const isFavorite = favoriteRecordings.includes(recording.id);
      const result = await window.electronAPI.toggleFavoriteRecording(recording.id, !isFavorite);
      if (result.success) {
        await loadFavoriteRecordings();
        Logger.info(`Recording ${!isFavorite ? 'added to' : 'removed from'} favorites`);
      } else {
        Logger.error('Failed to toggle favorite:', result.error);
      }
    } catch (error) {
      Logger.error('Error toggling favorite recording:', error);
    }
  };

  const saveFavoriteToDirectory = async (recording) => {
    try {
      const result = await window.electronAPI.saveFavoriteToDirectory(recording.filePath, recording.name);
      if (result.success) {
        Logger.info(`Recording saved to: ${result.savePath}`);
        alert(`录像已保存到: ${result.savePath}`);
      } else if (!result.canceled) {
        Logger.error('Failed to save recording:', result.error);
        alert('保存录像失败: ' + result.error);
      }
    } catch (error) {
      Logger.error('Error saving favorite recording:', error);
      alert('保存录像时发生错误: ' + error.message);
    }
  };

  // Batch delete recordings
  const batchDeleteRecordings = async () => {
    if (selectedRecordings.length === 0) {
      alert('请先选择要删除的录像');
      return;
    }

    if (!window.confirm(`确定要删除选中的 ${selectedRecordings.length} 个录像吗？此操作不可恢复。`)) {
      return;
    }

    try {
      let successCount = 0;
      let failCount = 0;

      for (const recording of selectedRecordings) {
        const result = await window.electronAPI.deleteRecording(recording.id);
        if (result.success) {
          successCount++;
        } else {
          failCount++;
          Logger.error(`Failed to delete ${recording.name}:`, result.error);
        }
      }

      Logger.info(`Batch delete completed: ${successCount} succeeded, ${failCount} failed`);
      
      // Clear selection and refresh list
      setSelectedRecordings([]);
      setIsSelectMode(false);
      loadRecordings();
      
      // Clear selected recording if it was deleted
      if (selectedRecording && selectedRecordings.some(r => r.id === selectedRecording.id)) {
        setSelectedRecording(null);
        setRecordingData(null);
      }
      
      alert(`成功删除 ${successCount} 个录像，${failCount} 个删除失败`);
    } catch (error) {
      Logger.error('Error batch deleting recordings:', error);
      alert('批量删除时发生错误：' + error.message);
    }
  };

  // Toggle selection mode
  const toggleSelectMode = () => {
    if (isSelectMode) {
      setSelectedRecordings([]);
      setStartDate(''); // Clear filter when exiting select mode
      setEndDate('');
    }
    setIsSelectMode(!isSelectMode);
  };

  // Handle start date change with validation
  const handleStartDateChange = (e) => {
    const newStartDate = e.target.value;
    
    if (endDate && newStartDate > endDate) {
      alert('开始日期不能晚于结束日期！');
      return;
    }
    
    setStartDate(newStartDate);
  };

  // Handle end date change with validation
  const handleEndDateChange = (e) => {
    const newEndDate = e.target.value;
    
    if (startDate && newEndDate < startDate) {
      alert('结束日期不能早于开始日期！');
      return;
    }
    
    setEndDate(newEndDate);
  };

  // Filter recordings by date range and favorites
  const filteredRecordings = (startDate || endDate || showFavoritesOnly)
    ? recordings.filter(recording => {
        const recordingDate = new Date(recording.date);

        // Date range filtering
        if (startDate) {
          const startDateObj = new Date(startDate);
          startDateObj.setHours(0, 0, 0, 0);
          if (recordingDate < startDateObj) return false;
        }

        if (endDate) {
          const endDateObj = new Date(endDate);
          endDateObj.setHours(23, 59, 59, 999);
          if (recordingDate > endDateObj) return false;
        }

        // Favorites filtering
        if (showFavoritesOnly && !favoriteRecordings.includes(recording.id)) {
          return false;
        }

        return true;
      })
    : recordings;

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

  // Toggle selection of a recording
  const toggleRecordingSelection = (recording) => {
    if (selectedRecordings.some(r => r.id === recording.id)) {
      setSelectedRecordings(selectedRecordings.filter(r => r.id !== recording.id));
    } else {
      setSelectedRecordings([...selectedRecordings, recording]);
    }
  };

  // Select all recordings
  const selectAllRecordings = () => {
    if (selectedRecordings.length === filteredRecordings.length) {
      setSelectedRecordings([]);
    } else {
      setSelectedRecordings([...filteredRecordings]);
    }
  };

  const selectRecordingsDir = async () => {
    try {
      const result = await window.electronAPI.selectRecordingsDir();
      if (result.success) {
        setRecordingsDir(result.recordingsDir);
        loadRecordings(); // Refresh recordings list
        Logger.info(`Recordings directory changed to: ${result.recordingsDir}`);
      } else if (!result.canceled) {
        Logger.error('Failed to select recordings directory:', result.error);
      }
    } catch (error) {
      Logger.error('Error selecting recordings directory:', error);
    }
  };

  const selectGamePath = async () => {
    try {
      const result = await window.electronAPI.selectGamePath();
      if (result.success) {
        setGamePath(result.gamePath);
        Logger.info(`Game path selected: ${result.gamePath}`);
      } else if (!result.canceled) {
        Logger.error('Failed to select game path:', result.error);
      }
    } catch (error) {
      Logger.error('Error selecting game path:', error);
    }
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

  const openDir = async (path) => {
    try {
      const result = await window.electronAPI.openDir(path);
      if (!result.success) {
        Logger.error('Error opening directory:', result.error);
      } else {
        Logger.info(`Directory opened: ${path}`);
      }
    } catch (error) {
      Logger.error('Error opening directory:', error);
    }
  };

  const getDirname = (path) => {
    const lastSlashIndex = path.lastIndexOf('\\') || path.lastIndexOf('/');
    return lastSlashIndex !== -1 ? path.substring(0, lastSlashIndex) : '';
  };


  const preFetchSource = async (game) => {
    if (!game) return;
    try {
      const result = await window.electronAPI.preFetchSource({
        gameName: game.name
      });
      if (result.success) {
        setSource(result.source);
        Logger.info(`Source fetched for game: ${game.name}`);
        setIsFetchingSource(true);
      } else {
        Logger.error('Failed to fetch source id:', result.error);
      }
    } catch (error) {
      Logger.error('Error fetching source:', error);
    }
  };

  const setCompressVideosConfig = async (e) => {
    setCompressVideos(e.target.checked)
    try {
      window.electronAPI.setCompressVideosConfig(e.target.checked)
      Logger.info(`Compress videos config set to: ${e.target.checked}`);
    } catch (error) {
      Logger.error('Error setting compress videos config:', error);
    }
  };

  const saveApiKey = async () => {
    try {
      const result = await window.electronAPI.saveApiKey(apiKey);
      if (result.success) {
        Logger.info('API key saved successfully');
        alert('API密钥保存成功');
      } else {
        Logger.error('Failed to save API key:', result.error);
        alert('API密钥保存失败: ' + result.error);
      }
    } catch (error) {
      Logger.error('Error saving API key:', error);
      alert('保存API密钥时发生错误: ' + error.message);
    }
  };

  const clearApiKey = async () => {
    if (window.confirm('确定要清除API密钥吗？此操作不可恢复。')) {
      try {
        setApiKey('');
        const result = await window.electronAPI.clearApiKey();
        if (result.success) {
          Logger.info('API key cleared successfully');
          alert('API密钥已清除');
        } else {
          Logger.error('Failed to clear API key:', result.error);
          alert('清除API密钥失败: ' + result.error);
        }
      } catch (error) {
        Logger.error('Error clearing API key:', error);
        alert('清除API密钥时发生错误: ' + error.message);
      }
    }
  };

  const loadApiKey = async () => {
    try {
      const result = await window.electronAPI.loadApiKey();
      if (result.success) {
        setApiKey(result.apiKey || '');
      } else {
        Logger.error('Failed to load API key:', result.error);
      }
    } catch (error) {
      Logger.error('Error loading API key:', error);
    }
  };

  useEffect(() => {
    if (selectedRecording) {
      const result = recordingDataBuffers.find(buffer => buffer.filePath === selectedRecording.filePath)
      if (result) {
        setRecordingData(result.data);
      } else {
        loadRecordingData(selectedRecording.filePath);
      }
    } else {
      setRecordingData(null);
    }
  }, [selectedRecording]);

  useEffect(() => {
    if (selectedGame) {
      preFetchSource(selectedGame);
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
  }, [isFetchingSource, isRecording]);

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

  const analyzeRecording = async (recording) => {
    const analyzeResult = {
      recording: recording
    }
    try {
      setAnalyzeStatus('analyzing');
      const result = await window.electronAPI.analyzeRecording(recording.filePath);
      setAnalyzeStatus('');
      if (result.success) {
        analyzeResult.text = result.text
        setAnalysisResult(analyzeResult);
        Logger.info('Recording analysis completed successfully');
        console.log(analyzeResult)
      } else {
        Logger.error('Recording analysis failed:', result.error);
        analyzeResult.text = `分析失败: ${result.error}`
        setAnalysisResult(analyzeResult);
      }
    } catch (error) {
      Logger.error('Error analyzing recording:', error);
      analyzeResult.text = `分析过程中出现错误: ${error.message}`;
      setAnalysisResult(analyzeResult);
    }
  };

  return (
    <div className="app">
      {/* Custom Title Bar */}
      <div className="custom-titlebar">
        <div className="titlebar-drag-region">
          <span className="app-title">游戏录制助手</span>
        </div>
        <div className="titlebar-controls">
          <button className="titlebar-button" onClick={handleMinimize} title="最小化">
            <svg width="12" height="12" viewBox="0 0 12 12">
              <line x1="0" y1="6" x2="12" y2="6" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </button>
          <button className="titlebar-button" onClick={handleMaximize} title={isMaximized ? '还原' : '最大化'}>
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
          <button className="titlebar-button close-button" onClick={handleClose} title="关闭">
            <svg width="12" height="12" viewBox="0 0 12 12">
              <line x1="1" y1="1" x2="11" y2="11" stroke="currentColor" strokeWidth="1.5" />
              <line x1="11" y1="1" x2="1" y2="11" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </button>
        </div>
      </div>

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
            className={activeTab === 'settings' ? 'active' : ''}
            onClick={() => setActiveTab('settings')}
          >
            设置
          </button>
          <button
            className={activeTab === 'entertainment' ? 'active' : ''}
            onClick={() => setActiveTab('entertainment')}
          >
            娱乐
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
          <>
            <section className="recording-controls">
              <h2>录制控制</h2>
              {isFetchingSource ? (
                <div className="selected-game">
                  <h3>已选择游戏: {selectedGame.name}</h3>
                  <div className="controls">
                    {!isRecording ? (
                      <button className="record-button" onClick={() => startMediaRecording(source)}>
                        开始录制
                      </button>
                    ) : (
                      <div className="recording-controls-group">
                        <button
                          className={`pause-button ${isPaused ? 'resume' : 'pause'}`}
                          onClick={togglePauseResume}
                        >
                          {isPaused ? '继续录制' : '暂停录制'}
                        </button>
                        <button className="stop-button" onClick={stopRecording}>
                          停止录制
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <p>请从下方列表中选择一个游戏程序开始录制</p>
              )}
            </section>
            <section className="game-selection">
              <h2>正在运行的游戏程序 ({gameProcesses.length})</h2>
              <button onClick={loadGameProcesses}>
                刷新
              </button>
              {gameProcesses.length === 0 ? (
                <>
                  <p>没有检测到正在运行的游戏程序，请确保游戏已经启动</p>
                  <button onClick={startGame}>打开游戏</button>
                </>
              ) : (
                <div className="process-list">
                  {gameProcesses.map(process => (
                    <div
                      key={process.pid}
                      className={`process-item ${selectedGame && selectedGame.pid === process.pid ? 'selected' : ''}`}
                      onClick={() => { setSelectedGame(process); }}
                    >
                      <h3>{process.name}</h3>
                      <p>{process.path}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>


          </>
        ) : activeTab === 'recordings' ? (
          <section className="recordings-section">
            {selectedRecording ? (
              <div className="viewer">
                <div className="viewer-header">
                  <button onClick={() => {
                    setSelectedRecording(null);
                    setRecordingData(null);
                  }}>
                    ← 返回列表
                  </button>
                  <h3>{selectedRecording.name}</h3>
                </div>
                <div className="video-container">
                  {recordingData ? (
                    <>
                      <video controls autoPlay>
                        <source src={recordingData} type="video/webm" />
                        您的浏览器不支持视频播放。
                      </video>
                      <div className="analysis-controls">
                        <button onClick={() => analyzeRecording(selectedRecording)}>分析录像</button>
                        {analyzeStatus === 'analyzing' && (
                          <p>正在分析录像...</p>
                        )}
                        {analysisResult && analysisResult.recording.id === selectedRecording.id && (
                          <div className="analysis-result">
                            <h4>分析结果:</h4>
                            <textarea
                              value={analysisResult.text}
                              readOnly
                              rows={6}
                              className="analysis-textarea"
                            />
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <p>正在加载录像...</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="recordings-list">
                <div className="recordings-list-header">
                  <h2>录像列表</h2>
                  <div className="batch-controls">
                    {!isSelectMode ? (
                      <div className="view-controls">
                        <button
                          onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                          className={`favorites-filter-button ${showFavoritesOnly ? 'active' : ''}`}
                        >
                          {showFavoritesOnly ? '⭐ 仅显示收藏' : '☆ 显示收藏'}
                        </button>
                        <button onClick={toggleSelectMode} className="select-mode-button">
                          批量操作
                        </button>
                      </div>
                    ) : (
                      <div className="batch-actions">
                        <div className="date-range-filter">
                          <input
                            type="date"
                            value={startDate}
                            onChange={handleStartDateChange}
                            className="date-filter-input"
                            title="开始日期"
                            placeholder="开始日期"
                          />
                          <span className="date-separator">至</span>
                          <input
                            type="date"
                            value={endDate}
                            onChange={handleEndDateChange}
                            className="date-filter-input"
                            title="结束日期"
                            placeholder="结束日期"
                          />
                        </div>
                        <span className="selected-count">已选择 {selectedRecordings.length} / {filteredRecordings.length} 项</span>
                        <button onClick={selectAllRecordings} className="select-all-button">
                          {selectedRecordings.length === filteredRecordings.length ? '取消全选' : '全选'}
                        </button>
                        <button onClick={batchDeleteRecordings} className="batch-delete-button" disabled={selectedRecordings.length === 0}>
                          批量删除
                        </button>
                        <button onClick={toggleSelectMode} className="cancel-select-button">
                          取消
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                {recordings.length === 0 ? (
                  <p>暂无录像文件</p>
                ) : (
                  filteredRecordings.map(recording => (
                    <div
                      key={recording.id}
                      className={`recording-item ${isSelectMode ? 'clickable' : ''} ${isSelectMode && selectedRecordings.some(r => r.id === recording.id) ? 'selected' : ''} ${favoriteRecordings.includes(recording.id) ? 'favorite' : ''}`}
                      onClick={() => isSelectMode && toggleRecordingSelection(recording)}
                    >
                      <div className="recording-thumbnail">
                        {isSelectMode && (
                          <input
                            type="checkbox"
                            checked={selectedRecordings.some(r => r.id === recording.id)}
                            onChange={(e) => e.stopPropagation()}
                            className="recording-checkbox"
                          />
                        )}
                        {recordingThumbnails[recording.id] ? (
                          <img
                            src={`data:image/png;base64,${recordingThumbnails[recording.id]}`}
                            alt={`${recording.name} thumbnail`}
                            className="recording-thumbnail-image"
                          />
                        ) : (
                          <div className="play-icon">▶</div>
                        )}
                        {favoriteRecordings.includes(recording.id) && (
                          <div className="favorite-indicator">⭐</div>
                        )}
                      </div>
                      <div className="recording-info" onClick={(e) => e.stopPropagation()}>
                        <h3>{recording.name}</h3>
                        <p>{new Date(recording.date).toLocaleString('zh-CN')}</p>
                        {!isSelectMode && (
                          <div className="recording-actions">
                            <button
                              className="play-button"
                              onClick={() => setSelectedRecording(recording)}
                            >
                              播放
                            </button>
                            <button
                              className={`favorite-button ${favoriteRecordings.includes(recording.id) ? 'favorited' : ''}`}
                              onClick={() => toggleFavoriteRecording(recording)}
                              title={favoriteRecordings.includes(recording.id) ? '取消收藏' : '添加收藏'}
                            >
                              {favoriteRecordings.includes(recording.id) ? '★' : '☆'}
                            </button>
                            {favoriteRecordings.includes(recording.id) && (
                              <button
                                className="save-favorite-button"
                                onClick={() => saveFavoriteToDirectory(recording)}
                                title="另存到指定目录"
                              >
                                另存
                              </button>
                            )}
                            <button
                              className="delete-button"
                              onClick={() => deleteRecording(recording)}
                            >
                              删除
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </section>
        ) : activeTab === 'entertainment' ? (
          <section className="entertainment-section">
            <h2>娱乐浏览</h2>
            <div className="browser-container">
              <div className="browser-controls">
                <input
                  type="text"
                  value={entertainmentUrl}
                  onChange={(e) => setEntertainmentUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      // Reload the iframe with new URL
                      const iframe = document.getElementById('entertainment-browser');
                      if (iframe) {
                        iframe.src = entertainmentUrl;
                      }
                    }
                  }}
                  placeholder="输入网址后按回车访问"
                />
                <button onClick={() => {
                  const iframe = document.getElementById('entertainment-browser');
                  if (iframe) {
                    iframe.src = entertainmentUrl;
                  }
                }}>
                  访问
                </button>
              </div>
              <iframe
                id="entertainment-browser"
                src={entertainmentUrl}
                title="娱乐浏览器"
                allowFullScreen
              />
            </div>
          </section>
        ) : (
          <section className="settings-section">
            <h2>设置</h2>
            <div className="settings-container">
              <div className="setting-item">
                <label htmlFor="recordings-dir">录像保存路径:</label>
                <div className="setting-input">
                  <input
                    type="text"
                    id="recordings-dir"
                    value={recordingsDir}
                    readOnly
                  />
                  <button onClick={() => { openDir(recordingsDir) }}>打开文件位置</button>
                  <button onClick={selectRecordingsDir}>选择路径</button>
                </div>
                <p className="setting-description">
                  选择录像文件保存的位置。当前保存路径: {recordingsDir || '默认路径'}
                </p>
              </div>
              <div className="setting-item">
                <label>
                  <input
                    type="checkbox"
                    checked={compressVideos}
                    onChange={(e) => { setCompressVideosConfig(e) }}
                  />
                  启用视频压缩
                </label>
                <p className="setting-description">
                  压缩视频可以减小文件大小，但会增加处理时间。当前状态: {compressVideos ? '已启用' : '已禁用'}
                </p>
              </div>
              <div className="setting-item">
                <label htmlFor="game-path">游戏程序路径:</label>
                <div className="setting-input">
                  <input
                    type="text"
                    id="game-path"
                    value={gamePath}
                    readOnly
                  />
                  <button onClick={() => { openDir(getDirname(gamePath)) }}>打开文件位置</button>
                  <button onClick={selectGamePath}>选择路径</button>
                </div>
              </div>
              <div className="setting-item">
                <label htmlFor="api-key">AI API密钥:</label>
                <div className="setting-input">
                  <input
                    type="password"
                    id="api-key"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="请输入API密钥"
                  />
                  <button onClick={saveApiKey}>保存密钥</button>
                  <button onClick={clearApiKey}>清除密钥</button>
                </div>
                <p className="setting-description">
                  用于AI视频分析功能的API密钥。当前状态: {apiKey ? '已设置' : '未设置'}
                </p>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

export default App;