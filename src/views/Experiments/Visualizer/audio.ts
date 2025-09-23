// Audio module for music visualizer
let audioContext: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let audioElement: HTMLAudioElement | null = null;
let isInitialized = false;
const barCount = 32;

// Initialize Web Audio API
const initializeAudioContext = (): void => {
  if (!audioContext && audioElement) {
    try {
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048; // Small for simple visualization
      
      const source = audioContext.createMediaElementSource(audioElement);
      source.connect(analyser);
      analyser.connect(audioContext.destination);
      
      console.log('Audio context initialized successfully');
    } catch (error) {
      console.error('Failed to initialize audio context:', error);
    }
  }
};

// Reset audio setup for new songs
export const resetAudio = (): void => {
  isInitialized = false;
  audioElement = null;
  // Note: Don't close audioContext as it can be reused
};

// Setup audio controls and auto-load music
export const setupAudio = (audioElementRef?: HTMLAudioElement): void => {
  if (isInitialized && audioElement === audioElementRef) return;

  // Reset if we're switching to a new element
  if (audioElementRef && audioElement !== audioElementRef) {
    isInitialized = false;
  }

  // Use provided element or find it in the template
  audioElement = audioElementRef || document.querySelector('audio.player__audio');
  
  if (!audioElement) {
    console.error('Audio element not found');
    return;
  }

  // Initialize audio context on first user interaction
  const initOnInteraction = (audio?: HTMLAudioElement | null) => {
    if (!audioContext) {
      initializeAudioContext();
    }
    if (audioContext?.state === 'suspended') {
      audioContext.resume();
    }

    if (audio) {
      audio.play();
    }
  };

  // Add event listeners
  audioElement.addEventListener('canplaythrough', () => {
    console.log('Audio can play through, initializing context');
    initializeAudioContext();
  });

  audioElement.addEventListener('play', () => initOnInteraction(audioElement));
  
  audioElement.addEventListener('error', (e) => {
    console.error('Audio loading error:', e);
    const audioEl = e.target as HTMLAudioElement;
    if (audioEl && audioEl.error) {
      console.error('Audio error code:', audioEl.error.code);
      console.error('Audio error message:', audioEl.error.message);
      console.error('Audio src:', audioEl.src);
    }
  });

  audioElement.addEventListener('loadstart', () => {
    console.log('Audio loading started');
  });

  audioElement.addEventListener('loadeddata', () => {
    console.log('Audio data loaded');
  });
  
  // Add click listener to start audio context on user interaction
  document.addEventListener('click', () => initOnInteraction(audioElement), { once: true });

  isInitialized = true;
};

// Get audio frequency data as normalized array
export const getAudioData = (): number[] => {
  if (!analyser) {
    return new Array(barCount).fill(0);
  }
  
  const dataArray = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(dataArray);
  
  // Convert to normalized values (0-1)
  return Array.from(dataArray)
    .slice(0, barCount)
    .map(value => value / 255);
};

// Get audio time domain data (for waveform visualization)
export const getWaveformData = (): number[] => {
  if (!analyser) {
    return new Array(barCount).fill(0);
  }
  
  const dataArray = new Uint8Array(analyser.fftSize);
  analyser.getByteTimeDomainData(dataArray);
  
  // Convert to normalized values (-1 to 1)
  return Array.from(dataArray)
    .slice(0, barCount)
    .map(value => (value - 128) / 128);
};

// Get average volume level
export const getAverageVolume = (): number => {
  const audioData = getAudioData();
  return audioData.reduce((sum, value) => sum + value, 0) / audioData.length;
};

// Get bass, mid, treble frequencies separately
export const getFrequencyRanges = (): { bass: number; mid: number; treble: number } => {
  const audioData = getAudioData();
  const bassEnd = Math.floor(audioData.length * 0.1);
  const midEnd = Math.floor(audioData.length * 0.5);
  
  const bass = audioData.slice(0, bassEnd).reduce((sum, val) => sum + val, 0) / bassEnd || 0;
  const mid = audioData.slice(bassEnd, midEnd).reduce((sum, val) => sum + val, 0) / (midEnd - bassEnd) || 0;
  const treble = audioData.slice(midEnd).reduce((sum, val) => sum + val, 0) / (audioData.length - midEnd) || 0;
  
  return { bass, mid, treble };
};

// Check if audio is playing
export const isPlaying = (): boolean => {
  return audioElement ? !audioElement.paused : false;
};

// Cleanup when component unmounts
export const cleanup = (): void => {
  if (audioElement) {
    // Don't remove the element since it's part of the template
    audioElement = null;
  }

  if (audioContext) {
    audioContext.close();
  }
};
