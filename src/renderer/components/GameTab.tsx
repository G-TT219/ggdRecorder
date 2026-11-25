import { useMemo, useState } from 'react';
import type { GameProcess, Recording, RecordingQuality, RecordingThumbnails } from '../types/electron-api';
import Icon from './Icon';

type GameTabProps = {
  gameProcesses: GameProcess[];
  selectedGame: GameProcess | null;
  isRecording: boolean;
  isPaused: boolean;
  recordingTimeLabel?: string;
  recordingError: string | null;
  gamePath: string;
  recordingsDir: string;
  recordingQuality: RecordingQuality;
  recentRecordings: Recording[];
  recordingThumbnails: RecordingThumbnails;
  miniMode?: boolean;
  onSelectGame: (game: GameProcess) => void;
  onRefreshProcesses: () => void;
  onStartRecording: (game: GameProcess) => void;
  onStopRecording: () => void;
  onPauseResume: () => void;
  onStartGame: () => void;
  onRecordingQualityChange: (quality: RecordingQuality) => void;
  onOpenRecordingsDir: () => void;
  onOpenCapture: () => void;
  onOpenLibrary: () => void;
  onOpenRecording: (recording: Recording, enterReview?: boolean) => void;
};

const isGooseDuckProcess = (name: string): boolean => {
  const lower = name.toLowerCase();
  return lower.includes('duck') || lower.includes('goose');
};

const QUALITY_OPTIONS: Array<{ value: RecordingQuality; label: string; spec: string }> = [
  { value: 'performance', label: '流畅', spec: '30 FPS' },
  { value: 'balanced', label: '均衡', spec: '60 FPS' },
  { value: 'quality', label: '高清', spec: '60 FPS+' },
];

