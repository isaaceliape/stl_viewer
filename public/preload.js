const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  listModels: (folderPath) => ipcRenderer.invoke('list-models', folderPath),
  loadModel: (modelPath) => ipcRenderer.invoke('load-model', modelPath),
  getFileStats: (filePath) => ipcRenderer.invoke('get-file-stats', filePath),
  // Folder memory
  getLastFolder: () => ipcRenderer.invoke('get-last-folder'),
  setLastFolder: (folderPath) => ipcRenderer.invoke('set-last-folder', folderPath),
  getDefaultFolder: () => ipcRenderer.invoke('get-default-folder'),
  // Thumbnail cache
  getThumbnailCache: (modelPath) => ipcRenderer.invoke('get-thumbnail-cache', modelPath),
  saveThumbnailCache: (modelPath, thumbnailData) => ipcRenderer.invoke('save-thumbnail-cache', modelPath, thumbnailData),
  clearThumbnailCache: () => ipcRenderer.invoke('clear-thumbnail-cache'),
});
