// Audio module for music visualizer
let audioContext: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let audioElement: HTMLAudioElement | null = null;
let microphoneStream: MediaStream | null = null;
let selectedAudioStream: MediaStream | null = null;
let songSource: MediaElementAudioSourceNode | null = null;
let microphoneSource: MediaStreamAudioSourceNode | null = null;
let selectedAudioSource: MediaStreamAudioSourceNode | null = null;
let isInitialized = false;
const barCount = 32;

// Audio source settings
type AudioSourceType = 'song' | 'microphone' | 'selected-output';
let currentAudioSourceType: AudioSourceType = 'song';
let isMicrophoneAvailable = false;
let isSelectedAudioAvailable = false;
let availableAudioDevices: MediaDeviceInfo[] = [];

// Initialize Web Audio API
const initializeAudioContext = (): void => {
  if (!audioContext && audioElement) {
    try {
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048; // Small for simple visualization
      
      // Create source for the song (audio element)
      songSource = audioContext.createMediaElementSource(audioElement);
      
      // Initially connect the song source
      connectAudioSource();
      
      console.log('Audio context initialized successfully');
    } catch (error) {
      console.error('Failed to initialize audio context:', error);
    }
  }
};

// Connect the appropriate audio source to the analyser
const connectAudioSource = (): void => {
  if (!audioContext || !analyser) return;

  // Disconnect all sources first
  try {
    if (songSource) songSource.disconnect();
    if (microphoneSource) microphoneSource.disconnect();
    if (selectedAudioSource) selectedAudioSource.disconnect();
  } catch (e) {
    // Sources may not be connected yet
  }

  if (currentAudioSourceType === 'microphone' && microphoneSource) {
    // Connect microphone to analyser (no destination for privacy)
    microphoneSource.connect(analyser);
    console.log('Switched to microphone input');
  } else if (currentAudioSourceType === 'selected-output' && selectedAudioSource) {
    // Connect selected audio output to analyser (no destination for privacy)
    selectedAudioSource.connect(analyser);
    console.log('Switched to selected audio output');
  } else if (songSource) {
    // Connect song to both analyser and speakers
    songSource.connect(analyser);
    analyser.connect(audioContext.destination);
    console.log('Switched to song playback');
  }
};

// Reset audio setup for new songs
export const resetAudio = (): void => {
  isInitialized = false;
  audioElement = null;
  // Note: Don't close audioContext as it can be reused
};

// Setup audio controls and auto-load music
export const setupAudio = (audioElementReference?: HTMLAudioElement): void => {
  if (isInitialized && audioElement === audioElementReference) return;

  // Reset if we're switching to a new element
  if (audioElementReference && audioElement !== audioElementReference) {
    isInitialized = false;
  }

  // Use provided element or find it in the template
  audioElement = audioElementReference || document.querySelector('audio.player__audio');
  
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
    const audioElement_ = e.target as HTMLAudioElement;
    if (audioElement_ && audioElement_.error) {
      console.error('Audio error code:', audioElement_.error.code);
      console.error('Audio error message:', audioElement_.error.message);
      console.error('Audio src:', audioElement_.src);
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
  return [...dataArray]
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
  return [...dataArray]
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
  
  const bass = audioData.slice(0, bassEnd).reduce((sum, value) => sum + value, 0) / bassEnd || 0;
  const mid = audioData.slice(bassEnd, midEnd).reduce((sum, value) => sum + value, 0) / (midEnd - bassEnd) || 0;
  const treble = audioData.slice(midEnd).reduce((sum, value) => sum + value, 0) / (audioData.length - midEnd) || 0;
  
  return { bass, mid, treble };
};

// Get frequency bands data for visualizers with configurable ranges
export const getFrequencyBands = (bandConfig: {
  [key: string]: { start: number; end: number }
}): { [key: string]: number } => {
  const audioData = getAudioData();
  const result: { [key: string]: number } = {};

  Object.entries(bandConfig).forEach(([bandName, config]) => {
    const startIndex = Math.max(0, config.start);
    const endIndex = Math.min(audioData.length - 1, config.end);
    
    if (startIndex <= endIndex) {
      const bandData = audioData.slice(startIndex, endIndex + 1);
      result[bandName] = bandData.reduce((sum, value) => sum + value, 0) / bandData.length || 0;
    } else {
      result[bandName] = 0;
    }
  });

  return result;
};

// Check if audio is playing
export const isPlaying = (): boolean => {
  return audioElement ? !audioElement.paused : false;
};

// Initialize microphone access
const initializeMicrophone = async (): Promise<boolean> => {
  try {
    if (!audioContext) {
      console.error('Audio context not initialized');
      return false;
    }

    microphoneStream = await navigator.mediaDevices.getUserMedia({ 
      audio: {
        echoCancellation: false,
        autoGainControl: false,
        noiseSuppression: false
      } 
    });
    
    microphoneSource = audioContext.createMediaStreamSource(microphoneStream);
    isMicrophoneAvailable = true;
    console.log('Microphone initialized successfully');
    return true;
  } catch (error) {
    console.error('Failed to initialize microphone:', error);
    isMicrophoneAvailable = false;
    return false;
  }
};

// Get available audio devices
export const getAvailableAudioDevices = async (): Promise<MediaDeviceInfo[]> => {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    availableAudioDevices = devices.filter(device => device.kind === 'audioinput');
    return availableAudioDevices;
  } catch (error) {
    console.error('Failed to get audio devices:', error);
    return [];
  }
};

