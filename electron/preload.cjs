const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  isElectron: true,
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  refocus: () => { try { ipcRenderer.send('window-refocus'); } catch {} },
  saveSession: (user) => ipcRenderer.invoke('session-save', user),
  loadSession: () => ipcRenderer.invoke('session-load'),
  clearSession: () => ipcRenderer.invoke('session-clear'),
  isFreshStart: () => ipcRenderer.invoke('app-fresh-start'),
});
