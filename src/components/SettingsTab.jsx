import { useState, useEffect, useRef } from 'react';
import Logger from '../utils/logger';

function SettingsTab({ recordingsDir, gamePath, compressVideos, onRecordingsDirChange, onGamePathChange, onCompressVideosChange }) {
  const [apiKey, setApiKey] = useState('');
  const [ggdToken, setGgdToken] = useState('');
  const sectionRef = useRef(null);

  useEffect(() => {
    loadApiKey();
    loadGgdToken();
  }, []);

  useEffect(() => {
    if (sectionRef.current) {
      sectionRef.current.scrollTop = 0;
    }
  }, []);

  const selectRecordingsDir = async () => {
    try {
      const result = await window.electronAPI.selectRecordingsDir();
      if (result.success) {
        onRecordingsDirChange(result.recordingsDir);
        Logger.info('Recordings directory changed to: ' + result.recordingsDir);
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
        onGamePathChange(result.gamePath);
        Logger.info('Game path selected: ' + result.gamePath);
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
        Logger.info('Directory opened: ' + path);
      }
    } catch (error) {
      Logger.error('Error opening directory:', error);
    }
  };

  const getDirname = (path) => {
    const lastSlashIndex = path.lastIndexOf('\\') || path.lastIndexOf('/');
    return lastSlashIndex !== -1 ? path.substring(0, lastSlashIndex) : '';
  };

  const handleCompressVideosChange = (e) => {
    onCompressVideosChange(e.target.checked);
    window.electronAPI.setCompressVideosConfig(e.target.checked);
    Logger.info('Compress videos config set to: ' + e.target.checked);
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
        alert('保存GGD Token时发生错误: ' + error.message);
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

  return (
    <section className="settings-section" ref={sectionRef}>
      <div className="settings-container">
        {/* Recording path */}
        <div className="settings-card">
          <div className="settings-card-header">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 6a2 2 0 012-2h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
              <circle cx="12" cy="13" r="3" />
              <path d="M10 16l-2 3h8l-2-3" />
            </svg>
            <div>
              <span className="settings-card-title">录像保存路径</span>
              <span className="settings-card-subtitle">录像文件存放目录</span>
            </div>
          </div>
          <div className="settings-field">
            <div className="settings-path-row">
              <div className="settings-path-input">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
                <span className="settings-path-text">{recordingsDir || '默认路径（视频目录/GameRecorder）'}</span>
              </div>
            </div>
            <div className="settings-actions">
              <button className="setting-btn secondary" onClick={() => openDir(recordingsDir)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                打开位置
              </button>
              <button className="setting-btn primary" onClick={selectRecordingsDir}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v14" />
                  <path d="M5 12h14" />
                </svg>
                选择路径
              </button>
            </div>
          </div>
        </div>

        {/* Compression */}
        <div className="settings-card">
          <div className="settings-card-header">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
              <line x1="4" y1="22" x2="4" y2="15" />
            </svg>
            <div>
              <span className="settings-card-title">视频压缩</span>
              <span className="settings-card-subtitle">录制后自动压缩以节省存储空间</span>
            </div>
            <label className="settings-toggle">
              <input type="checkbox" checked={compressVideos} onChange={handleCompressVideosChange} />
              <span className="settings-toggle-track">
                <span className="settings-toggle-knob"></span>
              </span>
            </label>
          </div>
        </div>

        {/* Game path */}
        <div className="settings-card">
          <div className="settings-card-header">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 14h4" /><path d="M8 12v4" /><path d="M15 13h.01" /><path d="M18 15h.01" />
              <path d="M7 9h10a5 5 0 014.7 6.7l-.7 2A2 2 0 0117.3 18l-2-2H8.7l-2 2A2 2 0 013 17.7l-.7-2A5 5 0 017 9z" />
            </svg>
            <div>
              <span className="settings-card-title">游戏程序路径</span>
              <span className="settings-card-subtitle">用于快速启动游戏</span>
            </div>
          </div>
          <div className="settings-field">
            <div className="settings-path-row">
              <div className="settings-path-input">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                <span className="settings-path-text">{gamePath || '未设置'}</span>
              </div>
            </div>
            <div className="settings-actions">
              <button className="setting-btn secondary" onClick={() => openDir(getDirname(gamePath))} disabled={!gamePath}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                打开位置
              </button>
              <button className="setting-btn primary" onClick={selectGamePath}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v14" /><path d="M5 12h14" />
                </svg>
                选择路径
              </button>
            </div>
          </div>
        </div>

        {/* API Key */}
        <div className="settings-card">
          <div className="settings-card-header">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0110 0v4" />
            </svg>
            <div>
              <span className="settings-card-title">AI API密钥</span>
              <span className="settings-card-subtitle">用于 Google Gemini 视频分析</span>
            </div>
            <span className={`settings-badge ${apiKey ? 'active' : ''}`}>{apiKey ? '已设置' : '未设置'}</span>
          </div>
          <div className="settings-field">
            <div className="settings-input-row">
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="输入 Google Gemini API 密钥"
                className="settings-text-input"
              />
            </div>
            <div className="settings-actions">
              <button className="setting-btn primary" onClick={saveApiKey}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
                  <polyline points="17 21 17 13 7 13 7 21" />
                  <polyline points="7 3 7 8 15 8" />
                </svg>
                保存
              </button>
              <button className="setting-btn danger" onClick={clearApiKey}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                </svg>
                清除
              </button>
            </div>
          </div>
        </div>

        {/* GGD Token */}
        <div className="settings-card">
          <div className="settings-card-header">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0110 0v4" />
            </svg>
            <div>
              <span className="settings-card-title">GGD战绩查询Token</span>
              <span className="settings-card-subtitle">用于 gaggle.fun 战绩 API</span>
            </div>
            <span className={`settings-badge ${ggdToken ? 'active' : ''}`}>{ggdToken ? '已设置' : '未设置'}</span>
          </div>
          <div className="settings-field">
            <div className="settings-input-row">
              <input
                type="password"
                value={ggdToken}
                onChange={(e) => setGgdToken(e.target.value)}
                placeholder="输入 GGD API Token"
                className="settings-text-input"
              />
            </div>
            <div className="settings-actions">
              <button className="setting-btn primary" onClick={saveGgdToken}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
                  <polyline points="17 21 17 13 7 13 7 21" />
                  <polyline points="7 3 7 8 15 8" />
                </svg>
                保存
              </button>
              <button className="setting-btn danger" onClick={clearGgdToken}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                </svg>
                清除
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default SettingsTab;
