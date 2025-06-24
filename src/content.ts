interface OverlayState {
  imageData: string | null;
  opacity: number;
  isVisible: boolean;
  fileName: string | null;
  offsetX: number;
  offsetY: number;
  scale: number;
  diffMode: boolean;
  noColorDiff: boolean;
  rulerMode: boolean;
}

let overlayElement: HTMLDivElement | null = null;
let imageElement: HTMLImageElement | null = null;
let diffCanvas: HTMLCanvasElement | null = null;
let diffTooltip: HTMLDivElement | null = null;
let currentDiffData: ImageData | null = null;
let rulerElement: HTMLDivElement | null = null;
let rulerStartPoint: {x: number, y: number} | null = null;
let rulerEndPoint: {x: number, y: number} | null = null;
let rulerMeasurement: HTMLDivElement | null = null;
let diffModeInterval: number | null = null;
let rulerState: 'idle' | 'started' | 'finished' = 'idle';

const createOverlay = () => {
  overlayElement = document.createElement('div');
  overlayElement.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 999999;
    display: flex;
    justify-content: center;
    align-items: flex-start;
    overflow: visible;
    isolation: isolate;
  `;

  imageElement = document.createElement('img');
  imageElement.style.cssText = `
    width: 100%;
    height: auto;
    object-fit: contain;
    opacity: 0.5;
    max-width: none;
  `;

  overlayElement.appendChild(imageElement);
  document.body.appendChild(overlayElement);
};

const updateOverlay = (state: OverlayState) => {
  if (!overlayElement || !imageElement) {
    createOverlay();
  }

  if (state.imageData && imageElement) {
    imageElement.src = state.imageData;
    imageElement.style.opacity = (state.opacity / 100).toString();
    
    const offsetX = state.offsetX || 0;
    const offsetY = state.offsetY || 0;
    const scale = (state.scale || 100) / 100;
    
    // Simple transform without zoom compensation for now
    imageElement.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
    imageElement.style.transformOrigin = 'center';
    
    // Reset width to allow natural sizing
    imageElement.style.width = '100%';
  }

  if (overlayElement) {
    overlayElement.style.display = state.isVisible && state.imageData ? 'flex' : 'none';
  }

  if (state.diffMode && state.imageData && state.isVisible) {
    enableDiffMode(state);
  } else if (state.noColorDiff && state.imageData && state.isVisible) {
    enableNoColorDiffMode(state);
  } else {
    disableDiffMode();
  }

  if (state.rulerMode) {
    enableRulerMode();
  } else {
    disableRulerMode();
  }
};

const createDiffCanvas = () => {
  if (!diffCanvas) {
    diffCanvas = document.createElement('canvas');
    diffCanvas.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 999998;
    `;
  }
  
  if (!diffTooltip) {
    diffTooltip = document.createElement('div');
    diffTooltip.style.cssText = `
      position: fixed;
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      pointer-events: none;
      z-index: 1000000;
      display: none;
    `;
    document.body.appendChild(diffTooltip);
  }
};

const capturePageAsImage = (): Promise<ImageData> => {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // For now, we'll use a simplified approach
    // In diff mode, we'll show the overlay in red where it differs from transparent
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    resolve(ctx.getImageData(0, 0, canvas.width, canvas.height));
  });
};

const calculateDiff = (pageImageData: ImageData, overlayImage: HTMLImageElement, state: OverlayState): ImageData => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get canvas context');

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  // Draw the overlay image with transformations
  ctx.save();
  const offsetX = state.offsetX || 0;
  const offsetY = state.offsetY || 0;
  const scale = (state.scale || 100) / 100;
  
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);
  ctx.drawImage(overlayImage, 0, 0, overlayImage.naturalWidth, overlayImage.naturalHeight);
  ctx.restore();

  const overlayImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const diffImageData = ctx.createImageData(canvas.width, canvas.height);

  // Calculate pixel differences
  for (let i = 0; i < pageImageData.data.length; i += 4) {
    const pageR = pageImageData.data[i];
    const pageG = pageImageData.data[i + 1];
    const pageB = pageImageData.data[i + 2];
    
    const overlayR = overlayImageData.data[i];
    const overlayG = overlayImageData.data[i + 1];
    const overlayB = overlayImageData.data[i + 2];
    const overlayA = overlayImageData.data[i + 3];
    
    // Only compare where overlay has content
    if (overlayA > 0) {
      const diffR = Math.abs(pageR - overlayR);
      const diffG = Math.abs(pageG - overlayG);
      const diffB = Math.abs(pageB - overlayB);
      
      const threshold = 30; // Sensitivity threshold
      const isDifferent = diffR > threshold || diffG > threshold || diffB > threshold;
      
      if (isDifferent) {
        // Show differences in red
        diffImageData.data[i] = 255;
        diffImageData.data[i + 1] = 0;
        diffImageData.data[i + 2] = 0;
        diffImageData.data[i + 3] = 200;
      }
    }
  }

  return diffImageData;
};

