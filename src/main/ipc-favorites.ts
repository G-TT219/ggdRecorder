import { ipcMain } from 'electron';
import { randomUUID } from 'crypto';
import * as fs from 'fs/promises';
import path from 'path';
import { app, dialog } from 'electron';
import logger from './logger';
import { getFavoritesConfig, saveFavoritesConfig, getFavoritesResponse } from './config';

export const registerFavoritesHandlers = (): void => {
  ipcMain.handle('get-favorite-recordings', async () => {
    try {
      const favorites = await getFavoritesConfig();
      return { success: true, ...getFavoritesResponse(favorites) };
    } catch (error) {
      logger.error('Error getting favorite recordings:', error);
      return { success: true, favorites: [], notes: {}, groups: [], recordingGroups: {} };
    }
  });

  ipcMain.handle('toggle-favorite-recording', async (_event, recordingId: string, isFavorite: boolean) => {
    try {
      const favorites = await getFavoritesConfig();
      if (isFavorite) {
        if (!favorites.favorites.includes(recordingId)) favorites.favorites.push(recordingId);
      } else {
        favorites.favorites = favorites.favorites.filter(id => id !== recordingId);
        delete favorites.recordingGroups[recordingId];
      }
      const result = await saveFavoritesConfig(favorites);
      return result ? { success: true, ...getFavoritesResponse(favorites) }
                    : { success: false, error: 'Failed to save' };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('save-recording-note', async (_event, recordingId: string, note: string) => {
    try {
      if (!recordingId || typeof recordingId !== 'string') return { success: false, error: 'Invalid recording ID' };
      const noteText = String(note || '').slice(0, 10000);
      const favorites = await getFavoritesConfig();
      if (noteText.trim()) favorites.notes[recordingId] = noteText;
      else delete favorites.notes[recordingId];
      const result = await saveFavoritesConfig(favorites);
      return result ? { success: true, ...getFavoritesResponse(favorites) }
                    : { success: false, error: 'Failed to save' };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('create-favorite-group', async (_event, name: string) => {
    try {
      const groupName = String(name || '').trim().slice(0, 30);
      if (!groupName) return { success: false, error: 'Group name is required' };
      const favorites = await getFavoritesConfig();
      favorites.groups.push({
        id: randomUUID(), name: groupName,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
      });
      const result = await saveFavoritesConfig(favorites);
      return result ? { success: true, ...getFavoritesResponse(favorites) }
                    : { success: false, error: 'Failed to save' };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('rename-favorite-group', async (_event, groupId: string, name: string) => {
    try {
      const groupName = String(name || '').trim().slice(0, 30);
      if (!groupName) return { success: false, error: 'Group name is required' };
      const favorites = await getFavoritesConfig();
      const group = favorites.groups.find(g => g.id === groupId);
      if (!group) return { success: false, error: 'Group not found' };
      group.name = groupName;
      group.updatedAt = new Date().toISOString();
      const result = await saveFavoritesConfig(favorites);
      return result ? { success: true, ...getFavoritesResponse(favorites) }
                    : { success: false, error: 'Failed to save' };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('delete-favorite-group', async (_event, groupId: string) => {
    try {
      const favorites = await getFavoritesConfig();
      favorites.groups = favorites.groups.filter(g => g.id !== groupId);
      for (const key of Object.keys(favorites.recordingGroups)) {
        if (favorites.recordingGroups[key] === groupId) delete favorites.recordingGroups[key];
      }
      const result = await saveFavoritesConfig(favorites);
      return result ? { success: true, ...getFavoritesResponse(favorites) }
                    : { success: false, error: 'Failed to save' };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('set-recording-favorite-group', async (_event, recordingId: string, groupId: string | null) => {
    try {
      const favorites = await getFavoritesConfig();
      if (!favorites.favorites.includes(recordingId)) return { success: false, error: 'Recording is not favorited' };
      if (!groupId) delete favorites.recordingGroups[recordingId];
      else if (favorites.groups.some(g => g.id === groupId)) favorites.recordingGroups[recordingId] = groupId;
      else return { success: false, error: 'Group not found' };
      const result = await saveFavoritesConfig(favorites);
      return result ? { success: true, ...getFavoritesResponse(favorites) }
                    : { success: false, error: 'Failed to save' };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('save-favorite-to-directory', async (_event, filePath: string, recordingName: string) => {
    try {
      const defaultFileName = recordingName.endsWith('.webm') || recordingName.endsWith('.mp4')
        ? recordingName : `${recordingName}.webm`;
      const result = await dialog.showSaveDialog({
        title: '保存录像',
        defaultPath: defaultFileName,
        filters: [{ name: '视频文件', extensions: ['webm', 'mp4'] }, { name: '所有文件', extensions: ['*'] }],
      });
      if (!result.canceled && result.filePath) {
        const data = await fs.readFile(filePath);
        await fs.writeFile(result.filePath, data);
        return { success: true, savePath: result.filePath };
      }
      return { success: false, canceled: true };
    } catch (error) {
      logger.error('Error saving favorite to directory:', error);
      return { success: false, error: (error as Error).message };
    }
  });
};
