const { contextBridge, ipcRenderer, shell } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  startRecording: (options?: unknown) => ipcRenderer.invoke('start-recording', options),
  stopRecording: () => ipcRenderer.invoke('stop-recording'),
  getGameProcesses: () => ipcRenderer.invoke('get-game-processes'),
  saveRecording: (buffer: ArrayBuffer, filename: string, shouldCompress?: boolean) =>
    ipcRenderer.invoke('save-recording', buffer, filename, shouldCompress),
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
  onStopRecording: (callback: (...args: unknown[]) => void) =>
    ipcRenderer.on('stop-recording', (_event: unknown, ...args: unknown[]) => callback(...args)),
  onStartRecordingShortcut: (callback: (...args: unknown[]) => void) =>
    ipcRenderer.on('start-recording-shortcut', (_event: unknown, ...args: unknown[]) => callback(...args)),
  onStopRecordingShortcut: (callback: (...args: unknown[]) => void) =>
    ipcRenderer.on('stop-recording-shortcut', (_event: unknown, ...args: unknown[]) => callback(...args)),
  removeAllListeners: (channel: string) => ipcRenderer.removeAllListeners(channel),
  setRecordingTarget: (gameName: string) => ipcRenderer.invoke('set-recording-target', gameName),
  logInfo: (message: string) => ipcRenderer.invoke('log-info', message),
  logError: (message: string) => ipcRenderer.invoke('log-error', message),
  getAppConfig: () => ipcRenderer.invoke('get-app-config'),
  setCompressVideosConfig: (value: boolean) => ipcRenderer.invoke('set-compressVideos', value),
  analyzeRecording: (filePath: string) => ipcRenderer.invoke('analyze-recording', filePath),
  saveApiKey: (apiKey: string) => ipcRenderer.invoke('save-api-key', apiKey),
  loadApiKey: () => ipcRenderer.invoke('load-api-key'),
  clearApiKey: () => ipcRenderer.invoke('clear-api-key'),
  saveGgdToken: (token: string) => ipcRenderer.invoke('save-ggd-token', token),
  loadGgdToken: () => ipcRenderer.invoke('load-ggd-token'),
  clearGgdToken: () => ipcRenderer.invoke('clear-ggd-token'),
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
  openExternal: (url: string) => shell.openExternal(url),
  fetchMatchData: (matchId: string) => ipcRenderer.invoke('fetch-match-data', matchId),
  fetchMatchHistory: (userId: string) => ipcRenderer.invoke('fetch-match-history', userId),
});
