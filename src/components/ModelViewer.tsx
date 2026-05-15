import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import JSZip from 'jszip';
import './ModelViewer.css';
import { ModelInfo, UserPreferences } from '../types/electron';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLightbulb } from '@fortawesome/free-solid-svg-icons';

interface ModelViewerProps {
  modelData: ModelInfo;
  preferences: UserPreferences;
}

interface ModelInfoState {
  name: string;
  size: string;
  modified: string;
}

interface ControlsState {
  isDragging: boolean;
  isPanning: boolean;
  previousMouse: { x: number; y: number };
}

function ModelViewer({ modelData, preferences }: ModelViewerProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const meshRef = useRef<THREE.Group | null>(null);
  const animationIdRef = useRef<number>(0);
  const renderRequestedRef = useRef<boolean>(false);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const loadRequestIdRef = useRef<number>(0);
  const controlsStateRef = useRef<ControlsState>({
    isDragging: false,
    isPanning: false,
    previousMouse: { x: 0, y: 0 }
  });
  const renderInteractionRef = useRef<boolean>(false);
  
  const [info, setInfo] = useState<ModelInfoState | null>(null);

  useEffect(() => {
    initializeViewer();
    return () => {
      cleanup();
    };
  }, []);

  useEffect(() => {
    loadAndDisplayModel();
  }, [modelData]);

  useEffect(() => {
    updateSceneAppearance();
  }, [preferences.previewBackgroundColor, preferences.modelColor]);

  const disposeGroupResources = (group: THREE.Group): void => {
    group.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;

      object.geometry?.dispose();

      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((material) => material?.dispose());
    });
  };

  const disposeCurrentModel = (): void => {
    if (!meshRef.current) return;

    if (sceneRef.current) {
      sceneRef.current.remove(meshRef.current);
    }

    disposeGroupResources(meshRef.current);
    meshRef.current = null;
  };

  const cleanup = (): void => {
    loadRequestIdRef.current += 1;

    if (animationIdRef.current) {
      cancelAnimationFrame(animationIdRef.current);
      animationIdRef.current = 0;
    }
    renderRequestedRef.current = false;

    if (resizeObserverRef.current) {
      resizeObserverRef.current.disconnect();
      resizeObserverRef.current = null;
    }

    // Remove event listeners
    if (mountRef.current) {
      mountRef.current.removeEventListener('pointerdown', handlePointerDown);
      mountRef.current.removeEventListener('pointermove', handlePointerMove);
      mountRef.current.removeEventListener('pointerup', handlePointerUp);
      mountRef.current.removeEventListener('pointercancel', handlePointerUp);
      mountRef.current.removeEventListener('wheel', handleWheel);
      mountRef.current.removeEventListener('contextmenu', handleContextMenu);
    }

    disposeCurrentModel();
    sceneRef.current = null;
    cameraRef.current = null;

    if (rendererRef.current) {
      const canvas = rendererRef.current.domElement;
      rendererRef.current.dispose();
      if (mountRef.current && canvas?.parentNode === mountRef.current) {
        mountRef.current.removeChild(canvas);
      }
      rendererRef.current = null;
    }
  };

  const parseSTLFile = async (arrayBuffer: ArrayBuffer): Promise<THREE.BufferGeometry> => {
    const view = new DataView(arrayBuffer);
    const isASCII = isASCIISTL(arrayBuffer);

    if (isASCII) {
      return parseASCIISTL(arrayBuffer);
    } else {
      return parseBinarySTL(view);
    }
  };

  const isASCIISTL = (arrayBuffer: ArrayBuffer): boolean => {
    const view = new Uint8Array(arrayBuffer);
    const decoder = new TextDecoder();
    const header = decoder.decode(view.slice(0, 5));
    return header === 'solid';
  };

  const parseBinarySTL = (view: DataView): THREE.BufferGeometry => {
    const triangles = view.getUint32(80, true);
    const geometry = new THREE.BufferGeometry();
    const vertices = new Float32Array(triangles * 9);
    const normals = new Float32Array(triangles * 9);

    let offset = 84;
    let attributeOffset = 0;
    for (let i = 0; i < triangles; i++) {
      const nx = view.getFloat32(offset, true); offset += 4;
      const ny = view.getFloat32(offset, true); offset += 4;
      const nz = view.getFloat32(offset, true); offset += 4;

      for (let j = 0; j < 3; j++) {
        vertices[attributeOffset] = view.getFloat32(offset, true); offset += 4;
        vertices[attributeOffset + 1] = view.getFloat32(offset, true); offset += 4;
        vertices[attributeOffset + 2] = view.getFloat32(offset, true); offset += 4;

        normals[attributeOffset] = nx;
        normals[attributeOffset + 1] = ny;
        normals[attributeOffset + 2] = nz;
        attributeOffset += 3;
      }
      offset += 2; // attribute byte count
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    return geometry;
  };

  const parseASCIISTL = (arrayBuffer: ArrayBuffer): THREE.BufferGeometry => {
    const decoder = new TextDecoder();
    const text = decoder.decode(arrayBuffer);
    const geometry = new THREE.BufferGeometry();
    const vertices: number[] = [];
    const normals: number[] = [];

    const vertexRegex = /vertex\s+([-+]?[0-9]*\.?[0-9]+(?:[eE][-+]?[0-9]+)?)\s+([-+]?[0-9]*\.?[0-9]+(?:[eE][-+]?[0-9]+)?)\s+([-+]?[0-9]*\.?[0-9]+(?:[eE][-+]?[0-9]+)?)/g;
    const normalRegex = /facet\s+normal\s+([-+]?[0-9]*\.?[0-9]+(?:[eE][-+]?[0-9]+)?)\s+([-+]?[0-9]*\.?[0-9]+(?:[eE][-+]?[0-9]+)?)\s+([-+]?[0-9]*\.?[0-9]+(?:[eE][-+]?[0-9]+)?)/g;

    const normalsArray: [number, number, number][] = [];
    let normalMatch: RegExpExecArray | null;
    while ((normalMatch = normalRegex.exec(text)) !== null) {
      normalsArray.push([parseFloat(normalMatch[1]), parseFloat(normalMatch[2]), parseFloat(normalMatch[3])]);
    }

    let normalIndex = 0;
    let vertexMatch: RegExpExecArray | null;
    while ((vertexMatch = vertexRegex.exec(text)) !== null) {
      vertices.push(parseFloat(vertexMatch[1]), parseFloat(vertexMatch[2]), parseFloat(vertexMatch[3]));
      const normal = normalsArray[Math.floor(normalIndex / 3)] || [0, 0, 1];
      normals.push(normal[0], normal[1], normal[2]);
      normalIndex++;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices), 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(normals), 3));
    return geometry;
  };

  const parse3MFFile = async (arrayBuffer: ArrayBuffer): Promise<THREE.BufferGeometry[] | null> => {
    try {
      const zip = new JSZip();
      await zip.loadAsync(arrayBuffer);

      const geometries: THREE.BufferGeometry[] = [];
      const modelFile = zip.file('3D/model.xml');
      
      if (modelFile) {
        const xmlText = await modelFile.async('text');
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

        const meshes = xmlDoc.getElementsByTagName('mesh');
        for (let i = 0; i < meshes.length; i++) {
          const mesh = meshes[i];
          const verticesEl = mesh.getElementsByTagName('vertices')[0];
          const trianglesEl = mesh.getElementsByTagName('triangles')[0];

          if (verticesEl && trianglesEl) {
            const geometry = new THREE.BufferGeometry();
            const vertexElements = verticesEl.getElementsByTagName('vertex');
            const triangleElements = trianglesEl.getElementsByTagName('triangle');
            const vertices = new Float32Array(vertexElements.length * 3);
            const indices = vertexElements.length > 65535
              ? new Uint32Array(triangleElements.length * 3)
              : new Uint16Array(triangleElements.length * 3);

            for (let j = 0; j < vertexElements.length; j++) {
              const v = vertexElements[j];
              const vertexOffset = j * 3;
              vertices[vertexOffset] = parseFloat(v.getAttribute('x') || '0');
              vertices[vertexOffset + 1] = parseFloat(v.getAttribute('y') || '0');
              vertices[vertexOffset + 2] = parseFloat(v.getAttribute('z') || '0');
            }

            for (let j = 0; j < triangleElements.length; j++) {
              const t = triangleElements[j];
              const indexOffset = j * 3;
              indices[indexOffset] = parseInt(t.getAttribute('v1') || '0', 10);
              indices[indexOffset + 1] = parseInt(t.getAttribute('v2') || '0', 10);
              indices[indexOffset + 2] = parseInt(t.getAttribute('v3') || '0', 10);
            }

            geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
            geometry.setIndex(new THREE.BufferAttribute(indices, 1));
            geometry.computeVertexNormals();
            geometries.push(geometry);
          }
        }
      }

      return geometries.length > 0 ? geometries : null;
    } catch (error) {
      console.error('Error parsing 3MF:', error);
      return null;
    }
  };

  const initializeViewer = (): void => {
    if (!mountRef.current || rendererRef.current) return;

    sceneRef.current = new THREE.Scene();
    sceneRef.current.background = new THREE.Color(preferences.previewBackgroundColor);

    cameraRef.current = new THREE.PerspectiveCamera(
      50,
      mountRef.current.clientWidth / mountRef.current.clientHeight,
      0.1,
      100000
    );

    rendererRef.current = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    rendererRef.current.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    rendererRef.current.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    rendererRef.current.shadowMap.enabled = false;
    rendererRef.current.domElement.style.touchAction = 'none';
    mountRef.current.appendChild(rendererRef.current.domElement);

    setupLights();
    setupControls();
    setupResizeObserver();
  };

  const updateSceneAppearance = (): void => {
    if (sceneRef.current) {
      sceneRef.current.background = new THREE.Color(preferences.previewBackgroundColor);
    }

    if (meshRef.current) {
      meshRef.current.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;

        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => {
          if (material instanceof THREE.MeshPhongMaterial) {
            material.color.set(preferences.modelColor);
            material.needsUpdate = true;
          }
        });
      });
    }

    requestRender();
  };

  const loadAndDisplayModel = async (): Promise<void> => {
    if (!mountRef.current) return;
    initializeViewer();
    const loadRequestId = ++loadRequestIdRef.current;

    try {
      const arrayBuffer = await window.electronAPI.loadModel(modelData.path);
      if (!arrayBuffer) {
        console.error('Failed to load model data');
        return;
      }
      
      const stats = await window.electronAPI.getFileStats(modelData.path);

      if (stats) {
        setInfo({
          name: modelData.name,
          size: formatFileSize(stats.size),
          modified: new Date(stats.modified).toLocaleString(),
        });
      }

      let geometries: THREE.BufferGeometry[] = [];

      if (modelData.ext === '.stl') {
        const geometry = await parseSTLFile(arrayBuffer);
        geometries = [geometry];
      } else if (modelData.ext === '.3mf') {
        const parsed = await parse3MFFile(arrayBuffer);
        geometries = parsed || [];
      }

      if (loadRequestId !== loadRequestIdRef.current) {
        geometries.forEach((geometry) => geometry.dispose());
        return;
      }

      renderScene(geometries);
    } catch (error) {
      console.error('Error loading model:', error);
    }
  };

  const renderScene = (geometries: THREE.BufferGeometry[]): void => {
    if (!mountRef.current) return;
    initializeViewer();
    if (!sceneRef.current) return;

    sceneRef.current.background = new THREE.Color(preferences.previewBackgroundColor);
    disposeCurrentModel();

    // Create mesh group
    const group = new THREE.Group();
    geometries.forEach((geometry) => {
      geometry.computeBoundingBox();
      const box = geometry.boundingBox;
      if (box) {
        const center = box.getCenter(new THREE.Vector3());
        geometry.translate(-center.x, -center.y, -center.z);
      }

      const material = new THREE.MeshPhongMaterial({
        color: new THREE.Color(preferences.modelColor),
        specular: 0x444444,
        shininess: 60,
        side: THREE.DoubleSide,
      });

      const mesh = new THREE.Mesh(geometry, material);
      group.add(mesh);
    });

    meshRef.current = group;
    sceneRef.current.add(group);

    // Center and fit camera
    centerAndFitCamera(group);

    // Render once after loading. Further renders are requested by controls/resizes.
    requestRender();
  };

  const setupLights = (): void => {
    if (!sceneRef.current) return;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    sceneRef.current.add(ambientLight);

    const directionalLight1 = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight1.position.set(5, 10, 7);
    sceneRef.current.add(directionalLight1);

    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.4);
    directionalLight2.position.set(-5, 5, -5);
    sceneRef.current.add(directionalLight2);

    const pointLight = new THREE.PointLight(0xffffff, 0.3);
    pointLight.position.set(0, -5, 0);
    sceneRef.current.add(pointLight);
  };

  const setupControls = (): void => {
    if (!rendererRef.current || !mountRef.current) return;

    mountRef.current.addEventListener('pointerdown', handlePointerDown);
    mountRef.current.addEventListener('pointermove', handlePointerMove);
    mountRef.current.addEventListener('pointerup', handlePointerUp);
    mountRef.current.addEventListener('pointercancel', handlePointerUp);
    mountRef.current.addEventListener('wheel', handleWheel, { passive: false });
    mountRef.current.addEventListener('contextmenu', handleContextMenu);
  };

  const setupResizeObserver = (): void => {
    if (!mountRef.current || !rendererRef.current || !cameraRef.current) return;

    resizeObserverRef.current = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (!rendererRef.current || !cameraRef.current || width === 0 || height === 0) return;

      rendererRef.current.setSize(width, height);
      cameraRef.current.aspect = width / height;
      cameraRef.current.updateProjectionMatrix();
      requestRender();
    });

    resizeObserverRef.current.observe(mountRef.current);
  };

  const beginInteractionRender = (): void => {
    if (renderInteractionRef.current) return;

    renderInteractionRef.current = true;
    const renderWhileInteracting = () => {
      if (!renderInteractionRef.current) return;
      renderOnce();
      animationIdRef.current = requestAnimationFrame(renderWhileInteracting);
    };

    animationIdRef.current = requestAnimationFrame(renderWhileInteracting);
  };

  const endInteractionRender = (): void => {
    renderInteractionRef.current = false;
    requestRender();
  };

  const handlePointerDown = (e: PointerEvent): void => {
    e.preventDefault();
    if (e.button === 0) {
      controlsStateRef.current.isDragging = true;
    } else if (e.button === 1 || e.button === 2) {
      controlsStateRef.current.isPanning = true;
    }

    controlsStateRef.current.previousMouse = { x: e.clientX, y: e.clientY };
    mountRef.current?.setPointerCapture(e.pointerId);
    mountRef.current?.classList.add('is-interacting');
    beginInteractionRender();
  };

  const handlePointerMove = (e: PointerEvent): void => {
    const state = controlsStateRef.current;
    if (!state.isDragging && !state.isPanning) return;

    const deltaX = e.clientX - state.previousMouse.x;
    const deltaY = e.clientY - state.previousMouse.y;
    state.previousMouse = { x: e.clientX, y: e.clientY };

    if (state.isDragging && meshRef.current && mountRef.current) {
      const rotationSpeed = (Math.PI * 2) / Math.max(240, Math.min(mountRef.current.clientWidth, mountRef.current.clientHeight));
      meshRef.current.rotation.y += deltaX * rotationSpeed;
      meshRef.current.rotation.x += deltaY * rotationSpeed;
    }

    if (state.isPanning && cameraRef.current && mountRef.current) {
      const viewportHeight = Math.max(1, mountRef.current.clientHeight);
      const visibleHeight = 2 * Math.tan(THREE.MathUtils.degToRad(cameraRef.current.fov) / 2) * cameraRef.current.position.z;
      const visibleWidth = visibleHeight * cameraRef.current.aspect;

      cameraRef.current.position.x -= (deltaX / Math.max(1, mountRef.current.clientWidth)) * visibleWidth;
      cameraRef.current.position.y += (deltaY / viewportHeight) * visibleHeight;
    }
  };

  const handlePointerUp = (e: PointerEvent): void => {
    controlsStateRef.current.isDragging = false;
    controlsStateRef.current.isPanning = false;
    if (mountRef.current?.hasPointerCapture(e.pointerId)) {
      mountRef.current.releasePointerCapture(e.pointerId);
    }
    mountRef.current?.classList.remove('is-interacting');
    endInteractionRender();
  };

  const handleWheel = (e: WheelEvent): void => {
    e.preventDefault();
    if (!cameraRef.current) return;

    const zoomSpeed = 0.1;
    cameraRef.current.position.z += e.deltaY * zoomSpeed;

    if (cameraRef.current.position.z < 10) {
      cameraRef.current.position.z = 10;
    }

    requestRender();
  };

  const handleContextMenu = (e: Event): void => {
    e.preventDefault();
  };

  const centerAndFitCamera = (object: THREE.Group): void => {
    if (!cameraRef.current) return;

    const boundingBox = new THREE.Box3().setFromObject(object);
    const center = boundingBox.getCenter(new THREE.Vector3());
    const size = boundingBox.getSize(new THREE.Vector3());

    object.position.set(-center.x, -center.y, -center.z);

    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = cameraRef.current.fov * (Math.PI / 180);
    const cameraZ = maxDim / Math.sin(fov / 2) * 1.5;

    cameraRef.current.position.set(0, 0, cameraZ);
    cameraRef.current.lookAt(new THREE.Vector3(0, 0, 0));
  };

  const renderOnce = (): void => {
    if (rendererRef.current && sceneRef.current && cameraRef.current) {
      rendererRef.current.render(sceneRef.current, cameraRef.current);
    }
  };

  const requestRender = (): void => {
    if (renderRequestedRef.current) return;

    renderRequestedRef.current = true;
    animationIdRef.current = requestAnimationFrame(() => {
      renderRequestedRef.current = false;
      animationIdRef.current = 0;
      renderOnce();
    });
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="model-viewer">
      <div ref={mountRef} className="viewer-canvas"></div>
      {info && (
        <div className="model-info">
          <h3>{info.name}</h3>
          <p className="info-item">
            <span className="label">Size:</span> {info.size}
          </p>
          <p className="info-item">
            <span className="label">Modified:</span> {info.modified}
          </p>
          <p className="info-hint"><FontAwesomeIcon icon={faLightbulb} /> Left-drag: rotate • Right-drag: pan • Scroll: zoom</p>
        </div>
      )}
    </div>
  );
}

