# AGENTS.md - AI Agent Guidelines

This document provides guidelines for AI agents working on the STL Viewer project.

## Project Overview

**STL Viewer** is an Electron-based desktop application for viewing STL and 3MF 3D model files in a gallery-style interface.

- **Tech Stack**: Electron 29, React 18, Three.js r148
- **Main Entry**: `public/electron.js`
- **React Entry**: `src/index.js`
- **Build System**: react-scripts (Webpack) + electron-builder

## Development Rules

### 1. Always Use tmux for Dev Server

When running the development server, **always use a tmux session**. This ensures:

- The dev server persists across terminal sessions
- Easy attachment/detachment without stopping the server
- Better process management for Electron + React
- Ability to monitor logs in a separate window

#### Standard tmux Session Commands

```bash
# Create a new tmux session for development
tmux new-session -d -s stl-viewer 'npm run dev'

# Attach to the existing session
tmux attach -t stl-viewer

# Detach from session (keep running)
# Press: Ctrl+B then D

# Kill the session when done
tmux kill-session -t stl-viewer

# List all sessions
tmux ls

# Send commands to running session
tmux send-keys -t stl-viewer 'npm run dev' Enter
```

#### Development Workflow

```bash
# Start fresh development session
cd /Users/isaaceliape/repos/stl_viewer
tmux new-session -d -s stl-viewer 'npm run dev'

# Later, attach to view logs
tmux attach -t stl-viewer

# Or view logs in a split window
tmux split-window -h -t stl-viewer
tmux send-keys -t stl-viewer 'tail -f /path/to/logs' Enter
```

#### Why tmux?

1. **Persistence**: Dev server keeps running even if terminal closes
2. **Multi-window**: Can split and view React logs + Electron logs separately
3. **Remote-friendly**: SSH sessions can detach/reattach without stopping
4. **Process isolation**: Easy to manage multiple dev servers

### 2. File Structure Knowledge

```
stl_viewer/
├── public/
│   ├── electron.js      # Main Electron process (file system, IPC)
│   ├── preload.js       # Security bridge for renderer
│   └── index.html       # HTML template
├── src/
│   ├── App.js           # Main React component (split layout)
│   ├── App.css          # Main styles
│   ├── index.js         # React entry point
│   ├── index.css        # Global styles
│   └── components/
│       ├── ModelGrid.js     # Left panel (model list)
│       ├── ModelGrid.css
│       ├── ModelViewer.js   # Right panel (3D viewer)
│       └── ModelViewer.css
├── package.json         # Dependencies & scripts
├── README.md            # Feature documentation
├── SETUP.md             # Installation guide
└── QUICK_REFERENCE.md   # Commands cheat sheet
```

### 3. Key Technical Details

#### Electron IPC

- Main process: `public/electron.js`
- Preload script: `public/preload.js`
- Renderer access: `window.electronAPI.*`
- Security: `contextIsolation: true`, `nodeIntegration: false`

Available IPC methods:
- `selectFolder()` - Opens folder dialog
- `listModels(path)` - Lists STL/3MF files
- `loadModel(path)` - Loads model binary
- `getFileStats(path)` - Gets file metadata

#### 3D Rendering (ModelViewer.js)

- Library: Three.js r148
- STL parsing: Custom binary/ASCII parser
- 3MF parsing: JSZip + XML DOM parser
- Controls: Mouse drag (rotate), scroll (zoom)
- Auto-fitting camera on model load

#### React State Management

- Main state in `App.js`:
  - `folderPath` - Current selected folder
  - `models` - List of available models
  - `selectedModel` - Currently viewed model
  - `loading` - Loading state

### 4. Common Modifications

#### Adding New File Format Support

1. Add extension filter in `public/electron.js`:
   ```javascript
   .filter((file) => 
     file.endsWith('.stl') || 
     file.endsWith('.3mf') || 
     file.endsWith('.obj')  // New format
   )
   ```

