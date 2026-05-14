import { useEffect, useState, useRef } from 'react';
import { generateThumbnail } from './ModelViewer';
import { ModelInfo } from '../types/electron';
import './ModelGrid.css';

interface ModelGridProps {
  models: ModelInfo[];
  selectedModel: ModelInfo | null;
  onSelectModel: (model: ModelInfo | null) => void;
  loading: boolean;
}

interface ThumbnailState {
  [path: string]: string;
}

interface LoadingThumbnailState {
  [path: string]: boolean;
}

function ModelGrid({ models, selectedModel, onSelectModel, loading }: ModelGridProps) {
  const [thumbnails, setThumbnails] = useState<ThumbnailState>({});
  const [loadingThumbnails, setLoadingThumbnails] = useState<LoadingThumbnailState>({});
  const thumbnailQueueRef = useRef<ModelInfo[]>([]);
  const processingRef = useRef<boolean>(false);

  useEffect(() => {
    // Queue models for thumbnail processing (check cache first)
    const newModels = models.filter(m => !thumbnails[m.path] && !loadingThumbnails[m.path]);
    if (newModels.length > 0) {
      thumbnailQueueRef.current = [...thumbnailQueueRef.current, ...newModels];
      processThumbnailQueue();
    }
  }, [models]);

  const processThumbnailQueue = async (): Promise<void> => {
    if (processingRef.current) return;
    processingRef.current = true;

    while (thumbnailQueueRef.current.length > 0) {
      const model = thumbnailQueueRef.current.shift()!;
      
      // Mark as loading
      setLoadingThumbnails(prev => ({ ...prev, [model.path]: true }));
      
      try {
        // First, check if thumbnail is cached
        const cachedThumbnail = await window.electronAPI.getThumbnailCache(model.path);
        
        if (cachedThumbnail) {
          // Use cached thumbnail
          setThumbnails(prev => ({ ...prev, [model.path]: cachedThumbnail }));
        } else {
          // Generate new thumbnail
          const thumbnailUrl = await generateThumbnail(model.path, model.ext);
          
          if (thumbnailUrl) {
            // Save to cache
            await window.electronAPI.saveThumbnailCache(model.path, thumbnailUrl);
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
      </div>

      {models.length === 0 && !loading ? (
        <div className="empty-state">
          <p>No STL or 3MF files found</p>
          <p className="empty-hint">Click "📁 Change Folder" to browse</p>
        </div>
      ) : (
        <div className="grid-items">
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
              </div>
              <div className="item-info">
                <h3 className="item-name" title={model.name}>
                  {model.name.length > 30 ? model.name.substring(0, 27) + '...' : model.name}
                </h3>
                <p className="item-ext">{model.ext.toUpperCase().replace('.', '')}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ModelGrid;