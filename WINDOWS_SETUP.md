# Windows Setup Guide for Rembra

## Prerequisites for Building on Windows

### 1. Install Visual Studio Build Tools
```cmd
# Download and install Visual Studio Build Tools 2019 or newer
# OR install Visual Studio Community with C++ desktop development workload
```

### 2. Install Python (for node-gyp)
```cmd
# Install Python 3.x (recommended) or Python 2.7
# Ensure python is in PATH
```

### 3. Install Node.js & npm
```cmd
# Install Node.js 16+ with npm
# Verify installation:
node --version
npm --version
```

## Building the Application

### 1. Install Dependencies
```cmd
cd rembra-electron
npm install
```

### 2. Rebuild Native Modules for Windows
```cmd
npm run rebuild
```

### 3. Build Application
```cmd
# For Windows only
npm run build:win

# For all platforms (if on Windows with cross-platform tools)
npm run dist:all
```

## Troubleshooting

### robotjs Build Issues
If robotjs fails to build:
```cmd
# Install windows-build-tools (deprecated but sometimes needed)
npm install --global windows-build-tools

# Or use newer approach:
npm install --global @microsoft/rush-stack-compiler-3.9
```

### Audio Capture Issues
- Windows may require additional audio permissions
- System audio capture might not work on all Windows versions
- Microphone permissions are handled by Electron automatically

### Font Rendering
- Windows uses Segoe UI font (built into Windows)
- All panels are designed to work with Windows fonts

## Windows-Specific Features

### Audio Capture
- Uses WASAPI for system audio capture
- Requires Windows 7+ (Vista not supported)
- May need "Stereo Mix" enabled in audio settings

### Window Management
- All window manipulation works on Windows
- Email automation requires appropriate permissions

### File Paths
- All paths use Node.js path.join() for cross-platform compatibility
- No hardcoded Unix-style paths

## Performance Notes

### First Run
- Tesseract.js will download language models (~2MB)
- Firebase initialization may be slower on first run

### Native Modules
- robotjs and electron-audio-loopback have native components
- Build times may be longer than pure JavaScript apps
