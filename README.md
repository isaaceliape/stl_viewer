# 🎨 STL/3MF Gallery Viewer

An advanced Electron-based 3D model gallery viewer for STL and 3MF files with interactive 3D rendering, measurements, color support, and file metadata display.

## ✨ Features

- **Split-panel Layout**: Grid gallery on the left, 3D viewer on the right
- **Multiple Format Support**: STL and 3MF files with color/material support
- **Advanced 3D Rendering**: Three.js powered with smooth rotation and zoom
- **File Metadata**: Display file size, creation/modification dates
- **On-demand Loading**: Optimized performance for large model collections
- **Custom Folder Selection**: Browse any folder on your system
- **Interactive Controls**:
  - Drag to rotate
  - Scroll to zoom
  - Real-time preview

## 🚀 Quick Start

### Prerequisites

- Node.js 16+ and npm
- macOS, Windows, or Linux

### Installation

1. Clone or navigate to the repository:

```bash
cd /path/to/stl_viewer
```

2. Install dependencies:

```bash
npm install
```

### Development

Run the app in development mode (recommended: use tmux):

```bash
# Start in tmux session (recommended)
tmux new-session -d -s stl-viewer 'npm run dev'

# Or without tmux (not recommended)
npm run dev

# Attach to tmux session to view logs
tmux attach -t stl-viewer

# Detach with Ctrl+B then D
```

This will start the React development server and Electron app with hot reloading.

**NOTE**: Always use tmux for the dev server! See AGENTS.md for details.

### Build for Production

Build the React app:

```bash
npm run build
```

Build the distributable Electron app:

```bash
npm run build-app
```

## 📁 Project Structure

```
stl_viewer/
├── public/
│   ├── electron.js          # Electron main process
│   ├── preload.js           # IPC bridge for secure communication
│   └── index.html           # HTML entry point
├── src/
│   ├── App.js              # Main React component
│   ├── App.css             # App styling
│   ├── index.js            # React entry point
│   ├── index.css           # Global styles
│   └── components/
│       ├── ModelGrid.js    # Left panel grid component
│       ├── ModelGrid.css
│       ├── ModelViewer.js  # 3D viewer component
│       └── ModelViewer.css
└── package.json
```

## 🎮 Controls

- **Select Model**: Click on any model in the left grid
- **Rotate**: Click and drag in the 3D viewer
- **Zoom**: Scroll mouse wheel
- **Change Folder**: Click "📁 Change Folder" button in header

## 📊 File Support

### STL Format
- Binary and ASCII STL files
- No color or material information
- All models rendered with gradient colors

### 3MF Format
- Full 3MF ZIP container support
- Color and material preservation
- Multiple mesh/part support

## 🔧 Technical Stack

- **Frontend**: React 18
- **3D Rendering**: Three.js
- **Desktop Framework**: Electron
- **File Parsing**: Custom STL/3MF parsers
- **Archive Support**: JSZip for 3MF files
- **Styling**: CSS3 with flexbox

## 🛠 Architecture Highlights

### IPC Communication
- Secure `contextIsolation` enabled
- Preload bridge for file operations
- Main process handles file system access

### 3D Rendering
- Binary and ASCII STL parsing
- 3MF XML parsing with color support
- Three.js scene with multiple lights
- Automatic camera fitting
- Real-time interaction

### Performance Optimizations
- On-demand model loading
- Geometry caching
- Efficient file discovery
- Lazy rendering

## 📝 Usage Examples

### Load Models from a Folder
1. Click "📁 Change Folder"
2. Select a directory with STL/3MF files
3. Models appear in the left panel

### View a Model
1. Click any model in the grid
2. 3D preview appears on the right
3. Drag to rotate, scroll to zoom

### See File Details
- Model name, file size, modification date shown below the 3D view

## 🐛 Troubleshooting

### Models not loading
- Ensure files are valid STL/3MF format
- Check file permissions
- Try refreshing by selecting folder again

### Performance issues with large models
- App loads models on-demand for better performance
- Close other applications if rendering is slow

### 3MF color not showing
- Check if 3MF file contains valid color information
- Try with a different 3MF file

## 📄 License

MIT License

## 👨‍💻 Development Notes

- Hot reloading enabled for React components
- Electron dev tools can be enabled in electron.js
- STL parsing handles both binary and ASCII formats
- 3MF parsing uses XML DOM parser and JSZip
- **ALWAYS use tmux for dev server** - see AGENTS.md

## 📖 Additional Documentation

- [AGENTS.md](./AGENTS.md) - AI agent guidelines & tmux rules
- [SETUP.md](./SETUP.md) - Detailed setup instructions
- [QUICK_REFERENCE.md](./QUICK_REFERENCE.md) - Commands cheat sheet

## 🔮 Future Enhancements

- Model measurements and dimensioning
- Export as image/video
- Multiple model comparison
- Favorites/bookmarks
- Search and filtering
- Model properties panel
- Support for OBJ, GLTF formats

---

Built with ❤️ for 3D enthusiasts
