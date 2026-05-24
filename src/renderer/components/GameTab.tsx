import type { GameProcess } from '../types/electron-api';

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
        <h2>录制控制</h2>
        {selectedGame ? (
          <div className="selected-game">
            <h3>已选择游戏: {selectedGame.name}</h3>
            <div className="controls">
              {!isRecording ? (
                <button className="record-button" onClick={() => onStartRecording(selectedGame)}>
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
          <p>请从下方列表中选择一个游戏程序开始录制</p>
        )}
      </section>
      <section className="game-selection">
        <h2>正在运行的游戏程序 ({gameProcesses.length})</h2>
        <button onClick={onRefreshProcesses}>刷新</button>
        {gameProcesses.length === 0 ? (
          <>
            <p>没有检测到正在运行的游戏程序，请确保游戏已经启动</p>
            <button onClick={onStartGame}>打开游戏</button>
          </>
        ) : (
          <div className="process-list">
            {gameProcesses.map(process => (
              <div
                key={process.pid}
                className={`process-item ${selectedGame && selectedGame.pid === process.pid ? 'selected' : ''}`}
                onClick={() => onSelectGame(process)}
              >
                <h3>{process.name}</h3>
              </div>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}

export default GameTab;
