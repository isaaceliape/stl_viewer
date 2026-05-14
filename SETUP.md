# 🚀 STL Viewer Setup Guide

## Prerequisites

Before you start, ensure you have:
- **Node.js** 16.x or higher ([download](https://nodejs.org))
- **npm** (comes with Node.js)
- macOS, Windows, or Linux

Check your versions:
```bash
node --version    # Should be v16.0.0 or higher
npm --version     # Should be v8.0.0 or higher
```

## Installation Steps

### 1. Install Dependencies

Navigate to the project directory and install all required packages:

```bash
cd /Users/isaaceliape/repos/stl_viewer
npm install
```

This will install:
- React and React DOM
- Three.js (3D rendering)
- Electron (desktop framework)
- JSZip (for 3MF file support)
- Development tools

### 2. Run in Development Mode

Start the application with live reloading:

```bash
npm run dev
```

This command:
- Starts the React development server on `http://localhost:3000`
- Launches the Electron app
- Enables hot reloading for code changes

The app should open automatically. If not, check the terminal for errors.

### 3. First Launch

On first run:
1. The app will ask you to select a folder
2. Choose your 3D models folder (e.g., `/Users/isaaceliape/Library/Mobile Documents/com~apple~CloudDocs/3D Printing/Models`)
3. Models will appear in the left panel
4. Click any model to view it in 3D on the right

## Development Workflow

### Hot Reload
- React changes auto-reload in the viewer
- Electron changes require app restart
- Modify `src/` files to see changes immediately

### Debug Mode
Uncomment this line in `public/electron.js` to open DevTools:
```javascript
// mainWindow.webContents.openDevTools();
```

### Common Issues

#### "Port 3000 is already in use"
Kill the process or use a different port:
```bash
lsof -i :3000  # Find process
kill -9 <PID>  # Kill it
```

#### Models not appearing
- Check file extensions (.stl, .3mf)
- Verify folder permissions
- Try a different folder

#### Rendering issues
- Update your GPU drivers
- Try disabling hardware acceleration
- Check GPU capability for WebGL

## Building for Production

### Build the App
```bash
npm run build
```

This creates an optimized production build in the `build/` folder.

### Create Distributable
```bash
npm run build-app
```

This generates platform-specific installers:
- **macOS**: `.dmg` and `.zip`
- **Windows**: `.exe` and portable `.exe`
- **Linux**: `.AppImage` and `.deb`

Installers will be in the `dist/` folder.

## Project Structure

```
stl_viewer/
├── public/                          # Electron main process & static assets
│   ├── electron.js                  # Electron app entry point
│   ├── preload.js                   # IPC security bridge
│   └── index.html                   # HTML template
├── src/                             # React source code
│   ├── App.js                       # Main component
│   ├── App.css
│   ├── index.js
│   ├── index.css
│   └── components/
│       ├── ModelGrid.js             # Left panel grid
│       ├── ModelGrid.css
│       ├── ModelViewer.js           # 3D viewer
│       └── ModelViewer.css
├── package.json                     # Dependencies & build config
├── .gitignore
└── README.md
```

## Key Features Explained

### Split Layout
- **Left Panel**: Grid of models with thumbnails
- **Right Panel**: 3D viewer with interactive rendering

### File Support
- **STL**: Binary & ASCII formats
- **3MF**: Full ZIP container with colors/materials

### 3D Controls
- **Rotate**: Click and drag
- **Zoom**: Scroll wheel
- **Pan**: Right-click drag (if enabled)

### File Metadata
- File name, size, and modification date
- Displayed below the 3D viewer

## Technology Stack

| Layer | Technology |
|-------|-----------|
| **Desktop** | Electron 29 |
| **Frontend** | React 18 |
| **3D Rendering** | Three.js r148 |
| **File Parsing** | Custom STL/3MF parsers |
| **Archives** | JSZip |
| **Build** | Webpack (via react-scripts) |
| **Packaging** | Electron Builder |

## Performance Tips

1. **Large Collections**: App loads models on-demand for speed
2. **Large Models**: Complex geometries may take time to parse
3. **GPU**: Enable hardware acceleration in settings

## Advanced Configuration

### Custom Default Folder
Edit `public/electron.js`:
```javascript
defaultPath: '/your/custom/path',
```

### Model Loading Strategy
In `src/App.js`, adjust loading behavior:
```javascript
const loadFolder = async (path) => {
  // Modify this function for different loading strategies
};
```

### 3D Scene Settings
In `src/components/ModelViewer.js`:
```javascript
const setupLights = () => {
  // Adjust lighting, colors, intensity
};
```

## Troubleshooting

### App Won't Start
```bash
# Clear caches and reinstall
rm -rf node_modules package-lock.json
npm install
npm run dev
```

### React Dev Server Won't Start
```bash
# Set NODE_ENV and try again
export NODE_ENV=development
npm run dev
```

### Electron Window Blank
- Check console for errors: Open DevTools (uncomment in electron.js)
- Verify React is running on http://localhost:3000
- Check firewall settings

## Getting Help

1. Check the [README.md](./README.md) for feature overview
2. Review component files for code examples
3. Check browser/Electron console for errors
4. Verify file format (binary vs ASCII STL)

## Next Steps

- 🎨 Explore the UI and interact with your models
- 📁 Try different model collections
- 🔧 Customize colors and lighting in ModelViewer.js
- 📦 Build the production app with `npm run build-app`

Happy 3D viewing! 🚀