const findDiffRegions = (diffImageData: ImageData): Array<{x: number, y: number, width: number, height: number}> => {
  const regions: Array<{x: number, y: number, width: number, height: number}> = [];
  const width = diffImageData.width;
  const height = diffImageData.height;
  const visited = new Set<number>();

  const getIndex = (x: number, y: number) => (y * width + x) * 4;
  
  const floodFill = (startX: number, startY: number) => {
    const stack = [{x: startX, y: startY}];
    let minX = startX, maxX = startX, minY = startY, maxY = startY;
    
    while (stack.length > 0) {
      const {x, y} = stack.pop()!;
      const idx = getIndex(x, y);
      
      if (visited.has(idx) || x < 0 || x >= width || y < 0 || y >= height) continue;
      if (diffImageData.data[idx + 3] === 0) continue; // Not a diff pixel
      
      visited.add(idx);
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      
      stack.push({x: x + 1, y});
      stack.push({x: x - 1, y});
      stack.push({x, y: y + 1});
      stack.push({x, y: y - 1});
    }
    
    return {x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1};
  };

  // Find all diff regions
  for (let y = 0; y < height; y += 5) { // Sample every 5 pixels for performance
    for (let x = 0; x < width; x += 5) {
      const idx = getIndex(x, y);
      if (!visited.has(idx) && diffImageData.data[idx + 3] > 0) {
        const region = floodFill(x, y);
        if (region.width > 5 && region.height > 5) { // Ignore tiny regions
          regions.push(region);
        }
      }
    }
  }

  return regions;
};

const applyDiffStyles = () => {
  if (!imageElement || !isValidContext()) return;
  
  // Check if diff mode is actually enabled
  chrome.storage.local.get([STORAGE_KEY], (result) => {
    const state = result[STORAGE_KEY];
    if (state && state.diffMode && imageElement) {
      // Force recalculation by toggling a minimal transform
      const currentTime = Date.now();
      const variation = (currentTime % 10000) < 5000 ? 'translateZ(0)' : 'translateZ(0.01px)';
      
      // Apply the existing transform plus the variation
      const { offsetX = 0, offsetY = 0, scale = 100 } = state;
      const scaleValue = scale / 100;
      
      imageElement.style.mixBlendMode = 'normal';
      imageElement.style.filter = 'invert(1) opacity(0.5)';
      imageElement.style.opacity = '1';
      imageElement.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scaleValue}) ${variation}`;
      imageElement.style.transformOrigin = 'center';
    }
  });
};

const applyNoColorDiffStyles = () => {
  if (!imageElement || !isValidContext()) return;
  
  // Check if no color diff mode is actually enabled
  chrome.storage.local.get([STORAGE_KEY], (result) => {
    const state = result[STORAGE_KEY];
    if (state && state.noColorDiff && imageElement) {
      // Force recalculation by toggling a minimal transform
      const currentTime = Date.now();
      const variation = (currentTime % 10000) < 5000 ? 'translateZ(0)' : 'translateZ(0.01px)';
      
      // Apply the existing transform plus the variation
      const { offsetX = 0, offsetY = 0, scale = 100 } = state;
      const scaleValue = scale / 100;
      
      imageElement.style.mixBlendMode = 'normal';
      imageElement.style.filter = 'grayscale(1) invert(1) opacity(0.5)';
      imageElement.style.opacity = '1';
      imageElement.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scaleValue}) ${variation}`;
      imageElement.style.transformOrigin = 'center';
    }
  });
};

