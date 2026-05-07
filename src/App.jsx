import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import Logger from './utils/logger';

function App() {
  const [gameProcesses, setGameProcesses] = useState([]);
  const [selectedGame, setSelectedGame] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordings, setRecordings] = useState([]);
  const [activeTab, setActiveTab] = useState('games'); // 'games', 'recordings', 'settings', 'entertainment', or 'stats'
  const [selectedRecording, setSelectedRecording] = useState(null);
  const [recordingData, setRecordingData] = useState(null);
  // const [recordingsListRef, setRecordingsListRef] = useState(null);
  const [listScrollPosition, setListScrollPosition] = useState(0);
  const [recordingDataBuffers, setRecordingDataBuffers] = useState([]);
  const [recordingsDir, setRecordingsDir] = useState('');
  const [recordingTime, setRecordingTime] = useState(0);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [analyzeStatus, setAnalyzeStatus] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [ggdToken, setGgdToken] = useState(''); // GGD API Token
  const [gamePath, setGamePath] = useState('');
  const [entertainmentUrl, setEntertainmentUrl] = useState('https://www.bilibili.com');
  const [statsUrl, setStatsUrl] = useState('https://gaggle.fun/dashboard'); // 游戏官方战绩网页
  const [iframeError, setIframeError] = useState(false); // iframe 加载错误状态
  const [matchData, setMatchData] = useState(null); // 对局数据
  const [matchLoading, setMatchLoading] = useState(false); // 加载状态
  const [matchError, setMatchError] = useState(''); // 错误信息
  const [matchIdInput, setMatchIdInput] = useState(''); // 对局ID输入
  const [matchHistory, setMatchHistory] = useState([]); // 最近对局历史
  const [matchHistoryLoading, setMatchHistoryLoading] = useState(false); // 历史加载状态
  const [matchHistoryError, setMatchHistoryError] = useState(''); // 历史错误信息
  const [userIdInput, setUserIdInput] = useState(''); // 用户ID输入
  const [selectedMatchId, setSelectedMatchId] = useState(null); // 当前选中的对局ID
  const [playerStats, setPlayerStats] = useState(null); // 玩家统计数据
  // 地图辅助工具状态
  const [selectedMap, setSelectedMap] = useState(1); // 当前选择的地图
  const [currentSequence, setCurrentSequence] = useState(1); // 当前序列号
  const [mapMarkers, setMapMarkers] = useState([]); // 地图标记点
  const [draggedNumber, setDraggedNumber] = useState(null); // 正在拖拽的数字（从工具栏）
  const [isDragging, setIsDragging] = useState(false); // 是否正在拖拽中
  const [draggingMarkerId, setDraggingMarkerId] = useState(null); // 正在拖拽的标记ID（地图上的）
  const [markerOffset, setMarkerOffset] = useState({ x: 0, y: 0 }); // 拖拽偏移量
  const [mouseDownPos, setMouseDownPos] = useState({ x: 0, y: 0 }); // 鼠标按下位置
  const [hasMoved, setHasMoved] = useState(false); // 是否已经移动过（用于区分点击和拖拽）
  const [isInDeleteZone, setIsInDeleteZone] = useState(false); // 是否在删除区域
  const [selectedNumberForRole, setSelectedNumberForRole] = useState(null); // 当前选中的数字（用于设置身份）
  const [roleAssignments, setRoleAssignments] = useState({}); // 角色身份分配 { number: role }
  const [connections, setConnections] = useState([]); // 连线关系 [{ from: markerId, to: markerId }]
  const [drawingConnection, setDrawingConnection] = useState(null); // 正在绘制连线的起始标记 { markerId, x, y }
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 }); // 鼠标当前位置（用于绘制临时连线）
  const [hoveredConnection, setHoveredConnection] = useState(null); // 当前悬停的连线索引
  const mapContainerRef = useRef(null); // 地图容器引用
  const deleteZoneRef = useRef(null); // 删除区域引用
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
  const [isRefreshingRecordings, setIsRefreshingRecordings] = useState(false); // Refreshing state
  const [currentPage, setCurrentPage] = useState(1); // Current page number
  const [totalPages, setTotalPages] = useState(1); // Total pages count
  const [recordingsPerPage] = useState(20); // Records per page (configurable)
  const compressVideosRef = useRef(compressVideos);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const recordingStartTimeRef = useRef(null);
  const timerIntervalRef = useRef(null);
  const recordingsListRef = useRef(null); // Reference to recordings list container
  const gamesSectionRef = useRef(null); // Reference to games section
  const settingsSectionRef = useRef(null); // Reference to settings section
  const entertainmentSectionRef = useRef(null); // Reference to entertainment section
  const scrollRAFRef = useRef(null); // For scroll event optimization
  const recordingsCacheRef = useRef([]); // Cache for recordings list
  const lastRefreshTimeRef = useRef(0); // Last refresh timestamp
  const REFRESH_DEBOUNCE_MS = 5000; // Minimum time between refreshes (2 seconds)
  // Refs for states that will be accessed in callbacks to avoid stale closures
  const sourceRef = useRef(source);
  const isRecordingRef = useRef(isRecording);
  const isPausedRef = useRef(isPaused);

  const mapNameMapping = {
    1: '地下室',
    2: '鹅教堂',
    3: '马拉德庄园',
    4: '连结殖民地',
    5: '黑天鹅',
    6: '鹅飞船',
    7: '神庙',
    8: '沙漠',
    9: '血夜港湾',
    10: '伊格尔顿泉',
    11: '伊格尔顿泉-下水道',
    12: '嘉年华',
    13: '绿头鸭',
  };

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
    loadGgdToken();

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

  const loadRecordings = async (forceRefresh = false) => {
    try {
      // Check if we should skip refresh due to debounce
      const now = Date.now();
      if (!forceRefresh && (now - lastRefreshTimeRef.current) < REFRESH_DEBOUNCE_MS) {
        Logger.info('Skipping recordings refresh (debounced)');
        return;
      }

      setIsRefreshingRecordings(true);

      if (recordings == null && recordingsCacheRef.current == null) {
        const recordingsList = await window.electronAPI.getRecordings();
        recordingsCacheRef.current = recordingsList;
        setRecordings(recordingsList);

        // Calculate pagination
        const { total, pages } = calculatePagination(recordingsList, recordingsPerPage);
        setTotalPages(pages);

        // Reset to first page if current page exceeds new total
        if (currentPage > pages) {
          setCurrentPage(1);
        }

        Logger.info(`Loaded ${recordingsList.length} recordings (updated)`);
        loadRecordingThumbnails(recordingsList);
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

            // Calculate pagination
            const { total, pages } = calculatePagination(recordingsList, recordingsPerPage);
            setTotalPages(pages);

            // Reset to first page if current page exceeds new total
            if (currentPage > pages) {
              setCurrentPage(1);
            }

            Logger.info(`Async Loaded ${recordingsList.length} recordings (updated)`);
            // Load thumbnails for new/changed recordings
            loadRecordingThumbnails(recordingsList);
          } else {
            Logger.info(`Async Loaded ${recordingsList.length} recordings (no changes, skipped update)`);
          }
          lastRefreshTimeRef.current = now;

        });

      }

      lastRefreshTimeRef.current = now;
    } catch (error) {
      Logger.error('Error loading recordings:', error);
    } finally {
      setIsRefreshingRecordings(false);
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

  const startMediaRecording_new = async (source) => {
    if (!source) {
      Logger.error('No game selected');
      return;
    }
    const { sourceId, sourceName } = source;
    try {
      let stream;

      // 尝试使用 getDisplayMedia（现代 API）
      try {
        Logger.info('Trying getDisplayMedia API...');
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            width: { ideal: 1920, max: 3840 },
            height: { ideal: 1080, max: 2160 },
            frameRate: { ideal: 60, max: 60 },
            cursor: 'always'
          },
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false
          }
        });
        Logger.info('getDisplayMedia succeeded');
      } catch (getDisplayError) {
        // 回退到旧版 getUserMedia API
        Logger.info('getDisplayMedia failed, falling back to getUserMedia:', getDisplayError.message);
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            mandatory: {
              chromeMediaSource: 'desktop'
            }
          },
          video: {
            mandatory: {
              chromeMediaSource: 'desktop',
              chromeMediaSourceId: sourceId,
              minWidth: 1920,          // 最小宽度 1080p
              maxWidth: 3840,          // 最大宽度 4K
              minHeight: 1080,         // 最小高度 1080p
              maxHeight: 2160,         // 最大高度 4K
              maxFrameRate: 60,        // 最高帧率
              minFrameRate: 30         // 最低帧率
            }
          }
        });
        Logger.info('getUserMedia succeeded with high resolution constraints');
      }

      // 检查实际获取到的分辨率
      const videoTrack = stream.getVideoTracks()[0];
      const settings = videoTrack.getSettings();
      Logger.info(`Actual recording resolution: ${settings.width}x${settings.height}@${settings.frameRate}fps`);

      // 配置高质量编码器 - 检测浏览器支持的格式
      const supportedMimeTypes = [
        'video/webm;codecs=vp9',
        'video/webm;codecs=vp8',
        'video/webm'
      ];

      let mimeType = 'video/webm';
      for (const type of supportedMimeTypes) {
        if (MediaRecorder.isTypeSupported(type)) {
          mimeType = type;
          Logger.info(`Using codec: ${type}`);
          break;
        }
      }

      // 先尝试带比特率的配置，如果不支持则回退到默认配置
      let options = { mimeType };

      // 某些浏览器不支持 videoBitsPerSecond，需要检测
      if (mimeType !== 'video/webm') {
        try {
          options = {
            mimeType,
            videoBitsPerSecond: 8000000  // 8Mbps 高码率
          };
          // 测试配置是否有效
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
        const shouldCompress = compressVideosRef.current;

        const result = await window.electronAPI.saveRecording(buffer, filename, shouldCompress);
        if (result.success) {
          if (result.warning) {
            Logger.info(result.warning);
          }
          loadRecordings(true); // Refresh recordings list with force
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
      Logger.info('High-quality media recording started successfully');
    } catch (error) {
      Logger.error('Error starting media recording:', error);
      // 最后的回退：使用原始的低分辨率配置
      try {
        Logger.info('Trying fallback with original method...');
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
          const shouldCompress = compressVideosRef.current;

          const result = await window.electronAPI.saveRecording(buffer, filename, shouldCompress);
          if (result.success) {
            if (result.warning) {
              Logger.info(result.warning);
            }
            loadRecordings(true);
            Logger.info(`Recording saved (fallback): ${filename}`);
          } else {
            Logger.error('Failed to save recording (fallback):', result.error);
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
        Logger.info('Fallback recording started (standard quality)');
      } catch (fallbackError) {
        Logger.error('Fallback recording also failed:', fallbackError);
      }
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
        loadRecordings(true); // Refresh recordings list
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

  // Save scroll position before navigating to player view
  const handleNavigateToPlayer = (recording) => {
    if (recordingsListRef.current) {
      const currentScrollPosition = recordingsListRef.current.scrollTop;
      setListScrollPosition(currentScrollPosition);
    }
    setSelectedRecording(recording);
  };

  // Restore scroll position when returning to list view
  const handleReturnToList = () => {
    setSelectedRecording(null);
    setRecordingData(null);
  };

  // Pagination functions
  const calculatePagination = (filteredRecordings, perPage) => {
    const total = filteredRecordings.length;
    const pages = Math.max(1, Math.ceil(total / perPage));
    return { total, pages };
  };

  const getCurrentPageRecordings = (allRecordings, page, perPage) => {
    if (showFavoritesOnly) return allRecordings
    const startIndex = (page - 1) * perPage;
    const endIndex = startIndex + perPage;
    return allRecordings.slice(startIndex, endIndex);
  };

  const goToPage = (pageNumber) => {
    if (pageNumber >= 1 && pageNumber <= totalPages && pageNumber !== currentPage) {
      setCurrentPage(pageNumber);
      // Reset scroll position when changing pages
      if (recordingsListRef.current) {
        recordingsListRef.current.scrollTop = 0;
      }
    }
  };

  const goToNextPage = () => {
    if (currentPage < totalPages) {
      goToPage(currentPage + 1);
    }
  };

  const goToPreviousPage = () => {
    if (currentPage > 1) {
      goToPage(currentPage - 1);
    }
  };

  // 优化：切换标签时重置非活动标签的滚动位置
  useEffect(() => {
    // 重置所有 section 的滚动位置
    const resetScrollPositions = () => {
      // 重置游戏录制区域（如果不是当前标签）
      if (activeTab === 'games' && gamesSectionRef.current) {
        gamesSectionRef.current.scrollTop = 0;
      }
      
      // 重置设置区域（如果不是当前标签）
      if (activeTab === 'settings' && settingsSectionRef.current) {
        settingsSectionRef.current.scrollTop = 0;
      }
      
      // 重置娱乐区域（如果不是当前标签）
      if (activeTab === 'entertainment' && entertainmentSectionRef.current) {
        entertainmentSectionRef.current.scrollTop = 0;
      }
      
      // 录像列表特殊处理：从其他标签返回时恢复滚动位置
      if (activeTab === 'recordings' && !selectedRecording && recordingsListRef.current) {
        // 如果之前有保存的滚动位置，则恢复
        if (listScrollPosition > 0) {
          recordingsListRef.current.scrollTop = listScrollPosition;
        } else {
          // 否则重置为 0
          recordingsListRef.current.scrollTop = 0;
        }
      } else if (activeTab !== 'recordings' && recordingsListRef.current && !selectedRecording) {
        // 离开录像列表时重置（但不在详情视图）
        recordingsListRef.current.scrollTop = 0;
      }
    };

    // 延迟执行，确保 DOM 已更新
    const timer = setTimeout(resetScrollPositions, 0);
    return () => clearTimeout(timer);
  }, [activeTab, selectedRecording]);

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

  const handleRecordingsListScroll = (e) => {
    // 使用 requestAnimationFrame 减少更新频率
    if (scrollRAFRef.current) {
      cancelAnimationFrame(scrollRAFRef.current);
    }
    
    scrollRAFRef.current = requestAnimationFrame(() => {
      const scrollTop = e.target.scrollTop;
      if (scrollTop > 0) {
        setListScrollPosition(scrollTop);
      }
    });
  };

  // 地图标记拖拽处理
  const handleMarkerMouseDown = (e, markerId) => {
    e.preventDefault();
    e.stopPropagation();
    
    // 记录鼠标按下位置
    setMouseDownPos({ x: e.clientX, y: e.clientY });
    setHasMoved(false); // 重置移动状态
    
    setDraggingMarkerId(markerId);
    setIsDragging(true);
    
    // 计算鼠标相对于标记的偏移
    const marker = mapMarkers.find(m => m.id === markerId);
    if (marker && mapContainerRef.current) {
      const containerRect = mapContainerRef.current.getBoundingClientRect();
      const markerX = (marker.x / 100) * containerRect.width;
      const markerY = (marker.y / 100) * containerRect.height;
      
      setMarkerOffset({
        x: e.clientX - containerRect.left - markerX,
        y: e.clientY - containerRect.top - markerY
      });
    }
  };

  const handleMapMouseMove = (e) => {
    if (!draggingMarkerId || !mapContainerRef.current) return;
    
    // 计算鼠标移动距离
    const moveDistance = Math.sqrt(
      Math.pow(e.clientX - mouseDownPos.x, 2) + 
      Math.pow(e.clientY - mouseDownPos.y, 2)
    );
    
    // 如果移动距离超过5像素，认为是拖拽而不是点击
    if (moveDistance > 5 && !hasMoved) {
      setHasMoved(true);
    }
    
    // 检查是否在删除区域内（右上角）
    if (deleteZoneRef.current) {
      const deleteRect = deleteZoneRef.current.getBoundingClientRect();
      const inDeleteZone = (
        e.clientX >= deleteRect.left &&
        e.clientX <= deleteRect.right &&
        e.clientY >= deleteRect.top &&
        e.clientY <= deleteRect.bottom
      );
      setIsInDeleteZone(inDeleteZone);
    }
    
    // 只有在确认是拖拽时才更新位置
    if (hasMoved) {
      const containerRect = mapContainerRef.current.getBoundingClientRect();
      const x = ((e.clientX - containerRect.left - markerOffset.x) / containerRect.width) * 100;
      const y = ((e.clientY - containerRect.top - markerOffset.y) / containerRect.height) * 100;
      
      // 限制在地图范围内
      const clampedX = Math.max(0, Math.min(100, x));
      const clampedY = Math.max(0, Math.min(100, y));
      
      setMapMarkers(
        mapMarkers.map(m => 
          m.id === draggingMarkerId ? { ...m, x: clampedX, y: clampedY } : m
        )
      );
    }
  };

  const handleMapMouseUp = () => {
    if (draggingMarkerId) {
      // 如果在删除区域内，删除该标记
      if (isInDeleteZone) {
        setMapMarkers(mapMarkers.filter(m => m.id !== draggingMarkerId));
        Logger.info('标记已删除');
      }
      
      setDraggingMarkerId(null);
      setIsDragging(false);
      setHasMoved(false); // 重置移动状态
      setIsInDeleteZone(false); // 重置删除区域状态
    }
  };

  // 处理数字标记点击（用于选择设置身份）
  const handleMarkerClick = (markerNumber) => {
    setSelectedNumberForRole(markerNumber);
  };

  // 设置角色身份
  const handleSetRole = (role) => {
    if (selectedNumberForRole !== null) {
      setRoleAssignments({
        ...roleAssignments,
        [selectedNumberForRole]: role
      });
      setSelectedNumberForRole(null);
    }
  };

  // 在外部浏览器中打开战绩网页
  const openStatsInBrowser = () => {
    if (statsUrl) {
      window.electronAPI.openExternal(statsUrl);
    }
  };

  // 查询对局数据
  const fetchMatchData = async (matchId) => {
    if (!matchId || !matchId.trim()) {
      setMatchError('请输入对局ID');
      return;
    }

    setMatchLoading(true);
    setMatchError('');
    setMatchData(null);

    try {
      // 通过 Electron 主进程代理请求，避免 CORS 问题
      const result = await window.electronAPI.fetchMatchData(matchId.trim());
      
      if (result.success) {
        Logger.info(`Fetch match data - Match ID: ${result.data?.matchId || 'N/A'}`);
        Logger.info(`Fetch match data - Map: ${result.data?.map || 'N/A'}`);
        Logger.info(`Fetch match data - Has playerData: ${!!result.data?.playerData}`);
        
        setMatchData(result.data);
        setSelectedMatchId(result.data.matchId);
        
        Logger.info(`Fetch match data - Success: ${result.data.matchId}`);
        Logger.info(`Match info - Map: ${result.data.map}, Mode: ${result.data.mode}`);
        if (result.data.playerData) {
          Logger.info(`Player count: ${Object.keys(result.data.playerData).length}`);
        }
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      Logger.error(`Failed to fetch match data: ${error.message}`);
      setMatchError(`查询失败: ${error.message}`);
      
      // 开发测试：如果没有API，使用本地示例数据
      if (process.env.NODE_ENV === 'development') {
        Logger.info('Using sample match data for development');
        // 这里可以导入示例数据进行测试
      }
    } finally {
      setMatchLoading(false);
    }
  };

  // 获取对局历史列表
  const fetchMatchHistory = async (userId) => {
    if (!userId || !userId.trim()) {
      setMatchHistoryError('请输入用户ID');
      return;
    }

    setMatchHistoryLoading(true);
    setMatchHistoryError('');
    setMatchHistory([]);

    try {
      const result = await window.electronAPI.fetchMatchHistory(userId.trim());
      
      if (result.success) {
        const apiData = result.data;
        
        // 检查 API 返回结构
        if (!apiData.isSuccess) {
          throw new Error(apiData.statusText || 'API 请求失败');
        }
        
        const body = apiData.body;
        
        // 提取对局列表
        const matches = body.latestMatches || [];
        
        // 转换数据格式，适配前端展示
        const formattedMatches = matches.map(match => ({
          matchId: match.matchId,
          role: match.role,
          faction: match.faction,
          map: match.map,
          mode: match.mode,
          win: match.win,
          startAt: match.startAt,
          endAt: match.endAt,
          playerCount: match.numOfPlayers,
          turnsSurvived: match.turnsSurvived,
          kills: match.kills,
          votingAccuracy: match.votingAccuracy,
          winningFaction: match.winningFaction,
          // 保留原始数据
          rawData: match
        }));
        
        setMatchHistory(formattedMatches);
        
        // 保存玩家统计数据
        setPlayerStats({
          winRate: body.winRate,
          votingAccuracy: body.votingAccuracy,
          turnsSurvived: body.turnsSurvived,
          kills: body.kills,
          rolesBreakdown: body.rolesBreakdown,
          totalGamePlayed: body.totalGamePlayed,
          achievement: body.achievement,
          playerLv: body.playerLv,
          hasMore: body.hasMore
        });
        
        Logger.info(`Match history fetched: ${formattedMatches.length} matches`);
        Logger.info(`Player Stats - Win Rate: ${body.winRate}%, Total Games: ${body.totalGamePlayed}, Level: ${body.playerLv}`);
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      Logger.error('Failed to fetch match history:', error);
      setMatchHistoryError(`获取历史失败: ${error.message}`);
    } finally {
      setMatchHistoryLoading(false);
    }
  };

  // 选择对局查看详情
  const handleSelectMatch = (matchId) => {
    setSelectedMatchId(matchId);
    setMatchIdInput(matchId);
    fetchMatchData(matchId);
  };

  // 获取角色名称映射
  const getRoleName = (roleId) => {
    const roleMap = {
      1: '鹅',
      2: '鸭子',
      3: '中立',
      8: '追踪者',
      11: '通灵者',
      13: '告密者',
      16: '秃鹫',
      17: '刺客',
      20: '保镖',
      23: '猎鹰',
      31: '正义使者',
      33: '忍者',
      50: '呆呆鸟',
      56: '警长',
      61: '加拿大鹅',
      66: '亡命徒',
      102: '模仿者',
      111: '食鸟' // 根据实际游戏调整
    };
    return roleMap[roleId] || `未知(${roleId})`;
  };

  // 获取阵营名称
  const getFactionName = (factionId) => {
    const factionMap = {
      1: '鹅阵营',
      2: '鸭子阵营',
      3: '中立阵营',
      16: '特殊阵营'
    };
    return factionMap[factionId] || `未知(${factionId})`;
  };

  // 获取地图名称
  const getMapName = (mapId) => {
    return mapNameMapping[mapId] || `地图${mapId}`;
  };

  // 获取模式名称
  const getModeName = (modeId) => {
    const modeMap = {
      1: '标准模式',
      5: '快速模式'
    };
    return modeMap[modeId] || `模式${modeId}`;
  };

  // 格式化时间戳
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '-';
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  // 计算游戏时长
  const calculateDuration = (startAt, endAt) => {
    if (!startAt || !endAt) return '-';
    const durationMs = endAt - startAt;
    const minutes = Math.floor(durationMs / 60000);
    const seconds = Math.floor((durationMs % 60000) / 1000);
    return `${minutes}分${seconds}秒`;
  };

  // 获取事件类型名称
  const getEventTypeName = (typeId) => {
    const typeMap = {
      0: '游戏结束',
      1: '玩家存活',
      2: '击杀',
      3: '投票踢出',
      6: '发现尸体',
      1002: '自爆',
      1013: '攻击',
      1014: '使用技能',
      1015: '特殊击杀'
    };
    return typeMap[typeId] || `事件(${typeId})`;
  };

  // 开始绘制连线（右键按下）
  const handleConnectionStart = (e, markerId, markerX, markerY) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (mapContainerRef.current) {
      const rect = mapContainerRef.current.getBoundingClientRect();
      setDrawingConnection({
        markerId,
        x: (markerX / 100) * rect.width,
        y: (markerY / 100) * rect.height
      });
    }
  };

  // 更新鼠标位置（用于绘制临时连线）
  const handleConnectionMouseMove = (e) => {
    if (drawingConnection && mapContainerRef.current) {
      const rect = mapContainerRef.current.getBoundingClientRect();
      setMousePos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
    }
  };

  // 完成连线（右键释放）
  const handleConnectionEnd = (e, targetMarkerId) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (drawingConnection && drawingConnection.markerId !== targetMarkerId) {
      // 检查是否已存在该连线
      const exists = connections.some(
        conn => 
          (conn.from === drawingConnection.markerId && conn.to === targetMarkerId) ||
          (conn.from === targetMarkerId && conn.to === drawingConnection.markerId)
      );
      
      if (!exists) {
        setConnections([
          ...connections,
          { from: drawingConnection.markerId, to: targetMarkerId }
        ]);
      }
    }
    
    setDrawingConnection(null);
  };

  // 取消连线
  const handleConnectionCancel = () => {
    setDrawingConnection(null);
  };

  // 删除连线
  const handleDeleteConnection = (fromId, toId) => {
    Logger.info(`Deleting connection: ${fromId} -> ${toId}`);
    setConnections(
      connections.filter(
        conn => !(conn.from === fromId && conn.to === toId)
      )
    );
  };

  // 添加全局 mouseup 事件监听，确保拖拽结束
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (draggingMarkerId) {
        setDraggingMarkerId(null);
        setIsDragging(false);
      }
    };

    if (draggingMarkerId) {
      // 只在拖拽时添加全局监听
      document.addEventListener('mouseup', handleGlobalMouseUp);
      document.addEventListener('mouseleave', handleGlobalMouseUp);
      
      return () => {
        document.removeEventListener('mouseup', handleGlobalMouseUp);
        document.removeEventListener('mouseleave', handleGlobalMouseUp);
      };
    }
  }, [draggingMarkerId]);

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
    const favoritedRecordings = selectedRecordings.filter(recording => favoriteRecordings.includes(recording.id));
    const recordingsToDelete = selectedRecordings.filter(recording => !favoriteRecordings.includes(recording.id));


    if (!window.confirm(`确定要删除选中的 ${recordingsToDelete.length} 个录像吗？已排除 ${favoritedRecordings.length} 个收藏的录像。此操作不可恢复。`)) {
      return;
    }

    try {
      let successCount = 0;
      let failCount = 0;

      for (const recording of recordingsToDelete) {
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
      loadRecordings(true);

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

  // Get current page recordings for display
  const getCurrentPageRecordingsList = () => {
    return getCurrentPageRecordings(filteredRecordings, currentPage, recordingsPerPage);
  };

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
        loadRecordings(true); // Refresh recordings list
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

  // GGD Token 相关函数
  const saveGgdToken = async () => {
    try {
      const result = await window.electronAPI.saveGgdToken(ggdToken);
      if (result.success) {
        Logger.info('GGD Token saved successfully');
        alert('GGD Token保存成功');
      } else {
        Logger.error('Failed to save GGD Token:', result.error);
        alert('GGD Token保存失败: ' + result.error);
      }
    } catch (error) {
      Logger.error('Error saving GGD Token:', error);
      alert('保存GGD Token时发生错误: ' + error.message);
    }
  };

  const clearGgdToken = async () => {
    if (window.confirm('确定要清除GGD Token吗？此操作不可恢复。')) {
      try {
        setGgdToken('');
        const result = await window.electronAPI.clearGgdToken();
        if (result.success) {
          Logger.info('GGD Token cleared successfully');
          alert('GGD Token已清除');
        } else {
          Logger.error('Failed to clear GGD Token:', result.error);
          alert('清除GGD Token失败: ' + result.error);
        }
      } catch (error) {
        Logger.error('Error clearing GGD Token:', error);
        alert('清除GGD Token时发生错误: ' + error.message);
      }
    }
  };

  const loadGgdToken = async () => {
    try {
      const result = await window.electronAPI.loadGgdToken();
      if (result.success) {
        setGgdToken(result.token || '');
      } else {
        Logger.error('Failed to load GGD Token:', result.error);
      }
    } catch (error) {
      Logger.error('Error loading GGD Token:', error);
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
          <section className="games-section" ref={gamesSectionRef}>
            <section className="recording-controls">
              <h2>录制控制</h2>
              {isFetchingSource ? (
                <div className="selected-game">
                  <h3>已选择游戏: {selectedGame.name}</h3>
                  <div className="controls">
                    {!isRecording ? (
                      <button className="record-button" onClick={() => startMediaRecording_new(source)}>
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
          </section>
        ) : activeTab === 'recordings' ? (
          <section className="recordings-section" ref={recordingsListRef} onScroll={handleRecordingsListScroll}>
            {selectedRecording ? (
              <div className="viewer">
                <div className="viewer-header">
                  <button onClick={handleReturnToList}>
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
                  {isRefreshingRecordings && (
                    <span className="refreshing-indicator">🔄 正在刷新...</span>
                  )}
                  <div className="batch-controls">
                    {!isSelectMode ? (
                      <div className="view-controls">
                        <button
                          onClick={() => loadRecordings(true)}
                          className="refresh-button"
                          title="刷新列表"
                          disabled={isRefreshingRecordings}
                        >
                          🔄 刷新
                        </button>
                        <button
                          onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                          className={`favorites-filter-button ${showFavoritesOnly ? 'active' : ''}`}
                          title={showFavoritesOnly ? '仅显示收藏' : '显示收藏'}
                        >
                          {showFavoritesOnly ? '⭐ 仅收藏' : '☆ 收藏'}
                        </button>
                        <button onClick={toggleSelectMode} className="select-mode-button">
                          批量操作
                        </button>
                      </div>
                    ) : (
                      <div className="batch-mode-controls">
                        <div className="batch-actions-row">
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
                        <div className="batch-date-filter-row">
                          <input
                            type="date"
                            value={startDate}
                            onChange={handleStartDateChange}
                            className="date-filter-input"
                            title="开始日期"
                          />
                          <span className="date-separator">至</span>
                          <input
                            type="date"
                            value={endDate}
                            onChange={handleEndDateChange}
                            className="date-filter-input"
                            title="结束日期"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Pagination Controls - Outside header */}
                {filteredRecordings.length > recordingsPerPage && !showFavoritesOnly && (
                  <div className="pagination-bar">
                    <div className="pagination-controls">
                      <button
                        onClick={goToPreviousPage}
                        disabled={currentPage === 1}
                        className="pagination-button"
                      >
                        ← 上一页
                      </button>
                      <span className="page-info">
                        {currentPage} / {totalPages}
                      </span>
                      <button
                        onClick={goToNextPage}
                        disabled={currentPage === totalPages}
                        className="pagination-button"
                      >
                        下一页 →
                      </button>
                    </div>
                    <span className="total-count">共 {filteredRecordings.length} 条</span>
                  </div>
                )}

                {recordings.length === 0 ? (
                  <p>暂无录像文件</p>
                ) : (
                  getCurrentPageRecordingsList().map(recording => (
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
                              onClick={() => handleNavigateToPlayer(recording)}
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
                                另存为
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
          <section className="entertainment-section" ref={entertainmentSectionRef}>
            <div className="map-tool-container">
              {/* 左侧边栏 */}
              <div className="map-sidebar">
                {/* 地图选择 */}
                <div className="map-selector">
                  <h3>地图选择</h3>
                  <select 
                    className="map-select"
                    value={selectedMap}
                    onChange={(e) => setSelectedMap(Number(e.target.value))}
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].map(mapNum => (
                      <option key={mapNum} value={mapNum}>
                        {mapNameMapping[mapNum]}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 轮次 */}
                <div className="sequence-selector">
                  <h3>轮次</h3>
                  <div className="sequence-grid">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(seq => (
                      <button
                        key={seq}
                        className={`seq-btn ${currentSequence === seq ? 'active' : ''}`}
                        onClick={() => setCurrentSequence(seq)}
                      >
                        {seq}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 工具 */}
                <div className="tools-panel">
                  <h3>数字标记</h3>
                  <div className="number-grid">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16].map(num => {
                      const role = roleAssignments[num];
                      let iconClass = `number-icon ${selectedNumberForRole === num ? 'selected' : ''}`;
                      
                      if (role === 'good') {
                        iconClass += ' role-good';
                      } else if (role === 'neutral') {
                        iconClass += ' role-neutral';
                      } else if (role === 'evil') {
                        iconClass += ' role-evil';
                      }
                      
                      return (
                        <div
                          key={num}
                          className={iconClass}
                          draggable
                          onDragStart={(e) => {
                            setDraggedNumber(num);
                            setIsDragging(true);
                            e.dataTransfer.effectAllowed = 'copy';
                          }}
                          onDragEnd={() => {
                            setDraggedNumber(null);
                            setIsDragging(false);
                          }}
                          onClick={() => handleMarkerClick(num)}
                          title={`数字 ${num}${role ? ` - ${role === 'good' ? '好鹅' : role === 'neutral' ? '中立' : '坏鸭'}` : ' - 拖拽到地图，点击设置身份'}`}
                        >
                          {num}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* 中间地图显示区 */}
              <div className="map-display">
                <div className="map-header">
                  <div className="map-title">
                    <img src={`/img/${selectedMap}.png`} alt="地图预览" className="map-preview-thumb" />
                    <h3>{mapNameMapping[selectedMap]}</h3>
                  </div>
                  <div className="map-actions">
                    <button onClick={() => setMapMarkers([])} className="action-btn">
                      清除标记
                    </button>
                  </div>
                </div>
                
                <div 
                  ref={mapContainerRef}
                  className={`map-canvas-container ${isDragging ? 'drag-over' : ''}`}
                  onMouseMove={(e) => {
                    handleMapMouseMove(e);
                    handleConnectionMouseMove(e);
                  }}
                  onMouseUp={(e) => {
                    handleMapMouseUp();
                    if (e.button === 2) { // 右键
                      handleConnectionCancel();
                    }
                  }}
                  onMouseLeave={(e) => {
                    handleMapMouseUp();
                    handleConnectionCancel();
                  }}
                  onContextMenu={(e) => e.preventDefault()} // 阻止右键菜单
                >
                  {/* 删除区域（右上角）- 仅在拖拽时显示 */}
                  {draggingMarkerId && (
                    <div 
                      ref={deleteZoneRef}
                      className={`delete-zone ${isInDeleteZone ? 'active' : ''}`}
                    >
                      <span className="delete-icon">🗑️</span>
                      <span className="delete-text">拖拽到此删除</span>
                    </div>
                  )}
                  
                  <img 
                    src={`/img/${selectedMap}.png`} 
                    alt={`地图${selectedMap}`} 
                    className="map-image"
                    draggable={false}
                    onDragStart={(e) => e.preventDefault()}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'copy';
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      
                      // 处理从工具栏拖拽的数字
                      if (draggedNumber !== null) {
                        // 检查当前序列是否已存在该数字
                        const existingMarker = mapMarkers.find(
                          m => m.number === draggedNumber && m.sequence === currentSequence
                        );
                        
                        if (existingMarker) {
                          // 如果已存在，更新其位置
                          const rect = e.target.getBoundingClientRect();
                          const x = ((e.clientX - rect.left) / rect.width) * 100;
                          const y = ((e.clientY - rect.top) / rect.height) * 100;
                          setMapMarkers(
                            mapMarkers.map(m => 
                              m.id === existingMarker.id ? { ...m, x, y } : m
                            )
                          );
                        } else {
                          // 如果不存在，添加新标记
                          const rect = e.target.getBoundingClientRect();
                          const x = ((e.clientX - rect.left) / rect.width) * 100;
                          const y = ((e.clientY - rect.top) / rect.height) * 100;
                          setMapMarkers([
                            ...mapMarkers, 
                            { 
                              x, 
                              y, 
                              number: draggedNumber, 
                              sequence: currentSequence, 
                              id: Date.now() 
                            }
                          ]);
                        }
                        setDraggedNumber(null);
                        setIsDragging(false);
                      }
                    }}
                  />
                  
                  {/* SVG 连线层 */}
                  <svg className="connections-layer">
                    {/* 已存在的连线 - 只显示当前序列的标记之间的连线 */}
                    {connections.map((conn, index) => {
                      const fromMarker = mapMarkers.find(m => m.id === conn.from);
                      const toMarker = mapMarkers.find(m => m.id === conn.to);
                      
                      // 如果任一标记不存在或不属于当前序列，则不显示
                      if (!fromMarker || !toMarker) return null;
                      if (fromMarker.sequence !== currentSequence || toMarker.sequence !== currentSequence) return null;
                      
                      return (
                        <g key={index}>
                          {/* 实际显示的连线（较细，先绘制在下层） */}
                          
                          {/* 透明的点击区域（更粗，后绘制在上层，用于扩大悬停范围） */}
                          <line
                            x1={`${fromMarker.x}%`}
                            y1={`${fromMarker.y}%`}
                            x2={`${toMarker.x}%`}
                            y2={`${toMarker.y}%`}
                            stroke="transparent"
                            strokeWidth="15"
                            strokeLinecap="round"
                            onMouseEnter={() => setHoveredConnection(index)}
                            onMouseLeave={() => setHoveredConnection(null)}
                            style={{ cursor: 'pointer' }}
                          />
                          <line
                            x1={`${fromMarker.x}%`}
                            y1={`${fromMarker.y}%`}
                            x2={`${toMarker.x}%`}
                            y2={`${toMarker.y}%`}
                            stroke="#00d4ff"
                            strokeWidth="3"
                            strokeLinecap="round"
                            opacity="0.8"
                          />
                        </g>
                      );
                    })}
                    
                    {/* 删除按钮层 - 在所有连线之上 */}
                    {connections.map((conn, index) => {
                      const fromMarker = mapMarkers.find(m => m.id === conn.from);
                      const toMarker = mapMarkers.find(m => m.id === conn.to);
                      
                      if (!fromMarker || !toMarker) return null;
                      if (fromMarker.sequence !== currentSequence || toMarker.sequence !== currentSequence) return null;
                      if (hoveredConnection !== index) return null;
                      
                      return (
                        <g key={`delete-${index}`}>
                          <circle
                            cx={`${(fromMarker.x + toMarker.x) / 2}%`}
                            cy={`${(fromMarker.y + toMarker.y) / 2}%`}
                            r="8"
                            fill="#ff4757"
                            stroke="white"
                            strokeWidth="2"
                            className="connection-delete-btn"
                            onMouseEnter={() => setHoveredConnection(index)}
                            onMouseLeave={() => setHoveredConnection(null)}
                            onClick={(e) => {
                              console.log('Delete button clicked!', conn.from, conn.to);
                              Logger.info(`Delete button clicked: ${conn.from} -> ${conn.to}`);
                              e.stopPropagation();
                              handleDeleteConnection(conn.from, conn.to);
                            }}
                            style={{ cursor: 'pointer' }}
                          />
                          <text
                            x={`${(fromMarker.x + toMarker.x) / 2}%`}
                            y={`${(fromMarker.y + toMarker.y) / 2}%`}
                            textAnchor="middle"
                            dominantBaseline="central"
                            fill="white"
                            fontSize="10"
                            fontWeight="bold"
                            style={{ pointerEvents: 'none' }}
                          >
                            ×
                          </text>
                        </g>
                      );
                    })}
                    
                    {/* 正在绘制的临时连线 */}
                    {drawingConnection && (
                      <line
                        x1={drawingConnection.x}
                        y1={drawingConnection.y}
                        x2={mousePos.x}
                        y2={mousePos.y}
                        stroke="#00d4ff"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeDasharray="5,5"
                        opacity="0.6"
                      />
                    )}
                  </svg>
                  
                  {/* 标记点覆盖层 */}
                  {mapMarkers.filter(m => m.sequence === currentSequence).map(marker => {
                    // 根据角色身份获取颜色
                    const role = roleAssignments[marker.number];
                    let markerClass = `map-marker-number ${draggingMarkerId === marker.id ? 'dragging' : ''}`;
                    
                    if (role === 'good') {
                      markerClass += ' role-good';
                    } else if (role === 'neutral') {
                      markerClass += ' role-neutral';
                    } else if (role === 'evil') {
                      markerClass += ' role-evil';
                    }
                    
                    return (
                      <div
                        key={marker.id}
                        className={markerClass}
                        style={{ left: `${marker.x}%`, top: `${marker.y}%` }}
                        onMouseDown={(e) => {
                          if (e.button === 0) { // 左键
                            handleMarkerMouseDown(e, marker.id);
                          } else if (e.button === 2) { // 右键
                            handleConnectionStart(e, marker.id, marker.x, marker.y);
                          }
                        }}
                        onMouseUp={(e) => {
                          if (e.button === 2 && drawingConnection) { // 右键释放
                            handleConnectionEnd(e, marker.id);
                          }
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          // 只有在没有移动过（纯点击）时才选择设置身份
                          if (!hasMoved) {
                            handleMarkerClick(marker.number);
                          }
                        }}
                        title={`数字 ${marker.number} - 拖拽移动，点击设置身份${role ? ` (${role === 'good' ? '好鹅' : role === 'neutral' ? '中立' : '坏鹅'})` : ''}`}
                      >
                        {marker.number}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 右侧面板 */}
              <div className="map-right-panel">
                <div className="role-assignment">
                  <h3>角色身份设置</h3>
                  
                  {selectedNumberForRole !== null ? (
                    <div className="role-selection-active">
                      <p className="selection-hint">为数字 <strong>{selectedNumberForRole}</strong> 选择身份：</p>
                      <div className="role-buttons">
                        <button 
                          className="role-btn good"
                          onClick={() => handleSetRole('good')}
                        >
                          🦆 好鹅
                        </button>
                        <button 
                          className="role-btn neutral"
                          onClick={() => handleSetRole('neutral')}
                        >
                          🐤 中立
                        </button>
                        <button 
                          className="role-btn evil"
                          onClick={() => handleSetRole('evil')}
                        >
                          👻 坏鹅
                        </button>
                      </div>
                      <button 
                        className="cancel-btn"
                        onClick={() => setSelectedNumberForRole(null)}
                      >
                        取消
                      </button>
                    </div>
                  ) : (
                    <div className="role-list">
                      <p className="role-hint">点击地图上的数字标记来设置身份</p>
                      {Object.keys(roleAssignments).length > 0 ? (
                        <div className="assigned-roles">
                          {Object.entries(roleAssignments).map(([number, role]) => {
                            const roleInfo = {
                              good: { label: '好鹅', icon: '🦆', color: '#4caf50' },
                              neutral: { label: '中立', icon: '🐤', color: '#ff9800' },
                              evil: { label: '坏鹅', icon: '👻', color: '#f44336' }
                            };
                            const info = roleInfo[role];
                            return (
                              <div key={number} className="role-item">
                                <span className="role-number">{number}</span>
                                <span className="role-info" style={{ color: info.color }}>
                                  {info.icon} {info.label}
                                </span>
                                <button 
                                  className="remove-role"
                                  onClick={() => {
                                    const newAssignments = { ...roleAssignments };
                                    delete newAssignments[number];
                                    setRoleAssignments(newAssignments);
                                  }}
                                >
                                  ×
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="empty-state">
                          <p>暂无身份分配</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>
        ) : activeTab === 'stats' ? (
          <section className="stats-section">
            <div className="stats-container">
              <div className="stats-header">
                <h2>战绩查询</h2>
                <button 
                  className="open-browser-btn"
                  onClick={openStatsInBrowser}
                  title="在系统浏览器中打开官网"
                >
                  🌐 打开官网
                </button>
              </div>

              {/* 用户ID输入区域 */}
              <div className="match-query-section">
                <div className="query-input-group">
                  <input
                    type="text"
                    className="match-id-input"
                    value={userIdInput}
                    onChange={(e) => setUserIdInput(e.target.value)}
                    placeholder="输入用户ID (例如: EAeQEOfRs1PeDzJc7yKjjvpmDf42)"
                    onKeyPress={(e) => e.key === 'Enter' && fetchMatchHistory(userIdInput)}
                  />
                  <button 
                    className="query-button"
                    onClick={() => fetchMatchHistory(userIdInput)}
                    disabled={matchHistoryLoading}
                  >
                    {matchHistoryLoading ? '加载中...' : '查询历史'}
                  </button>
                </div>
                
                {/* 对局ID快速查询 */}
                <div className="query-input-group" style={{ marginTop: '10px' }}>
                  <input
                    type="text"
                    className="match-id-input"
                    value={matchIdInput}
                    onChange={(e) => setMatchIdInput(e.target.value)}
                    placeholder="或直接输入对局ID快速查询 (例如: V05628042026637780784)"
                    onKeyPress={(e) => e.key === 'Enter' && fetchMatchData(matchIdInput)}
                  />
                  <button 
                    className="query-button"
                    onClick={() => fetchMatchData(matchIdInput)}
                    disabled={matchLoading}
                  >
                    {matchLoading ? '加载中...' : '查询对局'}
                  </button>
                </div>
              </div>

              {/* 历史加载状态 */}
              {matchHistoryLoading && (
                <div className="loading-state">
                  <div className="loading-spinner"></div>
                  <p>正在加载对局历史...</p>
                </div>
              )}

              {/* 历史错误提示 */}
              {matchHistoryError && !matchHistoryLoading && (
                <div className="error-state">
                  <div className="error-icon">⚠️</div>
                  <p>{matchHistoryError}</p>
                </div>
              )}

              {/* 玩家统计卡片 - 仅在没有查看详情时显示 */}
              {playerStats && !matchHistoryLoading && !matchData && (
                <div className="player-stats-card">
                  <div className="stats-header-section">
                    <div className="player-level">
                      <span className="level-badge">Lv.{playerStats.playerLv}</span>
                      <span className="total-games">总场次: {playerStats.totalGamePlayed}</span>
                    </div>
                    <div className="achievement-progress">
                      <span>成就: {playerStats.achievement.completed}/{playerStats.achievement.total}</span>
                      <div className="progress-bar">
                        <div 
                          className="progress-fill" 
                          style={{ width: `${(playerStats.achievement.completed / playerStats.achievement.total) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="stats-grid">
                    <div className="stat-box">
                      <div className="stat-value">{playerStats.winRate}%</div>
                      <div className="stat-label">胜率</div>
                    </div>
                    <div className="stat-box">
                      <div className="stat-value">{playerStats.votingAccuracy}%</div>
                      <div className="stat-label">投票准确率</div>
                    </div>
                    <div className="stat-box">
                      <div className="stat-value">{playerStats.turnsSurvived}</div>
                      <div className="stat-label">平均存活回合</div>
                    </div>
                    <div className="stat-box">
                      <div className="stat-value">{playerStats.kills}</div>
                      <div className="stat-label">平均击杀</div>
                    </div>
                  </div>
                  
                  <div className="roles-breakdown">
                    <h4>角色分布</h4>
                    <div className="role-stats">
                      <div className="role-stat-item goose">
                        <span className="role-label">🪿 鹅</span>
                        <span className="role-detail">
                          {playerStats.rolesBreakdown.goose.timesPlayed}场 / {playerStats.rolesBreakdown.goose.winRate}%胜率
                        </span>
                      </div>
                      <div className="role-stat-item duck">
                        <span className="role-label">🦆 鸭</span>
                        <span className="role-detail">
                          {playerStats.rolesBreakdown.duck.timesPlayed}场 / {playerStats.rolesBreakdown.duck.winRate}%胜率
                        </span>
                      </div>
                      <div className="role-stat-item neutral">
                        <span className="role-label">🎭 中立</span>
                        <span className="role-detail">
                          {playerStats.rolesBreakdown.neutral.timesPlayed}场 / {playerStats.rolesBreakdown.neutral.winRate}%胜率
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 对局历史列表 - 仅在没有查看详情时显示 */}
              {matchHistory.length > 0 && !matchHistoryLoading && !matchData && (
                <div className="match-history-section">
                  <div className="match-history-header">
                    <h3>📋 最近20场对局</h3>
                    <span className="match-count">共 {matchHistory.length} 场</span>
                  </div>
                  <div className="match-history-list">
                    {/* 表头 */}
                    <div className="match-history-header-row">
                      <div className="header-player">玩家</div>
                      <div className="header-result">胜/负</div>
                      <div className="header-date">日期</div>
                      <div className="header-players">玩家人数</div>
                      <div className="header-turns">存活回合</div>
                      <div className="header-arrow"></div>
                    </div>
                    
                    {matchHistory.map((match, index) => {
                      const isSelected = selectedMatchId === match.matchId;
                      const matchDate = new Date(match.startAt || match.timestamp);
                      
                      return (
                        <div 
                          key={match.matchId || index}
                          className={`match-history-item ${isSelected ? 'selected' : ''}`}
                          onClick={() => handleSelectMatch(match.matchId)}
                        >
                          <div className="match-role-info">
                            <div className="role-avatar">
                              {/* 这里可以显示角色头像 */}
                              <span className="role-icon">🎭</span>
                            </div>
                            <div className="role-details">
                              <span className="role-name">{getRoleName(match.role) || '未知角色'}</span>
                              <span className="role-map">{getMapName(match.map)} | {getModeName(match.mode)}</span>
                            </div>
                          </div>
                          
                          <div className="match-result">
                            <span className={`result-badge ${match.win ? 'win' : 'lose'}`}>
                              {match.win ? '胜利' : '失败'}
                            </span>
                          </div>
                          
                          <div className="match-date">
                            {matchDate.toLocaleDateString('zh-CN', {
                              month: '2-digit',
                              day: '2-digit',
                              year: 'numeric'
                            })}
                          </div>
                          
                          <div className="match-players">
                            {match.playerCount || Object.keys(match.playerData || {}).length}
                          </div>
                          
                          <div className="match-turns">
                            {match.turnsSurvived || '-'}
                          </div>
                          
                          <div className="match-arrow">
                            →
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 对局详情加载状态 */}
              {matchLoading && (
                <div className="loading-state">
                  <div className="loading-spinner"></div>
                  <p>正在查询对局数据...</p>
                </div>
              )}

              {/* 对局详情错误提示 */}
              {matchError && !matchLoading && (
                <div className="error-state">
                  <div className="error-icon">⚠️</div>
                  <p>{matchError}</p>
                </div>
              )}

              {/* 对局数据详情展示 */}
              {matchData && !matchLoading && (
                <div className="match-data-display">
                  {/* 返回按钮 */}
                  <div style={{ marginBottom: '15px', display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <button 
                      className="query-button"
                      onClick={() => {
                        setMatchData(null);
                        setMatchIdInput('');
                      }}
                      style={{ background: '#666', border: 'none', padding: '8px 16px', borderRadius: '6px', color: 'white', cursor: 'pointer', fontSize: '14px' }}
                    >
                      ← 返回历史列表
                    </button>
                    <span style={{ color: '#00d4ff', fontSize: '14px' }}>正在查看对局详情: {matchData.matchId}</span>
                  </div>
                  
                  {/* 对局基本信息 */}
                  <div className="match-info-card">
                    <h3>📊 对局信息</h3>
                    <div className="info-grid">
                      <div className="info-item">
                        <span className="info-label">对局ID:</span>
                        <span className="info-value">{matchData.matchId}</span>
                      </div>
                      <div className="info-item">
                        <span className="info-label">地图:</span>
                        <span className="info-value">{getMapName(matchData.map)}</span>
                      </div>
                      <div className="info-item">
                        <span className="info-label">模式:</span>
                        <span className="info-value">{getModeName(matchData.mode)}</span>
                      </div>
                      <div className="info-item">
                        <span className="info-label">获胜方:</span>
                        <span className="info-value">{getFactionName(matchData.winningFaction)}</span>
                      </div>
                      <div className="info-item">
                        <span className="info-label">开始时间:</span>
                        <span className="info-value">{formatTimestamp(matchData.startAt)}</span>
                      </div>
                      <div className="info-item">
                        <span className="info-label">结束时间:</span>
                        <span className="info-value">{formatTimestamp(matchData.endAt)}</span>
                      </div>
                      <div className="info-item full-width">
                        <span className="info-label">游戏时长:</span>
                        <span className="info-value">{calculateDuration(matchData.startAt, matchData.endAt)}</span>
                      </div>
                    </div>
                  </div>
        
                  {/* 玩家列表 */}
                  <div className="players-card">
                    <h3>玩家列表 ({Object.keys(matchData.playerData).length}人)</h3>
                    <div className="players-list">
                      {Object.values(matchData.playerData).map((player) => (
                        <div 
                          key={player.userId} 
                          className={`player-card ${player.win ? 'winner' : ''} faction-${player.faction}`}
                        >
                          <div className="player-header">
                            <div className="player-info">
                              <span className="player-nickname">{player.nickname}</span>
                              <span className={`player-role role-${player.faction}`}>
                                {getRoleName(player.role)}
                              </span>
                            </div>
                            <div className="player-status">
                              {player.isGhost && <span className="status-ghost">👻 已死亡</span>}
                              {!player.isGhost && <span className="status-alive">✅ 存活</span>}
                              {player.win && <span className="status-win">🏆 胜利</span>}
                            </div>
                          </div>
                          <div className="player-stats">
                            <div className="stat-item">
                              <span className="stat-label">击杀:</span>
                              <span className="stat-value">{player.kills}</span>
                            </div>
                            <div className="stat-item">
                              <span className="stat-label">任务:</span>
                              <span className="stat-value">{player.tasks}</span>
                            </div>
                            <div className="stat-item">
                              <span className="stat-label">正确投票:</span>
                              <span className="stat-value">{player.correctVotes}</span>
                            </div>
                            <div className="stat-item">
                              <span className="stat-label">存活回合:</span>
                              <span className="stat-value">{player.turnsSurvived}</span>
                            </div>
                            {player.discussions > 0 && (
                              <div className="stat-item">
                                <span className="stat-label">发言:</span>
                                <span className="stat-value">{player.discussions}</span>
                              </div>
                            )}
                            {player.sabotages > 0 && (
                              <div className="stat-item">
                                <span className="stat-label">破坏:</span>
                                <span className="stat-value">{player.sabotages}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
        
                  {/* 回合信息 */}
                  {matchData.rounds && matchData.rounds.length > 0 && (
                    <div className="rounds-card">
                      <h3>回合信息 ({matchData.rounds.length}回合)</h3>
                      <div className="rounds-list">
                        {matchData.rounds.map((round, index) => (
                          <div key={index} className="round-card">
                            <div className="round-header">
                              <h4>第 {index + 1} 回合</h4>
                              <span className="round-duration">
                                {calculateDuration(round.startAt, round.endAt)}
                              </span>
                            </div>
                                    
                            {/* 会议信息 */}
                            {round.meetingInfo && (
                              <div className="meeting-info">
                                <div className="meeting-header">
                                  <div className="meeting-type">
                                    <span className="meeting-icon">
                                      {round.meetingInfo.type === 'Report' ? '📢' : '🚨'}
                                    </span>
                                    <span className="meeting-type-text">
                                      {round.meetingInfo.type === 'Report' ? '报告尸体' : '紧急会议'}
                                    </span>
                                  </div>
                                  <div className="meeting-starter">
                                    <span className="label">发起人:</span>
                                    <span 
                                      className={`player-name-tag faction-${matchData.playerData[round.meetingInfo.starter]?.faction || 0}`}
                                    >
                                      {matchData.playerData[round.meetingInfo.starter]?.nickname || '未知'}
                                    </span>
                                  </div>
                                </div>
                                
                                <div className="meeting-result-section">
                                  <div className="result-label">投票结果</div>
                                  <div className={`result-value ${round.meetingInfo.result === 'skip' ? 'skip' : ''}`}>
                                    {round.meetingInfo.result === 'skip' ? '⏭️ 平票/跳过' : 
                                     <>
                                       <span className="result-icon">🗳️</span>
                                       <span 
                                         className={`player-name-tag faction-${matchData.playerData[round.meetingInfo.result]?.faction || 0}`}
                                       >
                                         {matchData.playerData[round.meetingInfo.result]?.nickname || '未知'}
                                       </span>
                                       <span className="result-action">被投票出局</span>
                                     </>}
                                  </div>
                                </div>
                                        
                                {/* 投票详情 - 优化版 */}
                                {round.meetingInfo.votes && (
                                  <div className="votes-detail-enhanced">
                                    <div className="votes-header">
                                      <span className="votes-title">📊 投票详情</span>
                                      <span className="votes-count">
                                        共 {Object.keys(round.meetingInfo.votes).length} 人投票
                                      </span>
                                    </div>
                                    <div className="votes-grid-enhanced">
                                      {Object.entries(round.meetingInfo.votes).map(([voterId, voteTarget]) => {
                                        const voter = matchData.playerData[voterId];
                                        const target = voteTarget !== 'skip' ? matchData.playerData[voteTarget] : null;
                                        const isSkip = voteTarget === 'skip';
                                        
                                        return (
                                          <div key={voterId} className={`vote-card ${isSkip ? 'vote-skip' : ''}`}>
                                            <div className="vote-row">
                                              <div className="voter-section">
                                                <span 
                                                  className={`voter-avatar faction-${voter?.faction || 0}`}
                                                >
                                                  {voter?.nickname?.charAt(0) || '?'}
                                                </span>
                                                <span 
                                                  className={`voter-name faction-${voter?.faction || 0}`}
                                                >
                                                  {voter?.nickname || '未知'}
                                                </span>
                                              </div>
                                              <div className="vote-arrow-container">
                                                <span className="vote-arrow">▶</span>
                                              </div>
                                              <div className="target-section">
                                                {isSkip ? (
                                                  <span className="target-skip">⏭️ 跳过</span>
                                                ) : (
                                                  <>
                                                    <span 
                                                      className={`target-avatar faction-${target?.faction || 0}`}
                                                    >
                                                      {target?.nickname?.charAt(0) || '?'}
                                                    </span>
                                                    <span 
                                                      className={`target-name faction-${target?.faction || 0}`}
                                                    >
                                                      {target?.nickname || '未知'}
                                                    </span>
                                                  </>
                                                )}
                                              </div>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
        
              {/* 空状态 */}
              {!matchData && !matchLoading && !matchError && (
                <div className="empty-state">
                  <div className="empty-icon">🎮</div>
                  <h3>请输入对局ID或用户ID查询战绩</h3>
                  <p>• 输入用户ID查询历史对局列表<br/>• 直接输入对局ID快速查询详细数据<br/>• 或从历史列表中点击对局查看详情</p>
                </div>
              )}
            </div>
          </section>
        ) : (
          <section className="settings-section" ref={settingsSectionRef}>
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
              
              <div className="setting-item">
                <label htmlFor="ggd-token">GGD战绩查询Token:</label>
                <div className="setting-input">
                  <input
                    type="password"
                    id="ggd-token"
                    value={ggdToken}
                    onChange={(e) => setGgdToken(e.target.value)}
                    placeholder="请输入GGD API Token"
                  />
                  <button onClick={saveGgdToken}>保存Token</button>
                  <button onClick={clearGgdToken}>清除Token</button>
                </div>
                <p className="setting-description">
                  用于 Goose Goose Duck 战绩查询API的认证Token。当前状态: {ggdToken ? '已设置' : '未设置'}
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