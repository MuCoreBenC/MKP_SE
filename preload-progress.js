const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('progressAPI', {
  onUpdate: (callback) => ipcRenderer.on('progress-update', (event, data) => callback(data)),
  onLog: (callback) => ipcRenderer.on('progress-log', (event, data) => callback(data)),
  onComplete: (callback) => ipcRenderer.on('progress-complete', (event, data) => callback(data)),
  onError: (callback) => ipcRenderer.on('progress-error', (event, data) => callback(data))
});