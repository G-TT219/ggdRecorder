import React, { useState, useEffect, useRef } from 'react';
import './App.css';

function App() {
  const [gameProcesses, setGameProcesses] = useState([]);
  const [selectedGame, setSelectedGame] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordings, setRecordings] = useState([]);
  const [activeTab, setActiveTab] = useState('games'); // 'games' or 'recordings'
  const [selectedRecording, setSelectedRecording] = useState(null);
  const [recordingData, setRecordingData] = useState(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);

  useEffect(() => {
    // Load game processes
    loadGameProcesses();
    loadRecordings();

    // Set up event listeners for recording
    window.electronAPI.onSourceIdSelected((event, sourceId, sourceName) => {
      console.log('Source selected:', sourceId, sourceName);
      startMediaRecording(sourceId, sourceName);
    });

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
      console.log('Game processes:', processes);
      setGameProcesses(processes);
    } catch (error) {
      console.error('Failed to load game processes:', error);
    }
  };

  const loadRecordings = async () => {
    try {
      const recordings = await window.electronAPI.getRecordings();
      setRecordings(recordings);
    } catch (error) {
      console.error('Failed to load recordings:', error);
    }
  };

  const loadRecordingData = async (filePath) => {
    try {
      const result = await window.electronAPI.readRecording(filePath);
      if (result.success) {
        setRecordingData(result.data);
      } else {
        console.error('Failed to load recording data:', result.error);
      }
    } catch (error) {
      console.error('Failed to load recording data:', error);
    }
  };

  const startMediaRecording = async (sourceId, sourceName) => {
    try {
      // Get the stream for the selected source
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
            minWidth: 1280,
            maxWidth: 1920,
            minHeight: 720,
            maxHeight: 1080
          }
        }
      });

      // Create MediaRecorder instance
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp9'
      });

      mediaRecorderRef.current = mediaRecorder;
      recordedChunksRef.current = [];

      // Handle data availability
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };

      // Handle recording stop
      mediaRecorder.onstop = async () => {
        // Create a blob from the recorded chunks
        const blob = new Blob(recordedChunksRef.current, {
          type: 'video/webm;codecs=vp9'
        });

        // Save the recording to file
        // const filename = `recording-${new Date().toISOString().replace(/:/g, '-')}.webm`;
        const filename = `recording-${new Date().toLocaleString('zh-CN').replace(/[/:]/g, '-').replace(/\s/g, '_')}.webm`; const arrayBuffer = await blob.arrayBuffer();
        const result = await window.electronAPI.saveRecording(arrayBuffer, filename);

        if (result.success) {
          console.log('Recording saved successfully');
        } else {
          console.error('Failed to save recording:', result.error);
        }

        // Clean up the stream tracks
        stream.getTracks().forEach(track => track.stop());

        // Update UI
        setIsRecording(false);

        // Refresh recordings list
        loadRecordings();
      };

      // Start recording
      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error starting media recording:', error);
      alert('Failed to start recording: ' + error.message);
    }
  };

  const startRecording = async () => {
    if (!selectedGame) {
      alert('Please select a game to record');
      return;
    }

    try {
      const result = await window.electronAPI.startRecording({
        gameId: selectedGame.pid,
        gameName: selectedGame.name
      });

      if (!result.success) {
        alert('Failed to start recording: ' + result.message);
      }
    } catch (error) {
      console.error('Failed to start recording:', error);
      alert('Failed to start recording');
    }
  };

  const stopRecording = async () => {
    try {
      const result = await window.electronAPI.stopRecording();

      if (!result.success) {
        alert('Failed to stop recording: ' + result.message);
      }
    } catch (error) {
      console.error('Failed to stop recording:', error);
      alert('Failed to stop recording');
    }
  };

  const deleteRecording = async (recording) => {
    if (window.confirm(`Are you sure you want to delete "${recording.name}"?`)) {
      try {
        const result = await window.electronAPI.deleteRecording(recording.id);
        if (result.success) {
          // Refresh recordings list
          loadRecordings();
          // If we were viewing this recording, close the viewer
          if (selectedRecording && selectedRecording.id === recording.id) {
            setSelectedRecording(null);
            setRecordingData(null);
          }
        } else {
          alert('Failed to delete recording: ' + result.error);
        }
      } catch (error) {
        console.error('Failed to delete recording:', error);
        alert('Failed to delete recording');
      }
    }
  };

  // When a recording is selected, load its data
  useEffect(() => {
    if (selectedRecording) {
      loadRecordingData(selectedRecording.filePath);
    } else {
      setRecordingData(null);
    }
  }, [selectedRecording]);

  return (
    <div className="app">
      <header className="app-header">
        <h1>Game Recorder</h1>
        <div className="tabs">
          <button
            className={activeTab === 'games' ? 'active' : ''}
            onClick={() => setActiveTab('games')}
          >
            Games
          </button>
          <button
            className={activeTab === 'recordings' ? 'active' : ''}
            onClick={() => {
              setActiveTab('recordings');
              loadRecordings();
            }}
          >
            Recordings ({recordings.length})
          </button>
        </div>
        {isRecording && (
          <div className="recording-indicator">
            <span className="recording-dot"></span>
            <span>Recording in progress...</span>
          </div>
        )}
      </header>

      <main className="app-main">
        {activeTab === 'games' ? (
          <>
            <section className="game-selection">
              <h2>Running Games ({gameProcesses.length})</h2>
              {gameProcesses.length === 0 ? (
                <p>No game processes found. Make sure your games are running.</p>
              ) : (
                <div className="process-list">
                  {gameProcesses.map(process => (
                    <div
                      key={process.pid}
                      className={`process-item ${selectedGame && selectedGame.pid === process.pid ? 'selected' : ''}`}
                      onClick={() => setSelectedGame(process)}
                    >
                      <h3>{process.name}</h3>
                      <p>{process.path}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="recording-controls">
              <h2>Recording Controls</h2>
              {selectedGame ? (
                <div className="selected-game">
                  <h3>Selected: {selectedGame.name}</h3>
                  <div className="controls">
                    {!isRecording ? (
                      <button className="record-button" onClick={startRecording}>
                        Start Recording
                      </button>
                    ) : (
                      <button className="stop-button" onClick={stopRecording}>
                        Stop Recording
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <p>Please select a game to record</p>
              )}
            </section>
          </>
        ) : (
          <section className="recordings-section">
            <h2>Recordings</h2>
            {selectedRecording ? (
              <div className="recording-viewer">
                <div className="viewer-header">
                  <button onClick={() => {
                    setSelectedRecording(null);
                    setRecordingData(null);
                  }}>&larr; Back to recordings</button>
                  <h3>{selectedRecording.name}</h3>
                </div>
                <div className="video-container">
                  {recordingData ? (
                    <video
                      src={`data:video/webm;base64,${recordingData}`}
                      controls
                      autoPlay
                    />
                  ) : (
                    <p>Loading video...</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="recordings-list">
                {recordings.length === 0 ? (
                  <p>No recordings found.</p>
                ) : (
                  recordings.map(recording => (
                    <div key={recording.id} className="recording-item">
                      <div className="recording-thumbnail">
                        <div className="play-icon">▶</div>
                      </div>
                      <div className="recording-info">
                        <h3>{recording.name}</h3>
                        <p>{new Date(recording.date).toLocaleString()}</p>
                        <div className="recording-actions">
                          <button
                            className="play-button"
                            onClick={() => setSelectedRecording(recording)}
                          >
                            Play
                          </button>
                          <button
                            className="delete-button"
                            onClick={() => deleteRecording(recording)}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}

export default App;