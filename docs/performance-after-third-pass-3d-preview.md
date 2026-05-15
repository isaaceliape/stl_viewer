# 3D Preview Performance After Third Pass

Date: Fri 15 May 2026
Project: STL Viewer
Scope: reuse renderer/camera/lights across selected models

## Build verification

Command:

- `npm run build`

Result:

- compiled successfully
- JS bundle after gzip: 210.59 kB
- CSS bundle after gzip: 4 kB

`git diff --check` passed with no whitespace errors.

## Files changed

- `src/components/ModelViewer.tsx`
- `src/App.tsx`

## Changes made

### 1. Renderer/camera/lights are initialized once

Before:

- Every selected model called `renderScene()`.
- `renderScene()` called full `cleanup()`.
- Full cleanup removed event listeners, disconnected resize observer, disposed the renderer, removed the canvas, nulled the scene/camera, and rebuilt all of it.

After:

- `initializeViewer()` runs once when `ModelViewer` mounts.
- It creates:
  - `THREE.Scene`
  - `THREE.PerspectiveCamera`
  - `THREE.WebGLRenderer`
  - lights
  - controls
  - resize observer
- `initializeViewer()` exits early if a renderer already exists.

Expected impact:

- switching selected models avoids WebGL renderer/canvas/context churn.
- lights and controls are not recreated for every model selection.
- model switching should feel lighter and reduce long-session resource pressure.

### 2. Model switching now replaces only the model group

Before:

- model switching tore down the whole preview pipeline.

After:

- `disposeCurrentModel()` removes only the current `THREE.Group` from the scene.
- It disposes the old model geometries and materials.
- The existing renderer/camera/lights stay alive.
- A new model group is created and added to the existing scene.

Expected impact:

- less setup work on every selected model.
- better separation between persistent viewer infrastructure and model-specific resources.

### 3. Theme/color changes no longer remount the viewer

Before:

- `App.tsx` keyed the viewer by:
  - selected model path
  - preview background color
  - model color
- Changing preview/model colors forced React to unmount/remount the viewer.
- That caused reload/reparse/recreate behavior even though only material/background changed.

After:

- `ModelViewer` key is now only `selectedModel.path`.
- `updateSceneAppearance()` updates the scene background and existing mesh material color in place.

Expected impact:

- changing model color or preview background no longer reloads/reparses the selected model.
- settings changes are cheaper and feel more immediate.

### 4. Stale async model loads are guarded

Before:

- a slow model load could finish after the user selected another model and still render stale geometry.

After:

- `loadRequestIdRef` invalidates stale async loads.
- If an older request resolves late, its parsed geometries are disposed and ignored.

Expected impact:

- safer rapid clicking through model lists.
- avoids stale model flashes and leaked geometry from abandoned loads.

## Static verification checks

Automated source checks passed:

- mount effect initializes viewer once
- model effect loads without cleanup teardown
- `renderScene` no longer calls `cleanup()`
- `renderScene` disposes only current model
- `initializeViewer` guards existing renderer
- `setupLights()` only called in `initializeViewer()`
- `setupControls()` only called in `initializeViewer()`
- `setupResizeObserver()` only called in `initializeViewer()`
- appearance updates material without remount
- App key is selected model path only
- stale async loads are guarded

## Remaining performance work

Still worth doing later:

1. Fix 3MF geometry generation with indexed geometry.
2. Generate thumbnails only for visible cards.
3. Reuse one offscreen thumbnail renderer instead of creating one per thumbnail.
4. Move heavy STL/3MF parsing to a Web Worker for very large models.
5. Improve or replace ASCII STL regex parsing.
