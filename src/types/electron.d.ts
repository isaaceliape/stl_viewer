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
      getPreferences: () => Promise<UserPreferences>;
      setPreferences: (preferences: Partial<UserPreferences>) => Promise<boolean>;
      getThumbnailCache: (modelPath: string, cacheVariant?: string) => Promise<string | null>;
      saveThumbnailCache: (modelPath: string, thumbnailData: string, cacheVariant?: string) => Promise<boolean>;
      clearThumbnailCache: () => Promise<boolean>;
    };
  }
}

export interface ModelInfo {
  name: string;
  path: string;
  ext: string;
  size?: number;
  modified?: string;
}

export interface FileStats {
  size: number;
  created: Date;
  modified: Date;
}

export interface UserPreferences {
  gridView: boolean;
  viewerVisible: boolean;
  sortBy: 'name' | 'size' | 'modified';
  previewBackgroundColor: string;
  thumbnailBackgroundColor: string;
  modelColor: string;
  thumbnailZoom: number;
  cardDensity: 'compact' | 'comfortable' | 'spacious';
  autoSelectFirstModel: boolean;
}

export interface ModelData {
  name: string;
  path: string;
  ext: string;
}

export {}; // Make this a module
