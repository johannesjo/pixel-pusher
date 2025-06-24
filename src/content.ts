interface OverlayState {
  imageData: string | null;
  opacity: number;
  isVisible: boolean;
  fileName: string | null;
  offsetX: number;
  offsetY: number;
  scale: number;
}

let overlayElement: HTMLDivElement | null = null;
let imageElement: HTMLImageElement | null = null;

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
    overflow: hidden;
  `;

  imageElement = document.createElement('img');
  imageElement.style.cssText = `
    width: 100%;
    height: auto;
    object-fit: contain;
    opacity: 0.5;
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
    
    imageElement.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
  }

  if (overlayElement) {
    overlayElement.style.display = state.isVisible && state.imageData ? 'flex' : 'none';
  }
};

const handleResize = () => {
  if (imageElement && overlayElement) {
    const viewportWidth = window.innerWidth;
    imageElement.style.width = `${viewportWidth}px`;
  }
};

const loadStoredState = () => {
  chrome.storage.local.get(['overlayState'], (result) => {
    if (result.overlayState) {
      updateOverlay(result.overlayState);
    }
  });
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'updateOverlay') {
    updateOverlay(message.state);
  }
});

// Listen for storage changes
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && changes.overlayState) {
    const newState = changes.overlayState.newValue;
    if (newState) {
      updateOverlay(newState);
    }
  }
});

window.addEventListener('resize', handleResize);

let resizeTimeout: number;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(handleResize, 100);
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  // Alt+Shift+V to toggle visibility
  if (e.altKey && e.shiftKey && e.key === 'V') {
    e.preventDefault();
    chrome.storage.local.get(['overlayState'], (result) => {
      if (result.overlayState && result.overlayState.imageData) {
        const newState = { ...result.overlayState, isVisible: !result.overlayState.isVisible };
        chrome.storage.local.set({ overlayState: newState });
      }
    });
  }
  
  // Alt+Shift+Arrow keys to adjust opacity
  if (e.altKey && e.shiftKey && !e.ctrlKey && (e.key.startsWith('Arrow'))) {
    e.preventDefault();
    chrome.storage.local.get(['overlayState'], (result) => {
      if (result.overlayState && result.overlayState.imageData) {
        let { opacity = 50 } = result.overlayState;
        const step = 5;
        
        switch(e.key) {
          case 'ArrowUp':
            opacity = Math.min(100, opacity + step);
            break;
          case 'ArrowDown':
            opacity = Math.max(0, opacity - step);
            break;
        }
        
        const newState = { ...result.overlayState, opacity };
        chrome.storage.local.set({ overlayState: newState });
      }
    });
  }
  
  // Alt+Shift+Ctrl+Arrow keys to move overlay
  if (e.altKey && e.shiftKey && e.ctrlKey && (e.key.startsWith('Arrow'))) {
    e.preventDefault();
    chrome.storage.local.get(['overlayState'], (result) => {
      if (result.overlayState && result.overlayState.imageData) {
        let { offsetX = 0, offsetY = 0 } = result.overlayState;
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
        
        const newState = { ...result.overlayState, offsetX, offsetY };
        chrome.storage.local.set({ overlayState: newState });
      }
    });
  }
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', loadStoredState);
} else {
  loadStoredState();
}