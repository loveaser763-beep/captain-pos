const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  isElectron: true,
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  saveSession: (user) => ipcRenderer.invoke('session-save', user),
  loadSession: () => ipcRenderer.invoke('session-load'),
  clearSession: () => ipcRenderer.invoke('session-clear'),
});