const enableDiffMode = async (state: OverlayState) => {
  try {
    if (!imageElement || !overlayElement) return;
    
    // Make sure we have an image to show
    if (!state.imageData) {
      console.warn('No image loaded for diff mode');
      return;
    }
    
    // Make sure the overlay is visible
    overlayElement.style.display = 'flex';
    imageElement.style.display = 'block';
    
    // Apply proper transform with position and scale
    const offsetX = state.offsetX || 0;
    const offsetY = state.offsetY || 0;
    const scale = (state.scale || 100) / 100;
    
    // Try a simpler approach - just invert the image
    imageElement.style.mixBlendMode = 'normal';
    imageElement.style.filter = 'invert(1) opacity(0.5)';
    imageElement.style.opacity = '1';
    imageElement.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
    imageElement.style.transformOrigin = 'center';
    
    // Clear any existing interval
    if (diffModeInterval) {
      clearInterval(diffModeInterval);
    }
    
    // Set up interval to refresh diff every 5 seconds
    diffModeInterval = window.setInterval(() => {
      applyDiffStyles();
    }, 5000);
    
    // With invert filter:
    // - The overlay is inverted and semi-transparent
    // - Areas that match will appear gray
    // - Areas that differ will show contrast
  } catch (error) {
    console.error('Failed to enable diff mode:', error);
  }
};

const enableNoColorDiffMode = async (state: OverlayState) => {
  try {
    if (!imageElement || !overlayElement) return;
    
    // Make sure we have an image to show
    if (!state.imageData) {
      console.warn('No image loaded for no color diff mode');
      return;
    }
    
    // Make sure the overlay is visible
    overlayElement.style.display = 'flex';
    imageElement.style.display = 'block';
    
    // Apply proper transform with position and scale
    const offsetX = state.offsetX || 0;
    const offsetY = state.offsetY || 0;
    const scale = (state.scale || 100) / 100;
    
    // Desaturate and invert for no color diff
    imageElement.style.mixBlendMode = 'normal';
    imageElement.style.filter = 'grayscale(1) invert(1) opacity(0.5)';
    imageElement.style.opacity = '1';
    imageElement.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
    imageElement.style.transformOrigin = 'center';
    
    // Clear any existing interval
    if (diffModeInterval) {
      clearInterval(diffModeInterval);
    }
    
    // Set up interval to refresh diff every 5 seconds
    diffModeInterval = window.setInterval(() => {
      applyNoColorDiffStyles();
    }, 5000);
    
    // With grayscale + invert filter:
    // - Both the overlay and page content are desaturated before comparing
    // - Color differences are ignored, only luminance differences matter
    // - Areas that match will appear gray
    // - Areas that differ in brightness will show contrast
  } catch (error) {
    console.error('Failed to enable no color diff mode:', error);
  }
};

const disableDiffMode = () => {
  // Clear the refresh interval
  if (diffModeInterval) {
    clearInterval(diffModeInterval);
    diffModeInterval = null;
  }
  
  if (diffCanvas && diffCanvas.parentElement) {
    diffCanvas.parentElement.removeChild(diffCanvas);
  }
  
  if (imageElement) {
    imageElement.style.display = 'block';
    imageElement.style.mixBlendMode = 'normal';
    imageElement.style.filter = 'none';
    if (isValidContext()) {
      chrome.storage.local.get([STORAGE_KEY], (result) => {
        const state = result[STORAGE_KEY];
        if (state && imageElement) {
          imageElement.style.opacity = (state.opacity / 100).toString();
        }
      });
    }
  }
  
  if (diffTooltip) {
    diffTooltip.style.display = 'none';
  }
  
  // document.removeEventListener('mousemove', handleDiffHover);
  currentDiffData = null;
  cachedRegions = null;
};

// Ruler functionality
let rulerModeIndicator: HTMLDivElement | null = null;

