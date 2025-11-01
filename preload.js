// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  startRecording: (options) => ipcRenderer.invoke('start-recording', options),
  stopRecording: () => ipcRenderer.invoke('stop-recording'),
  getGameProcesses: () => ipcRenderer.invoke('get-game-processes'),
  saveRecording: (buffer, filename) => ipcRenderer.invoke('save-recording', buffer, filename),
  getRecordings: () => ipcRenderer.invoke('get-recordings'),
  deleteRecording: (filename) => ipcRenderer.invoke('delete-recording', filename),
  readRecording: (filePath) => ipcRenderer.invoke('read-recording', filePath),
  onSourceIdSelected: (callback) => ipcRenderer.on('source-id-selected', callback),
  onStopRecording: (callback) => ipcRenderer.on('stop-recording', callback),
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
});