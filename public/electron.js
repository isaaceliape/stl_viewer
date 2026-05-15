const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

const isDev = !app.isPackaged;

// Hot reload for Electron main process in development
if (isDev) {
  try {
    const electronReload = require('electron-reload');
    electronReload(__dirname, {
      electron: path.join(__dirname, '../node_modules/electron/dist/Electron.app/Contents/MacOS/Electron'),
      hardResetMethod: 'exit',
      ignore: ['node_modules', 'build', 'dist'],
      argv: process.argv.slice(2)
    });
    console.log('Electron hot reload enabled');
  } catch (e) {
    console.log('electron-reload not found, skipping hot reload setup');
  }
}

const devUrl = 'http://localhost:3010';
const prodUrl = `file://${path.join(__dirname, '../build/index.html')}`;

// Config and cache directories
const cacheDir = path.join(os.homedir(), '.stl-viewer-cache', 'thumbnails');
const thumbnailCacheVersion = 'v2';
const configDir = path.join(os.homedir(), '.stl-viewer-cache');
const configFile = path.join(configDir, 'config.json');

// Ensure directories exist
if (!fs.existsSync(cacheDir)) {
  fs.mkdirSync(cacheDir, { recursive: true });
}
if (!fs.existsSync(configDir)) {
  fs.mkdirSync(configDir, { recursive: true });
}

// Load config from file
function loadConfig() {
  try {
    if (fs.existsSync(configFile)) {
      const data = fs.readFileSync(configFile, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading config:', error);
  }
  return {
    lastFolder: null,
    defaultFolder: path.join(os.homedir(), 'Library/Mobile Documents/com~apple~CloudDocs/3D Printing/Models'),
    preferences: {
      gridView: false,
      viewerVisible: true,
      sortBy: 'name',
      previewBackgroundColor: '#1a1a1a',
      thumbnailBackgroundColor: '#2a2a2a',
      modelColor: '#4488ff',
      thumbnailZoom: 1.08,
      cardDensity: 'comfortable',
      autoSelectFirstModel: false,
    }
  };
}

// Generate cache key from file path + modification time
function getCacheKey(filePath, cacheVariant = '') {
  try {
    const stats = fs.statSync(filePath);
    const hash = `${thumbnailCacheVersion}-${cacheVariant}-${path.basename(filePath)}-${stats.size}-${Math.floor(stats.mtimeMs)}`;
    return hash.replace(/[^a-zA-Z0-9-]/g, '_');
  } catch (e) {
    return `${thumbnailCacheVersion}-${cacheVariant}-${path.basename(filePath)}`.replace(/[^a-zA-Z0-9-]/g, '_');
  }
}

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 1000,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  const startUrl = isDev ? devUrl : prodUrl;
  console.log(`Loading URL: ${startUrl} (isDev: ${isDev})`);
  mainWindow.loadURL(startUrl);
}

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// =====================
// IPC Handlers
// =====================

ipcMain.handle('select-folder', async () => {
  const config = loadConfig();
  const defaultPath = config.lastFolder || config.defaultFolder;
  
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    defaultPath: defaultPath,
  });

  if (!result.canceled && result.filePaths[0]) {
    config.lastFolder = result.filePaths[0];
    fs.writeFileSync(configFile, JSON.stringify(config, null, 2));
    return result.filePaths[0];
  }
  return null;
});

ipcMain.handle('get-last-folder', async () => {
  const config = loadConfig();
  return config.lastFolder || config.defaultFolder;
});

