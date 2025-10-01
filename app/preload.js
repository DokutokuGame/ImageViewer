const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('mediaAPI', {
  listDirectories: () => ipcRenderer.invoke('directories:list'),
  selectDirectory: () => ipcRenderer.invoke('directories:select'),
  removeDirectory: (directoryId) => ipcRenderer.invoke('directories:remove', directoryId),
  listTags: () => ipcRenderer.invoke('tags:list'),
  filterByTag: (tagId) => ipcRenderer.invoke('tags:directories', tagId),
});
