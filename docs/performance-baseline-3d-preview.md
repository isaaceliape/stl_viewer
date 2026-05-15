# 3D Preview Performance Baseline

Date: Fri 15 May 2026 13:23 IST
Project: STL Viewer
Scope: baseline before 3D preview performance changes

## Environment

- Host: macOS 26.4.1
- CPU: Apple M1
- Memory: 16 GB
- Node: v24.15.0
- npm: 11.12.1
- Build command: `npm run build`
- Build result: compiled successfully
- Production bundle after gzip:
  - JS: 210.2 kB
  - CSS: 4 kB

## Important limitation

This repo currently has no checked-in `.stl` or `.3mf` fixture files, so this baseline combines:

- static code-path analysis of the current preview implementation
- a synthetic binary STL parser benchmark that mirrors the current `parseBinarySTL` implementation
- production build verification

No runtime Electron/GPU trace with a real model was captured in this baseline. If we want a stronger before/after comparison later, add one or two representative model fixtures, for example:

- small model: < 2 MB
- medium model: 10-30 MB
- large model: 50 MB+

## Current 3D preview pipeline

Main file:

- `src/components/ModelViewer.tsx`

Current load path:

1. `loadAndDisplayModel()` reads the whole model via `window.electronAPI.loadModel()`.
2. `getFileStats()` fetches metadata separately.
3. STL or 3MF parsing happens on the renderer main thread.
4. `renderScene()` tears down previous renderer state through `cleanup()`.
5. A new `THREE.Scene`, `PerspectiveCamera`, `WebGLRenderer`, lights, materials, meshes, and mouse listeners are created.
6. `animate()` starts a continuous `requestAnimationFrame` loop.
7. The scene renders every animation frame until cleanup.

## Baseline findings

### 1. Idle rendering is continuous

Current behavior:

- `animate()` calls `requestAnimationFrame(animate)` every frame.
- Rendering continues even when the model, camera, and controls are idle.

Expected impact:

- unnecessary GPU/CPU usage while idle
- higher battery usage on laptops
- app can feel heavier than necessary
- performance cost grows with canvas size, pixel ratio, model complexity, and shadow settings

This is the highest-priority optimization target.

### 2. Renderer and WebGL context are recreated for each selected model

Current behavior:

- `renderScene()` calls `cleanup()`.
- Then it creates a new `WebGLRenderer` and appends a new canvas.

Expected impact:

- model switching has extra setup cost
- repeated WebGL resource churn
- higher risk of long-session memory pressure

Better target state:

- keep renderer/camera/lights/listeners for the lifetime of the component
- replace only the loaded mesh/group when the selected model changes

### 3. GPU resource cleanup is incomplete

Current cleanup disposes the renderer, but does not explicitly traverse and dispose:

- `BufferGeometry`
- `Material`
- future textures/maps

Expected impact:

- possible GPU memory leaks during repeated model switching
- possible WebGL context loss in long browsing sessions

Better target state:

- dispose geometries and materials before removing a model group

### 4. Retina pixel ratio can multiply GPU work

Current behavior:

- `renderer.setPixelRatio(window.devicePixelRatio)`

On Retina displays, pixel ratio is commonly 2.0, which means roughly 4x the pixels compared with 1.0.

Expected impact:

- higher GPU cost
- bigger cost from the continuous render loop

Better target state:

- cap pixel ratio, for example `Math.min(window.devicePixelRatio, 1.5)`
- optionally expose preview quality as a setting later

### 5. Shadows are enabled without an obvious visible payoff

Current behavior:

- renderer shadow maps are enabled
- mesh cast/receive shadows are enabled
- directional light casts shadows

But the scene does not appear to include a floor or clear shadow receiver.

Expected impact:

- extra GPU work and memory for shadow maps
- likely little visible improvement

Better target state:

- disable shadows by default
- add a proper shadow receiver only if shadows become a deliberate visual feature

### 6. Materials render double-sided faces

Current behavior:

- `MeshPhongMaterial` uses `side: THREE.DoubleSide`

Expected impact:

- more fragment work on dense models
- useful as a compatibility fallback for broken normals/winding, but not ideal as the default performance path

Potential target state:

- use `FrontSide` by default
- add a compatibility toggle if needed

### 7. Binary STL parser does extra allocation

Current behavior:

- pushes vertex and normal floats into JS arrays
- converts those arrays to `Float32Array` after parsing

