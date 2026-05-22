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
        onGamePathChange(result.gamePath);
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

  const handleCompressVideosChange = (e) => {
    onCompressVideosChange(e.target.checked);
    window.electronAPI.setCompressVideosConfig(e.target.checked);
    Logger.info(`Compress videos config set to: ${e.target.checked}`);
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
        alert('清除GGD Token时发生错误: ' + error.message);
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
            <button onClick={() => openDir(recordingsDir)}>打开文件位置</button>
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
              onChange={handleCompressVideosChange}
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
            <button onClick={() => openDir(getDirname(gamePath))}>打开文件位置</button>
            <button onClick={selectGamePath}>选择路径</button>
          </div>
        </div>
        <div className="setting-item">
          <label htmlFor="api-key">AI API密钥:</label>
          <div className="setting-input">
            <input
              type="password"
              id="api-key"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="请输入API密钥"
            />
            <button onClick={saveApiKey}>保存密钥</button>
            <button onClick={clearApiKey}>清除密钥</button>
          </div>
          <p className="setting-description">
            用于AI视频分析功能的API密钥。当前状态: {apiKey ? '已设置' : '未设置'}
          </p>
        </div>

        <div className="setting-item">
          <label htmlFor="ggd-token">GGD战绩查询Token:</label>
          <div className="setting-input">
            <input
              type="password"
              id="ggd-token"
              value={ggdToken}
              onChange={(e) => setGgdToken(e.target.value)}
              placeholder="请输入GGD API Token"
            />
            <button onClick={saveGgdToken}>保存Token</button>
            <button onClick={clearGgdToken}>清除Token</button>
          </div>
          <p className="setting-description">
            用于 Goose Goose Duck 战绩查询API的认证Token。当前状态: {ggdToken ? '已设置' : '未设置'}
          </p>
        </div>
      </div>
    </section>
  );
}

export default SettingsTab;
