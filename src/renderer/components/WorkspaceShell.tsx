import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Icon, { type IconName } from './Icon';

export const APP_ERROR_EVENT = 'ggd-app-error';
export const APP_TOAST_EVENT = 'ggd-app-toast';

export type AppToastTone = 'info' | 'success' | 'warning';
export type StudioTheme = 'noir' | 'cream';

export type AppToastPayload = {
  id: number;
  message: string;
  tone: AppToastTone;
  title?: string;
};

let toastSeq = 1;

export function emitAppError(message: string): void {
  if (typeof window !== 'undefined' && message.trim()) {
    window.dispatchEvent(new CustomEvent(APP_ERROR_EVENT, { detail: { message: message.trim() } }));
  }
}

export function emitAppToast(message: string, tone: AppToastTone = 'info', title?: string): void {
  if (typeof window !== 'undefined' && message.trim()) {
    toastSeq += 1;
    window.dispatchEvent(
      new CustomEvent<AppToastPayload>(APP_TOAST_EVENT, {
        detail: { id: toastSeq, message: message.trim(), tone, title },
      })
    );
  }
}

export type WorkspaceId = 'games' | 'recordings' | 'entertainment' | 'stats' | 'settings' | 'capture' | 'review';

type MascotPersona = {
  id: string;
  name: string;
  badge: string;
  quip: string;
  faction: 'goose' | 'duck' | 'neutral';
  icon: string;
};

const MASCOT_PERSONAS: MascotPersona[] = [
  { id: 'detective', name: '侦探鹅', badge: '好鹅阵营', quip: '线索已摊在桌上，准备开录！', faction: 'goose', icon: './assets/role-icons/Detective.png' },
  { id: 'sheriff', name: '警长鹅', badge: '好鹅阵营', quip: '锁定目标，随时收网。', faction: 'goose', icon: './assets/role-icons/Sheriff.png' },
  { id: 'assassin', name: '刺客鸭', badge: '鸭阵营', quip: '嘘…记住每一轮的动线。', faction: 'duck', icon: './assets/role-icons/Assassin.png' },
  { id: 'dodo', name: '呆呆鸟', badge: '中立阵营', quip: '快把我投出去吧！', faction: 'neutral', icon: './assets/role-icons/Dodo.png' },
  { id: 'spy', name: '间谍鸭', badge: '鸭阵营', quip: '录像复盘能看穿一切伪装。', faction: 'duck', icon: './assets/role-icons/Spy.png' },
];

const PERSONA_STORAGE_KEY = 'ggd-recorder.persona.v1';

const loadInitialPersonaIndex = (): number => {
  try {
    const saved = window.localStorage.getItem(PERSONA_STORAGE_KEY);
    if (!saved) return 0;
    const found = MASCOT_PERSONAS.findIndex(item => item.id === saved);
    return found >= 0 ? found : 0;
  } catch {
    return 0;
  }
};

const STUDIO_NAV_ITEMS: Array<{
  id: Exclude<WorkspaceId, 'review' | 'settings'>;
  label: string;
  shortLabel: string;
  hint: string;
  shortcut: string;
  icon: IconName;
}> = [
  { id: 'games', label: '录制台', shortLabel: '录制', hint: '双栏导播台与窗口雷达', shortcut: 'Ctrl+1', icon: 'record' },
  { id: 'recordings', label: '录像影院', shortLabel: '影院', hint: '海报库与时间戳复盘', shortcut: 'Ctrl+2', icon: 'film' },
  { id: 'entertainment', label: '推理沙盘', shortLabel: '沙盘', hint: '13 张地图点位与轨迹', shortcut: 'Ctrl+3', icon: 'map' },
  { id: 'stats', label: '战绩档案', shortLabel: '战绩', hint: '生涯统计与回合投票', shortcut: 'Ctrl+4', icon: 'chart' },
  { id: 'capture', label: '截图标注', shortLabel: '截图', hint: '框选桌面与快速批注', shortcut: 'Ctrl+5', icon: 'image' },
];

type StudioTopBarProps = {
  activeWorkspace: WorkspaceId;
  recordingsCount: number;
  isRecording: boolean;
  isPaused: boolean;
  recordingTimeLabel: string;
  theme: StudioTheme;
  miniMode: boolean;
  isMaximized: boolean;
  onNavigate: (workspace: WorkspaceId) => void;
  onToggleTheme: () => void;
  onToggleMiniMode: () => void;
  onOpenCommand: () => void;
  onMinimize: () => void;
  onMaximize: () => void;
  onClose: () => void;
};