// Initialize selected audio output
const initializeSelectedAudio = async (deviceId?: string): Promise<boolean> => {
  try {
    if (!audioContext) {
      console.error('Audio context not initialized');
      return false;
    }

    const constraints: MediaStreamConstraints = {
      audio: deviceId ? { deviceId: { exact: deviceId } } : true
    };

    selectedAudioStream = await navigator.mediaDevices.getUserMedia(constraints);
    selectedAudioSource = audioContext.createMediaStreamSource(selectedAudioStream);
    isSelectedAudioAvailable = true;
    console.log('Selected audio output initialized successfully');
    return true;
  } catch (error) {
    console.error('Failed to initialize selected audio output:', error);
    isSelectedAudioAvailable = false;
    return false;
  }
};

// Switch to song mode
const switchToSong = async (): Promise<boolean> => {
  currentAudioSourceType = 'song';
  if (audioElement) {
    await audioElement.play().catch(console.error);
  }
  connectAudioSource();
  return true;
};

// Switch to microphone mode
const switchToMicrophone = async (): Promise<boolean> => {
  if (!isMicrophoneAvailable) {
    const micInitialized = await initializeMicrophone();
    if (!micInitialized) {
      return false;
    }
  }
  
  currentAudioSourceType = 'microphone';
  if (audioElement) {
    audioElement.pause();
  }
  connectAudioSource();
  return true;
};

// Switch to selected audio output mode
const switchToSelectedOutput = async (): Promise<boolean> => {
  if (!isSelectedAudioAvailable) {
    const audioInitialized = await initializeSelectedAudio();
    if (!audioInitialized) {
      return false;
    }
  }
  
  currentAudioSourceType = 'selected-output';
  if (audioElement) {
    audioElement.pause();
  }
  connectAudioSource();
  return true;
};

// Toggle between song, microphone, and selected audio output
export const toggleAudioSource = async (): Promise<boolean> => {
  if (!audioContext) {
    console.error('Audio context not initialized');
    return false;
  }

  // Cycle through the three modes using switch
  switch (currentAudioSourceType) {
    case 'song': {
      return await switchToMicrophone();
    }
    
    case 'microphone': {
      const success = await switchToSelectedOutput();
      if (!success) {
        // If selected audio fails, fall back to song
        return await switchToSong();
      }
      return true;
    }
    
    case 'selected-output': {
      return await switchToSong();
    }
    
    default: {
      return await switchToSong();
    }
  }
};

// Set specific audio source
export const setAudioSource = async (sourceType: AudioSourceType, deviceId?: string): Promise<boolean> => {
  if (!audioContext) {
    console.error('Audio context not initialized');
    return false;
  }

  if (sourceType === 'microphone' && !isMicrophoneAvailable) {
    const micInitialized = await initializeMicrophone();
    if (!micInitialized) return false;
  }

  if (sourceType === 'selected-output') {
    const audioInitialized = await initializeSelectedAudio(deviceId);
    if (!audioInitialized) return false;
  }

  currentAudioSourceType = sourceType;
  
  // Handle audio element play/pause
  if (sourceType === 'song' && audioElement) {
    audioElement.play().catch(console.error);
  } else if (audioElement) {
    audioElement.pause();
  }

  connectAudioSource();
  return true;
};

// Get current audio source
export const getAudioSource = (): AudioSourceType => {
  return currentAudioSourceType;
};

// Check if microphone is available
export const isMicrophoneReady = (): boolean => {
  return isMicrophoneAvailable;
};

// Cleanup when component unmounts
export const cleanup = (): void => {
  // Stop microphone stream if active
  if (microphoneStream) {
    microphoneStream.getTracks().forEach(track => track.stop());
    microphoneStream = null;
  }
  
  // Stop selected audio stream if active
  if (selectedAudioStream) {
    selectedAudioStream.getTracks().forEach(track => track.stop());
    selectedAudioStream = null;
  }
  
  // Disconnect sources
  try {
    if (songSource) songSource.disconnect();
    if (microphoneSource) microphoneSource.disconnect();
    if (selectedAudioSource) selectedAudioSource.disconnect();
  } catch (e) {
    // Sources may not be connected
  }
  
  // Reset state
  songSource = null;
  microphoneSource = null;
  selectedAudioSource = null;
  currentAudioSourceType = 'song';
  isMicrophoneAvailable = false;
  isSelectedAudioAvailable = false;
  availableAudioDevices = [];

  if (audioElement) {
    // Don't remove the element since it's part of the template
    audioElement = null;
  }

  if (audioContext) {
    audioContext.close();
  }
};