const createRuler = () => {
  if (!rulerElement) {
    rulerElement = document.createElement('div');
    rulerElement.style.cssText = `
      position: fixed;
      pointer-events: none;
      z-index: 1000001;
      display: none;
    `;
    document.body.appendChild(rulerElement);
  }
  
  if (!rulerMeasurement) {
    rulerMeasurement = document.createElement('div');
    rulerMeasurement.style.cssText = `
      position: fixed;
      background: rgba(0, 0, 0, 0.9);
      color: white;
      padding: 6px 10px;
      border-radius: 4px;
      font-size: 16px;
      font-family: monospace;
      font-weight: bold;
      pointer-events: none;
      z-index: 1000002;
      display: none;
    `;
    document.body.appendChild(rulerMeasurement);
  }
  
  // Create mode indicator
  if (!rulerModeIndicator) {
    rulerModeIndicator = document.createElement('div');
    rulerModeIndicator.style.cssText = `
      position: fixed;
      top: 10px;
      left: 10px;
      background: rgba(74, 144, 226, 0.9);
      color: white;
      padding: 8px 12px;
      border-radius: 4px;
      font-size: 14px;
      font-family: monospace;
      font-weight: bold;
      pointer-events: none;
      z-index: 1000003;
      display: none;
    `;
    document.body.appendChild(rulerModeIndicator);
  }
};

const updateRulerCursor = (width?: number, height?: number) => {
  const rulerOverlay = document.getElementById('pixel-pusher-ruler-overlay');
  if (!rulerOverlay || !rulerModeIndicator) return;
  
  switch (rulerState) {
    case 'idle':
      rulerOverlay.style.cursor = 'crosshair';
      rulerModeIndicator.innerHTML = 'RULER MODE<br><small>Click to start measuring</small>';
      rulerModeIndicator.style.background = 'rgba(74, 144, 226, 0.9)';
      break;
    case 'started':
      rulerOverlay.style.cursor = 'crosshair';
      if (width !== undefined && height !== undefined) {
        rulerModeIndicator.innerHTML = `MEASURING<br><strong>${width}px × ${height}px</strong><br><small>Click to set end point</small>`;
      } else {
        rulerModeIndicator.innerHTML = 'MEASURING<br><small>Click to set end point</small>';
      }
      rulerModeIndicator.style.background = 'rgba(46, 204, 113, 0.9)';
      break;
    case 'finished':
      rulerOverlay.style.cursor = 'pointer';
      if (width !== undefined && height !== undefined) {
        rulerModeIndicator.innerHTML = `MEASUREMENT<br><strong>${width}px × ${height}px</strong><br><small>Click to clear</small>`;
      } else {
        rulerModeIndicator.innerHTML = 'MEASUREMENT COMPLETE<br><small>Click to clear</small>';
      }
      rulerModeIndicator.style.background = 'rgba(231, 76, 60, 0.9)';
      break;
  }
};

