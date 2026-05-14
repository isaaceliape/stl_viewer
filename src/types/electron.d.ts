import { IpcRenderer } from 'electron';

declare global {
  interface Window {
    electronAPI: {
      selectFolder: () => Promise<string | null>;
      listModels: (folderPath: string) => Promise<ModelInfo[]>;
      loadModel: (modelPath: string) => Promise<ArrayBuffer | null>;
      getFileStats: (filePath: string) => Promise<FileStats | null>;
      getLastFolder: () => Promise<string>;
      setLastFolder: (folderPath: string) => Promise<boolean>;
      getDefaultFolder: () => Promise<string>;
      getThumbnailCache: (modelPath: string) => Promise<string | null>;
      saveThumbnailCache: (modelPath: string, thumbnailData: string) => Promise<boolean>;
      clearThumbnailCache: () => Promise<boolean>;
    };
  }
}

export interface ModelInfo {
  name: string;
  path: string;
  ext: string;
}

export interface FileStats {
  size: number;
  created: Date;
  modified: Date;
}

export interface ModelData {
  name: string;
  path: string;
  ext: string;
}

export {}; // Make this a module