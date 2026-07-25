import { ipcMain } from 'electron';
import path from 'path';
import * as fs from 'fs/promises';
import type { FileHandle } from 'fs/promises';
import { randomUUID } from 'crypto';
import logger from './logger';
import { createRecordingsDir, isPathInside, recordingUrlMap, setRecordingUrl } from './utils';
import { getGlobalConfig, getFavoritesConfig, saveFavoritesConfig } from './config';
import { generateVideoThumbnail } from './services/ffmpeg';
import type { RecordingSessionStartOptions } from '../shared/types';

type RecordingSession = {
  id: string;
  ownerId: number;
  finalPath: string;
  tempPath: string;
  handle: FileHandle;
  bytesWritten: number;
  chunksWritten: number;
  writeChain: Promise<void>;
  writeError: Error | null;
  ownerDestroyedHandler: () => void;
};

const recordingSessions = new Map<string, RecordingSession>();
const MAX_RECORDING_CHUNK_BYTES = 64 * 1024 * 1024;

const getConfiguredRecordingsDir = async (): Promise<string> => {
  const configured = getGlobalConfig().recordingsDir;
  const recordingsDir = configured || await createRecordingsDir();
  await fs.mkdir(recordingsDir, { recursive: true });
  return recordingsDir;
};

const sanitizeRecordingFilename = (
  filename: string,
  mimeType: string
): string => {
  const extension = mimeType.toLowerCase().includes('mp4') ? '.mp4' : '.webm';
  const basename = path.basename(String(filename || ''))
    .replace(/\.(webm|mp4)$/i, '')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
    .replace(/[. ]+$/g, '')
    .trim()
    .slice(0, 160);
  return `${basename || `GGD录像_${Date.now()}`}${extension}`;
};

const getUniqueFilePath = async (directory: string, filename: string): Promise<string> => {
  const extension = path.extname(filename);
  const basename = path.basename(filename, extension);
  for (let suffix = 0; suffix < 1000; suffix += 1) {
    const candidateName = suffix === 0
      ? filename
      : `${basename}_${suffix}${extension}`;
    const candidate = path.join(directory, candidateName);
    try {
      await fs.access(candidate);
    } catch {
      try {
        await fs.access(`${candidate}.part`);
      } catch {
        return candidate;
      }
    }
  }
  throw new Error('无法创建唯一的录像文件名');
};

const closeSessionHandle = async (session: RecordingSession): Promise<void> => {
  try { await session.writeChain; } catch { /* handled by caller */ }
  try { await session.handle.sync(); } catch { /* best effort */ }
  try { await session.handle.close(); } catch { /* already closed */ }
};

const preserveInterruptedSession = async (
  session: RecordingSession
): Promise<string | undefined> => {
  await closeSessionHandle(session);
  if (session.bytesWritten === 0) {
    await fs.unlink(session.tempPath).catch(() => {});
    return undefined;
  }
  const extension = path.extname(session.finalPath);
  const basename = path.basename(session.finalPath, extension);
  const recoveredPath = await getUniqueFilePath(
    path.dirname(session.finalPath),
    `${basename}_recovered${extension}`
  );
  await fs.rename(session.tempPath, recoveredPath);
  return recoveredPath;
};

const recoverInterruptedRecordings = async (recordingsDir: string): Promise<void> => {
  const activeTempPaths = new Set(
    [...recordingSessions.values()].map(session => path.resolve(session.tempPath))
  );
  const entries = await fs.readdir(recordingsDir);
  await Promise.all(entries
    .filter(filename => /\.(webm|mp4)\.part$/i.test(filename))
    .map(async filename => {
      const tempPath = path.join(recordingsDir, filename);
      if (activeTempPaths.has(path.resolve(tempPath))) return;
      const stats = await fs.stat(tempPath).catch(() => null);
      if (!stats) return;
      if (stats.size === 0) {
        await fs.unlink(tempPath).catch(() => {});
        return;
      }
      const finalName = filename.slice(0, -'.part'.length);
      const extension = path.extname(finalName);
      const basename = path.basename(finalName, extension);
      const recoveredPath = await getUniqueFilePath(
        recordingsDir,
        `${basename}_recovered${extension}`
      );
      await fs.rename(tempPath, recoveredPath).catch(error => {
        logger.error('Error recovering interrupted recording:', error);
      });
    }));
};