export function StudioTopBar({
  activeWorkspace,
  recordingsCount,
  isRecording,
  isPaused,
  recordingTimeLabel,
  theme,
  miniMode,
  isMaximized,
  onNavigate,
  onToggleTheme,
  onToggleMiniMode,
  onOpenCommand,
  onMinimize,
  onMaximize,
  onClose,
}: StudioTopBarProps) {
  const [personaIndex, setPersonaIndex] = useState(loadInitialPersonaIndex);
  const [badgePopped, setBadgePopped] = useState(false);
  const persona = MASCOT_PERSONAS[personaIndex] || MASCOT_PERSONAS[0];
  const inReview = activeWorkspace === 'review';

  const cyclePersona = () => {
    const nextIndex = (personaIndex + 1) % MASCOT_PERSONAS.length;
    const nextPersona = MASCOT_PERSONAS[nextIndex];
    setPersonaIndex(nextIndex);
    setBadgePopped(true);
    window.setTimeout(() => setBadgePopped(false), 360);
    try {
      window.localStorage.setItem(PERSONA_STORAGE_KEY, nextPersona.id);
    } catch {
      // Ignore storage errors.
    }
    emitAppToast(`${nextPersona.name}：${nextPersona.quip}`, 'info', '身份徽章已切换');
  };

  return (
    <header className={`studio-topbar ${isRecording ? 'is-recording' : ''} ${miniMode ? 'is-mini' : ''}`}>
      <div className="studio-topbar-left">
        {inReview ? (
          <button
            type="button"
            className="studio-review-back"
            onClick={() => onNavigate('recordings')}
            aria-label="退出分屏复盘"
          >
            <span aria-hidden="true">←</span>
            <span>退出分屏复盘</span>
          </button>
        ) : (
          <div className="studio-brand-cluster">
            <button
              type="button"
              className={`studio-mascot-chip faction-${persona.faction} ${badgePopped ? 'is-popping' : ''}`}
              onClick={cyclePersona}
              title={`${persona.name}（${persona.badge}）— 点击切换桌游身份贴纸`}
              aria-label={`当前身份：${persona.name}，点击切换`}
            >
              <img src={persona.icon} alt="" draggable={false} />
            </button>
            <div className="studio-brand-text">
              <strong>GGD<span>STUDIO</span></strong>
              <small>{persona.name}</small>
            </div>
          </div>
        )}
      </div>

      <nav className="studio-nav-island" aria-label="主工作区导航">
        {STUDIO_NAV_ITEMS.map(item => {
          const active = activeWorkspace === item.id || (item.id === 'recordings' && activeWorkspace === 'review');
          const showLive = item.id === 'games' && isRecording;
          return (
            <button
              key={item.id}
              type="button"
              className={`studio-nav-pill ${active ? 'is-active' : ''}`}
              onClick={() => onNavigate(item.id)}
              aria-current={active ? 'page' : undefined}
              title={`${item.label} · ${item.hint} (${item.shortcut})`}
            >
              <span className="studio-nav-pill-icon">
                <Icon name={item.icon} size={15} />
                {showLive && <i className={`studio-live-dot ${isPaused ? 'is-paused' : ''}`} aria-hidden="true" />}
              </span>
              <span className="studio-nav-pill-label">{miniMode ? item.shortLabel : item.label}</span>
              {item.id === 'recordings' && recordingsCount > 0 && (
                <span className="studio-nav-badge">{recordingsCount}</span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="studio-topbar-right">
        {isRecording && (
          <button
            type="button"
            className={`studio-live-capsule ${isPaused ? 'is-paused' : ''}`}
            onClick={() => onNavigate('games')}
            title="点击返回录制台"
          >
            <i aria-hidden="true" />
            <span>{isPaused ? 'PAUSED' : 'REC'}</span>
            <time>{recordingTimeLabel}</time>
          </button>
        )}

        <div className="studio-utility-group">
          <button
            type="button"
            className="studio-tool-btn studio-cmd-trigger"
            onClick={onOpenCommand}
            title="打开命令面板 (Ctrl+K)"
            aria-label="打开命令面板"
          >
            <Icon name="search" size={14} />
            <kbd>⌘K</kbd>
          </button>

          <button
            type="button"
            className="studio-tool-btn"
            onClick={onToggleTheme}
            title={theme === 'noir' ? '切换到奶油桌游浅色主题' : '切换到暖黑侦探深色主题'}
            aria-label={theme === 'noir' ? '切换到奶油桌游浅色主题' : '切换到暖黑侦探深色主题'}
          >
            <Icon name={theme === 'noir' ? 'sun' : 'moon'} size={15} />
          </button>

          <button
            type="button"
            className={`studio-tool-btn ${miniMode ? 'is-active' : ''}`}
            onClick={onToggleMiniMode}
            title={miniMode ? '恢复完整宽屏演播室' : '切换迷你侧边录制窗'}
            aria-label={miniMode ? '恢复完整宽屏演播室' : '切换迷你侧边录制窗'}
          >
            <Icon name={miniMode ? 'maximize' : 'minimize'} size={14} />
          </button>

          <button
            type="button"
            className={`studio-tool-btn ${activeWorkspace === 'settings' ? 'is-active' : ''}`}
            onClick={() => onNavigate('settings')}
            aria-current={activeWorkspace === 'settings' ? 'page' : undefined}
            title="系统设置 (Ctrl+6)"
            aria-label="系统设置"
          >
            <Icon name="settings" size={15} />
          </button>
        </div>

        <div className="studio-window-controls">
          <button type="button" className="studio-win-btn" onClick={onMinimize} title="最小化" aria-label="最小化">
            <svg width="11" height="11" viewBox="0 0 12 12">
              <line x1="1" y1="6" x2="11" y2="6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
          <button
            type="button"
            className="studio-win-btn"
            onClick={onMaximize}
            title={isMaximized ? '还原窗口' : '最大化窗口'}
            aria-label={isMaximized ? '还原窗口' : '最大化窗口'}
          >
            {isMaximized ? (
              <svg width="11" height="11" viewBox="0 0 12 12">
                <rect x="3" y="1" width="8" height="8" rx="1.2" fill="none" stroke="currentColor" strokeWidth="1.4" />
                <rect x="1" y="3" width="8" height="8" rx="1.2" fill="none" stroke="currentColor" strokeWidth="1.4" />
              </svg>
            ) : (
              <svg width="11" height="11" viewBox="0 0 12 12">
                <rect x="1.25" y="1.25" width="9.5" height="9.5" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
              </svg>
            )}
          </button>
          <button type="button" className="studio-win-btn is-close" onClick={onClose} title="关闭窗口" aria-label="关闭窗口">
            <svg width="11" height="11" viewBox="0 0 12 12">
              <line x1="2" y1="2" x2="10" y2="10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="10" y1="2" x2="2" y2="10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}

export type CommandPaletteAction = {
  id: string;
  label: string;
  detail: string;
  shortcut?: string;
  icon?: IconName;
  category?: string;
  keywords?: string;
  run: () => void;
};

type CommandPaletteProps = {
  open: boolean;
  actions: CommandPaletteAction[];
  onClose: () => void;
};

export function CommandPalette({ open, actions, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const filteredActions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return actions;
    return actions.filter(action => {
      const haystack = `${action.label} ${action.detail} ${action.category || ''} ${action.keywords || ''}`.toLowerCase();
      return haystack.includes(normalized);
    });
  }, [actions, query]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    if (activeIndex >= filteredActions.length) {
      setActiveIndex(0);
    }
  }, [activeIndex, filteredActions.length]);

  if (!open) return null;

  const executeAction = (action?: CommandPaletteAction) => {
    if (!action) return;
    action.run();
    onClose();
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (filteredActions.length > 0) {
        setActiveIndex(prev => (prev + 1) % filteredActions.length);
      }
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (filteredActions.length > 0) {
        setActiveIndex(prev => (prev - 1 + filteredActions.length) % filteredActions.length);
      }
    } else if (event.key === 'Enter') {
      event.preventDefault();
      executeAction(filteredActions[activeIndex]);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    }
  };

  return (
    <div className="command-palette-scrim" role="presentation" onMouseDown={onClose}>
      <section
        className="command-palette"
        role="dialog"
        aria-modal="true"
        aria-labelledby="command-palette-title"
        onMouseDown={event => event.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="command-palette-search">
          <span className="command-palette-search-icon" aria-hidden="true">
            <Icon name="search" size={16} />
          </span>
          <input
            ref={inputRef}
            autoFocus
            value={query}
            onChange={event => {
              setQuery(event.target.value);
              setActiveIndex(0);
            }}
            placeholder="搜索工作区、主题切换、录制或复盘指令…"
            aria-label="搜索动作或工作区"
          />
          {query && (
            <button
              type="button"
              className="command-palette-clear"
              onClick={() => {
                setQuery('');
                inputRef.current?.focus();
              }}
              aria-label="清空搜索"
            >
              ×
            </button>
          )}
          <kbd>ESC</kbd>
        </div>

        <div className="command-palette-heading">
          <span id="command-palette-title">
            {query.trim() ? `匹配结果 (${filteredActions.length})` : '快速操作'}
          </span>
          <small>↑↓ 选择 · Enter 执行</small>
        </div>

        <div className="command-palette-list" role="listbox">
          {filteredActions.length === 0 ? (
            <div className="command-palette-empty">
              <img src="./assets/role-icons/Detective.png" alt="" draggable={false} />
              <strong>未找到匹配命令</strong>
              <span>试试输入“主题”、“迷你”、“复盘”或“地图”</span>
            </div>
          ) : (
            filteredActions.map((action, index) => (
              <button
                key={action.id}
                type="button"
                role="option"
                aria-selected={index === activeIndex}
                className={`command-palette-item ${index === activeIndex ? 'is-highlighted' : ''}`}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => executeAction(action)}
              >
                <span className="command-palette-item-leading">
                  <span className="command-palette-item-icon" aria-hidden="true">
                    <Icon name={action.icon || 'sparkles'} size={15} />
                  </span>
                  <span className="command-palette-item-copy">
                    <strong>
                      {action.label}
                      {action.category && <em className="command-palette-cat">{action.category}</em>}
                    </strong>
                    <small>{action.detail}</small>
                  </span>
                </span>
                {action.shortcut && <kbd>{action.shortcut}</kbd>}
              </button>
            ))
          )}
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
    <div className={`recording-dock ${isPaused ? 'is-paused' : ''}`} role="status" aria-live="polite">
      <div className="recording-dock-main">
        <span className="recording-dock-wave" aria-hidden="true">
          <i /><i /><i /><i />
        </span>
        <div>
          <strong>
            {isPaused ? '录制已暂停' : '正在录制'}
            <time className="recording-dock-timer">{formatTime(recordingTime)}</time>
          </strong>
          <span>{selectedGameName || '当前游戏'} · Ctrl+Shift+D 结束</span>
        </div>
      </div>
      <div className="recording-dock-actions">
        <button type="button" className="recording-dock-secondary" onClick={onTogglePause}>
          <Icon name={isPaused ? 'play' : 'pause'} size={12} />
          {isPaused ? '继续' : '暂停'}
        </button>
        <button type="button" className="recording-dock-stop" onClick={onStop}>
          <Icon name="stop" size={12} />
          结束录制
        </button>
        <button type="button" className="recording-dock-library" onClick={onOpenLibrary}>
          影院 <span aria-hidden="true">↗</span>
        </button>
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

type TopErrorToastProps = {
  message: string;
  onClose: () => void;
};

export function TopErrorToast({ message, onClose }: TopErrorToastProps) {
  if (!message) return null;
  return (
    <div className="top-error-toast" role="alert" aria-live="assertive">
      <span className="top-error-toast-icon" aria-hidden="true">
        <Icon name="warning" size={15} />
      </span>
      <div className="top-error-toast-copy">
        <strong>操作未完成</strong>
        <span>{message}</span>
      </div>
      <button type="button" className="top-error-toast-close" onClick={onClose} aria-label="关闭错误提示">×</button>
      <span className="top-toast-progress is-error" aria-hidden="true" />
    </div>
  );
}

type TopStatusToastProps = {
  toast: AppToastPayload | null;
  onClose: () => void;
};

export function TopStatusToast({ toast, onClose }: TopStatusToastProps) {
  if (!toast) return null;
  const iconName: IconName = toast.tone === 'success' ? 'check' : toast.tone === 'warning' ? 'warning' : 'sparkles';
  const defaultTitle = toast.tone === 'success' ? '已完成' : toast.tone === 'warning' ? '提示' : '演播室提示';
  return (
    <div key={toast.id} className={`top-status-toast tone-${toast.tone}`} role="status" aria-live="polite">
      <span className="top-status-toast-icon" aria-hidden="true">
        <Icon name={iconName} size={14} />
      </span>
      <div className="top-status-toast-copy">
        <strong>{toast.title || defaultTitle}</strong>
        <span>{toast.message}</span>
      </div>
      <button type="button" className="top-status-toast-close" onClick={onClose} aria-label="关闭提示">×</button>
      <span className={`top-toast-progress tone-${toast.tone}`} aria-hidden="true" />
    </div>
  );
}
