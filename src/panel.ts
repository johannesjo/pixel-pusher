interface OverlayState {
  imageData: string | null;
  opacity: number;
  isVisible: boolean;
  fileName: string | null;
  offsetX: number;
  offsetY: number;
  scale: number;
}

let currentState: OverlayState = {
  imageData: null,
  opacity: 50,
  isVisible: true,
  fileName: null,
  offsetX: 0,
  offsetY: 0,
  scale: 100
};

const initializePanel = () => {
  const dropZone = document.getElementById('dropZone') as HTMLElement;
  const fileInput = document.getElementById('fileInput') as HTMLInputElement;
  const opacitySlider = document.getElementById('opacitySlider') as HTMLInputElement;
  const opacityInput = document.getElementById('opacityInput') as HTMLInputElement;
  const toggleButton = document.getElementById('toggleButton') as HTMLButtonElement;
  const clearButton = document.getElementById('clearButton') as HTMLButtonElement;
  const currentImageInfo = document.getElementById('currentImageInfo') as HTMLElement;
  const currentImageName = document.getElementById('currentImageName') as HTMLElement;
  const offsetXSlider = document.getElementById('offsetXSlider') as HTMLInputElement;
  const offsetXInput = document.getElementById('offsetXInput') as HTMLInputElement;
  const offsetYSlider = document.getElementById('offsetYSlider') as HTMLInputElement;
  const offsetYInput = document.getElementById('offsetYInput') as HTMLInputElement;
  const scaleSlider = document.getElementById('scaleSlider') as HTMLInputElement;
  const scaleInput = document.getElementById('scaleInput') as HTMLInputElement;
  const resetPositionButton = document.getElementById('resetPositionButton') as HTMLButtonElement;

  const updateCurrentImageDisplay = () => {
    if (currentState.fileName) {
      currentImageInfo.classList.remove('hidden');
      currentImageName.textContent = currentState.fileName;
    } else {
      currentImageInfo.classList.add('hidden');
    }
  };

  const sendStateToContent = () => {
    // Storage changes will automatically trigger content script update
    // No need to send messages
  };

  const loadStoredState = () => {
    chrome.storage.local.get(['overlayState'], (result) => {
      if (result.overlayState) {
        currentState = { ...currentState, ...result.overlayState };
        opacitySlider.value = currentState.opacity.toString();
        opacityInput.value = currentState.opacity.toString();
        offsetXSlider.value = currentState.offsetX.toString();
        offsetXInput.value = currentState.offsetX.toString();
        offsetYSlider.value = currentState.offsetY.toString();
        offsetYInput.value = currentState.offsetY.toString();
        scaleSlider.value = currentState.scale.toString();
        scaleInput.value = currentState.scale.toString();
        toggleButton.textContent = currentState.isVisible ? 'Hide Overlay' : 'Show Overlay';
        updateCurrentImageDisplay();
        sendStateToContent();
      }
    });
  };

  const saveState = () => {
    chrome.storage.local.set({ overlayState: currentState });
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
    saveState();
    updateCurrentImageDisplay();
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

  loadStoredState();
};

document.addEventListener('DOMContentLoaded', initializePanel);