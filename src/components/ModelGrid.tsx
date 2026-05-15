import { useEffect, useState, useRef } from 'react';
import { generateThumbnail } from './ModelViewer';
import { ModelInfo, UserPreferences } from '../types/electron';
import './ModelGrid.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faList,
  faThLarge,
  faFolderOpen,
  faCube,
  faPalette,
  faPrint,
  faClock,
  faTimes,
  faSortAmountUp,
  faSortAmountDown,
} from '@fortawesome/free-solid-svg-icons';

interface ModelGridProps {
  models: ModelInfo[];
  selectedModel: ModelInfo | null;
  onSelectModel: (model: ModelInfo | null) => void;
  loading: boolean;
  gridView: boolean;
  preferences: UserPreferences;
  onSortChange: (sort: 'name' | 'size' | 'modified') => void;
  onToggleSortOrder: () => void;
  onToggleGridView: () => void;
}

interface ThumbnailState {
  [path: string]: string;
}

interface LoadingThumbnailState {
  [path: string]: boolean;
}

type FilterExt = '.stl' | '.3mf';

function ModelGrid({ models, selectedModel, onSelectModel, loading, gridView, preferences, onSortChange, onToggleSortOrder, onToggleGridView }: ModelGridProps) {
  const [thumbnails, setThumbnails] = useState<ThumbnailState>({});
  const [activeFilters, setActiveFilters] = useState<Set<FilterExt>>(new Set());

  // Derive available extensions from the current model list
  const availableExts = Array.from(new Set(models.map(m => m.ext))) as FilterExt[];

  const toggleFilter = (ext: FilterExt) => {
    setActiveFilters(prev => {
      const next = new Set(prev);
      if (next.has(ext)) next.delete(ext);
      else next.add(ext);
      return next;
    });
  };

  const clearFilters = () => setActiveFilters(new Set());

  const filteredModels = activeFilters.size === 0
    ? models
    : models.filter(m => activeFilters.has(m.ext as FilterExt));

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
        <h2>Models ({filteredModels.length}{activeFilters.size > 0 ? `/${models.length}` : ''})</h2>
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
            onClick={onToggleSortOrder}
            className="sort-order-btn"
            title={preferences.sortOrder === 'asc' ? 'Ascending — click for descending' : 'Descending — click for ascending'}
          >
            <FontAwesomeIcon icon={preferences.sortOrder === 'asc' ? faSortAmountUp : faSortAmountDown} />
          </button>
          <button
            onClick={onToggleGridView}
            className={`view-toggle-btn ${gridView ? 'active' : ''}`}
            title={gridView ? 'Switch to list view' : 'Switch to grid view'}
          >
            {gridView ? <FontAwesomeIcon icon={faList} /> : <FontAwesomeIcon icon={faThLarge} />}
          </button>
        </div>
      </div>

      {availableExts.length > 1 && (
        <div className="filter-pills-row">
          {availableExts.map(ext => (
            <button
              key={ext}
              className={`filter-pill ${activeFilters.has(ext) ? 'active' : ''}`}
              onClick={() => toggleFilter(ext)}
            >
              <FontAwesomeIcon icon={ext === '.stl' ? faCube : faPalette} />
              {ext.toUpperCase().replace('.', '')}
            </button>
          ))}
          {activeFilters.size > 0 && (
            <button className="filter-pill filter-pill-clear" onClick={clearFilters} title="Clear filters">
              <FontAwesomeIcon icon={faTimes} /> Clear
            </button>
          )}
        </div>
      )}

      {filteredModels.length === 0 && !loading ? (
        <div className="empty-state">
          {models.length === 0 ? (
            <>
              <p>No STL or 3MF files found</p>
              <p className="empty-hint">Click "<FontAwesomeIcon icon={faFolderOpen} /> Change Folder" to browse</p>
            </>
          ) : (
            <>
              <p>No models match the active filters</p>
              <button className="filter-pill filter-pill-clear" onClick={clearFilters}>
                <FontAwesomeIcon icon={faTimes} /> Clear filters
              </button>
            </>
          )}
        </div>
      ) : (
        <div className={`grid-items ${gridView ? 'grid-view' : 'list-view'} density-${preferences.cardDensity}`}>
          {filteredModels.map((model, index) => (
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
                      {model.ext === '.stl' ? <FontAwesomeIcon icon={faCube} /> : <FontAwesomeIcon icon={faPalette} />}
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
                  <FontAwesomeIcon icon={faPrint} />
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
                    <FontAwesomeIcon icon={faClock} /> {formatModifiedDate(model.modified)}
                  </span>
                  <span title={model.path}><FontAwesomeIcon icon={faFolderOpen} /> {getFolderName(model.path)}</span>
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