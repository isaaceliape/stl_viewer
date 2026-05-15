# 3MF Indexed Geometry Performance/Correctness Pass

Date: Fri 15 May 2026
Project: STL Viewer
Scope: improve 3MF parsing/rendering in preview and thumbnail paths

## Build verification

Command:

- `npm run build`

Result:

- compiled successfully
- JS bundle after gzip: 211.45 kB
- CSS bundle after gzip: 4.02 kB

`git diff --check` passed with no whitespace errors.

## File changed

- `src/components/ModelViewer.tsx`

## What changed

### 1. 3MF preview geometry now uses indices

Before:

- The parser read `<vertices>` into a plain JS array.
- It read `<triangle v1/v2/v3>` values only to calculate normals.
- It did not attach triangle indices to the geometry.
- Position and normal attributes could have mismatched lengths.

After:

- Positions are stored in a preallocated `Float32Array(vertexElements.length * 3)`.
- Triangle connectivity is stored in an index buffer:
  - `Uint16Array` when vertex count <= 65,535
  - `Uint32Array` when vertex count > 65,535
- Geometry now calls:
  - `geometry.setAttribute('position', ...)`
  - `geometry.setIndex(...)`
  - `geometry.computeVertexNormals()`

Expected impact:

- correct 3MF triangle connectivity
- less custom per-triangle normal code
- fewer temporary `THREE.Vector3` allocations
- better memory layout for WebGL/Three.js

### 2. 3MF thumbnail geometry uses the same indexed path

The thumbnail generator had a duplicated 3MF parser. It now uses the same indexed geometry strategy.

Expected impact:

- thumbnails render 3MF files more correctly
- thumbnail generation avoids the old per-triangle `Vector3` normal computation path

## Static verification checks

Automated source checks passed:

- 3MF preview uses indexed geometry
- 3MF normals are computed by Three.js
- 3MF typed position arrays are used in both preview and thumbnail paths
- 3MF index arrays are used in both preview and thumbnail paths
- old `normalArray` path removed
- old per-triangle `Vector3` normal path removed
- preview and thumbnail both call `computeVertexNormals()`

## Remaining performance work

The highest-value remaining items are now mostly thumbnail and large-file work:

1. Generate thumbnails only for visible cards instead of every model in the folder.
2. Reuse one offscreen thumbnail renderer instead of creating one renderer per thumbnail.
3. Move heavy parsing to a Web Worker for very large files.
4. Improve or replace ASCII STL whole-file regex parsing.
5. Add a real runtime GPU/performance trace once representative STL/3MF fixture files are available.
