# 3D Preview Performance After First Pass

Date: Fri 15 May 2026
Project: STL Viewer
Scope: first optimization batch after baseline report

## Build verification

Command:

- `npm run build`

Result:

- compiled successfully
- JS bundle after gzip: 210.44 kB
- CSS bundle after gzip: 4 kB

Baseline JS bundle was 210.2 kB, so this pass added roughly 235 B gzip.

## Changes made

File changed:

- `src/components/ModelViewer.tsx`

### 1. Replaced continuous idle rendering with render-on-demand

Before:

- `animate()` recursively called `requestAnimationFrame(animate)` forever.
- The scene rendered continuously while idle.

After:

- `requestRender()` schedules a single animation frame only when needed.
- A render is requested after:
  - model load
  - rotate drag
  - pan drag
  - wheel zoom
  - preview resize

Expected impact:

- idle preview should no longer continuously consume GPU/CPU just to redraw the same frame.
- this is the biggest practical improvement in this pass.

### 2. Added explicit geometry/material disposal

Before:

- cleanup disposed the renderer only.
- created geometries/materials were not explicitly disposed.

After:

- cleanup traverses the scene.
- each mesh disposes:
  - geometry
  - material or material array

Expected impact:

- less GPU memory leakage when switching models repeatedly.
- safer long browsing sessions.

### 3. Capped preview pixel ratio

Before:

- `renderer.setPixelRatio(window.devicePixelRatio)`

After:

- `renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))`

Expected impact:

- Retina displays avoid the full 2x pixel ratio cost.
- preview should render fewer pixels while still looking sharp enough.

### 4. Disabled preview shadow rendering

Before:

- shadow maps enabled on the renderer.
- main directional light cast shadows.
- model meshes cast and received shadows.

After:

- shadow maps disabled.
- no cast/receive shadow flags on preview meshes.

Expected impact:

- lower GPU work.
- removes shadow-map overhead that had little visible payoff because there is no proper shadow receiver/floor.

### 5. Added ResizeObserver for the preview canvas

Before:

- renderer size and camera aspect were set only when creating the preview.

After:

- `ResizeObserver` watches the preview container.
- renderer size and camera aspect are updated on resize.
- one render is requested after resize.

Expected impact:

- cleaner resizing when layout changes.
- avoids stretched/wrong-aspect previews after panel size changes.

## Before/after comparison against baseline

### Idle rendering

Before:

- continuous `requestAnimationFrame` loop.
- expected roughly 60 renders/sec while visible, even with no interaction.

After:

- no recurring loop.
- expected 0 steady-state renders/sec while idle.
- renders occur only in response to load/interaction/resize.

### Pixel cost

Before:

- full `window.devicePixelRatio`.
- on Retina 2.0, canvas can render around 4x the pixels of DPR 1.0.

After:

- DPR capped at 1.5.
- compared with DPR 2.0, that is about 44% fewer rendered pixels for the preview canvas.

### Shadow cost

Before:

- shadow map path enabled.

After:

- shadow map path disabled.

### Resource lifecycle

Before:

- renderer disposed, but mesh geometry/material resources were not explicitly disposed.

After:

- geometry/material resources are disposed during cleanup.

## Not changed yet

These baseline risks still remain and are good candidates for the next pass:

1. Renderer/camera/lights are still recreated for each selected model.
2. Binary STL parser still uses JS arrays before converting to typed arrays.
3. ASCII STL parser still uses whole-file decode plus regex.
4. 3MF geometry generation still needs correctness/performance work.
5. Thumbnail generation still queues every model and creates a renderer per thumbnail.
6. Thumbnail generator cleanup still only disposes the renderer, not every geometry/material.

## Recommended next optimization batch

Next I would target parser and thumbnail pressure:

1. Preallocate typed arrays in binary STL parsing.
2. Extract shared STL/3MF parsing helpers so preview and thumbnails do not duplicate logic.
3. Dispose thumbnail geometries/materials explicitly.
4. Generate thumbnails only for visible items.
5. Then fix 3MF indexed geometry generation.
