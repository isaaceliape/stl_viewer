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
        <button onClick={handleSelectFolder} className="folder-btn">
          📁 Change Folder
        </button>
      </header>

      {folderPath && (
        <div className="folder-info">
          <span>{models.length} models found in {folderPath.split('/').pop()}</span>
        </div>
      )}

      {loading && <div className="loading">Loading models...</div>}

      <div className="main-layout">
        <div className="grid-section">
          <ModelGrid
            models={models}
            selectedModel={selectedModel}
            onSelectModel={setSelectedModel}
            loading={loading}
          />
        </div>
        <div className="viewer-section">
          {selectedModel ? (
            <ModelViewer key={selectedModel.path} modelData={selectedModel} />
          ) : (
            <div className="viewer-placeholder">
              <p>Select a model to view</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;