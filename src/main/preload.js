const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('mediaApi', {
  selectRoot: () => ipcRenderer.invoke('select-root'),
  scanDirectory: (rootPath) => ipcRenderer.invoke('scan-directory', rootPath),
  openFile: (filePath) => ipcRenderer.invoke('open-file', filePath),
  getRootTags: () => ipcRenderer.invoke('get-root-tags'),
  removeRootTag: (rootPath) => ipcRenderer.invoke('remove-root-tag', rootPath),
});
