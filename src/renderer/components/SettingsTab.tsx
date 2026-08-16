import { useState, useEffect, useRef } from 'react';
import Logger from '../utils/logger';
import type { RecordingQuality } from '../../shared/types';

type SettingsTabProps = {
  recordingsDir: string;
  gamePath: string;
  recordingQuality: RecordingQuality;
  onRecordingsDirChange: (dir: string) => void;
  onGamePathChange: (path: string) => void;
  onRecordingQualityChange: (quality: RecordingQuality) => void;
};

function SettingsTab({
  recordingsDir,
  gamePath,
  recordingQuality,
  onRecordingsDirChange,
  onGamePathChange,
  onRecordingQualityChange,
}: SettingsTabProps) {
  const sectionRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (sectionRef.current) {
      sectionRef.current.scrollTop = 0;
    }
  }, []);

  const selectRecordingsDir = async () => {
    try {
      const r = await window.electronAPI.selectRecordingsDir();
      if (!r.success && !r.canceled) {
        Logger.error('Failed to select recordings directory:', r.error);
      } else if (r.success) {
        onRecordingsDirChange(r.recordingsDir);
        Logger.info('Recordings directory changed to: ' + r.recordingsDir);
      }
    } catch (error) {
      Logger.error('Error selecting recordings directory:', error);
    }
  };

  const selectGamePath = async () => {
    try {
      const r = await window.electronAPI.selectGamePath();
      if (!r.success && !r.canceled) {
        Logger.error('Failed to select game path:', r.error);
      } else if (r.success) {
        onGamePathChange(r.gamePath);
        Logger.info('Game path selected: ' + r.gamePath);
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
        Logger.error('Failed to start game');
      } else {
        Logger.info('Game started successfully');
      }
    } catch (error) {
      Logger.error('Error starting game:', error);
    }
  };

  const openDir = async (path: string) => {
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

  const getDirname = (path: string) => {
    const lastSlashIndex = Math.max(path.lastIndexOf('\\'), path.lastIndexOf('/'));
    return lastSlashIndex !== -1 ? path.substring(0, lastSlashIndex) : '';
  };

  const handleRecordingQualityChange = async (quality: RecordingQuality) => {
    if (quality === recordingQuality) return;
    const previousQuality = recordingQuality;
    onRecordingQualityChange(quality);
    const result = await window.electronAPI.setRecordingQualityConfig(quality);
    if (!result.success) {
      onRecordingQualityChange(previousQuality);
      Logger.error('Failed to save recording quality:', result.error);
    } else {
      Logger.info('Recording quality set to: ' + quality);
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

        {/* Recording quality */}
        <div className="settings-card recording-quality-card">
          <div className="settings-card-header">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <path d="M7 15l3-3 2 2 3-4 2 2" />
            </svg>
            <div>
              <span className="settings-card-title">录制质量</span>
              <span className="settings-card-subtitle">录制时直接编码并持续写盘，不再进行录后压缩</span>
            </div>
            <span className="settings-badge active">实时写盘</span>
          </div>
          <div className="settings-field">
            <div className="recording-quality-options" role="radiogroup" aria-label="录制质量">
              {([
                ['performance', '流畅', '30 FPS · 较低资源占用', 1],
                ['balanced', '均衡', '最高 60 FPS · 日常推荐', 2],
                ['quality', '高质量', '最高 60 FPS · 更多细节', 3],
              ] as const).map(([value, label, description, level]) => (
                <button
                  type="button"
                  role="radio"
                  aria-checked={recordingQuality === value}
                  key={value}
                  className={recordingQuality === value ? 'active' : ''}
                  data-quality={value}
                  onClick={() => handleRecordingQualityChange(value)}
                >
                  <span className="recording-quality-option-title">
                    {label}
                    <i className="recording-quality-level" aria-hidden="true">
                      {[1, 2, 3].map(item => <b key={item} className={item <= level ? 'filled' : ''} />)}
                    </i>
                  </span>
                  <small>{description}</small>
                </button>
              ))}
            </div>
            <p className="recording-quality-note">
              分辨率跟随录制源，帧率最高 60 FPS；程序会根据实际画面尺寸自动计算码率。
            </p>
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


      </div>
    </section>
  );
}

export default SettingsTab;