// Export thumbnail generator function
export async function generateThumbnail(modelPath: string, ext: string, preferences: UserPreferences): Promise<string | null> {
  try {
    const arrayBuffer = await window.electronAPI.loadModel(modelPath);
    if (!arrayBuffer) return null;

    // Create offscreen renderer
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(256, 256);
    renderer.setClearColor(new THREE.Color(preferences.thumbnailBackgroundColor), 1);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100000);

    // Add lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 7);
    scene.add(directionalLight);

    // Parse geometry based on file type
    let geometries: THREE.BufferGeometry[] = [];

    if (ext === '.stl') {
      const view = new DataView(arrayBuffer);
      const decoder = new TextDecoder();
      const v = new Uint8Array(arrayBuffer);
      const header = decoder.decode(v.slice(0, 5));
      const isASCII = header === 'solid';

      if (isASCII) {
        const text = decoder.decode(arrayBuffer);
        const geometry = new THREE.BufferGeometry();
        const vertices: number[] = [];
        const normals: number[] = [];

        const vertexRegex = /vertex\s+([-+]?[0-9]*\.?[0-9]+(?:[eE][-+]?[0-9]+)?)\s+([-+]?[0-9]*\.?[0-9]+(?:[eE][-+]?[0-9]+)?)\s+([-+]?[0-9]*\.?[0-9]+(?:[eE][-+]?[0-9]+)?)/g;
        const normalRegex = /facet\s+normal\s+([-+]?[0-9]*\.?[0-9]+(?:[eE][-+]?[0-9]+)?)\s+([-+]?[0-9]*\.?[0-9]+(?:[eE][-+]?[0-9]+)?)\s+([-+]?[0-9]*\.?[0-9]+(?:[eE][-+]?[0-9]+)?)/g;

        const normalsArray: [number, number, number][] = [];
        let normalMatch: RegExpExecArray | null;
        while ((normalMatch = normalRegex.exec(text)) !== null) {
          normalsArray.push([parseFloat(normalMatch[1]), parseFloat(normalMatch[2]), parseFloat(normalMatch[3])]);
        }

        let normalIndex = 0;
        let vertexMatch: RegExpExecArray | null;
        while ((vertexMatch = vertexRegex.exec(text)) !== null) {
          vertices.push(parseFloat(vertexMatch[1]), parseFloat(vertexMatch[2]), parseFloat(vertexMatch[3]));
          const normal = normalsArray[Math.floor(normalIndex / 3)] || [0, 0, 1];
          normals.push(normal[0], normal[1], normal[2]);
          normalIndex++;
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices), 3));
        geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(normals), 3));
        geometries = [geometry];
      } else {
        const triangles = view.getUint32(80, true);
        const geometry = new THREE.BufferGeometry();
        const vertices = new Float32Array(triangles * 9);
        const normals = new Float32Array(triangles * 9);

        let offset = 84;
        let attributeOffset = 0;
        for (let i = 0; i < triangles; i++) {
          const nx = view.getFloat32(offset, true); offset += 4;
          const ny = view.getFloat32(offset, true); offset += 4;
          const nz = view.getFloat32(offset, true); offset += 4;

          for (let j = 0; j < 3; j++) {
            vertices[attributeOffset] = view.getFloat32(offset, true); offset += 4;
            vertices[attributeOffset + 1] = view.getFloat32(offset, true); offset += 4;
            vertices[attributeOffset + 2] = view.getFloat32(offset, true); offset += 4;

            normals[attributeOffset] = nx;
            normals[attributeOffset + 1] = ny;
            normals[attributeOffset + 2] = nz;
            attributeOffset += 3;
          }
          offset += 2;
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
        geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
        geometries = [geometry];
      }
    } else if (ext === '.3mf') {
      const zip = new JSZip();
      await zip.loadAsync(arrayBuffer);
      const modelFile = zip.file('3D/model.xml');

      if (modelFile) {
        const xmlText = await modelFile.async('text');
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
        const meshes = xmlDoc.getElementsByTagName('mesh');

        for (let i = 0; i < meshes.length; i++) {
          const mesh = meshes[i];
          const verticesEl = mesh.getElementsByTagName('vertices')[0];
          const trianglesEl = mesh.getElementsByTagName('triangles')[0];

          if (verticesEl && trianglesEl) {
            const geometry = new THREE.BufferGeometry();
            const vertexElements = verticesEl.getElementsByTagName('vertex');
            const triangleElements = trianglesEl.getElementsByTagName('triangle');
            const vertices = new Float32Array(vertexElements.length * 3);
            const indices = vertexElements.length > 65535
              ? new Uint32Array(triangleElements.length * 3)
              : new Uint16Array(triangleElements.length * 3);

            for (let j = 0; j < vertexElements.length; j++) {
              const v = vertexElements[j];
              const vertexOffset = j * 3;
              vertices[vertexOffset] = parseFloat(v.getAttribute('x') || '0');
              vertices[vertexOffset + 1] = parseFloat(v.getAttribute('y') || '0');
              vertices[vertexOffset + 2] = parseFloat(v.getAttribute('z') || '0');
            }

            for (let j = 0; j < triangleElements.length; j++) {
              const t = triangleElements[j];
              const indexOffset = j * 3;
              indices[indexOffset] = parseInt(t.getAttribute('v1') || '0', 10);
              indices[indexOffset + 1] = parseInt(t.getAttribute('v2') || '0', 10);
              indices[indexOffset + 2] = parseInt(t.getAttribute('v3') || '0', 10);
            }

            geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
            geometry.setIndex(new THREE.BufferAttribute(indices, 1));
            geometry.computeVertexNormals();
            geometries.push(geometry);
          }
        }
      }
    }

    // Create mesh group
    const group = new THREE.Group();
    geometries.forEach((geometry) => {
      geometry.computeBoundingBox();
      const box = geometry.boundingBox;
      if (box) {
        const center = box.getCenter(new THREE.Vector3());
        geometry.translate(-center.x, -center.y, -center.z);
      }

      const material = new THREE.MeshPhongMaterial({
        color: new THREE.Color(preferences.modelColor),
        specular: 0x444444,
        shininess: 60,
        side: THREE.DoubleSide,
      });

      const mesh = new THREE.Mesh(geometry, material);
      group.add(mesh);
    });

    scene.add(group);

    // Center and fit
    const boundingBox = new THREE.Box3().setFromObject(group);
    const center = boundingBox.getCenter(new THREE.Vector3());
    group.position.set(-center.x, -center.y, -center.z);

    const size = boundingBox.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = camera.fov * (Math.PI / 180);
    // Keep thumbnails tightly framed so the model uses more of the card space.
    const cameraZ = maxDim / Math.sin(fov / 2) * preferences.thumbnailZoom;

    camera.position.set(0, 0, cameraZ);
    camera.lookAt(0, 0, 0);

    // Render
    renderer.render(scene, camera);

    // Get thumbnail URL
    const thumbnailUrl = canvas.toDataURL('image/png');

    // Cleanup
    group.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;

      object.geometry?.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((material) => material?.dispose());
    });
    renderer.dispose();

    return thumbnailUrl;
  } catch (error) {
    console.error('Error generating thumbnail:', error);
    return null;
  }
}

export default ModelViewer;