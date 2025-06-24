# pixel-pusher

A Chrome DevTools extension that allows you to overlay semi-transparent images on any webpage for design comparison and alignment checking.

## Features

- Drag and drop image files onto the DevTools panel
- Adjustable opacity slider (0-100%)
- Click-through overlay (doesn't interfere with page interaction)
- Responsive image sizing that scales with the page width
- Image persistence across page reloads
- Toggle overlay visibility

## Installation

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select this directory
5. The extension is now installed

## Usage

1. Open Chrome DevTools (F12 or right-click → Inspect)
2. Navigate to the "Image Overlay" tab in DevTools
3. Drag and drop an image file onto the drop zone or click to select
4. Use the opacity slider to adjust transparency
5. Toggle visibility with the "Hide/Show Overlay" button
6. Clear the current image with the "Clear Image" button

## Development

The extension is built with TypeScript. To modify:

1. Install dependencies: `npm install`
2. Make changes to TypeScript files in `src-ts/`
3. Compile: `npm run build`
4. Reload the extension in Chrome

## Technical Details

- Uses Chrome Extension Manifest V3
- TypeScript for type safety
- Functional programming approach
- Chrome Storage API for persistence
- Content script for overlay rendering