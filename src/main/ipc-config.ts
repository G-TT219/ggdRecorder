import { ipcMain, dialog } from 'electron';
import * as fs from 'fs/promises';
import { spawn } from 'child_process';
import path from 'path';
import logger from './logger';
import { getGlobalConfig, setGlobalConfig, saveAppConfig } from './config';

export const registerConfigHandlers = (): void => {
  ipcMain.handle('get-app-config', async () => {
    try { return { success: true, config: getGlobalConfig() }; }
    catch { return { success: false }; }
  });

  ipcMain.handle('set-compressVideos', async (_event, compressVideos: boolean) => {
    try {
      const config = getGlobalConfig();
      config.compressVideos = compressVideos;
      const ok = await saveAppConfig(config);
      return ok ? { success: true, compressVideos } : { success: false, error: 'save failed' };
    } catch { return { success: false, error: 'save failed' }; }
  });

  ipcMain.handle('set-recordings-dir', async (_event, dirPath: string) => {
    try {
      try { await fs.access(dirPath); } catch { await fs.mkdir(dirPath, { recursive: true }); }
      const config = getGlobalConfig();
      config.recordingsDir = dirPath;
      const ok = await saveAppConfig(config);
      return ok ? { success: true, recordingsDir: dirPath } : { success: false, error: 'save failed' };
    } catch { return { success: false, error: 'save failed' }; }
  });

  ipcMain.handle('select-recordings-dir', async () => {
    try {
      const result = await dialog.showOpenDialog({ properties: ['openDirectory'] });
      if (!result.canceled && result.filePaths.length > 0) {
        const dirPath = result.filePaths[0];
        const config = getGlobalConfig();
        config.recordingsDir = dirPath;
        const ok = await saveAppConfig(config);
        return ok ? { success: true, recordingsDir: dirPath } : { success: false, error: 'save failed' };
      }
      return { success: false, canceled: true };
    } catch { return { success: false, error: 'dialog error' }; }
  });

  ipcMain.handle('open-dir', async (_event, dirPath: string) => {
    try {
      const { shell } = require('electron');
      const stat = await fs.stat(dirPath);
      if (!stat.isDirectory()) return { success: false, error: 'Path is not a directory' };
      shell.openPath(dirPath);
      return { success: true };
    } catch { return { success: false, error: 'open failed' }; }
  });

  ipcMain.handle('get-game-path', async () => {
    try {
      const config = getGlobalConfig();
      return config.gamePath ? { success: true, gamePath: config.gamePath } : { success: false, error: 'please select game path' };
    } catch { return { success: false, error: 'error' }; }
  });

  ipcMain.handle('select-game-path', async () => {
    try {
      const result = await dialog.showOpenDialog({ properties: ['openFile'], filters: [{ name: 'Executable Files', extensions: ['exe'] }] });
      if (!result.canceled && result.filePaths.length > 0) {
        const gamePath = result.filePaths[0];
        const config = getGlobalConfig();
        config.gamePath = gamePath;
        const ok = await saveAppConfig(config);
        return ok ? { success: true, gamePath } : { success: false, error: 'save failed' };
      }
      return { success: false, canceled: true };
    } catch { return { success: false, error: 'dialog error' }; }
  });

  ipcMain.handle('start-game', (_event, gamePath: string) => {
    try {
      spawn(gamePath, { detached: true });
      return { success: true };
    } catch { return { success: false }; }
  });

  ipcMain.handle('save-api-key', async (_event, apiKey: string) => {
    try {
      const config = getGlobalConfig();
      config.apiKey = apiKey;
      await saveAppConfig(config);
      return { success: true };
    } catch { return { success: false, error: 'save failed' }; }
  });

  ipcMain.handle('load-api-key', async () => {
    try {
      const config = getGlobalConfig();
      return { success: true, apiKey: config.apiKey || '' };
    } catch { return { success: true, apiKey: '' }; }
  });

  ipcMain.handle('clear-api-key', async () => {
    try {
      const config = getGlobalConfig();
      config.apiKey = '';
      await saveAppConfig(config);
      return { success: true };
    } catch { return { success: false, error: 'clear failed' }; }
  });

  ipcMain.handle('save-ggd-token', async (_event, token: string) => {
    try {
      const config = getGlobalConfig();
      config.ggdToken = token;
      await saveAppConfig(config);
      return { success: true };
    } catch { return { success: false, error: 'save failed' }; }
  });

  ipcMain.handle('load-ggd-token', async () => {
    try {
      const config = getGlobalConfig();
      return { success: true, token: config.ggdToken || '' };
    } catch { return { success: true, token: '' }; }
  });

  ipcMain.handle('clear-ggd-token', async () => {
    try {
      const config = getGlobalConfig();
      config.ggdToken = '';
      await saveAppConfig(config);
      return { success: true };
    } catch { return { success: false, error: 'clear failed' }; }
  });
};
