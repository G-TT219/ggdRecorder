import { createRecordingChunkAppender } from './recording-transport';

const { contextBridge, ipcRenderer, shell } = require('electron');

const appendRecordingChunk = createRecordingChunkAppender(
  (channel, payload) => ipcRenderer.invoke(channel, payload)
);

contextBridge.exposeInMainWorld('electronAPI', {
  getGameProcesses: () => ipcRenderer.invoke('get-game-processes'),
  startRecordingSession: (options: unknown) => ipcRenderer.invoke('start-recording-session', options),
  appendRecordingChunk,
  finishRecordingSession: (sessionId: string) =>
    ipcRenderer.invoke('finish-recording-session', sessionId),
  abortRecordingSession: (sessionId: string) =>
    ipcRenderer.invoke('abort-recording-session', sessionId),
  getRecordings: () => ipcRenderer.invoke('get-recordings'),
  deleteRecording: (filename: string) => ipcRenderer.invoke('delete-recording', filename),
  getRecordingUrl: (filePath: string) => ipcRenderer.invoke('get-recording-url', filePath),
  getRecordingsDir: () => ipcRenderer.invoke('get-recordings-dir'),
  setRecordingsDir: (dirPath: string) => ipcRenderer.invoke('set-recordings-dir', dirPath),
  selectRecordingsDir: () => ipcRenderer.invoke('select-recordings-dir'),
  openDir: (path: string) => ipcRenderer.invoke('open-dir', path),
  getGamePath: () => ipcRenderer.invoke('get-game-path'),
  selectGamePath: () => ipcRenderer.invoke('select-game-path'),
  startGame: (gamePath: string) => ipcRenderer.invoke('start-game', gamePath),
  generateThumbnail: (filePath: string) => ipcRenderer.invoke('generate-thumbnail', filePath),
  onStartRecordingShortcut: (callback: (...args: unknown[]) => void) =>
    ipcRenderer.on('start-recording-shortcut', (_event: unknown, ...args: unknown[]) => callback(...args)),
  onStopRecordingShortcut: (callback: (...args: unknown[]) => void) =>
    ipcRenderer.on('stop-recording-shortcut', (_event: unknown, ...args: unknown[]) => callback(...args)),
  removeAllListeners: (channel: string) => ipcRenderer.removeAllListeners(channel),
  setRecordingTarget: (target: { name: string; pid: number }) =>
    ipcRenderer.invoke('set-recording-target', target),
  logInfo: (message: string) => ipcRenderer.invoke('log-info', message),
  logError: (message: string) => ipcRenderer.invoke('log-error', message),
  getAppConfig: () => ipcRenderer.invoke('get-app-config'),
  setRecordingQualityConfig: (value: string) => ipcRenderer.invoke('set-recording-quality', value),
  analyzeRecording: (filePath: string) => ipcRenderer.invoke('analyze-recording', filePath),
  saveApiKey: (apiKey: string) => ipcRenderer.invoke('save-api-key', apiKey),
  loadApiKey: () => ipcRenderer.invoke('load-api-key'),
  clearApiKey: () => ipcRenderer.invoke('clear-api-key'),
  getGaggleAuthStatus: () => ipcRenderer.invoke('get-gaggle-auth-status'),
  connectGaggle: () => ipcRenderer.invoke('connect-gaggle'),
  refreshGaggleAuth: () => ipcRenderer.invoke('refresh-gaggle-auth'),
  disconnectGaggle: () => ipcRenderer.invoke('disconnect-gaggle'),
  setManualGaggleAuth: (token: string) => ipcRenderer.invoke('set-manual-gaggle-auth', token),
  onGaggleAuthStatusChanged: (callback: (status: unknown) => void) => {
    const listener = (_event: unknown, status: unknown) => callback(status);
    ipcRenderer.on('gaggle-auth-status-changed', listener);
    return () => ipcRenderer.removeListener('gaggle-auth-status-changed', listener);
  },
  getFavoriteRecordings: () => ipcRenderer.invoke('get-favorite-recordings'),
  toggleFavoriteRecording: (recordingId: string, isFavorite: boolean) =>
    ipcRenderer.invoke('toggle-favorite-recording', recordingId, isFavorite),
  saveRecordingNote: (recordingId: string, note: string) =>
    ipcRenderer.invoke('save-recording-note', recordingId, note),
  createFavoriteGroup: (name: string) => ipcRenderer.invoke('create-favorite-group', name),
  renameFavoriteGroup: (groupId: string, name: string) =>
    ipcRenderer.invoke('rename-favorite-group', groupId, name),
  deleteFavoriteGroup: (groupId: string) => ipcRenderer.invoke('delete-favorite-group', groupId),
  setRecordingFavoriteGroup: (recordingId: string, groupId: string | null) =>
    ipcRenderer.invoke('set-recording-favorite-group', recordingId, groupId),
  saveFavoriteToDirectory: (filePath: string, recordingName: string) =>
    ipcRenderer.invoke('save-favorite-to-directory', filePath, recordingName),
  windowMinimize: () => ipcRenderer.invoke('window-minimize'),
  windowMaximize: () => ipcRenderer.invoke('window-maximize'),
  windowClose: () => ipcRenderer.invoke('window-close'),
  resizeWindow: (width: number, height: number) => ipcRenderer.invoke('resize-window', width, height),
  captureScreenRegion: () => ipcRenderer.invoke('capture-screen-region'),
  onScreenshotSelectionInit: (callback: (payload: unknown) => void) => {
    const listener = (_event: unknown, payload: unknown) => callback(payload);
    ipcRenderer.once('screenshot-selection-init', listener);
    return () => ipcRenderer.removeListener('screenshot-selection-init', listener);
  },
  completeScreenshotSelection: (rect: { x: number; y: number; width: number; height: number }) =>
    ipcRenderer.invoke('complete-screenshot-selection', rect),
  cancelScreenshotSelection: () => ipcRenderer.invoke('cancel-screenshot-selection'),
  saveScreenshot: (dataUrl: string) => ipcRenderer.invoke('save-screenshot', dataUrl),
  copyScreenshot: (dataUrl: string) => ipcRenderer.invoke('copy-screenshot', dataUrl),
  openExternal: (url: string) => shell.openExternal(url),
  fetchMatchData: (matchId: string) => ipcRenderer.invoke('fetch-match-data', matchId),
  fetchMyMatchHistory: () => ipcRenderer.invoke('fetch-my-match-history'),
});
