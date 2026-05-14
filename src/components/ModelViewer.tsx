import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import JSZip from 'jszip';
import './ModelViewer.css';
import { ModelInfo } from '../types/electron';

interface ModelViewerProps {
  modelData: ModelInfo;
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

function ModelViewer({ modelData }: ModelViewerProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const meshRef = useRef<THREE.Group | null>(null);
  const animationIdRef = useRef<number>(0);
  const controlsStateRef = useRef<ControlsState>({
    isDragging: false,
    isPanning: false,
    previousMouse: { x: 0, y: 0 }
  });
  
  const [info, setInfo] = useState<ModelInfoState | null>(null);

  useEffect(() => {
    loadAndDisplayModel();
    return () => {
      cleanup();
    };
  }, [modelData]);

  const cleanup = (): void => {
    if (animationIdRef.current) {
      cancelAnimationFrame(animationIdRef.current);
    }
    if (rendererRef.current) {
      rendererRef.current.dispose();
      if (mountRef.current && rendererRef.current.domElement) {
        try {
          mountRef.current.removeChild(rendererRef.current.domElement);
        } catch (e) {
          // Element may already be removed
        }
      }
    }
    // Remove event listeners
    if (rendererRef.current && mountRef.current) {
      mountRef.current.removeEventListener('mousedown', handleMouseDown);
      mountRef.current.removeEventListener('mousemove', handleMouseMove);
      mountRef.current.removeEventListener('mouseup', handleMouseUp);
      mountRef.current.removeEventListener('wheel', handleWheel);
      mountRef.current.removeEventListener('contextmenu', handleContextMenu);
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
    const vertices: number[] = [];
    const normals: number[] = [];

    let offset = 84;
    for (let i = 0; i < triangles; i++) {
      const nx = view.getFloat32(offset, true); offset += 4;
      const ny = view.getFloat32(offset, true); offset += 4;
      const nz = view.getFloat32(offset, true); offset += 4;

      for (let j = 0; j < 3; j++) {
        const vx = view.getFloat32(offset, true); offset += 4;
        const vy = view.getFloat32(offset, true); offset += 4;
        const vz = view.getFloat32(offset, true); offset += 4;
        vertices.push(vx, vy, vz);
        normals.push(nx, ny, nz);
      }
      offset += 2; // attribute byte count
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices), 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(normals), 3));
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
            const vertexArray: number[] = [];
            const normalArray: number[] = [];

            const vertexElements = verticesEl.getElementsByTagName('vertex');
            for (let j = 0; j < vertexElements.length; j++) {
              const v = vertexElements[j];
              vertexArray.push(
                parseFloat(v.getAttribute('x') || '0'),
                parseFloat(v.getAttribute('y') || '0'),
                parseFloat(v.getAttribute('z') || '0')
              );
            }

            const triangleElements = trianglesEl.getElementsByTagName('triangle');
            for (let j = 0; j < triangleElements.length; j++) {
              const t = triangleElements[j];
              const v1 = parseInt(t.getAttribute('v1') || '0');
              const v2 = parseInt(t.getAttribute('v2') || '0');
              const v3 = parseInt(t.getAttribute('v3') || '0');

              const p1 = new THREE.Vector3(vertexArray[v1 * 3], vertexArray[v1 * 3 + 1], vertexArray[v1 * 3 + 2]);
              const p2 = new THREE.Vector3(vertexArray[v2 * 3], vertexArray[v2 * 3 + 1], vertexArray[v2 * 3 + 2]);
              const p3 = new THREE.Vector3(vertexArray[v3 * 3], vertexArray[v3 * 3 + 1], vertexArray[v3 * 3 + 2]);

              const edge1 = new THREE.Vector3().subVectors(p2, p1);
              const edge2 = new THREE.Vector3().subVectors(p3, p1);
              const normal = new THREE.Vector3().crossVectors(edge1, edge2).normalize();

              for (let k = 0; k < 3; k++) {
                normalArray.push(normal.x, normal.y, normal.z);
              }
            }

            geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertexArray), 3));
            geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(normalArray), 3));
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

  const loadAndDisplayModel = async (): Promise<void> => {
    if (!mountRef.current) return;

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

      renderScene(geometries);
    } catch (error) {
      console.error('Error loading model:', error);
    }
  };

  const renderScene = (geometries: THREE.BufferGeometry[]): void => {
    if (!mountRef.current) return;

    // Cleanup previous renderer if exists
    cleanup();

    // Initialize scene
    sceneRef.current = new THREE.Scene();
    sceneRef.current.background = new THREE.Color(0x1a1a1a);

    cameraRef.current = new THREE.PerspectiveCamera(
      50,
      mountRef.current.clientWidth / mountRef.current.clientHeight,
      0.1,
      100000
    );

    rendererRef.current = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    rendererRef.current.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    rendererRef.current.setPixelRatio(window.devicePixelRatio);
    rendererRef.current.shadowMap.enabled = true;
    mountRef.current.appendChild(rendererRef.current.domElement);

    setupLights();

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
        color: new THREE.Color().setHSL(0.55, 0.7, 0.5),
        specular: 0x444444,
        shininess: 60,
        side: THREE.DoubleSide,
      });

      const mesh = new THREE.Mesh(geometry, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    });

    meshRef.current = group;
    sceneRef.current.add(group);

    // Center and fit camera
    centerAndFitCamera(group);

    // Setup controls
    setupControls();

    // Start animation loop
    animate();
  };

  const setupLights = (): void => {
    if (!sceneRef.current) return;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    sceneRef.current.add(ambientLight);

    const directionalLight1 = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight1.position.set(5, 10, 7);
    directionalLight1.castShadow = true;
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

    mountRef.current.addEventListener('mousedown', handleMouseDown);
    mountRef.current.addEventListener('mousemove', handleMouseMove);
    mountRef.current.addEventListener('mouseup', handleMouseUp);
    mountRef.current.addEventListener('wheel', handleWheel, { passive: false });
    mountRef.current.addEventListener('contextmenu', handleContextMenu);
  };

  const handleMouseDown = (e: MouseEvent): void => {
    e.preventDefault();
    if (e.button === 0) {
      controlsStateRef.current.isDragging = true;
    } else if (e.button === 2) {
      controlsStateRef.current.isPanning = true;
    }
    controlsStateRef.current.previousMouse = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: MouseEvent): void => {
    const state = controlsStateRef.current;

    if (state.isDragging && meshRef.current) {
      const deltaX = e.clientX - state.previousMouse.x;
      const deltaY = e.clientY - state.previousMouse.y;

      meshRef.current.rotation.y += deltaX * 0.01;
      meshRef.current.rotation.x += deltaY * 0.01;

      state.previousMouse = { x: e.clientX, y: e.clientY };
    }

    if (state.isPanning && cameraRef.current) {
      const deltaX = e.clientX - state.previousMouse.x;
      const deltaY = e.clientY - state.previousMouse.y;

      const panSpeed = 0.002 * cameraRef.current.position.z;
      cameraRef.current.position.x -= deltaX * panSpeed;
      cameraRef.current.position.y += deltaY * panSpeed;

      state.previousMouse = { x: e.clientX, y: e.clientY };
    }
  };

  const handleMouseUp = (): void => {
    controlsStateRef.current.isDragging = false;
    controlsStateRef.current.isPanning = false;
  };

  const handleWheel = (e: WheelEvent): void => {
    e.preventDefault();
    if (!cameraRef.current) return;

    const zoomSpeed = 0.1;
    cameraRef.current.position.z += e.deltaY * zoomSpeed;

    if (cameraRef.current.position.z < 10) {
      cameraRef.current.position.z = 10;
    }
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

  const animate = (): void => {
    animationIdRef.current = requestAnimationFrame(animate);
    if (rendererRef.current && sceneRef.current && cameraRef.current) {
      rendererRef.current.render(sceneRef.current, cameraRef.current);
    }
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
          <p className="info-hint">💡 Left-drag: rotate • Right-drag: pan • Scroll: zoom</p>
        </div>
      )}
    </div>
  );
}

