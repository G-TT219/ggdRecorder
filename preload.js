// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

const { contextBridge, ipcRenderer, shell } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  startRecording: (options) => ipcRenderer.invoke('start-recording', options),
  stopRecording: () => ipcRenderer.invoke('stop-recording'),
  getGameProcesses: () => ipcRenderer.invoke('get-game-processes'),
  saveRecording: (buffer, filename, shouldCompress) => ipcRenderer.invoke('save-recording', buffer, filename, shouldCompress),
  getRecordings: () => ipcRenderer.invoke('get-recordings'),
  deleteRecording: (filename) => ipcRenderer.invoke('delete-recording', filename),
  getRecordingUrl: (filePath) => ipcRenderer.invoke('get-recording-url', filePath),
  getRecordingsDir: () => ipcRenderer.invoke('get-recordings-dir'),
  setRecordingsDir: (dirPath) => ipcRenderer.invoke('set-recordings-dir', dirPath),
  selectRecordingsDir: () => ipcRenderer.invoke('select-recordings-dir'),
  openDir: (path) => ipcRenderer.invoke('open-dir',path),
  getGamePath: () => ipcRenderer.invoke('get-game-path'),
  selectGamePath: () => ipcRenderer.invoke('select-game-path'),
  startGame: (gamePath) => ipcRenderer.invoke('start-game', gamePath),
  generateThumbnail: (filePath) => ipcRenderer.invoke('generate-thumbnail', filePath),
  // onSourceIdSelected: (callback) => ipcRenderer.on('source-id-selected', callback),
  onStopRecording: (callback) => ipcRenderer.on('stop-recording', callback),
  onStartRecordingShortcut: (callback) => ipcRenderer.on('start-recording-shortcut', callback),
  onStopRecordingShortcut: (callback) => ipcRenderer.on('stop-recording-shortcut', callback),
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
  setRecordingTarget: (gameName) => ipcRenderer.invoke('set-recording-target', gameName),
  logInfo: (message) => ipcRenderer.invoke('log-info', message),
  logError: (message) => ipcRenderer.invoke('log-error', message),
  getAppConfig: () => ipcRenderer.invoke('get-app-config'),
  setCompressVideosConfig: (value) => ipcRenderer.invoke('set-compressVideos', value),
  analyzeRecording: (filePath) => ipcRenderer.invoke('analyze-recording', filePath),
  saveApiKey: (apiKey) => ipcRenderer.invoke('save-api-key', apiKey),
  loadApiKey: () => ipcRenderer.invoke('load-api-key'),
  clearApiKey: () => ipcRenderer.invoke('clear-api-key'),
  // GGD Token
  saveGgdToken: (token) => ipcRenderer.invoke('save-ggd-token', token),
  loadGgdToken: () => ipcRenderer.invoke('load-ggd-token'),
  clearGgdToken: () => ipcRenderer.invoke('clear-ggd-token'),
  // Favorite recordings
  getFavoriteRecordings: () => ipcRenderer.invoke('get-favorite-recordings'),
  toggleFavoriteRecording: (recordingId, isFavorite) => ipcRenderer.invoke('toggle-favorite-recording', recordingId, isFavorite),
  saveFavoriteToDirectory: (filePath, recordingName) => ipcRenderer.invoke('save-favorite-to-directory', filePath, recordingName),
  // Window controls
  windowMinimize: () => ipcRenderer.invoke('window-minimize'),
  windowMaximize: () => ipcRenderer.invoke('window-maximize'),
  windowClose: () => ipcRenderer.invoke('window-close'),
  resizeWindow: (width, height) => ipcRenderer.invoke('resize-window', width, height),
  // Open external URL in system browser
  openExternal: (url) => shell.openExternal(url),
  // Fetch match data through main process to avoid CORS
  fetchMatchData: (matchId) => ipcRenderer.invoke('fetch-match-data', matchId),
  // Fetch match history list
  fetchMatchHistory: (userId) => ipcRenderer.invoke('fetch-match-history', userId),
});