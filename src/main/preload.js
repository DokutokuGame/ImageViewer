const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('mediaApi', {
  selectRoot: () => ipcRenderer.invoke('select-root'),
  scanDirectory: (rootPath) => ipcRenderer.invoke('scan-directory', rootPath),
  listMediaFiles: (directoryPath, options) =>
    ipcRenderer.invoke('list-media-files', directoryPath, options),
  openFile: (filePath) => ipcRenderer.invoke('open-file', filePath),
  openDirectory: (directoryPath) => ipcRenderer.invoke('open-directory', directoryPath),
  getRootTags: () => ipcRenderer.invoke('get-root-tags'),
  removeRootTag: (rootPath) => ipcRenderer.invoke('remove-root-tag', rootPath),
});