2. Add parser in `src/components/ModelViewer.js`:
   ```javascript
   const parseOBJFile = async (arrayBuffer) => {
     // Parse logic here
   };
   ```

#### Changing 3D Lighting

Edit `setupLights()` in `src/components/ModelViewer.js`:
```javascript
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
```

#### Modifying UI Colors

Edit `src/App.css`:
```css
.app-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}
```

### 5. Build Commands

```bash
# Development (in tmux!)
tmux new-session -d -s stl-viewer 'npm run dev'

# Production build
npm run build

# Create installers
npm run build-app

# Run production version
npm start
```

### 6. Debugging Tips

#### Enable DevTools

Uncomment in `public/electron.js`:
```javascript
if (isDev) {
  mainWindow.webContents.openDevTools();
}
```

#### View React Console

DevTools → Console tab (when DevTools enabled)

#### Monitor tmux Session

```bash
# Attach to view real-time logs
tmux attach -t stl-viewer

# Or capture output
tmux capture-pane -t stl-viewer
```

### 7. Performance Considerations

- Models load on-demand (not all at once)
- Large 3MF files may take time to unzip
- GPU acceleration handled by Three.js
- Geometry caching in Three.js buffers

### 8. Security Notes

- **Never** enable `nodeIntegration: true`
- **Always** use `contextIsolation: true`
- All file system access through IPC
- No `eval()` or dynamic code execution
- Preload script sanitizes all data

### 9. Testing Workflow

```bash
# 1. Start dev server in tmux
tmux new-session -d -s stl-viewer 'npm run dev'

# 2. Wait for React to start
sleep 10

# 3. Verify Electron window opens
# 4. Test folder selection
# 5. Test model loading
# 6. Test 3D controls

# 7. Kill session when done
tmux kill-session -t stl-viewer
```

### 10. Git Workflow

```bash
# Feature branches
git checkout -b feature/new-format-support

# Commit changes
git add .
git commit -m "Add OBJ file format support"

# Push
git push origin feature/new-format-support
```

## Agent-Specific Instructions

### When Adding New Features

1. Check `AGENTS.md` for tmux rule (this file!)
2. Use tmux for any dev server: `tmux new-session -d -s stl-viewer 'npm run dev'`
3. Follow existing code patterns
4. Update documentation (README.md, QUICK_REFERENCE.md)
5. Test with real STL/3MF files

### When Modifying UI

1. Update corresponding `.css` file
2. Test responsive behavior
3. Verify Electron window sizing
4. Check dark mode compatibility (viewer uses dark background)

### When Adding Dependencies

1. Add to `package.json`
2. Consider bundle size impact
3. Update README.md tech stack section
4. Test in tmux dev session

### When Debugging Issues

1. Attach to tmux session: `tmux attach -t stl-viewer`
2. Enable DevTools in electron.js
3. Check both React console and Electron console
4. Review IPC communication in preload.js

## Session Naming Convention

- **stl-viewer** - Main development session
- **stl-viewer-test** - Testing session
- **stl-viewer-build** - Production build session

## Quick Reference for Agents

| Task | Command |
|------|---------|
| Start dev server | `tmux new-session -d -s stl-viewer 'npm run dev'` |
| Attach to session | `tmux attach -t stl-viewer` |
| Detach from session | `Ctrl+B` then `D` |
| Kill session | `tmux kill-session -t stl-viewer` |
| List sessions | `tmux ls` |
| View logs | `tmux attach -t stl-viewer` |

## Remember

🎯 **ALWAYS use tmux for dev server!**

```bash
tmux new-session -d -s stl-viewer 'npm run dev'
```

This ensures:
- ✅ Persistent development environment
- ✅ Easy log monitoring
- ✅ Session detachment without stopping
- ✅ Better process management
- ✅ Remote-friendly workflow

---

**Last Updated**: 2026-05-14  
**Project**: STL Viewer v1.0.0  
**Maintainer**: AI Agent Guidelines