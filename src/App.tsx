import { useState, useEffect } from 'react';
import './App.css';
import ModelGrid from './components/ModelGrid';
import ModelViewer from './components/ModelViewer';
import { ModelInfo, UserPreferences } from './types/electron';

type SortOption = 'name' | 'size' | 'modified';
type ActivePage = 'gallery' | 'settings';

const defaultPreferences: UserPreferences = {
  gridView: false,
  viewerVisible: true,
  sortBy: 'name',
  previewBackgroundColor: '#1a1a1a',
  thumbnailBackgroundColor: '#2a2a2a',
  modelColor: '#4488ff',
  thumbnailZoom: 1.08,
  cardDensity: 'comfortable',
  autoSelectFirstModel: false,
};

function App() {
  const [folderPath, setFolderPath] = useState<string | null>(null);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [selectedModel, setSelectedModel] = useState<ModelInfo | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [activePage, setActivePage] = useState<ActivePage>('gallery');
  const [preferences, setPreferences] = useState<UserPreferences>(defaultPreferences);

  const { gridView, viewerVisible, sortBy } = preferences;

  const sortedModels = [...models].sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return a.name.localeCompare(b.name);
      case 'size':
        return (b.size || 0) - (a.size || 0);
      case 'modified':
        return new Date(b.modified || 0).getTime() - new Date(a.modified || 0).getTime();
      default:
        return 0;
    }
  });

  useEffect(() => {
    loadInitialState();
  }, []);

  useEffect(() => {
    if (preferences.autoSelectFirstModel && !selectedModel && sortedModels.length > 0) {
      setSelectedModel(sortedModels[0]);
    }
  }, [preferences.autoSelectFirstModel, selectedModel, sortedModels]);

  const loadInitialState = async (): Promise<void> => {
    const loadedPreferences = await loadPreferences();
    await loadLastFolder(loadedPreferences);
  };

  const loadPreferences = async (): Promise<UserPreferences> => {
    try {
      const savedPreferences = await window.electronAPI.getPreferences();
      const mergedPreferences = { ...defaultPreferences, ...savedPreferences };
      setPreferences(mergedPreferences);
      return mergedPreferences;
    } catch (error) {
      console.error('Error loading preferences:', error);
      return defaultPreferences;
    }
  };

  const savePreferences = async (updates: Partial<UserPreferences>): Promise<void> => {
    const nextPreferences = { ...preferences, ...updates };
    setPreferences(nextPreferences);
    try {
      await window.electronAPI.setPreferences(updates);
    } catch (error) {
      console.error('Error saving preferences:', error);
    }
  };

  const loadLastFolder = async (loadedPreferences = preferences): Promise<void> => {
    try {
      const lastFolder = await window.electronAPI.getLastFolder();
      if (lastFolder) {
        await loadFolder(lastFolder, loadedPreferences);
      }
    } catch (error) {
      console.error('Error loading last folder:', error);
    }
  };

  const loadFolder = async (path: string, loadedPreferences = preferences): Promise<void> => {
    setLoading(true);
    try {
      const modelList = await window.electronAPI.listModels(path);
      setModels(modelList);
      setFolderPath(path);
      setSelectedModel(loadedPreferences.autoSelectFirstModel && modelList.length > 0 ? modelList[0] : null);
      await window.electronAPI.setLastFolder(path);
    } catch (error) {
      console.error('Error loading folder:', error);
      alert('Error loading folder: ' + (error as Error).message);
    }
    setLoading(false);
  };

  const handleSelectFolder = async (): Promise<void> => {
    try {
      const path = await window.electronAPI.selectFolder();
      if (path) {
        await loadFolder(path);
      }
    } catch (error) {
      console.error('Error selecting folder:', error);
    }
  };

  const handleToggleGridView = async (): Promise<void> => {
    await savePreferences({ gridView: !gridView });
  };

  const handleToggleViewerVisible = async (): Promise<void> => {
    await savePreferences({ viewerVisible: !viewerVisible });
  };

  const handleClearThumbnailCache = async (): Promise<void> => {
    await window.electronAPI.clearThumbnailCache();
    alert('Thumbnail cache cleared. Thumbnails will regenerate as you browse.');
  };

  const handleResetSettings = async (): Promise<void> => {
    setPreferences(defaultPreferences);
    await window.electronAPI.setPreferences(defaultPreferences);
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>🎨 STL/3MF Gallery Viewer</h1>
        <div className="header-buttons">
          <button onClick={handleSelectFolder} className="folder-btn">
            📁 Change Folder
          </button>
          <button 
            onClick={handleToggleViewerVisible}
            className="toggle-viewer-btn"
            title={viewerVisible ? 'Hide preview' : 'Show preview'}
          >
            {viewerVisible ? '◀ Hide Preview' : '▶ Show Preview'}
          </button>
          <button
            onClick={() => setActivePage(activePage === 'settings' ? 'gallery' : 'settings')}
            className={`settings-btn ${activePage === 'settings' ? 'active' : ''}`}
          >
            {activePage === 'settings' ? '← Gallery' : '⚙ Settings'}
          </button>
        </div>
      </header>

      {folderPath && activePage === 'gallery' && (
        <div className="folder-info">
          <span>{models.length} models found in {folderPath.split('/').pop()}</span>
        </div>
      )}

      {loading && <div className="loading">Loading models...</div>}

      {activePage === 'settings' ? (
        <main className="settings-page">
          <section className="settings-hero">
            <div>
              <p className="settings-eyebrow">Preferences</p>
              <h2>Tune the gallery to your workspace</h2>
              <p>Adjust model colors, thumbnail framing, layout defaults, and cache behavior.</p>
            </div>
            <button className="reset-settings-btn" onClick={handleResetSettings}>Reset all settings</button>
          </section>

          <div className="settings-grid">
            <section className="settings-section">
              <h3>Colors</h3>
              <label className="setting-row">
                <span>
                  <strong>Preview background</strong>
                  <small>Canvas color behind the selected model.</small>
                </span>
                <input type="color" value={preferences.previewBackgroundColor} onChange={(e) => savePreferences({ previewBackgroundColor: e.target.value })} />
              </label>
              <label className="setting-row">
                <span>
                  <strong>Thumbnail background</strong>
                  <small>Background used when generating card thumbnails.</small>
                </span>
                <input type="color" value={preferences.thumbnailBackgroundColor} onChange={(e) => savePreferences({ thumbnailBackgroundColor: e.target.value })} />
              </label>
              <label className="setting-row">
                <span>
                  <strong>Model color</strong>
                  <small>Material color for preview and thumbnails.</small>
                </span>
                <input type="color" value={preferences.modelColor} onChange={(e) => savePreferences({ modelColor: e.target.value })} />
              </label>
            </section>

            <section className="settings-section">
              <h3>Gallery defaults</h3>
              <label className="setting-row">
                <span>
                  <strong>Default view</strong>
                  <small>Choose the layout restored on launch.</small>
                </span>
                <select value={preferences.gridView ? 'grid' : 'list'} onChange={(e) => savePreferences({ gridView: e.target.value === 'grid' })}>
                  <option value="list">List</option>
                  <option value="grid">Grid</option>
                </select>
              </label>
              <label className="setting-row">
                <span>
                  <strong>Preview panel</strong>
                  <small>Show or hide the model preview by default.</small>
                </span>
                <select value={preferences.viewerVisible ? 'show' : 'hide'} onChange={(e) => savePreferences({ viewerVisible: e.target.value === 'show' })}>
                  <option value="show">Show</option>
                  <option value="hide">Hide</option>
                </select>
              </label>
              <label className="setting-row">
                <span>
                  <strong>Sort order</strong>
                  <small>Default ordering for model cards.</small>
                </span>
                <select value={preferences.sortBy} onChange={(e) => savePreferences({ sortBy: e.target.value as SortOption })}>
                  <option value="name">Name (A-Z)</option>
                  <option value="size">Size (Largest)</option>
                  <option value="modified">Date (Newest)</option>
                </select>
              </label>
            </section>

            <section className="settings-section">
              <h3>Cards and thumbnails</h3>
              <label className="setting-row">
                <span>
                  <strong>Thumbnail zoom</strong>
                  <small>Lower values make models fill more of the thumbnail.</small>
                </span>
                <div className="range-control">
                  <input
                    type="range"
                    min="0.9"
                    max="1.5"
                    step="0.02"
                    value={preferences.thumbnailZoom}
                    onChange={(e) => savePreferences({ thumbnailZoom: Number(e.target.value) })}
                  />
                  <b>{preferences.thumbnailZoom.toFixed(2)}×</b>
                </div>
              </label>
              <label className="setting-row">
                <span>
                  <strong>Card density</strong>
                  <small>Compact fits more models; spacious gives thumbnails more room.</small>
                </span>
                <select value={preferences.cardDensity} onChange={(e) => savePreferences({ cardDensity: e.target.value as UserPreferences['cardDensity'] })}>
                  <option value="compact">Compact</option>
                  <option value="comfortable">Comfortable</option>
                  <option value="spacious">Spacious</option>
                </select>
              </label>
              <label className="setting-row toggle-row">
                <span>
                  <strong>Auto-select first model</strong>
                  <small>Open the first model automatically after loading a folder.</small>
                </span>
                <input type="checkbox" checked={preferences.autoSelectFirstModel} onChange={(e) => savePreferences({ autoSelectFirstModel: e.target.checked })} />
              </label>
            </section>

            <section className="settings-section">
              <h3>Maintenance</h3>
              <p className="settings-copy">Clear cached thumbnails after changing colors or zoom if you want every card refreshed immediately.</p>
              <button className="secondary-settings-btn" onClick={handleClearThumbnailCache}>Clear thumbnail cache</button>
            </section>
          </div>
        </main>
      ) : (
        <div className="main-layout">
          <div className={`grid-section ${!viewerVisible ? 'full-width' : ''}`}>
            <ModelGrid
              models={sortedModels}
              selectedModel={selectedModel}
              onSelectModel={(model) => {
                setSelectedModel(model);
                if (model && !preferences.viewerVisible) {
                  savePreferences({ viewerVisible: true });
                }
              }}
              loading={loading}
              gridView={gridView}
              preferences={preferences}
              onSortChange={(sort) => savePreferences({ sortBy: sort })}
              onToggleGridView={handleToggleGridView}
            />
          </div>
          {viewerVisible && (
            <div className="viewer-section" style={{ background: preferences.previewBackgroundColor }}>
              {selectedModel ? (
                <ModelViewer key={`${selectedModel.path}-${preferences.previewBackgroundColor}-${preferences.modelColor}`} modelData={selectedModel} preferences={preferences} />
              ) : (
                <div className="viewer-placeholder">
                  <p>Select a model to view</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default App;