const formatShortSize = (bytes: number): string => {
  if (!bytes) return '0 MB';
  const mb = bytes / (1024 * 1024);
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb.toFixed(mb >= 100 ? 0 : 1)} MB`;
};

function GameTab({
  gameProcesses,
  selectedGame,
  isRecording,
  isPaused,
  recordingTimeLabel = '00:00:00',
  recordingError,
  gamePath,
  recordingsDir,
  recordingQuality,
  recentRecordings,
  recordingThumbnails,
  miniMode = false,
  onSelectGame,
  onRefreshProcesses,
  onStartRecording,
  onStopRecording,
  onPauseResume,
  onStartGame,
  onRecordingQualityChange,
  onOpenRecordingsDir,
  onOpenCapture,
  onOpenLibrary,
  onOpenRecording,
}: GameTabProps) {
  const [processFilter, setProcessFilter] = useState('');
  const selectedIsGGD = selectedGame ? isGooseDuckProcess(selectedGame.name) : false;

  const filteredProcesses = useMemo(() => {
    const query = processFilter.trim().toLowerCase();
    if (!query) return gameProcesses;
    return gameProcesses.filter(
      proc => proc.name.toLowerCase().includes(query) || String(proc.pid).includes(query)
    );
  }, [gameProcesses, processFilter]);

  const currentQualityMeta = QUALITY_OPTIONS.find(opt => opt.value === recordingQuality) || QUALITY_OPTIONS[1];

  return (
    <section className={`studio-deck ${miniMode ? 'is-mini' : ''}`}>
      {/* LEFT: Main Broadcast Monitor & Hardware Control Console */}
      <div className="studio-stage-column">
        <section className={`studio-monitor ${isRecording ? (isPaused ? 'is-paused' : 'is-live') : ''}`}>
          <div className="studio-monitor-telemetry">
            <span className={`studio-onair-pill ${isRecording ? (isPaused ? 'is-paused' : 'is-live') : ''}`}>
              <i aria-hidden="true" />
              {isRecording ? (isPaused ? 'PAUSED' : 'ON AIR') : 'STANDBY'}
            </span>
            <span className="studio-telemetry-spec">
              {currentQualityMeta.label} · {currentQualityMeta.spec}
            </span>
            <time className="studio-monitor-clock">{recordingTimeLabel}</time>
          </div>

          {selectedGame ? (
            <div className="studio-monitor-locked">
              <div className={`studio-target-emblem ${selectedIsGGD ? 'is-ggd' : ''}`}>
                {selectedIsGGD ? (
                  <img src="./assets/role-icons/Goose.png" alt="" draggable={false} />
                ) : (
                  <span>{selectedGame.name.slice(0, 1).toUpperCase()}</span>
                )}
              </div>
              <div className="studio-target-info">
                <span className="studio-target-kicker">
                  TARGET LOCKED
                  {selectedIsGGD && <em className="studio-ggd-stamp">鹅鸭杀识别成功</em>}
                </span>
                <h2>{selectedGame.name}</h2>
                <p>PID {selectedGame.pid} · 画面与系统音频同步直写本地</p>
              </div>
              {isRecording && (
                <div className={`studio-vu-meter ${isPaused ? 'is-paused' : ''}`} aria-hidden="true">
                  <i /><i /><i /><i /><i /><i />
                </div>
              )}
            </div>
          ) : (
            <div className="studio-monitor-idle">
              <div className="studio-sticker-fan" aria-hidden="true">
                <span className="sticker-card s1"><img src="./assets/role-icons/Goose.png" alt="" draggable={false} /></span>
                <span className="sticker-card s2"><img src="./assets/role-icons/Detective.png" alt="" draggable={false} /></span>
                <span className="sticker-card s3"><img src="./assets/role-icons/Duck.png" alt="" draggable={false} /></span>
                <span className="sticker-card s4"><img src="./assets/role-icons/Dodo.png" alt="" draggable={false} /></span>
              </div>
              <h2>推理演播室已就绪</h2>
              <p>从右侧「窗口雷达」点击锁定《鹅鸭杀》或任意游戏窗口，即可一键开录。</p>
            </div>
          )}

          {/* Hardware Shutter Deck */}
          <div className="studio-shutter-deck">
            <div className="studio-shutter-primary">
              {!isRecording ? (
                <button
                  type="button"
                  className="studio-shutter-btn record-button"
                  disabled={!selectedGame}
                  onClick={() => selectedGame && onStartRecording(selectedGame)}
                >
                  <span className="shutter-lens" aria-hidden="true"><i /></span>
                  <span>{selectedGame ? '开始录制本局' : '请先在右侧锁定窗口'}</span>
                  <kbd>Ctrl+Shift+S</kbd>
                </button>
              ) : (
                <div className="studio-live-actions">
                  <button
                    type="button"
                    className={`studio-control-btn pause-button ${isPaused ? 'resume' : 'pause'}`}
                    onClick={onPauseResume}
                  >
                    <Icon name={isPaused ? 'play' : 'pause'} size={15} />
                    <span>{isPaused ? '继续录制' : '暂停录制'}</span>
                  </button>
                  <button type="button" className="studio-control-btn is-stop stop-button" onClick={onStopRecording}>
                    <Icon name="stop" size={15} />
                    <span>结束并保存</span>
                    <kbd>Ctrl+Shift+D</kbd>
                  </button>
                </div>
              )}
            </div>

            <div className="studio-console-row">
              <div className="studio-quality-switcher" role="radiogroup" aria-label="快速切换录制画质">
                <span className="studio-console-label">画质预设</span>
                <div className="studio-quality-pills">
                  {QUALITY_OPTIONS.map(option => (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={recordingQuality === option.value}
                      disabled={isRecording}
                      className={recordingQuality === option.value ? 'is-active' : ''}
                      onClick={() => onRecordingQualityChange(option.value)}
                    >
                      <strong>{option.label}</strong>
                      <small>{option.spec}</small>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="studio-quick-actions">
              <button
                type="button"
                className="studio-action-chip"
                onClick={onStartGame}
                disabled={!gamePath}
                title={gamePath ? `启动：${gamePath}` : '请先在设置中指定游戏路径'}
              >
                <Icon name="rocket" size={14} />
                <span>启动游戏</span>
              </button>
              <button
                type="button"
                className="studio-action-chip"
                onClick={onOpenRecordingsDir}
                title={recordingsDir || '打开录像保存目录'}
              >
                <Icon name="folder" size={14} />
                <span>录像目录</span>
              </button>
              <button type="button" className="studio-action-chip" onClick={onOpenCapture}>
                <Icon name="image" size={14} />
                <span>截图标注</span>
              </button>
            </div>
          </div>
        </section>

        {recordingError && (
          <div className="recording-error" role="alert">
            <Icon name="warning" size={16} />
            <span>{recordingError}</span>
          </div>
        )}
      </div>

      {/* RIGHT: Window Radar + Recent Matches Shelf */}
      <div className="studio-rack-column">
        <section className="studio-radar-card">
          <div className="studio-card-head">
            <div>
              <span className="studio-card-eyebrow">SOURCE RADAR</span>
              <h3>窗口雷达 <span className="studio-count-pill">{gameProcesses.length}</span></h3>
            </div>
            <button
              type="button"
              className="studio-ghost-btn"
              onClick={onRefreshProcesses}
              title="重新扫描运行中的游戏窗口"
            >
              <Icon name="refresh" size={14} />
              <span>刷新</span>
            </button>
          </div>

          {gameProcesses.length > 4 && (
            <div className="studio-radar-search">
              <Icon name="search" size={13} />
              <input
                value={processFilter}
                onChange={e => setProcessFilter(e.target.value)}
                placeholder="筛选进程名或 PID…"
                aria-label="筛选游戏窗口"
              />
            </div>
          )}

          {filteredProcesses.length === 0 ? (
            <div className="studio-radar-empty">
              <img src="./assets/role-icons/Sheriff.png" alt="" draggable={false} />
              <strong>{gameProcesses.length === 0 ? '未侦测到游戏窗口' : '没有匹配的窗口'}</strong>
              <p>
                {gameProcesses.length === 0
                  ? '先启动《鹅鸭杀》后点击刷新，或直接点左侧“启动游戏”。'
                  : '换个关键词试试，或清空筛选框。'}
              </p>
            </div>
          ) : (
            <div className="studio-radar-list">
              {filteredProcesses.map(proc => {
                const isGGD = isGooseDuckProcess(proc.name);
                const isSelected = Boolean(selectedGame && selectedGame.pid === proc.pid);
                return (
                  <button
                    key={proc.pid}
                    type="button"
                    className={`studio-radar-item ${isSelected ? 'is-selected' : ''} ${isGGD ? 'is-ggd' : ''}`}
                    onClick={() => onSelectGame(proc)}
                    aria-pressed={isSelected}
                  >
                    <span className={`studio-radar-avatar ${isGGD ? 'is-ggd' : ''}`} aria-hidden="true">
                      {isGGD ? (
                        <img src="./assets/role-icons/Goose.png" alt="" draggable={false} />
                      ) : (
                        proc.name.slice(0, 1).toUpperCase()
                      )}
                    </span>
                    <span className="studio-radar-copy">
                      <strong>
                        {proc.name}
                        {isGGD && <em className="studio-ggd-mini">推荐</em>}
                      </strong>
                      <small>PID {proc.pid}</small>
                    </span>
                    <span className="studio-radar-check" aria-hidden="true">
                      <Icon name="check" size={13} />
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {!miniMode && (
          <section className="studio-recent-card">
            <div className="studio-card-head">
              <div>
                <span className="studio-card-eyebrow">RECENT TAPES</span>
                <h3>最近战局</h3>
              </div>
              <button type="button" className="studio-link-btn" onClick={onOpenLibrary}>
                全部录像 ↗
              </button>
            </div>

            {recentRecordings.length === 0 ? (
              <div className="studio-recent-empty">
                <span>还没有录像带 — 录下第一局后会自动出现在这里。</span>
              </div>
            ) : (
              <div className="studio-recent-list">
                {recentRecordings.slice(0, 4).map(rec => (
                  <div key={rec.id} className="studio-recent-item">
                    <button
                      type="button"
                      className="studio-recent-main"
                      onClick={() => onOpenRecording(rec, false)}
                      title={`播放 ${rec.name}`}
                    >
                      <span className="studio-recent-thumb">
                        {recordingThumbnails[rec.id] ? (
                          <img src={`data:image/png;base64,${recordingThumbnails[rec.id]}`} alt="" />
                        ) : (
                          <Icon name="play" size={16} />
                        )}
                      </span>
                      <span className="studio-recent-copy">
                        <strong>{rec.name}</strong>
                        <small>
                          {new Date(rec.date).toLocaleDateString('zh-CN')} · {formatShortSize(rec.size)}
                        </small>
                      </span>
                    </button>
                    <button
                      type="button"
                      className="studio-recent-review"
                      onClick={() => onOpenRecording(rec, true)}
                      title="直接进入地图分屏复盘"
                      aria-label={`分屏复盘 ${rec.name}`}
                    >
                      <Icon name="split" size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </section>
  );
}

export default GameTab;