Expected impact:

- unnecessary intermediate memory allocation
- avoidable GC pressure

Better target state:

- preallocate typed arrays from the known triangle count
- fill by index

### 8. ASCII STL parser is likely expensive on large files

Current behavior:

- decodes the entire file into a string
- runs large regex scans over the full text
- stores intermediate arrays

Expected impact:

- renderer main-thread stalls
- high memory usage for large ASCII STL files

Better target state:

- use a streaming/parser approach
- or parse off-main-thread in a Web Worker
- or use a maintained STL loader/parser

### 9. 3MF geometry generation looks incorrect and potentially wasteful

Current behavior:

- reads vertices from the 3MF XML
- reads triangle indices to calculate normals
- does not set an index buffer from `v1`, `v2`, `v3`
- does not expand positions per triangle
- normal array length may not match position array length

Expected impact:

- 3MF rendering correctness issues
- wasted normal computation
- misleading geometry/camera results in some files

Better target state:

- create indexed geometry:
  - positions from `<vertices>`
  - index from triangle `v1`, `v2`, `v3`
  - call `geometry.computeVertexNormals()`

### 10. Thumbnail generation competes with preview performance

Current behavior:

- `ModelGrid` queues thumbnails for all models, not just visible ones
- `generateThumbnail()` duplicates parser logic
- each thumbnail creates a new offscreen `WebGLRenderer`
- thumbnail parsing/rendering also runs on the renderer main thread

Expected impact:

- opening folders with many models can make the app sluggish
- initial cache population may compete with preview interaction
- repeated renderer creation adds overhead

Better target state:

- generate thumbnails only for visible cards
- reuse one offscreen thumbnail renderer
- extract shared parser code
- move parsing/heavy work to a Web Worker later

## Synthetic binary STL parser benchmark

Benchmark mirrors the current binary STL parser strategy:

- DataView reads
- JS `number[]` push for positions/normals
- final conversion to `Float32Array`

Synthetic model data was generated in memory. Each case ran 5 times.

Results:

- 10,000 triangles
  - synthetic file size: 0.48 MB
  - output geometry buffer size: 0.69 MB
  - average parse time: 3.28 ms
  - min/max parse time: 2.43 / 5.89 ms
  - average heap delta: 2.31 MB

- 50,000 triangles
  - synthetic file size: 2.38 MB
  - output geometry buffer size: 3.43 MB
  - average parse time: 12.51 ms
  - min/max parse time: 9.47 / 16.52 ms
  - average heap delta: 9.43 MB

- 100,000 triangles
  - synthetic file size: 4.77 MB
  - output geometry buffer size: 6.87 MB
  - average parse time: 23.63 ms
  - min/max parse time: 19.79 / 26.02 ms
  - average heap delta: 1.17 MB

Notes:

- Heap delta is noisy because Node/V8 GC may run between samples.
- The parser benchmark does not include Electron IPC, Three.js geometry upload to GPU, material setup, bounding box calculation, renderer creation, or actual frame rendering.
- Real-world total load time will be higher than these numbers.

## Baseline risk summary

Highest risk areas before optimization:

1. Idle continuous rendering at 60fps.
2. Renderer/WebGL context recreation on every model selection.
3. Incomplete geometry/material disposal.
4. Main-thread parsing for large STL/3MF files.
5. Thumbnail generation running for every model in a folder.

## Recommended before/after comparison metrics

After changes, compare:

- Production build still succeeds.
- Idle preview rendering:
  - before: continuous render loop
  - target after: zero steady-state renders unless interaction/resize/model change occurs
- Binary STL parse benchmark:
  - before 100k triangles: 23.63 ms average
  - target after typed-array parser: lower parse time and lower heap churn
- Model switch resource lifecycle:
  - before: renderer recreated per model
  - target after: renderer reused, old geometry/material disposed
- Thumbnail workload:
  - before: all models queued
  - target after: visible/on-demand generation

## First optimization batch I recommend

For the first pass, keep scope small and measurable:

1. Replace continuous animation loop with render-on-demand.
2. Add explicit mesh geometry/material disposal.
3. Cap preview pixel ratio to 1.5.
4. Disable shadows in the preview.
5. Add `ResizeObserver` so the canvas resizes cleanly and renders once after resize.

This should reduce idle CPU/GPU usage significantly without changing file format parsing yet.