ipcMain.handle('set-last-folder', async (event, folderPath) => {
  try {
    const config = loadConfig();
    config.lastFolder = folderPath;
    fs.writeFileSync(configFile, JSON.stringify(config, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving config:', error);
    return false;
  }
});

ipcMain.handle('get-default-folder', async () => {
  return path.join(os.homedir(), 'Library/Mobile Documents/com~apple~CloudDocs/3D Printing/Models');
});

ipcMain.handle('get-preferences', async () => {
  const config = loadConfig();
  return {
    gridView: config.preferences?.gridView ?? false,
    viewerVisible: config.preferences?.viewerVisible ?? true,
    sortBy: config.preferences?.sortBy ?? 'name',
    previewBackgroundColor: config.preferences?.previewBackgroundColor ?? '#1a1a1a',
    thumbnailBackgroundColor: config.preferences?.thumbnailBackgroundColor ?? '#2a2a2a',
    modelColor: config.preferences?.modelColor ?? '#4488ff',
    thumbnailZoom: config.preferences?.thumbnailZoom ?? 1.08,
    cardDensity: config.preferences?.cardDensity ?? 'comfortable',
    autoSelectFirstModel: config.preferences?.autoSelectFirstModel ?? false,
  };
});

ipcMain.handle('set-preferences', async (event, preferences) => {
  try {
    const config = loadConfig();
    config.preferences = {
      ...(config.preferences || {}),
      ...preferences,
    };
    fs.writeFileSync(configFile, JSON.stringify(config, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving preferences:', error);
    return false;
  }
});

ipcMain.handle('list-models', async (event, folderPath) => {
  try {
    const files = fs.readdirSync(folderPath);
    const models = files
      .filter((file) => {
        const ext = path.extname(file).toLowerCase();
        return ext === '.stl' || ext === '.3mf';
      })
      .map((file) => {
        const fullPath = path.join(folderPath, file);
        const stats = fs.statSync(fullPath);
        return {
          name: file,
          path: fullPath,
          ext: path.extname(file).toLowerCase(),
          size: stats.size,
          modified: stats.mtime.toISOString(),
        };
      });
    return models;
  } catch (error) {
    console.error('Error listing models:', error);
    return [];
  }
});

ipcMain.handle('load-model', async (event, modelPath) => {
  try {
    const data = fs.readFileSync(modelPath);
    return data.buffer;
  } catch (error) {
    console.error('Error loading model:', error);
    return null;
  }
});

ipcMain.handle('get-file-stats', async (event, filePath) => {
  try {
    const stats = fs.statSync(filePath);
    return {
      size: stats.size,
      created: stats.birthtime,
      modified: stats.mtime,
    };
  } catch (error) {
    console.error('Error getting file stats:', error);
    return null;
  }
});

// Thumbnail cache handlers
ipcMain.handle('get-thumbnail-cache', async (event, modelPath, cacheVariant) => {
  try {
    const cacheKey = getCacheKey(modelPath, cacheVariant);
    const cachePath = path.join(cacheDir, `${cacheKey}.png`);
    
    if (fs.existsSync(cachePath)) {
      const data = fs.readFileSync(cachePath);
      return `data:image/png;base64,${data.toString('base64')}`;
    }
    return null;
  } catch (error) {
    console.error('Error reading thumbnail cache:', error);
    return null;
  }
});

ipcMain.handle('save-thumbnail-cache', async (event, modelPath, thumbnailData, cacheVariant) => {
  try {
    const cacheKey = getCacheKey(modelPath, cacheVariant);
    const cachePath = path.join(cacheDir, `${cacheKey}.png`);
    
    const base64Data = thumbnailData.replace(/^data:image\/png;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    
    fs.writeFileSync(cachePath, buffer);
    return true;
  } catch (error) {
    console.error('Error saving thumbnail cache:', error);
    return false;
  }
});

ipcMain.handle('clear-thumbnail-cache', async () => {
  try {
    if (fs.existsSync(cacheDir)) {
      const files = fs.readdirSync(cacheDir);
      for (const file of files) {
        fs.unlinkSync(path.join(cacheDir, file));
      }
    }
    return true;
  } catch (error) {
    console.error('Error clearing thumbnail cache:', error);
    return false;
  }
});

ipcMain.handle('open-in-slicer', async (event, modelPath) => {
  try {
    const { execFile } = require('child_process');
    await new Promise((resolve, reject) => {
      execFile('open', ['-a', 'AnycubicSlicerNext', modelPath], (err) => {
        if (err) reject(err); else resolve();
      });
    });
    return { success: true };
  } catch (error) {
    console.error('Error opening in slicer:', error);
    return { success: false, error: error.message };
  }
});