// Export thumbnail generator function
export async function generateThumbnail(modelPath: string, ext: string): Promise<string | null> {
  try {
    const arrayBuffer = await window.electronAPI.loadModel(modelPath);
    if (!arrayBuffer) return null;

    // Create offscreen renderer
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setSize(256, 256);
    renderer.setClearColor(0x2a2a2a, 1);

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
        const vertices: number[] = [];
        const normals: number[] = [];

        let offset = 84;
        for (let i = 0; i < triangles; i++) {
          const nx = view.getFloat32(offset, true); offset += 4;
          const ny = view.getFloat32(offset, true); offset += 4;
          const nz = view.getFloat32(offset, true); offset += 4;

          for (let j = 0; j < 3; j++) {
            vertices.push(view.getFloat32(offset, true)); offset += 4;
            vertices.push(view.getFloat32(offset, true)); offset += 4;
            vertices.push(view.getFloat32(offset, true)); offset += 4;
            normals.push(nx, ny, nz);
          }
          offset += 2;
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices), 3));
        geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(normals), 3));
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
            const vertexArray: number[] = [];
            const normalArray: number[] = [];

            const vertexElements = verticesEl.getElementsByTagName('vertex');
            for (let j = 0; j < vertexElements.length; j++) {
              const v = vertexElements[j];
              vertexArray.push(
                parseFloat(v.getAttribute('x') || '0'),
                parseFloat(v.getAttribute('y') || '0'),
                parseFloat(v.getAttribute('z') || '0')
              );
            }

            const triangleElements = trianglesEl.getElementsByTagName('triangle');
            for (let j = 0; j < triangleElements.length; j++) {
              const t = triangleElements[j];
              const v1 = parseInt(t.getAttribute('v1') || '0');
              const v2 = parseInt(t.getAttribute('v2') || '0');
              const v3 = parseInt(t.getAttribute('v3') || '0');

              const p1 = new THREE.Vector3(vertexArray[v1 * 3], vertexArray[v1 * 3 + 1], vertexArray[v1 * 3 + 2]);
              const p2 = new THREE.Vector3(vertexArray[v2 * 3], vertexArray[v2 * 3 + 1], vertexArray[v2 * 3 + 2]);
              const p3 = new THREE.Vector3(vertexArray[v3 * 3], vertexArray[v3 * 3 + 1], vertexArray[v3 * 3 + 2]);

              const edge1 = new THREE.Vector3().subVectors(p2, p1);
              const edge2 = new THREE.Vector3().subVectors(p3, p1);
              const normal = new THREE.Vector3().crossVectors(edge1, edge2).normalize();

              for (let k = 0; k < 3; k++) {
                normalArray.push(normal.x, normal.y, normal.z);
              }
            }

            geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertexArray), 3));
            geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(normalArray), 3));
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
        color: 0x4488ff,
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
    const cameraZ = maxDim / Math.sin(fov / 2) * 1.5;

    camera.position.set(0, 0, cameraZ);
    camera.lookAt(0, 0, 0);

    // Render
    renderer.render(scene, camera);

    // Get thumbnail URL
    const thumbnailUrl = canvas.toDataURL('image/png');

    // Cleanup
    renderer.dispose();

    return thumbnailUrl;
  } catch (error) {
    console.error('Error generating thumbnail:', error);
    return null;
  }
}

export default ModelViewer;