export const registerRecordingHandlers = (): void => {
  ipcMain.handle('start-recording-session', async (event, options: RecordingSessionStartOptions) => {
    try {
      if ([...recordingSessions.values()].some(session => session.ownerId === event.sender.id)) {
        return { success: false, error: '当前窗口已有录像正在写入' };
      }
      if (!options || typeof options.filename !== 'string' || typeof options.mimeType !== 'string') {
        return { success: false, error: '录像会话参数无效' };
      }
      const recordingsDir = await getConfiguredRecordingsDir();
      const filename = sanitizeRecordingFilename(options.filename, options.mimeType);
      const finalPath = await getUniqueFilePath(recordingsDir, filename);
      const tempPath = `${finalPath}.part`;
      const handle = await fs.open(tempPath, 'wx');
      const sessionId = randomUUID();
      const session: RecordingSession = {
        id: sessionId,
        ownerId: event.sender.id,
        finalPath,
        tempPath,
        handle,
        bytesWritten: 0,
        chunksWritten: 0,
        writeChain: Promise.resolve(),
        writeError: null,
        ownerDestroyedHandler: () => {},
      };
      session.ownerDestroyedHandler = () => {
        if (recordingSessions.get(sessionId) !== session) return;
        recordingSessions.delete(sessionId);
        void preserveInterruptedSession(session)
          .then(recoveredPath => {
            logger.warn(
              recoveredPath
                ? `Recording owner closed; partial file recovered at ${recoveredPath}`
                : `Recording owner closed before data was written: ${sessionId}`
            );
          })
          .catch(error => logger.error('Error recovering recording after renderer exit:', error));
      };
      recordingSessions.set(sessionId, session);
      event.sender.once('destroyed', session.ownerDestroyedHandler);
      logger.info(`Recording session started: ${sessionId} -> ${finalPath}`);
      return { success: true, sessionId, filePath: finalPath };
    } catch (error) {
      logger.error('Error starting recording session:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('append-recording-chunk', async (event, payload) => {
    const session = recordingSessions.get(payload?.sessionId);
    if (!session || session.ownerId !== event.sender.id) {
      return { success: false, error: '录像会话不存在或已结束' };
    }
    if (!Number.isInteger(payload?.chunkId) || payload.chunkId !== session.chunksWritten) {
      return { success: false, error: '录像数据块顺序异常' };
    }

    const rawBuffer = payload?.buffer;
    const byteLength = rawBuffer instanceof ArrayBuffer
      ? rawBuffer.byteLength
      : ArrayBuffer.isView(rawBuffer)
        ? rawBuffer.byteLength
        : 0;
    if (byteLength === 0 || byteLength > MAX_RECORDING_CHUNK_BYTES) {
      return { success: false, error: '录像数据块大小异常' };
    }

    const chunk = rawBuffer instanceof ArrayBuffer
      ? Buffer.from(rawBuffer)
      : Buffer.from(rawBuffer.buffer, rawBuffer.byteOffset, rawBuffer.byteLength);
    session.writeChain = session.writeChain.then(async () => {
      await session.handle.write(chunk, 0, chunk.length, null);
      session.bytesWritten += chunk.length;
      session.chunksWritten += 1;
    });

    try {
      await session.writeChain;
      return { success: true, bytesWritten: session.bytesWritten };
    } catch (error) {
      session.writeError = error instanceof Error ? error : new Error(String(error));
      logger.error('Error writing recording chunk:', error);
      return { success: false, error: session.writeError.message };
    }
  });

  ipcMain.handle('finish-recording-session', async (event, sessionId: string) => {
    const session = recordingSessions.get(sessionId);
    if (!session || session.ownerId !== event.sender.id) {
      return { success: false, error: '录像会话不存在或已结束' };
    }
    recordingSessions.delete(sessionId);
    event.sender.removeListener('destroyed', session.ownerDestroyedHandler);
    try {
      await session.writeChain;
      if (session.writeError) throw session.writeError;
      await session.handle.sync();
      await session.handle.close();
      await fs.rename(session.tempPath, session.finalPath);
      const stats = await fs.stat(session.finalPath);
      logger.info(
        `Recording session finished: ${sessionId}, ${session.chunksWritten} chunks, ${stats.size} bytes`
      );
      return {
        success: true,
        filePath: session.finalPath,
        size: stats.size,
        chunks: session.chunksWritten,
      };
    } catch (error) {
      const recoveredPath = await preserveInterruptedSession(session).catch(recoveryError => {
        logger.error('Error recovering recording after finish failure:', recoveryError);
        return undefined;
      });
      logger.error('Error finishing recording session:', error);
      return {
        success: false,
        error: recoveredPath
          ? `${(error as Error).message}（已保留中断录像）`
          : (error as Error).message,
      };
    }
  });

  ipcMain.handle('abort-recording-session', async (event, sessionId: string) => {
    const session = recordingSessions.get(sessionId);
    if (!session || session.ownerId !== event.sender.id) {
      return { success: false, error: '录像会话不存在或已结束' };
    }
    recordingSessions.delete(sessionId);
    event.sender.removeListener('destroyed', session.ownerDestroyedHandler);
    try {
      const filePath = await preserveInterruptedSession(session);
      logger.warn(`Recording session aborted: ${sessionId}`);
      return { success: true, ...(filePath ? { filePath } : {}) };
    } catch (error) {
      logger.error('Error aborting recording session:', error);
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
      await recoverInterruptedRecordings(recordingsDir);
      const files = await fs.readdir(recordingsDir);
      const videoFiles = files.filter(f => /\.(webm|mp4)$/i.test(f));
      const results = await Promise.all(
        videoFiles.map(async file => {
          const filePath = path.join(recordingsDir, file);
          const stats = await fs.stat(filePath);
          return {
            id: file,
            name: file.replace(/_compressed\.mp4$/i, '').replace(/\.(webm|mp4)$/i, ''),
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

  ipcMain.handle('set-recording-target', async (
    _event,
    target: { name: string; pid: number }
  ) => {
    if (!target || typeof target.name !== 'string' || !Number.isInteger(target.pid)) {
      return { success: false, error: '录制目标无效' };
    }
    const { setPendingRecordingTarget } = await import('./utils');
    setPendingRecordingTarget({ name: target.name, pid: target.pid });
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