const enableRulerMode = () => {
  createRuler();
  document.body.style.cursor = 'crosshair';
  rulerState = 'idle';
  
  // Show mode indicator
  if (rulerModeIndicator) {
    rulerModeIndicator.style.display = 'block';
  }
  
  // Add a transparent overlay to capture all events
  const rulerOverlay = document.createElement('div');
  rulerOverlay.id = 'pixel-pusher-ruler-overlay';
  rulerOverlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 1000000;
    cursor: crosshair;
  `;
  document.body.appendChild(rulerOverlay);
  
  // Update cursor and indicator
  updateRulerCursor();
  
  // Mouse events
  rulerOverlay.addEventListener('click', handleRulerClick);
  rulerOverlay.addEventListener('mousemove', handleRulerMouseMove);
  
  // Touch events for responsive mode
  rulerOverlay.addEventListener('touchstart', handleRulerClick);
  rulerOverlay.addEventListener('touchmove', handleRulerMouseMove);
  
  document.addEventListener('keydown', handleRulerEscape);
};

const disableRulerMode = () => {
  document.body.style.cursor = '';
  
  // Remove the overlay
  const rulerOverlay = document.getElementById('pixel-pusher-ruler-overlay');
  if (rulerOverlay) {
    rulerOverlay.remove();
  }
  
  document.removeEventListener('keydown', handleRulerEscape);
  
  if (rulerElement) {
    rulerElement.style.display = 'none';
  }
  if (rulerMeasurement) {
    rulerMeasurement.style.display = 'none';
  }
  if (rulerModeIndicator) {
    rulerModeIndicator.style.display = 'none';
  }
  
  rulerStartPoint = null;
  rulerEndPoint = null;
  rulerState = 'idle';
};

const handleRulerClick = (e: MouseEvent | TouchEvent) => {
  e.preventDefault();
  e.stopPropagation();
  
  // Get coordinates from mouse or touch event
  let clientX: number, clientY: number;
  if (e instanceof TouchEvent && e.touches.length > 0) {
    clientX = e.touches[0].clientX;
    clientY = e.touches[0].clientY;
  } else if (e instanceof MouseEvent) {
    clientX = e.clientX;
    clientY = e.clientY;
  } else {
    return;
  }
  
  switch (rulerState) {
    case 'idle':
      // First click - set start point
      rulerStartPoint = { x: clientX, y: clientY };
      rulerState = 'started';
      updateRulerCursor();
      if (rulerElement) {
        rulerElement.style.display = 'none';
      }
      if (rulerMeasurement) {
        rulerMeasurement.style.display = 'none';
      }
      break;
      
    case 'started':
      // Second click - set end point and show final measurement
      rulerEndPoint = { x: clientX, y: clientY };
      rulerState = 'finished';
      updateRulerDisplay();
      break;
      
    case 'finished':
      // Third click - clear ruler
      rulerStartPoint = null;
      rulerEndPoint = null;
      rulerState = 'idle';
      updateRulerCursor();
      if (rulerElement) {
        rulerElement.style.display = 'none';
      }
      if (rulerMeasurement) {
        rulerMeasurement.style.display = 'none';
      }
      break;
  }
};

const handleRulerMouseMove = (e: MouseEvent | TouchEvent) => {
  if (!rulerElement || !rulerMeasurement) return;
  
  if (rulerState === 'started' && rulerStartPoint) {
    // Get coordinates from mouse or touch event
    let currentX: number, currentY: number;
    if (e instanceof TouchEvent && e.touches.length > 0) {
      currentX = e.touches[0].clientX;
      currentY = e.touches[0].clientY;
    } else if (e instanceof MouseEvent) {
      currentX = e.clientX;
      currentY = e.clientY;
    } else {
      return;
    }
    
    // Show preview while moving
    updateRulerDisplay(currentX, currentY);
  }
};

const updateRulerDisplay = (currentX?: number, currentY?: number) => {
  if (!rulerStartPoint || !rulerElement) return;
  
  // Use end point if finalizing, otherwise use current mouse position
  const endX = currentX ?? rulerEndPoint?.x ?? rulerStartPoint.x;
  const endY = currentY ?? rulerEndPoint?.y ?? rulerStartPoint.y;
  
  // Calculate dimensions in CSS pixels
  const width = Math.round(Math.abs(endX - rulerStartPoint.x));
  const height = Math.round(Math.abs(endY - rulerStartPoint.y));
  
  // Position and size the ruler
  const left = Math.min(rulerStartPoint.x, endX);
  const top = Math.min(rulerStartPoint.y, endY);
  
  rulerElement.style.cssText = `
    position: fixed;
    left: ${left}px;
    top: ${top}px;
    width: ${width}px;
    height: ${height}px;
    border: 2px solid #4a90e2;
    background: rgba(74, 144, 226, 0.1);
    pointer-events: none;
    z-index: 1000001;
    display: block;
  `;
  
  // Add lines to show horizontal and vertical measurements
  rulerElement.innerHTML = `
    <div style="position: absolute; left: 0; top: 50%; width: 100%; height: 1px; background: #4a90e2; opacity: 0.5;"></div>
    <div style="position: absolute; left: 50%; top: 0; width: 1px; height: 100%; background: #4a90e2; opacity: 0.5;"></div>
  `;
  
  // Update the mode indicator with measurements
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  
  // Common viewport widths to check against
  const commonWidths = [1920, 1440, 1366, 1280, 1024, 768, 414, 390, 375, 360];
  
  // Try to detect the scale factor
  let detectedScale = 1;
  let displayWidth = width;
  let displayHeight = height;
  
  // If measuring full viewport width, check if it matches a scaled common width
  if (Math.abs(width - viewportWidth) < 5) { // Within 5px of viewport width
    for (const commonWidth of commonWidths) {
      const scale = width / commonWidth;
      // Check if this is a reasonable scale factor (between 1.1 and 3)
      if (scale > 1.1 && scale < 3 && Math.abs(scale - Math.round(scale * 4) / 4) < 0.01) {
        detectedScale = scale;
        displayWidth = Math.round(width / detectedScale);
        displayHeight = Math.round(height / detectedScale);
        break;
      }
    }
  }
  
  // Update the cursor/indicator with the measurements
  updateRulerCursor(displayWidth, displayHeight);
  
  // Hide the floating measurement display
  if (rulerMeasurement) {
    rulerMeasurement.style.display = 'none';
  }
};

const handleRulerEscape = (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    // Clear the ruler
    rulerStartPoint = null;
    rulerEndPoint = null;
    rulerState = 'idle';
    updateRulerCursor();
    if (rulerElement) {
      rulerElement.style.display = 'none';
    }
    if (rulerMeasurement) {
      rulerMeasurement.style.display = 'none';
    }
  }
};

let cachedRegions: Array<{x: number, y: number, width: number, height: number}> | null = null;

const handleDiffHover = (e: MouseEvent) => {
  if (!currentDiffData || !diffTooltip) return;
  
  const x = e.clientX;
  const y = e.clientY;
  const idx = (y * currentDiffData.width + x) * 4;
  
  if (currentDiffData.data[idx + 3] > 0) {
    // Cache regions for performance
    if (!cachedRegions) {
      cachedRegions = findDiffRegions(currentDiffData);
    }
    
    const region = cachedRegions.find(r => 
      x >= r.x && x <= r.x + r.width &&
      y >= r.y && y <= r.y + r.height
    );
    
    if (region) {
      diffTooltip.textContent = `${region.width}×${region.height}px`;
      diffTooltip.style.left = `${e.clientX + 10}px`;
      diffTooltip.style.top = `${e.clientY - 30}px`;
      diffTooltip.style.display = 'block';
    } else {
      diffTooltip.style.display = 'none';
    }
  } else {
    diffTooltip.style.display = 'none';
  }
};

const handleResize = () => {
  // Update overlay with zoom compensation when window resizes or zoom changes
  if (isValidContext()) {
    chrome.storage.local.get([STORAGE_KEY], (result) => {
      const state = result[STORAGE_KEY];
      if (state) {
        updateOverlay(state);
      }
    });
  }
};

// Use a simpler approach - let the panel control which tab sees the overlay
const STORAGE_KEY = 'overlayState';

// Check if we're in a valid Chrome extension context
const isValidContext = () => {
  return typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id;
};

const loadStoredState = () => {
  if (!isValidContext()) {
    console.warn('Pixel Pusher: Cannot load state - not in valid context');
    return;
  }
  
  try {
    chrome.storage.local.get([STORAGE_KEY], (result) => {
      if (chrome.runtime.lastError) {
        console.warn('Pixel Pusher: Error loading state:', chrome.runtime.lastError);
        return;
      }
      
      console.log('Pixel Pusher: Loading state:', result[STORAGE_KEY]);
      if (result[STORAGE_KEY]) {
        updateOverlay(result[STORAGE_KEY]);
      }
    });
  } catch (error) {
    console.warn('Pixel Pusher: Failed to load state:', error);
  }
};

// Set up message listener only in valid contexts
if (isValidContext()) {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'updateOverlay') {
      updateOverlay(message.state);
    } else if (message.type === 'clearOverlay') {
      // Clear overlay for this tab
      updateOverlay({
        imageData: null,
        opacity: 50,
        isVisible: true,
        fileName: null,
        offsetX: 0,
        offsetY: 0,
        scale: 100,
        diffMode: false,
        noColorDiff: false,
        rulerMode: false
      });
    }
  });
}

// Listen for storage changes only in valid contexts
if (isValidContext()) {
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes[STORAGE_KEY]) {
      console.log('Pixel Pusher: Storage change detected');
      const newState = changes[STORAGE_KEY].newValue;
      if (newState) {
        updateOverlay(newState);
      }
    }
  });
}

window.addEventListener('resize', handleResize);

let resizeTimeout: number;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(handleResize, 100);
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if (!isValidContext()) return;
  // Alt+Shift+V to toggle visibility
  if (e.altKey && e.shiftKey && e.key === 'V') {
    e.preventDefault();
    chrome.storage.local.get([STORAGE_KEY], (result) => {
      if (result[STORAGE_KEY] && result[STORAGE_KEY].imageData) {
        const newState = { ...result[STORAGE_KEY], isVisible: !result[STORAGE_KEY].isVisible };
        chrome.storage.local.set({ [STORAGE_KEY]: newState });
      }
    });
  }
  
  // Alt+Shift+D to toggle diff mode
  if (e.altKey && e.shiftKey && e.key === 'D') {
    e.preventDefault();
    chrome.storage.local.get([STORAGE_KEY], (result) => {
        if (result[STORAGE_KEY] && result[STORAGE_KEY].imageData) {
          const newDiffMode = !result[STORAGE_KEY].diffMode;
          const newState = { 
            ...result[STORAGE_KEY], 
            diffMode: newDiffMode,
            // Show overlay when diff mode is enabled, hide when disabled
            isVisible: newDiffMode,
            // Turn off no color diff if regular diff is enabled
            noColorDiff: newDiffMode ? false : result[STORAGE_KEY].noColorDiff
          };
          chrome.storage.local.set({ [STORAGE_KEY]: newState });
        }
    });
  }
  
  // Alt+Shift+R to toggle ruler mode
  if (e.altKey && e.shiftKey && e.key === 'R') {
    e.preventDefault();
    chrome.storage.local.get([STORAGE_KEY], (result) => {
        if (result[STORAGE_KEY]) {
          const newState = { ...result[STORAGE_KEY], rulerMode: !result[STORAGE_KEY].rulerMode };
          chrome.storage.local.set({ [STORAGE_KEY]: newState });
        }
    });
  }
  
  // Alt+Shift+G to toggle no color diff mode
  if (e.altKey && e.shiftKey && e.key === 'G') {
    e.preventDefault();
    chrome.storage.local.get([STORAGE_KEY], (result) => {
        if (result[STORAGE_KEY] && result[STORAGE_KEY].imageData) {
          const newNoColorDiff = !result[STORAGE_KEY].noColorDiff;
          const newState = { 
            ...result[STORAGE_KEY], 
            noColorDiff: newNoColorDiff,
            // Show overlay when no color diff mode is enabled, hide when disabled
            isVisible: newNoColorDiff,
            // Turn off regular diff if no color diff is enabled
            diffMode: newNoColorDiff ? false : result[STORAGE_KEY].diffMode
          };
          chrome.storage.local.set({ [STORAGE_KEY]: newState });
        }
    });
  }
  
  // Alt+Shift+Arrow keys to adjust opacity
  if (e.altKey && e.shiftKey && !e.ctrlKey && (e.key.startsWith('Arrow'))) {
    e.preventDefault();
    chrome.storage.local.get([STORAGE_KEY], (result) => {
        if (result[STORAGE_KEY] && result[STORAGE_KEY].imageData) {
          let { opacity = 50 } = result[STORAGE_KEY];
          const step = 5;
          
          switch(e.key) {
            case 'ArrowUp':
              opacity = Math.min(100, opacity + step);
              break;
            case 'ArrowDown':
              opacity = Math.max(0, opacity - step);
              break;
          }
          
          const newState = { ...result[STORAGE_KEY], opacity };
          chrome.storage.local.set({ [STORAGE_KEY]: newState });
        }
    });
  }
  
  // AltGr+Shift+Arrow keys to move overlay (AltGr triggers both altKey and ctrlKey)
  if (e.altKey && e.ctrlKey && e.shiftKey && (e.key.startsWith('Arrow'))) {
    e.preventDefault();
    chrome.storage.local.get([STORAGE_KEY], (result) => {
        if (result[STORAGE_KEY] && result[STORAGE_KEY].imageData) {
          let { offsetX = 0, offsetY = 0 } = result[STORAGE_KEY];
          const step = 1;
          
          switch(e.key) {
            case 'ArrowLeft':
              offsetX -= step;
              break;
            case 'ArrowRight':
              offsetX += step;
              break;
            case 'ArrowUp':
              offsetY -= step;
              break;
            case 'ArrowDown':
              offsetY += step;
              break;
          }
          
          const newState = { ...result[STORAGE_KEY], offsetX, offsetY };
          chrome.storage.local.set({ [STORAGE_KEY]: newState });
        }
    });
  }
});

// Initialize only in valid Chrome extension contexts
if (isValidContext()) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadStoredState);
  } else {
    loadStoredState();
  }
} else {
  console.log('Pixel Pusher: Not initializing - not in valid Chrome extension context');
}