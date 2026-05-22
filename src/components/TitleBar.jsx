function TitleBar({ isMaximized, onMinimize, onMaximize, onClose }) {
  return (
    <div className="custom-titlebar">
      <div className="titlebar-drag-region">
        <span className="app-title">游戏录制助手</span>
      </div>
      <div className="titlebar-controls">
        <button className="titlebar-button" onClick={onMinimize} title="最小化">
          <svg width="12" height="12" viewBox="0 0 12 12">
            <line x1="0" y1="6" x2="12" y2="6" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </button>
        <button className="titlebar-button" onClick={onMaximize} title={isMaximized ? '还原' : '最大化'}>
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
        <button className="titlebar-button close-button" onClick={onClose} title="关闭">
          <svg width="12" height="12" viewBox="0 0 12 12">
            <line x1="1" y1="1" x2="11" y2="11" stroke="currentColor" strokeWidth="1.5" />
            <line x1="11" y1="1" x2="1" y2="11" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export default TitleBar;
