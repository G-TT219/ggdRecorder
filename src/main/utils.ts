import * as fsSync from 'fs';
import path from 'path';
import { app } from 'electron';

export const isPathInside = (parentPath: string, childPath: string): boolean => {
  const parent = path.resolve(parentPath);
  const child = path.resolve(childPath);
  const relative = path.relative(parent, child);
  return relative === '' || (!!relative && !relative.startsWith('..') && !path.isAbsolute(relative));
};

export const sleep = (ms: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, ms));

export const getRecordingsDir = (): string => {
  return path.join(app.getPath('videos'), 'GameRecorder');
};

export const createRecordingsDir = async (): Promise<string> => {
  const recordingsDir = getRecordingsDir();
  try {
    await fsSync.promises.access(recordingsDir);
  } catch {
    await fsSync.promises.mkdir(recordingsDir, { recursive: true });
  }
  return recordingsDir;
};

export const getAssetPath = (...paths: string[]): string => path.join(__dirname, ...paths);

export const getFavoritesConfigPath = (): string =>
  path.join(app.getPath('userData'), 'favorites.json');

export const getAppConfigPath = (): string =>
  path.join(app.getPath('userData'), 'config.json');

export const recordingUrlMap = new Map<string, string>();

export const pendingRecordingTarget: { current: string | null } = { current: null };
export const setPendingRecordingTarget = (name: string): void => { pendingRecordingTarget.current = name; };
