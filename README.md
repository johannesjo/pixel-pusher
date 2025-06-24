# Pixel Pusher

A Chrome DevTools extension that allows you to overlay semi-transparent images on any webpage for pixel-perfect design comparison and alignment checking.

## Features

- **Visual Image Preview** - See thumbnail of current overlay in the panel
- **Drag and Drop** - Simply drop image files onto the DevTools panel
- **Precise Controls**:
  - Opacity adjustment (0-100%) with slider and text input
  - X/Y position offset (-500px to +500px) with 1px precision
  - Scale adjustment (10-200%) for resizing
- **Keyboard Shortcuts** (work from both page and DevTools):
  - `Alt+Shift+V` - Toggle overlay visibility
  - `Alt+Shift+↑/↓` - Adjust opacity (5% steps)
  - `AltGr+Shift+Arrow Keys` - Move overlay (1px steps)
- **Click-through overlay** - Doesn't interfere with page interaction
- **Persistent state** - Settings preserved across page reloads
- **Reset position** - Quick button to restore default position/scale

## Installation

### Prerequisites
- Node.js and npm installed
- Google Chrome browser

### Build Steps

1. Clone or download this repository:
   ```bash
   git clone https://github.com/yourusername/pixel-pusher.git
   cd pixel-pusher
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the extension:
   ```bash
   npm run build
   ```

4. Load the extension in Chrome:
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" in the top right
   - Click "Load unpacked" and select this directory
   - The extension is now installed

## Usage

1. Open Chrome DevTools (F12 or right-click → Inspect)
2. Navigate to the "Pixel Pusher" tab in DevTools
3. Drag and drop an image file onto the drop zone or click to select
4. Use the controls to adjust your overlay:
   - **Opacity**: Use slider or enter exact percentage
   - **Position**: Adjust X/Y offset with sliders or text inputs
   - **Scale**: Resize the overlay from 10% to 200%
5. Use keyboard shortcuts for quick adjustments
6. Click "Reset Position" to restore defaults
7. Clear the current image with "Clear Image" button

## Development

### Project Structure
```
pixel-pusher/
├── src/            # TypeScript source files
├── dist/           # Compiled JavaScript (git-ignored)
├── manifest.json   # Chrome extension manifest
├── panel.html      # DevTools panel UI
├── devtools.html   # DevTools page
└── icon.png        # Extension icon
```

### Development Workflow

1. Install dependencies (if not already done):
   ```bash
   npm install
   ```

2. Make changes to TypeScript files in `src/`

3. Build the extension:
   ```bash
   npm run build
   ```

4. For continuous development:
   ```bash
   npm run watch
   ```

5. Reload the extension in Chrome:
   - Go to `chrome://extensions/`
   - Find "Pixel Pusher"
   - Click the refresh icon

## Technical Details

- **Chrome Extension Manifest V3** - Latest extension platform
- **TypeScript** - Type-safe development with modern JavaScript features
- **Chrome Storage API** - Persistent state across sessions
- **Content Script** - Renders overlay directly on web pages
- **DevTools Panel** - Custom UI integrated into Chrome Developer Tools
- **Keyboard Event Handling** - Works in both page and DevTools contexts

## License

MIT License - feel free to use this extension for your projects!