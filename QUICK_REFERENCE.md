# 🎯 STL Viewer - Quick Reference

## Essential Commands

```bash
# First time setup
cd /Users/isaaceliape/repos/stl_viewer
npm install

# Development - ALWAYS use tmux!
tmux new-session -d -s stl-viewer 'npm run dev'

# Attach to session (view logs)
tmux attach -t stl-viewer

# Detach from session (Ctrl+B then D)

# Kill session
tmux kill-session -t stl-viewer

# List all sessions
tmux ls

# Windows development (if needed)
npm run dev-win

# Production build
npm run build

# Create distributable installers
npm run build-app

# Start production app
npm start

# Run tests
npm test
```

## Keyboard Shortcuts (In App)

| Action | Control |
|--------|---------|
| Rotate Model | Click + Drag |
| Zoom | Scroll Wheel |
| Select Model | Click on grid item |
| Change Folder | Click "📁 Change Folder" button |

## tmux Session Management

| Action | Command |
|--------|---------|
| Start dev server | `tmux new-session -d -s stl-viewer 'npm run dev'` |
| Attach to session | `tmux attach -t stl-viewer` |
| Detach from session | `Ctrl+B` then `D` |
| Kill session | `tmux kill-session -t stl-viewer` |
| List sessions | `tmux ls` |
| Send command | `tmux send-keys -t stl-viewer '<cmd>' Enter` |

**NOTE**: Always use tmux for development! See AGENTS.md for details.

## File Locations

| Purpose | Path |
|---------|------|
| Electron Main | `public/electron.js` |
| React App | `src/App.js` |
| 3D Viewer | `src/components/ModelViewer.js` |
| Model Grid | `src/components/ModelGrid.js` |
| Styles | `src/App.css` + component `.css` files |
| Config | `package.json` |

## Development Tips

### Enable Debug Tools
Open `public/electron.js`, uncomment:
```javascript
// mainWindow.webContents.openDevTools();
```

### Clear Cache
```bash
rm -rf node_modules package-lock.json build
npm install
npm run dev
```

### Check for Issues
```bash
# Check for errors
npm test

# Build for production
npm run build
```

## Project Structure Map

```
stl_viewer/
├── public/              ← Electron main process
├── src/                 ← React components
│   ├── App.js          ← Main layout
│   └── components/
│       ├── ModelGrid   ← Left panel
│       └── ModelViewer ← 3D viewer
├── build/              ← Production build (after npm run build)
├── dist/               ← Installers (after npm run build-app)
└── package.json        ← Dependencies
```

## Common Tasks

### Add a New Component
```javascript
// src/components/NewComponent.js
import React from 'react';
import './NewComponent.css';

function NewComponent() {
  return <div>Your content</div>;
}

export default NewComponent;
```

### Import in App.js
```javascript
import NewComponent from './components/NewComponent';

// Then use in JSX
<NewComponent />
```

### Update 3D Rendering
Edit `src/components/ModelViewer.js`:
- `setupLights()` - adjust lighting
- `renderScene()` - modify materials/colors
- `animate()` - add animations

### Modify UI Styling
Edit corresponding `.css` files in `src/` and `src/components/`

## Troubleshooting Quick Fixes

```bash
# Port already in use
lsof -i :3000
kill -9 <PID>

# Dependencies broken
npm install --legacy-peer-deps

# Clear all caches
rm -rf node_modules .next dist build package-lock.json
npm install

# Check Node version
node --version  # Should be 16+
```

## Performance Checklist

- ✅ Models load on-demand (not all at startup)
- ✅ Large models parsed incrementally
- ✅ Three.js caches geometries
- ✅ React memoization on components
- ✅ CSS GPU acceleration enabled

## Before Shipping

```bash
# 1. Test on all target platforms
npm run build-app

# 2. Test production build locally
npm start

# 3. Verify all features work
# - Load different folders
# - Browse various STL/3MF files
# - Test 3D controls

# 4. Check file sizes
ls -lh dist/

# 5. Sign binaries (if distributing)
# Platform-specific signing required

# 6. Kill any running tmux sessions
tmux kill-session -t stl-viewer  # if running
```

## File Format Notes

### STL Files
- Binary: Most common (smaller)
- ASCII: Human-readable text
- Both supported automatically
- No color information

### 3MF Files
- ZIP container with XML + models
- Supports colors/materials
- Potentially large file sizes
- Full support implemented

## Color Coding

**Grid Items:**
- 📦 STL file
- 🎨 3MF file
- Selected = purple highlight

**3D Models:**
- STL: Rainbow gradient colors
- 3MF: Preserved colors from file

## Memory Usage Tips

- Close unused models (not reloaded until selected)
- Modern browsers handle 100+ models fine
- Very large models (>50MB) may stall
- GPU memory auto-managed by Three.js

## Resources

- 📖 [README.md](./README.md) - Full feature overview
- 📚 [SETUP.md](./SETUP.md) - Detailed setup guide
- 📋 [PROJECT_SUMMARY.md](./PROJECT_SUMMARY.md) - Technical overview
- 🎨 [Three.js Docs](https://threejs.org/docs)
- ⚡ [Electron Docs](https://www.electronjs.org/docs)

---

**Pro Tips:**
- Use `tmux new-session -d -s stl-viewer 'npm run dev'` for development (ALWAYS!)
- Use `tmux attach -t stl-viewer` to view logs in real-time
- Use `npm run build-app` for distribution
- Keep models folder organized for better browsing
- Test with various model sizes before shipping

Happy coding! 🚀
