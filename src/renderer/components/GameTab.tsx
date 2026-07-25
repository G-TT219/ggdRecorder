import type { GameProcess } from '../types/electron-api';
import Icon from './Icon';

type GameTabProps = {
  gameProcesses: GameProcess[];
  selectedGame: GameProcess | null;
  isRecording: boolean;
  isPaused: boolean;
  gamePath: string;
  onSelectGame: (game: GameProcess) => void;
  onRefreshProcesses: () => void;
  onStartRecording: (game: GameProcess) => void;
  onStopRecording: () => void;
  onPauseResume: () => void;
  onStartGame: () => void;
};

function GameTab({
  gameProcesses,
  selectedGame,
  isRecording,
  isPaused,
  gamePath,
  onSelectGame,
  onRefreshProcesses,
  onStartRecording,
  onStopRecording,
  onPauseResume,
  onStartGame
}: GameTabProps) {
  return (
    <section className="games-section">
      <section className="recording-controls">
        <div className="section-heading">
          <div>
            <span className="section-kicker">CAPTURE</span>
            <h2>录制控制</h2>
            <p>选择一个正在运行的游戏窗口，开始高质量录制。</p>
          </div>
          <span className={`capture-status ${isRecording ? (isPaused ? 'paused' : 'live') : 'ready'}`}>
            <span className="capture-status-dot" aria-hidden="true" />
            {isRecording ? (isPaused ? '已暂停' : '录制中') : '准备就绪'}
          </span>
        </div>
        {selectedGame ? (
          <div className="selected-game">
            <div className="selected-game-overview">
              <span className="process-avatar selected" aria-hidden="true">
                {selectedGame.name.slice(0, 1).toUpperCase()}
              </span>
              <div className="selected-game-copy">
                <span>当前录制目标</span>
                <h3>{selectedGame.name}</h3>
                <small>PID {selectedGame.pid}</small>
              </div>
            </div>
            <div className="controls">
              {!isRecording ? (
                <button className="record-button" onClick={() => onStartRecording(selectedGame)}>
                  <span className="record-button-dot" aria-hidden="true" />
                  开始录制
                </button>
              ) : (
                <div className="recording-controls-group">
                  <button
                    className={`pause-button ${isPaused ? 'resume' : 'pause'}`}
                    onClick={onPauseResume}
                  >
                    {isPaused ? '继续录制' : '暂停录制'}
                  </button>
                  <button className="stop-button" onClick={onStopRecording}>
                    停止录制
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="recording-empty-state">
            <span className="recording-empty-icon" aria-hidden="true"><Icon name="gamepad" size={22} /></span>
            <div>
              <strong>尚未选择录制窗口</strong>
              <p>从下方进程列表选择一个游戏。</p>
            </div>
          </div>
        )}
      </section>
      <section className="game-selection">
        <div className="section-heading compact">
          <div>
            <span className="section-kicker">SOURCES</span>
            <h2>可录制窗口 <span className="section-count">{gameProcesses.length}</span></h2>
          </div>
          <button className="secondary-button icon-button" onClick={onRefreshProcesses} title="刷新进程列表">
            <Icon name="refresh" size={15} />
            刷新
          </button>
        </div>
        {gameProcesses.length === 0 ? (
          <div className="process-empty-state">
            <span className="process-empty-icon" aria-hidden="true"><Icon name="gamepad" size={24} /></span>
            <strong>未检测到游戏窗口</strong>
            <p>启动游戏后刷新列表，或直接从这里打开游戏。</p>
            <button className="secondary-button" onClick={onStartGame} disabled={!gamePath}>打开游戏</button>
          </div>
        ) : (
          <div className="process-list">
            {gameProcesses.map(process => (
              <button
                type="button"
                key={process.pid}
                className={`process-item ${selectedGame && selectedGame.pid === process.pid ? 'selected' : ''}`}
                onClick={() => onSelectGame(process)}
                aria-pressed={selectedGame?.pid === process.pid}
              >
                <span className="process-avatar" aria-hidden="true">{process.name.slice(0, 1).toUpperCase()}</span>
                <span className="process-copy">
                  <strong>{process.name}</strong>
                  <small>PID {process.pid}</small>
                </span>
                <span className="process-check" aria-hidden="true"><Icon name="check" size={14} /></span>
              </button>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}

export default GameTab;
