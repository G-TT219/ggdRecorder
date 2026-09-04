import type { ReactNode } from 'react';
import Icon from './Icon';

export type WorkspaceId = 'games' | 'recordings' | 'entertainment' | 'stats' | 'settings' | 'capture' | 'review';

type WorkspaceRailProps = {
  activeWorkspace: WorkspaceId;
  recordingsCount: number;
  isRecording: boolean;
  onNavigate: (workspace: WorkspaceId) => void;
};

const workspaceItems: Array<{
  id: Exclude<WorkspaceId, 'review'>;
  label: string;
  hint: string;
  icon: 'gamepad' | 'play' | 'clipboard' | 'chart' | 'warning' | 'ghost';
}> = [
  { id: 'games', label: '录制', hint: '捕捉当前游戏', icon: 'gamepad' },
  { id: 'recordings', label: '录像库', hint: '浏览与复盘', icon: 'play' },
  { id: 'entertainment', label: '标注工作区', hint: '地图与截图', icon: 'clipboard' },
  { id: 'stats', label: '战绩分析', hint: '对局与玩家', icon: 'chart' },
  { id: 'capture', label: '截图', hint: '快速截取画面', icon: 'ghost' },
];

export function WorkspaceRail({ activeWorkspace, recordingsCount, isRecording, onNavigate }: WorkspaceRailProps) {
  return (
    <aside className="workspace-rail" aria-label="工作区导航">
      <div className="workspace-rail-brand">
        <span className="workspace-rail-mark" aria-hidden="true">G</span>
        <span className="workspace-rail-wordmark">GGD<span>REC</span></span>
      </div>

      <div className="workspace-rail-section-label">工作区</div>
      <nav className="workspace-rail-nav">
        {workspaceItems.map(item => {
          const active = activeWorkspace === item.id || (item.id === 'recordings' && activeWorkspace === 'review');
          return (
            <button
              key={item.id}
              type="button"
              className={`workspace-rail-item ${active ? 'is-active' : ''}`}
              onClick={() => onNavigate(item.id)}
              aria-current={active ? 'page' : undefined}
              title={item.hint}
            >
              <span className="workspace-rail-icon"><Icon name={item.icon} size={17} /></span>
              <span className="workspace-rail-copy">
                <strong>{item.label}</strong>
                <small>{item.hint}</small>
              </span>
              {item.id === 'recordings' && recordingsCount > 0 && (
                <span className="workspace-rail-count">{recordingsCount}</span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="workspace-rail-spacer" />
      <div className="workspace-rail-footer">
        <button
          type="button"
          className={`workspace-rail-item workspace-rail-settings ${activeWorkspace === 'settings' ? 'is-active' : ''}`}
          onClick={() => onNavigate('settings')}
          aria-current={activeWorkspace === 'settings' ? 'page' : undefined}
        >
          <span className="workspace-rail-icon workspace-rail-settings-glyph" aria-hidden="true">⌘</span>
          <span className="workspace-rail-copy"><strong>设置</strong><small>偏好与连接</small></span>
        </button>
        <div className={`workspace-rail-recording-state ${isRecording ? 'is-recording' : ''}`}>
          <span className="workspace-rail-state-dot" aria-hidden="true" />
          <span>{isRecording ? '正在录制' : '本地就绪'}</span>
        </div>
      </div>
    </aside>
  );
}

type ContextBarProps = {
  activeWorkspace: WorkspaceId;
  isRecording: boolean;
  onNavigate: (workspace: WorkspaceId) => void;
  onOpenCommand: () => void;
};

const contextTitles: Record<WorkspaceId, { eyebrow: string; title: string; description: string }> = {
  games: { eyebrow: 'WORKSPACE / CAPTURE', title: '录制', description: '选择游戏并开始捕捉' },
  recordings: { eyebrow: 'WORKSPACE / LIBRARY', title: '录像库', description: '浏览、筛选和复盘你的录像' },
  entertainment: { eyebrow: 'WORKSPACE / ANNOTATE', title: '标注工作区', description: '地图、截图与玩家关系' },
  stats: { eyebrow: 'WORKSPACE / ANALYTICS', title: '战绩分析', description: '查看对局与玩家数据' },
  settings: { eyebrow: 'WORKSPACE / SETTINGS', title: '设置', description: '管理应用偏好和连接' },
  capture: { eyebrow: 'WORKSPACE / SNAPSHOT', title: '截图', description: '快速截取并标注画面' },
  review: { eyebrow: 'WORKSPACE / REVIEW', title: '复盘', description: '回看录像并记录关键时刻' },
};

export function ContextBar({ activeWorkspace, isRecording, onNavigate, onOpenCommand }: ContextBarProps) {
  const context = contextTitles[activeWorkspace];
  const inReview = activeWorkspace === 'review';
  return (
    <header className="context-bar">
      <div className="context-bar-leading">
        {inReview && (
          <button type="button" className="context-back-button" onClick={() => onNavigate('recordings')} aria-label="返回录像库">
            <span aria-hidden="true">←</span>
          </button>
        )}
        <div className="context-bar-copy">
          <span className="context-bar-eyebrow">{context.eyebrow}</span>
          <div className="context-bar-title-row">
            <h1>{context.title}</h1>
            <span className="context-bar-slash" aria-hidden="true">/</span>
            <span className="context-bar-description">{context.description}</span>
          </div>
        </div>
      </div>
      <div className="context-bar-actions">
        {isRecording && <span className="context-recording-chip"><i aria-hidden="true" /> LIVE</span>}
        <button type="button" className="context-command-button" title="打开命令面板（Ctrl/Cmd + K）" aria-label="打开命令面板" onClick={onOpenCommand}>
          <span>⌘K</span>
        </button>
      </div>
    </header>
  );
}

export type CommandPaletteAction = {
  id: string;
  label: string;
  detail: string;
  shortcut?: string;
  run: () => void;
};

type CommandPaletteProps = {
  open: boolean;
  actions: CommandPaletteAction[];
  onClose: () => void;
};

export function CommandPalette({ open, actions, onClose }: CommandPaletteProps) {
  if (!open) return null;
  return (
    <div className="command-palette-scrim" role="presentation" onMouseDown={onClose}>
      <section
        className="command-palette"
        role="dialog"
        aria-modal="true"
        aria-labelledby="command-palette-title"
        onMouseDown={event => event.stopPropagation()}
      >
        <div className="command-palette-search">
          <span aria-hidden="true">⌘</span>
          <input autoFocus placeholder="搜索动作或工作区…" aria-label="搜索动作或工作区" />
          <kbd>ESC</kbd>
        </div>
        <div className="command-palette-heading">
          <span id="command-palette-title">快速操作</span>
          <small>按 Enter 执行</small>
        </div>
        <div className="command-palette-list">
          {actions.map(action => (
            <button
              key={action.id}
              type="button"
              className="command-palette-item"
              onClick={() => { action.run(); onClose(); }}
            >
              <span className="command-palette-item-copy"><strong>{action.label}</strong><small>{action.detail}</small></span>
              {action.shortcut && <kbd>{action.shortcut}</kbd>}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

type RecordingDockProps = {
  isRecording: boolean;
  isPaused: boolean;
  recordingTime: number;
  selectedGameName?: string;
  formatTime: (seconds: number) => string;
  onTogglePause: () => void;
  onStop: () => void;
  onOpenLibrary: () => void;
};

export function RecordingDock({
  isRecording,
  isPaused,
  recordingTime,
  selectedGameName,
  formatTime,
  onTogglePause,
  onStop,
  onOpenLibrary,
}: RecordingDockProps) {
  if (!isRecording) return null;
  return (
    <div className="recording-dock" role="status" aria-live="polite">
      <div className="recording-dock-main">
        <span className="recording-dock-pulse" aria-hidden="true" />
        <div>
          <strong>{isPaused ? '录制已暂停' : '正在录制'}</strong>
          <span>{selectedGameName || '当前游戏'} · {formatTime(recordingTime)}</span>
        </div>
      </div>
      <div className="recording-dock-actions">
        <button type="button" className="recording-dock-secondary" onClick={onTogglePause}>
          {isPaused ? '继续' : '暂停'}
        </button>
        <button type="button" className="recording-dock-stop" onClick={onStop}>结束录制</button>
        <button type="button" className="recording-dock-library" onClick={onOpenLibrary}>打开录像库 <span aria-hidden="true">↗</span></button>
      </div>
    </div>
  );
}

type WorkspaceStageProps = {
  children: ReactNode;
};

export function WorkspaceStage({ children }: WorkspaceStageProps) {
  return <div className="workspace-stage">{children}</div>;
}
