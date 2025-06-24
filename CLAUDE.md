# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Build Commands
- `npm run build` - Compile TypeScript source files to JavaScript
- `npm run watch` - Run TypeScript compiler in watch mode for development

### Development Workflow
1. Make changes to TypeScript files in `src/`
2. Run `npm run watch` to continuously compile changes
3. Reload the extension in Chrome (`chrome://extensions/` → find "Pixel Pusher" → click refresh)
4. Test changes in Chrome DevTools → "Pixel Pusher" tab

## Architecture Overview

This is a Chrome DevTools extension that overlays semi-transparent images on web pages for design comparison. It follows Chrome Extension Manifest V3 architecture with these key components:

### Component Communication Flow
```
DevTools Panel (panel.ts) 
    ↓ Chrome Runtime Messages
Content Script (content.ts) → Renders overlay on webpage
    ↑ Chrome Storage API for state persistence
```

### Key Files and Responsibilities
- **src/panel.ts**: DevTools panel UI logic - handles image upload, controls, keyboard shortcuts
- **src/content.ts**: Content script injected into web pages - renders the actual image overlay
- **src/devtools.ts**: Creates the DevTools panel tab
- **src/background.ts**: Background service worker for extension lifecycle

### Important Implementation Details
- Uses Chrome Storage API to persist overlay state (image, position, opacity, scale)
- Keyboard shortcuts work in both DevTools and webpage contexts
- Image data is stored as base64 data URLs in Chrome storage
- Overlay is click-through using `pointer-events: none`
- All communication between panel and content script uses Chrome runtime messaging

### Keyboard Shortcuts
- `Alt+Shift+V` - Toggle overlay visibility
- `Alt+Shift+↑/↓` - Adjust opacity (5% steps)
- `AltGr+Shift+Arrow Keys` - Move overlay (1px steps)

### No Testing Framework
This project does not have a testing framework set up. All testing is manual through the Chrome extension developer workflow.