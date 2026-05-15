# 3D Preview Performance After Second Pass

Date: Fri 15 May 2026
Project: STL Viewer
Scope: second optimization batch after render-on-demand pass

## Build verification

Command:

- `npm run build`

Result:

- compiled successfully
- JS bundle after gzip: 210.48 kB
- CSS bundle after gzip: 4 kB

`git diff --check` also passed with no whitespace errors.

## Changes made

File changed:

- `src/components/ModelViewer.tsx`

### 1. Optimized binary STL parsing in preview path

Before:

- Binary STL parser used JS `number[]` arrays.
- It pushed position and normal floats repeatedly.
- It converted those arrays into `Float32Array` after parsing.

After:

- Binary STL parser preallocates typed arrays:
  - `new Float32Array(triangles * 9)` for positions
  - `new Float32Array(triangles * 9)` for normals
- It fills arrays by index while parsing.
- It passes the typed arrays directly into Three.js buffer attributes.

Expected impact:

- lower allocation churn
- lower garbage collector pressure
- faster parsing for binary STL files

### 2. Optimized binary STL parsing in thumbnail path

The thumbnail generator had its own duplicate binary STL parser. That path now uses the same typed-array strategy.

Expected impact:

- faster first-time thumbnail generation for binary STL models
- less memory churn while warming the thumbnail cache

### 3. Added thumbnail geometry/material cleanup

Before:

- Thumbnail generation disposed the offscreen renderer.
- It did not explicitly dispose thumbnail geometries/materials.

After:

- Thumbnail generation traverses the generated group and disposes:
  - mesh geometry
  - material or material array
- Then it disposes the renderer.

Expected impact:

- less GPU memory pressure while generating many thumbnails
- safer long sessions when opening folders with many models

## Synthetic parser benchmark

Benchmark compares the old JS-array parser against the new preallocated typed-array parser.

Each case used synthetic binary STL data generated in memory and 8 measured runs after warmup.

### 10,000 triangles

- file size: 0.48 MB
- old parser average: 2.34 ms
- optimized parser average: 0.91 ms
- speedup: 2.57x
- average time reduction: 61.1%

### 50,000 triangles

- file size: 2.38 MB
- old parser average: 10.62 ms
- optimized parser average: 1.25 ms
- speedup: 8.5x
- average time reduction: 88.2%

### 100,000 triangles

- file size: 4.77 MB
- old parser average: 20.66 ms
- optimized parser average: 2.67 ms
- speedup: 7.74x
- average time reduction: 87.1%

## Baseline comparison

Baseline report recorded current-parser times of:

- 10,000 triangles: 3.28 ms average
- 50,000 triangles: 12.51 ms average
- 100,000 triangles: 23.63 ms average

Second-pass optimized benchmark:

- 10,000 triangles: 0.91 ms average
- 50,000 triangles: 1.25 ms average
- 100,000 triangles: 2.67 ms average

The exact numbers vary between benchmark runs, but the optimized parser is consistently much faster because it avoids `Array.push()` growth and the extra conversion pass.

## Still not changed

These items remain for future passes:

1. ASCII STL parsing still uses whole-file decode plus regex.
2. 3MF geometry generation still needs a correctness/performance fix with indexed geometry.
3. Preview renderer/camera/lights are still recreated per selected model.
4. Thumbnail generation still queues all models rather than visible cards only.
5. Thumbnail generation still creates a renderer per thumbnail instead of reusing one offscreen renderer.

## Recommended next batch

I recommend fixing 3MF geometry next because it is both correctness and performance work:

1. Build positions from `<vertices>`.
2. Build an index buffer from triangle `v1`, `v2`, `v3`.
3. Set `geometry.setIndex(...)`.
4. Call `geometry.computeVertexNormals()`.
5. Apply the same path in preview and thumbnail generation.

After that, thumbnail scheduling/virtualization would be the next biggest UX improvement for folders with many files.
