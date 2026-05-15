import { useEffect, useState, useRef } from 'react';
import { generateThumbnail } from './ModelViewer';
import { ModelInfo, UserPreferences } from '../types/electron';
import './ModelGrid.css';

interface ModelGridProps {
  models: ModelInfo[];
  selectedModel: ModelInfo | null;
  onSelectModel: (model: ModelInfo | null) => void;
  loading: boolean;
  gridView: boolean;
  preferences: UserPreferences;
  onSortChange: (sort: 'name' | 'size' | 'modified') => void;
  onToggleGridView: () => void;
}

interface ThumbnailState {
  [path: string]: string;
}

interface LoadingThumbnailState {
  [path: string]: boolean;
}

function ModelGrid({ models, selectedModel, onSelectModel, loading, gridView, preferences, onSortChange, onToggleGridView }: ModelGridProps) {
  const [thumbnails, setThumbnails] = useState<ThumbnailState>({});

  const formatFileSize = (bytes?: number): string => {
    if (!bytes && bytes !== 0) return 'Unknown size';
    if (bytes === 0) return '0 B';

    const units = ['B', 'KB', 'MB', 'GB'];
    const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const value = bytes / Math.pow(1024, unitIndex);

    return `${value >= 10 || unitIndex === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`;
  };

  const formatModifiedDate = (modified?: string): string => {
    if (!modified) return 'Unknown date';

    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(modified));
  };

  const getFolderName = (modelPath: string): string => {
    const parts = modelPath.split(/[\\/]/);
    return parts.length > 1 ? parts[parts.length - 2] : 'Local file';
  };
  const [loadingThumbnails, setLoadingThumbnails] = useState<LoadingThumbnailState>({});
  const thumbnailQueueRef = useRef<ModelInfo[]>([]);
  const processingRef = useRef<boolean>(false);

  const thumbnailVariant = `${preferences.thumbnailBackgroundColor}-${preferences.modelColor}-${preferences.thumbnailZoom}`;

  useEffect(() => {
    setThumbnails({});
    thumbnailQueueRef.current = [];
  }, [thumbnailVariant]);

  useEffect(() => {
    // Queue models for thumbnail processing (check cache first)
    const newModels = models.filter(m => !thumbnails[m.path] && !loadingThumbnails[m.path]);
    if (newModels.length > 0) {
      thumbnailQueueRef.current = [...thumbnailQueueRef.current, ...newModels];
      processThumbnailQueue();
    }
  }, [models, thumbnails, loadingThumbnails, thumbnailVariant]);

  const processThumbnailQueue = async (): Promise<void> => {
    if (processingRef.current) return;
    processingRef.current = true;

    while (thumbnailQueueRef.current.length > 0) {
      const model = thumbnailQueueRef.current.shift()!;
      
      // Mark as loading
      setLoadingThumbnails(prev => ({ ...prev, [model.path]: true }));
      
      try {
        // First, check if thumbnail is cached
        const cachedThumbnail = await window.electronAPI.getThumbnailCache(model.path, thumbnailVariant);
        
        if (cachedThumbnail) {
          // Use cached thumbnail
          setThumbnails(prev => ({ ...prev, [model.path]: cachedThumbnail }));
        } else {
          // Generate new thumbnail
          const thumbnailUrl = await generateThumbnail(model.path, model.ext, preferences);
          
          if (thumbnailUrl) {
            // Save to cache
            await window.electronAPI.saveThumbnailCache(model.path, thumbnailUrl, thumbnailVariant);
            // Display thumbnail
            setThumbnails(prev => ({ ...prev, [model.path]: thumbnailUrl }));
          }
        }
      } catch (error) {
        console.error('Failed to process thumbnail for', model.name, error);
      }
      
      setLoadingThumbnails(prev => ({ ...prev, [model.path]: false }));
      
      // Small delay to prevent overwhelming the system
      await new Promise<void>(resolve => setTimeout(resolve, 20));
    }

    processingRef.current = false;
  };

  return (
    <div className="model-grid">
      <div className="grid-header">
        <h2>Models ({models.length})</h2>
        <div className="grid-header-controls">
          <select
            value={preferences.sortBy}
            onChange={(e) => onSortChange(e.target.value as 'name' | 'size' | 'modified')}
            className="sort-select"
            title="Sort by"
          >
            <option value="name">Name (A-Z)</option>
            <option value="size">Size (Largest)</option>
            <option value="modified">Date (Newest)</option>
          </select>
          <button
            onClick={onToggleGridView}
            className={`view-toggle-btn ${gridView ? 'active' : ''}`}
            title={gridView ? 'Switch to list view' : 'Switch to grid view'}
          >
            {gridView ? '📋' : '⊞'}
          </button>
        </div>
      </div>

      {models.length === 0 && !loading ? (
        <div className="empty-state">
          <p>No STL or 3MF files found</p>
          <p className="empty-hint">Click "📁 Change Folder" to browse</p>
        </div>
      ) : (
        <div className={`grid-items ${gridView ? 'grid-view' : 'list-view'} density-${preferences.cardDensity}`}>
          {models.map((model, index) => (
            <div
              key={index}
              className={`grid-item ${selectedModel?.path === model.path ? 'selected' : ''}`}
              onClick={() => onSelectModel(model)}
            >
              <div className="item-thumbnail">
                {thumbnails[model.path] ? (
                  <img 
                    src={thumbnails[model.path]} 
                    alt={model.name}
                    className="thumbnail-image"
                  />
                ) : loadingThumbnails[model.path] ? (
                  <div className="thumbnail-loading">
                    <div className="spinner"></div>
                  </div>
                ) : (
                  <div className="thumbnail-placeholder">
                    <span className="placeholder-icon">
                      {model.ext === '.stl' ? '📦' : '🎨'}
                    </span>
                  </div>
                )}
                <button
                  className="open-in-slicer-btn"
                  title="Open in AnycubicSlicerNext"
                  onClick={(e) => {
                    e.stopPropagation();
                    window.electronAPI.openInSlicer(model.path);
                  }}
                >
                  🖨
                </button>
              </div>
              <div className="item-info">
                <h3 className="item-name" title={model.name}>
                  {model.name}
                </h3>
                <div className="item-meta-row">
                  <span className="item-ext">{model.ext.toUpperCase().replace('.', '')}</span>
                  <span className="item-size">{formatFileSize(model.size)}</span>
                </div>
                <div className="item-details">
                  <span title={model.modified ? new Date(model.modified).toLocaleString() : undefined}>
                    🕒 {formatModifiedDate(model.modified)}
                  </span>
                  <span title={model.path}>📁 {getFolderName(model.path)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ModelGrid;