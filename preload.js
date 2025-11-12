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
  readRecording: (filePath) => ipcRenderer.invoke('read-recording', filePath),
  getRecordingsDir: () => ipcRenderer.invoke('get-recordings-dir'),
  setRecordingsDir: (dirPath) => ipcRenderer.invoke('set-recordings-dir', dirPath),
  selectRecordingsDir: () => ipcRenderer.invoke('select-recordings-dir'),
  openDir: (path) => ipcRenderer.invoke('open-dir',path),
  getGamePath: () => ipcRenderer.invoke('get-game-path'),
  selectGamePath: () => ipcRenderer.invoke('select-game-path'),
  startGame: (gamePath) => ipcRenderer.invoke('start-game', gamePath),
  onSourceIdSelected: (callback) => ipcRenderer.on('source-id-selected', callback),
  onStopRecording: (callback) => ipcRenderer.on('stop-recording', callback),
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
});