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
  activeTabId?: number; // Track which tab should show the overlay
}

let currentState: OverlayState = {
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
};

const initializePanel = () => {
  const dropZone = document.getElementById('dropZone') as HTMLElement;
  const fileInput = document.getElementById('fileInput') as HTMLInputElement;
  const opacitySlider = document.getElementById('opacitySlider') as HTMLInputElement;
  const opacityInput = document.getElementById('opacityInput') as HTMLInputElement;
  const toggleButton = document.getElementById('toggleButton') as HTMLButtonElement;
  const diffModeButton = document.getElementById('diffModeButton') as HTMLButtonElement;
  const noColorDiffButton = document.getElementById('noColorDiffButton') as HTMLButtonElement;
  const rulerModeButton = document.getElementById('rulerModeButton') as HTMLButtonElement;
  const clearButton = document.getElementById('clearButton') as HTMLButtonElement;
  const imagePreviewContainer = document.getElementById('imagePreviewContainer') as HTMLElement;
  const imagePreview = document.getElementById('imagePreview') as HTMLImageElement;
  const imagePreviewName = document.getElementById('imagePreviewName') as HTMLElement;
  const offsetXSlider = document.getElementById('offsetXSlider') as HTMLInputElement;
  const offsetXInput = document.getElementById('offsetXInput') as HTMLInputElement;
  const offsetYSlider = document.getElementById('offsetYSlider') as HTMLInputElement;
  const offsetYInput = document.getElementById('offsetYInput') as HTMLInputElement;
  const scaleSlider = document.getElementById('scaleSlider') as HTMLInputElement;
  const scaleInput = document.getElementById('scaleInput') as HTMLInputElement;
  const resetPositionButton = document.getElementById('resetPositionButton') as HTMLButtonElement;

  const updateCurrentImageDisplay = () => {
    if (currentState.imageData && currentState.fileName) {
      imagePreviewContainer.classList.remove('hidden');
      imagePreview.src = currentState.imageData;
      imagePreviewName.textContent = currentState.fileName;
      dropZone.querySelector('p')!.textContent = 'Drop a new image or click to replace';
    } else {
      imagePreviewContainer.classList.add('hidden');
      dropZone.querySelector('p')!.textContent = 'Drop an image here or click to select';
    }
  };

  const sendStateToContent = () => {
    // Storage changes will automatically trigger content script update
    // No need to send messages
  };

  const STORAGE_KEY = 'overlayState';

  const loadStoredState = () => {
    console.log('Panel: Loading state');
    chrome.storage.local.get([STORAGE_KEY], (result) => {
      console.log('Panel: Loaded state:', result[STORAGE_KEY]);
      if (result[STORAGE_KEY]) {
        currentState = { ...currentState, ...result[STORAGE_KEY] };
        // Set this tab as the active one
        currentState.activeTabId = chrome.devtools.inspectedWindow.tabId;
        
        opacitySlider.value = currentState.opacity.toString();
        opacityInput.value = currentState.opacity.toString();
        offsetXSlider.value = currentState.offsetX.toString();
        offsetXInput.value = currentState.offsetX.toString();
        offsetYSlider.value = currentState.offsetY.toString();
        offsetYInput.value = currentState.offsetY.toString();
        scaleSlider.value = currentState.scale.toString();
        scaleInput.value = currentState.scale.toString();
        toggleButton.textContent = currentState.isVisible ? 'Hide Overlay' : 'Show Overlay';
        diffModeButton.classList.toggle('active', currentState.diffMode);
        noColorDiffButton.classList.toggle('active', currentState.noColorDiff);
        rulerModeButton.classList.toggle('active', currentState.rulerMode);
        updateCurrentImageDisplay();
        
        // Clear overlay on other tabs and show on this tab
        if (currentState.imageData) {
          sendStateToCurrentTab();
        }
      }
    });
  };

  const saveState = () => {
    console.log('Panel: Saving state:', currentState);
    chrome.storage.local.set({ [STORAGE_KEY]: currentState }, () => {
      if (chrome.runtime.lastError) {
        console.error('Panel: Error saving state:', chrome.runtime.lastError);
      } else {
        console.log('Panel: State saved successfully');
        // Send message to current tab to update overlay
        sendStateToCurrentTab();
      }
    });
  };

  const sendStateToCurrentTab = () => {
    const tabId = chrome.devtools.inspectedWindow.tabId;
    // Update the active tab ID in the state
    currentState.activeTabId = tabId;
    
    // First, clear overlay on all tabs
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        if (tab.id && tab.id !== tabId) {
          chrome.tabs.sendMessage(tab.id, {
            type: 'clearOverlay'
          }).catch(() => {});
        }
      });
    });
    
    // Then send the overlay to the current tab
    chrome.tabs.sendMessage(tabId, {
      type: 'updateOverlay',
      state: currentState
    }).catch(() => {
      console.warn('Failed to send overlay to tab:', tabId);
    });
  };

  const handleFileSelect = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      currentState.imageData = e.target?.result as string;
      currentState.fileName = file.name;
      saveState();
      updateCurrentImageDisplay();
      sendStateToContent();
    };
    reader.readAsDataURL(file);
  };

  dropZone.addEventListener('click', () => {
    fileInput.click();
  });

  fileInput.addEventListener('change', (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  });

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('drag-over');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    
    const file = e.dataTransfer?.files[0];
    if (file) {
      handleFileSelect(file);
    }
  });

  const updateOpacity = (value: string) => {
    const opacity = Math.max(0, Math.min(100, parseInt(value) || 0));
    currentState.opacity = opacity;
    opacitySlider.value = opacity.toString();
    opacityInput.value = opacity.toString();
    saveState();
    sendStateToContent();
  };

  opacitySlider.addEventListener('input', (e) => {
    updateOpacity((e.target as HTMLInputElement).value);
  });

  opacityInput.addEventListener('input', (e) => {
    updateOpacity((e.target as HTMLInputElement).value);
  });

  toggleButton.addEventListener('click', () => {
    currentState.isVisible = !currentState.isVisible;
    toggleButton.textContent = currentState.isVisible ? 'Hide Overlay' : 'Show Overlay';
    saveState();
    sendStateToContent();
  });

  clearButton.addEventListener('click', () => {
    currentState.imageData = null;
    currentState.fileName = null;
    currentState.diffMode = false;
    currentState.noColorDiff = false;
    diffModeButton.classList.remove('active');
    noColorDiffButton.classList.remove('active');
    saveState();
    updateCurrentImageDisplay();
    sendStateToContent();
  });

  diffModeButton.addEventListener('click', () => {
    if (currentState.imageData) {
      currentState.diffMode = !currentState.diffMode;
      // Turn off no color diff if regular diff is enabled
      if (currentState.diffMode) {
        currentState.noColorDiff = false;
        noColorDiffButton.classList.remove('active');
        // Make sure overlay is visible when diff mode is enabled
        currentState.isVisible = true;
        toggleButton.textContent = 'Hide Overlay';
      } else {
        // Hide overlay when diff mode is disabled
        currentState.isVisible = false;
        toggleButton.textContent = 'Show Overlay';
      }
      diffModeButton.classList.toggle('active', currentState.diffMode);
      saveState();
      sendStateToContent();
    }
  });

  noColorDiffButton.addEventListener('click', () => {
    if (currentState.imageData) {
      currentState.noColorDiff = !currentState.noColorDiff;
      // Turn off regular diff if no color diff is enabled
      if (currentState.noColorDiff) {
        currentState.diffMode = false;
        diffModeButton.classList.remove('active');
        // Make sure overlay is visible when no color diff mode is enabled
        currentState.isVisible = true;
        toggleButton.textContent = 'Hide Overlay';
      } else {
        // Hide overlay when no color diff mode is disabled
        currentState.isVisible = false;
        toggleButton.textContent = 'Show Overlay';
      }
      noColorDiffButton.classList.toggle('active', currentState.noColorDiff);
      saveState();
      sendStateToContent();
    }
  });

  rulerModeButton.addEventListener('click', () => {
    currentState.rulerMode = !currentState.rulerMode;
    rulerModeButton.classList.toggle('active', currentState.rulerMode);
    saveState();
    sendStateToContent();
  });

  const updateOffsetX = (value: string) => {
    const offsetX = Math.max(-500, Math.min(500, parseInt(value) || 0));
    currentState.offsetX = offsetX;
    offsetXSlider.value = offsetX.toString();
    offsetXInput.value = offsetX.toString();
    saveState();
    sendStateToContent();
  };

  const updateOffsetY = (value: string) => {
    const offsetY = Math.max(-500, Math.min(500, parseInt(value) || 0));
    currentState.offsetY = offsetY;
    offsetYSlider.value = offsetY.toString();
    offsetYInput.value = offsetY.toString();
    saveState();
    sendStateToContent();
  };

  const updateScale = (value: string) => {
    const scale = Math.max(10, Math.min(200, parseInt(value) || 100));
    currentState.scale = scale;
    scaleSlider.value = scale.toString();
    scaleInput.value = scale.toString();
    saveState();
    sendStateToContent();
  };

  offsetXSlider.addEventListener('input', (e) => {
    updateOffsetX((e.target as HTMLInputElement).value);
  });

  offsetXInput.addEventListener('input', (e) => {
    updateOffsetX((e.target as HTMLInputElement).value);
  });

  offsetYSlider.addEventListener('input', (e) => {
    updateOffsetY((e.target as HTMLInputElement).value);
  });

  offsetYInput.addEventListener('input', (e) => {
    updateOffsetY((e.target as HTMLInputElement).value);
  });

  scaleSlider.addEventListener('input', (e) => {
    updateScale((e.target as HTMLInputElement).value);
  });

  scaleInput.addEventListener('input', (e) => {
    updateScale((e.target as HTMLInputElement).value);
  });

  resetPositionButton.addEventListener('click', () => {
    currentState.offsetX = 0;
    currentState.offsetY = 0;
    currentState.scale = 100;
    offsetXSlider.value = '0';
    offsetXInput.value = '0';
    offsetYSlider.value = '0';
    offsetYInput.value = '0';
    scaleSlider.value = '100';
    scaleInput.value = '100';
    saveState();
    sendStateToContent();
  });

  // Keyboard shortcuts for panel
  // Add tabindex to make the body focusable
  document.body.tabIndex = 0;
  
  // Focus the body when panel loads to ensure keyboard events work
  document.body.focus();
  
  // Re-focus when clicking anywhere in the panel
  document.body.addEventListener('click', () => {
    document.body.focus();
  });
  
  document.addEventListener('keydown', (e) => {
    // Alt+Shift+V to toggle visibility
    if (e.altKey && e.shiftKey && e.key === 'V') {
      e.preventDefault();
      if (currentState.imageData) {
        currentState.isVisible = !currentState.isVisible;
        toggleButton.textContent = currentState.isVisible ? 'Hide Overlay' : 'Show Overlay';
        saveState();
        sendStateToContent();
      }
    }
    
    // Alt+Shift+D to toggle diff mode
    if (e.altKey && e.shiftKey && e.key === 'D') {
      e.preventDefault();
      if (currentState.imageData) {
        currentState.diffMode = !currentState.diffMode;
        // Turn off no color diff if regular diff is enabled
        if (currentState.diffMode) {
          currentState.noColorDiff = false;
          noColorDiffButton.classList.remove('active');
          // Make sure overlay is visible when diff mode is enabled
          currentState.isVisible = true;
          toggleButton.textContent = 'Hide Overlay';
        } else {
          // Hide overlay when diff mode is disabled
          currentState.isVisible = false;
          toggleButton.textContent = 'Show Overlay';
        }
        diffModeButton.classList.toggle('active', currentState.diffMode);
        saveState();
        sendStateToContent();
      }
    }
    
    // Alt+Shift+G to toggle no color diff mode
    if (e.altKey && e.shiftKey && e.key === 'G') {
      e.preventDefault();
      if (currentState.imageData) {
        currentState.noColorDiff = !currentState.noColorDiff;
        // Turn off regular diff if no color diff is enabled
        if (currentState.noColorDiff) {
          currentState.diffMode = false;
          diffModeButton.classList.remove('active');
          // Make sure overlay is visible when no color diff mode is enabled
          currentState.isVisible = true;
          toggleButton.textContent = 'Hide Overlay';
        } else {
          // Hide overlay when no color diff mode is disabled
          currentState.isVisible = false;
          toggleButton.textContent = 'Show Overlay';
        }
        noColorDiffButton.classList.toggle('active', currentState.noColorDiff);
        saveState();
        sendStateToContent();
      }
    }
    
    // Alt+Shift+R to toggle ruler mode
    if (e.altKey && e.shiftKey && e.key === 'R') {
      e.preventDefault();
      currentState.rulerMode = !currentState.rulerMode;
      rulerModeButton.classList.toggle('active', currentState.rulerMode);
      saveState();
      sendStateToContent();
    }
    
    // Alt+Shift+Arrow keys to adjust opacity
    if (e.altKey && e.shiftKey && !e.ctrlKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault();
      if (currentState.imageData) {
        const step = 5;
        if (e.key === 'ArrowUp') {
          updateOpacity((currentState.opacity + step).toString());
        } else if (e.key === 'ArrowDown') {
          updateOpacity((currentState.opacity - step).toString());
        }
      }
    }
    
    // AltGr+Shift+Arrow keys to move overlay (AltGr triggers both altKey and ctrlKey)
    if (e.altKey && e.ctrlKey && e.shiftKey && e.key.startsWith('Arrow')) {
      e.preventDefault();
      if (currentState.imageData) {
        const step = 1;
        switch(e.key) {
          case 'ArrowLeft':
            updateOffsetX((currentState.offsetX - step).toString());
            break;
          case 'ArrowRight':
            updateOffsetX((currentState.offsetX + step).toString());
            break;
          case 'ArrowUp':
            updateOffsetY((currentState.offsetY - step).toString());
            break;
          case 'ArrowDown':
            updateOffsetY((currentState.offsetY + step).toString());
            break;
        }
      }
    }
  });

  loadStoredState();
};

document.addEventListener('DOMContentLoaded', initializePanel);