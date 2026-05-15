# 3D Preview Interaction Rendering Improvements

Date: Fri 15 May 2026
Project: STL Viewer
Scope: smoother rotate/pan behavior in the 3D preview

## Build verification

Command:

- `npm run build`

Result:

- compiled successfully
- JS bundle after gzip: 211.45 kB
- CSS bundle after gzip: 4.02 kB

`git diff --check` passed with no whitespace errors.

## Files changed

- `src/components/ModelViewer.tsx`
- `src/components/ModelViewer.css`

## Changes made

### 1. Replaced mouse events with pointer events

Before:

- Controls used `mousedown`, `mousemove`, and `mouseup` on the preview container.
- Dragging could become less reliable if the pointer left the canvas while rotating or panning.

After:

- Controls use `pointerdown`, `pointermove`, `pointerup`, and `pointercancel`.
- The preview captures the pointer during interaction with `setPointerCapture()`.
- It releases capture on pointer up/cancel.

Expected impact:

- smoother and more reliable drag interactions.
- rotation/panning continues even if the pointer leaves the canvas bounds during a drag.
- better foundation for trackpad/stylus/touch-like pointer devices.

### 2. Render continuously only while interacting

Before:

- The preview used render-on-demand only.
- That is excellent for idle performance, but interactive drag rendering can feel uneven if pointer events arrive irregularly.

After:

- On pointer down, `beginInteractionRender()` starts a temporary requestAnimationFrame loop.
- While the user is rotating or panning, the preview renders every frame.
- On pointer up/cancel, the interaction render loop stops and one final render is requested.

Expected impact:

- smoother perceived rotation and panning.
- keeps the earlier idle optimization: the preview still does not continuously render while idle.

### 3. Viewport-normalized rotation speed

Before:

- Rotation used a fixed `0.01` radians per pixel.
- The feel could vary depending on preview size.

After:

- Rotation speed is based on the preview viewport size:
  - `2π / max(240, min(width, height))`

Expected impact:

- more consistent rotation feel across different preview sizes.
- dragging across the preview maps more naturally to model rotation.

### 4. Camera/FOV-aware panning

Before:

- Panning used `camera.position.z * 0.002` as a rough speed multiplier.
- Pan speed was not tied to actual viewport dimensions or camera field of view.

After:

- Pan distance is calculated from:
  - camera FOV
  - camera distance
  - viewport width/height
  - camera aspect ratio

Expected impact:

- panning feels more stable and proportional at different zoom levels and preview sizes.
- small drags should move the model predictably in screen space.

### 5. Interaction cursor feedback

Before:

- No cursor feedback on the preview canvas.

After:

- Preview canvas uses `cursor: grab`.
- During interaction it uses `cursor: grabbing`.
- `user-select: none` avoids accidental selection while dragging.
- renderer canvas has `touchAction = 'none'` to avoid browser/native gesture interference.

## Static verification checks

Automated source checks passed:

- pointer events replace mouse events
- pointer capture enabled
- pointer capture released
- interaction render loop exists
- rotation speed normalized by viewport
- pan speed based on camera FOV and viewport
- touch action disabled on canvas
- interacting CSS class used
- grab cursor added

## Remaining interaction ideas

Possible future polish:

1. Add optional inertia after rotation drag release.
2. Add double-click to refit/reset camera.
3. Add keyboard shortcuts for reset view and zoom.
4. Add a small orientation axis/gizmo.
5. Add pinch-to-zoom support for trackpads/touch devices if Electron pointer events expose enough data cleanly.
