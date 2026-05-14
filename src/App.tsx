import { useState, useEffect } from 'react';
import './App.css';
import ModelGrid from './components/ModelGrid';
import ModelViewer from './components/ModelViewer';
import { ModelInfo } from './types/electron';

function App() {
  const [folderPath, setFolderPath] = useState<string | null>(null);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [selectedModel, setSelectedModel] = useState<ModelInfo | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [viewerVisible, setViewerVisible] = useState<boolean>(true);
  const [gridView, setGridView] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<'name' | 'size' | 'modified'>('name');

  // Sort models based on current sort option
  const sortedModels = [...models].sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return a.name.localeCompare(b.name);
      case 'size':
        return (b.size || 0) - (a.size || 0); // Largest first
      case 'modified':
        return new Date(b.modified || 0).getTime() - new Date(a.modified || 0).getTime(); // Newest first
      default:
        return 0;
    }
  });

  useEffect(() => {
    loadLastFolder();
  }, []);

  const loadLastFolder = async (): Promise<void> => {
    try {
      const lastFolder = await window.electronAPI.getLastFolder();
      if (lastFolder) {
        await loadFolder(lastFolder);
      }
    } catch (error) {
      console.error('Error loading last folder:', error);
    }
  };

  const loadFolder = async (path: string): Promise<void> => {
    setLoading(true);
    try {
      const modelList = await window.electronAPI.listModels(path);
      setModels(modelList);
      setFolderPath(path);
      setSelectedModel(null);
      // Save as last folder
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

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>🎨 STL/3MF Gallery Viewer</h1>
        <div className="header-buttons">
          <button onClick={handleSelectFolder} className="folder-btn">
            📁 Change Folder
          </button>
          <div className="sort-dropdown">
            <label htmlFor="sort-select">Sort by:</label>
            <select
              id="sort-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'name' | 'size' | 'modified')}
              className="sort-select"
            >
              <option value="name">Name (A-Z)</option>
              <option value="size">Size (Largest)</option>
              <option value="modified">Date (Newest)</option>
            </select>
          </div>
          <button 
            onClick={() => setGridView(!gridView)}
            className={`view-toggle-btn ${gridView ? 'active' : ''}`}
            title={gridView ? "Switch to list view" : "Switch to grid view"}
          >
            {gridView ? "📋 List" : "⊞ Grid"}
          </button>
          <button 
            onClick={() => setViewerVisible(!viewerVisible)}
            className="toggle-viewer-btn"
            title={viewerVisible ? "Hide preview" : "Show preview"}
          >
            {viewerVisible ? "◀ Hide Preview" : "▶ Show Preview"}
          </button>
        </div>
      </header>

      {folderPath && (
        <div className="folder-info">
          <span>{models.length} models found in {folderPath.split('/').pop()}</span>
        </div>
      )}

      {loading && <div className="loading">Loading models...</div>}

      <div className="main-layout">
        <div className={`grid-section ${!viewerVisible ? 'full-width' : ''}`}>
          <ModelGrid
            models={sortedModels}
            selectedModel={selectedModel}
            onSelectModel={setSelectedModel}
            loading={loading}
            gridView={gridView}
          />
        </div>
        {viewerVisible && (
          <div className="viewer-section">
            {selectedModel ? (
              <ModelViewer key={selectedModel.path} modelData={selectedModel} />
            ) : (
              <div className="viewer-placeholder">
                <p>Select a model to view</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;