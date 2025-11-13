import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import Logger from './utils/logger';

function App() {
  const [gameProcesses, setGameProcesses] = useState([]);
  const [selectedGame, setSelectedGame] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordings, setRecordings] = useState([]);
  const [activeTab, setActiveTab] = useState('games'); // 'games', 'recordings', 'settings', or 'entertainment'
  const [selectedRecording, setSelectedRecording] = useState(null);
  const [recordingData, setRecordingData] = useState(null);
  const [recordingsDir, setRecordingsDir] = useState('');
  const [recordingTime, setRecordingTime] = useState(0);
  const [gamePath, setGamePath] = useState('');
  const [entertainmentUrl, setEntertainmentUrl] = useState('https://www.bilibili.com');
  const [compressVideos, setCompressVideos] = useState(false);
  const [source, setSource] = useState(null)
  const compressVideosRef = useRef(compressVideos);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const recordingStartTimeRef = useRef(null);
  const timerIntervalRef = useRef(null);

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
    loadRecordingsDir();
    loadGamePath()

    window.electronAPI.onStopRecording(() => {
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
      }
    });

    // Clean up event listeners
    return () => {
      window.electronAPI.removeAllListeners('source-id-selected');
      window.electronAPI.removeAllListeners('stop-recording');
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
    } catch (error) {
      Logger.error('Error loading recordings:', error);
    }
  };

  const loadRecordingsDir = async () => {
    try {
      const result = await window.electronAPI.getRecordingsDir();
      if (result.success) {
        setRecordingsDir(result.recordingsDir);
        Logger.info(`Recordings directory loaded: ${result.recordingsDir}`);
      }
    } catch (error) {
      Logger.error('Error loading recordings directory:', error);
    }
  };

  const loadRecordingData = async (filePath) => {
    try {
      const result = await window.electronAPI.readRecording(filePath);
      if (result.success) {
        setRecordingData(`data:video/webm;base64,${result.data}`);
      }
    } catch (error) {
      Logger.error('Error loading recording data:', error);
    }
  };

  const loadGamePath = async () => {
    try {
      const result = await window.electronAPI.getGamePath();
      if (result.success) {
        setGamePath(result.gamePath || '');
        Logger.info(`Game path loaded: ${result.gamePath}`);
      }
    } catch (error) {
      Logger.error('Error loading game path:', error);
    }
  };

  const startRecording = async () => {
    if (!selectedGame) return;

    try {
      const result = await window.electronAPI.startRecording({
        gameName: selectedGame.name
      });

      if (!result.success) {
        Logger.error('Failed to start recording:', result.message);
      } else {
        Logger.info('Recording started successfully');
      }
    } catch (error) {
      Logger.error('Error starting recording:', error);
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
      const result = await window.electronAPI.deleteRecording(recording.id);
      if (result.success) {
        Logger.info('Recording deleted successfully');
        loadRecordings(); // Refresh recordings list
        if (selectedRecording && selectedRecording.id === recording.id) {
          setSelectedRecording(null);
          setRecordingData(null);
        }
      } else {
        Logger.error('Failed to delete recording:', result.error);
      }
    } catch (error) {
      Logger.error('Error deleting recording:', error);
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

  const changeCompressVideos = (event) => {
    setCompressVideos(event.target.checked);
  };

  const preFetchSource = async (game) => {
    if(!game) return;
    try {
      const result = await window.electronAPI.preFetchSource({
        gameName: game.name
      });
      if (result.success) {
        setSource(result.source);
        Logger.info(`Source fetched for game: ${game.name}`);
      } else {
        Logger.error('Failed to fetch source id:', result.error);
      }
    } catch (error) {
      Logger.error('Error fetching source:', error);
    }
  };

  useEffect(() => {
    if (selectedRecording) {
      loadRecordingData(selectedRecording.filePath);
    } else {
      setRecordingData(null);
    }
  }, [selectedRecording]);

  useEffect(() => {
    if (selectedGame) {
      preFetchSource(selectedGame);
    }
  }, [selectedGame]);

  return (
    <div className="app">
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

            <section className="recording-controls">
              <h2>录制控制</h2>
              {selectedGame ? (
                <div className="selected-game">
                  <h3>已选择游戏: {selectedGame.name}</h3>
                  <div className="controls">
                    {!isRecording ? (
                      <button className="record-button" onClick={() => startMediaRecording(source)}>
                        开始录制
                      </button>
                    ) : (
                      <button className="stop-button" onClick={stopRecording}>
                        停止录制
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <p>请从上方列表中选择一个游戏程序开始录制</p>
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
                    <video controls autoPlay>
                      <source src={recordingData} type="video/webm" />
                      您的浏览器不支持视频播放。
                    </video>
                  ) : (
                    <p>正在加载录像...</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="recordings-list">
                <h2>录像列表</h2>
                {recordings.length === 0 ? (
                  <p>暂无录像文件</p>
                ) : (
                  recordings.map(recording => (
                    <div key={recording.id} className="recording-item">
                      <div className="recording-thumbnail">
                        <div className="play-icon">▶</div>
                      </div>
                      <div className="recording-info">
                        <h3>{recording.name}</h3>
                        <p>{new Date(recording.date).toLocaleString('zh-CN')}</p>
                        <div className="recording-actions">
                          <button
                            className="play-button"
                            onClick={() => setSelectedRecording(recording)}
                          >
                            播放
                          </button>
                          <button
                            className="delete-button"
                            onClick={() => deleteRecording(recording)}
                          >
                            删除
                          </button>
                        </div>
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
                    onChange={(e) => { setCompressVideos(e.target.checked) }}
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
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

export default App;