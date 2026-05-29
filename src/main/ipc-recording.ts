import { ipcMain, BrowserWindow } from 'electron';
import path from 'path';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import { randomUUID } from 'crypto';
import logger from './logger';
import { createRecordingsDir, isPathInside, recordingUrlMap, setRecordingUrl } from './utils';
import { getGlobalConfig, getFavoritesConfig, saveFavoritesConfig } from './config';
import { compressVideo, generateVideoThumbnail } from './services/ffmpeg';

export const registerRecordingHandlers = (): void => {

  ipcMain.handle('save-recording', async (_event, buffer: ArrayBuffer, filename: string, shouldCompress = false) => {
    try {
      const config = getGlobalConfig();
      let recordingsDir;
      try {
        recordingsDir = config.recordingsDir || await createRecordingsDir();
      } catch {
        recordingsDir = await createRecordingsDir();
      }
      const filePath = path.join(recordingsDir, filename);
      const bufferData = Buffer.from(buffer);

      if (shouldCompress) {
        const tempPath = path.join(recordingsDir, `temp_${Date.now()}_${filename}`);
        await fs.writeFile(tempPath, bufferData);
        try {
          const compressedPath = path.join(recordingsDir, filename.replace('.webm', '_compressed.mp4'));
          await compressVideo(tempPath, compressedPath);
          await fs.unlink(tempPath);
          return { success: true, filePath: compressedPath };
        } catch (compressError) {
          logger.error('Error compressing video:', compressError);
          await fs.unlink(tempPath).catch(() => {});
          await fs.writeFile(filePath, bufferData);
          return { success: true, filePath, warning: 'Compression failed, saved original file' };
        }
      } else {
        await fs.writeFile(filePath, bufferData);
        return { success: true, filePath };
      }
    } catch (error) {
      logger.error('Error saving recording:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('get-recordings', async () => {
    try {
      const config = getGlobalConfig();
      let recordingsDir;
      try {
        recordingsDir = config.recordingsDir || await createRecordingsDir();
      } catch {
        recordingsDir = await createRecordingsDir();
      }
      const files = await fs.readdir(recordingsDir);
      const videoFiles = files.filter(f => f.endsWith('.webm') || f.endsWith('.mp4'));
      const results = await Promise.all(
        videoFiles.map(async file => {
          const filePath = path.join(recordingsDir, file);
          const stats = await fs.stat(filePath);
          return {
            id: file,
            name: file.replace('.webm', '').replace('_compressed.mp4', ''),
            date: stats.birthtime.toISOString(),
            filePath,
            size: stats.size,
          };
        })
      );
      results.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      return results;
    } catch (error) {
      logger.error('Error getting recordings:', error);
      return [];
    }
  });

  ipcMain.handle('delete-recording', async (_event, filename: string) => {
    try {
      const config = getGlobalConfig();
      let recordingsDir;
      try {
        recordingsDir = config.recordingsDir || await createRecordingsDir();
      } catch {
        recordingsDir = await createRecordingsDir();
      }
      const recordingId = path.basename(filename);
      const filePath = path.join(recordingsDir, recordingId);
      await fs.unlink(filePath);

      const cacheDir = path.join(require('electron').app.getPath('userData'), 'cache', 'thumbnails');
      const thumbnailPath = path.join(cacheDir, recordingId.replace(/\.[^/.]+$/, '_thumb.png'));
      try { await fs.unlink(thumbnailPath); } catch { /* ignore */ }

      const favorites = await getFavoritesConfig();
      favorites.favorites = favorites.favorites.filter((id: string) => id !== recordingId);
      delete (favorites as Record<string, unknown>).notes[recordingId];
      delete (favorites as Record<string, unknown>).recordingGroups[recordingId];
      await saveFavoritesConfig(favorites);

      return { success: true };
    } catch (error) {
      logger.error('Error deleting recording:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('get-recording-url', async (_event, filePath: string) => {
    try {
      const config = getGlobalConfig();
      const recordingsDir = config.recordingsDir || await createRecordingsDir();
      const resolvedFilePath = path.resolve(filePath);
      if (!isPathInside(recordingsDir, resolvedFilePath)) {
        return { success: false, error: 'Recording path is outside recordings directory' };
      }
      if (!resolvedFilePath.endsWith('.webm') && !resolvedFilePath.endsWith('.mp4')) {
        return { success: false, error: 'Unsupported recording file type' };
      }
      await fs.access(resolvedFilePath);
      const token = randomUUID();
      setRecordingUrl(token, resolvedFilePath);
      return { success: true, url: `recording://local/${token}/${encodeURIComponent(path.basename(resolvedFilePath))}` };
    } catch (error) {
      logger.error('Error creating recording URL:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('generate-thumbnail', async (_event, filePath: string) => {
    try {
      const { app } = require('electron');
      const cacheDir = path.join(app.getPath('userData'), 'cache', 'thumbnails');
      const filename = path.basename(filePath);
      const thumbnailPath = path.join(cacheDir, filename.replace(/\.[^/.]+$/, '_thumb.png'));
      try { await fs.access(cacheDir); } catch { await fs.mkdir(cacheDir, { recursive: true }); }
      try {
        await fs.access(thumbnailPath);
        const data = await fs.readFile(thumbnailPath);
        return { success: true, data: data.toString('base64') };
      } catch {
        const result = await generateVideoThumbnail(filePath, thumbnailPath);
        return { success: true, data: result.data };
      }
    } catch (error) {
      logger.error('Error generating thumbnail:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('get-recordings-dir', async () => {
    try {
      const config = getGlobalConfig();
      return { success: true, recordingsDir: config.recordingsDir || await createRecordingsDir() };
    } catch {
      return { success: true, recordingsDir: await createRecordingsDir() };
    }
  });

  ipcMain.handle('stop-recording', async (event) => {
    try {
      logger.info('Stopping recording');
      event.sender.send('stop-recording');
      return { success: true, message: 'Recording stopped' };
    } catch (error) {
      logger.error('Error stopping recording:', error);
      return { success: false, message: (error as Error).message };
    }
  });

  ipcMain.handle('set-recording-target', async (_event, gameName: string) => {
    const { setPendingRecordingTarget } = await import('./utils');
    setPendingRecordingTarget(gameName);
    return { success: true };
  });

  ipcMain.handle('analyze-recording', async (_event, filePath: string) => {
    try {
      const { analyze } = await import('./services/gemini');
      const config = getGlobalConfig();
      if (!config.apiKey) return { success: false, error: 'API key not found' };
      const text = await analyze(filePath, config.apiKey);
      return { success: true, text };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });
};
