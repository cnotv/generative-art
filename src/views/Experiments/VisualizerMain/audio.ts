// Audio module for music visualizer
const barCount = 32

// Audio source settings
type AudioSourceType = 'song' | 'microphone' | 'selected-output'

const state = {
  audioContext: null as AudioContext | null,
  analyser: null as AnalyserNode | null,
  audioElement: null as HTMLAudioElement | null,
  microphoneStream: null as MediaStream | null,
  selectedAudioStream: null as MediaStream | null,
  songSource: null as MediaElementAudioSourceNode | null,
  microphoneSource: null as MediaStreamAudioSourceNode | null,
  selectedAudioSource: null as MediaStreamAudioSourceNode | null,
  isInitialized: false,
  currentAudioSourceType: 'song' as AudioSourceType,
  isMicrophoneAvailable: false,
  isSelectedAudioAvailable: false,
  availableAudioDevices: [] as MediaDeviceInfo[]
}

// Initialize Web Audio API
const initializeAudioContext = (): void => {
  if (!state.audioContext && state.audioElement) {
    try {
      const AudioContextClass =
        window.AudioContext ||
        (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AudioContextClass) return
      state.audioContext = new AudioContextClass()
      state.analyser = state.audioContext.createAnalyser()
      state.analyser.fftSize = 2048

      state.songSource = state.audioContext.createMediaElementSource(state.audioElement)

      connectAudioSource()

      console.warn('Audio context initialized successfully')
    } catch (error) {
      console.error('Failed to initialize audio context:', error)
    }
  }
}

// Connect the appropriate audio source to the analyser
const connectAudioSource = (): void => {
  if (!state.audioContext || !state.analyser) return

  try {
    if (state.songSource) state.songSource.disconnect()
    if (state.microphoneSource) state.microphoneSource.disconnect()
    if (state.selectedAudioSource) state.selectedAudioSource.disconnect()
  } catch (_e) {
    // Sources may not be connected yet
  }

  if (state.currentAudioSourceType === 'microphone' && state.microphoneSource) {
    state.microphoneSource.connect(state.analyser)
    console.warn('Switched to microphone input')
  } else if (state.currentAudioSourceType === 'selected-output' && state.selectedAudioSource) {
    state.selectedAudioSource.connect(state.analyser)
    console.warn('Switched to selected audio output')
  } else if (state.songSource) {
    state.songSource.connect(state.analyser)
    state.analyser.connect(state.audioContext.destination)
    console.warn('Switched to song playback')
  }
}

// Reset audio setup for new songs
export const resetAudio = (): void => {
  state.isInitialized = false
  state.audioElement = null
  // Note: Don't close audioContext as it can be reused
}

// Setup audio controls and auto-load music
export const setupAudio = (audioElementReference?: HTMLAudioElement): void => {
  if (state.isInitialized && state.audioElement === audioElementReference) return

  if (audioElementReference && state.audioElement !== audioElementReference) {
    state.isInitialized = false
  }

  state.audioElement = audioElementReference || document.querySelector('audio.player__audio')

  if (!state.audioElement) {
    console.error('Audio element not found')
    return
  }

  const initOnInteraction = (audio?: HTMLAudioElement | null) => {
    if (!state.audioContext) {
      initializeAudioContext()
    }
    if (state.audioContext?.state === 'suspended') {
      state.audioContext.resume()
    }

    if (audio) {
      audio.play()
    }
  }

  state.audioElement.addEventListener('canplaythrough', () => {
    console.warn('Audio can play through, initializing context')
    initializeAudioContext()
  })

  state.audioElement.addEventListener('play', () => initOnInteraction(state.audioElement))

  state.audioElement.addEventListener('error', (e) => {
    console.error('Audio loading error:', e)
    const audioElement_ = e.target as HTMLAudioElement
    if (audioElement_ && audioElement_.error) {
      console.error('Audio error code:', audioElement_.error.code)
      console.error('Audio error message:', audioElement_.error.message)
      console.error('Audio src:', audioElement_.src)
    }
  })

  state.audioElement.addEventListener('loadstart', () => {
    console.warn('Audio loading started')
  })

  state.audioElement.addEventListener('loadeddata', () => {
    console.warn('Audio data loaded')
  })

  document.addEventListener('click', () => initOnInteraction(state.audioElement), { once: true })

  state.isInitialized = true
}

// Get audio frequency data as normalized array
export const getAudioData = (): number[] => {
  if (!state.analyser) {
    return new Array(barCount).fill(0)
  }

  const dataArray = new Uint8Array(state.analyser.frequencyBinCount)
  state.analyser.getByteFrequencyData(dataArray)

  return [...dataArray].slice(0, barCount).map((value) => value / 255)
}

// Get audio time domain data (for waveform visualization)
export const getWaveformData = (): number[] => {
  if (!state.analyser) {
    return new Array(barCount).fill(0)
  }

  const dataArray = new Uint8Array(state.analyser.fftSize)
  state.analyser.getByteTimeDomainData(dataArray)

  return [...dataArray].slice(0, barCount).map((value) => (value - 128) / 128)
}

// Get average volume level
export const getAverageVolume = (): number => {
  const audioData = getAudioData()
  return audioData.reduce((sum, value) => sum + value, 0) / audioData.length
}

// Get bass, mid, treble frequencies separately
export const getFrequencyRanges = (): { bass: number; mid: number; treble: number } => {
  const audioData = getAudioData()
  const bassEnd = Math.floor(audioData.length * 0.1)
  const midEnd = Math.floor(audioData.length * 0.5)

  const bass = audioData.slice(0, bassEnd).reduce((sum, value) => sum + value, 0) / bassEnd || 0
  const mid =
    audioData.slice(bassEnd, midEnd).reduce((sum, value) => sum + value, 0) / (midEnd - bassEnd) ||
    0
  const treble =
    audioData.slice(midEnd).reduce((sum, value) => sum + value, 0) / (audioData.length - midEnd) ||
    0

  return { bass, mid, treble }
}

// Get frequency bands data for visualizers with configurable ranges
export const getFrequencyBands = (bandConfig: {
  [key: string]: { start: number; end: number }
}): { [key: string]: number } => {
  const audioData = getAudioData()
  const result: { [key: string]: number } = {}

  Object.entries(bandConfig).forEach(([bandName, config]) => {
    const startIndex = Math.max(0, config.start)
    const endIndex = Math.min(audioData.length - 1, config.end)

    if (startIndex <= endIndex) {
      const bandData = audioData.slice(startIndex, endIndex + 1)
      result[bandName] = bandData.reduce((sum, value) => sum + value, 0) / bandData.length || 0
    } else {
      result[bandName] = 0
    }
  })

  return result
}

// Check if audio is playing
export const isPlaying = (): boolean => {
  return state.audioElement ? !state.audioElement.paused : false
}

// Initialize microphone access
const initializeMicrophone = async (): Promise<boolean> => {
  try {
    if (!state.audioContext) {
      console.error('Audio context not initialized')
      return false
    }

    state.microphoneStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        autoGainControl: false,
        noiseSuppression: false
      }
    })

    state.microphoneSource = state.audioContext.createMediaStreamSource(state.microphoneStream)
    state.isMicrophoneAvailable = true
    console.warn('Microphone initialized successfully')
    return true
  } catch (error) {
    console.error('Failed to initialize microphone:', error)
    state.isMicrophoneAvailable = false
    return false
  }
}

// Get available audio devices
export const getAvailableAudioDevices = async (): Promise<MediaDeviceInfo[]> => {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices()
    state.availableAudioDevices = devices.filter((device) => device.kind === 'audioinput')
    return state.availableAudioDevices
  } catch (error) {
    console.error('Failed to get audio devices:', error)
    return []
  }
}

// Initialize selected audio output
const initializeSelectedAudio = async (deviceId?: string): Promise<boolean> => {
  try {
    if (!state.audioContext) {
      console.error('Audio context not initialized')
      return false
    }

    const constraints: MediaStreamConstraints = {
      audio: deviceId ? { deviceId: { exact: deviceId } } : true
    }

    state.selectedAudioStream = await navigator.mediaDevices.getUserMedia(constraints)
    state.selectedAudioSource = state.audioContext.createMediaStreamSource(
      state.selectedAudioStream
    )
    state.isSelectedAudioAvailable = true
    console.warn('Selected audio output initialized successfully')
    return true
  } catch (error) {
    console.error('Failed to initialize selected audio output:', error)
    state.isSelectedAudioAvailable = false
    return false
  }
}

// Switch to song mode
const switchToSong = async (): Promise<boolean> => {
  state.currentAudioSourceType = 'song'
  if (state.audioElement) {
    await state.audioElement.play().catch(console.error)
  }
  connectAudioSource()
  return true
}

// Switch to microphone mode
const switchToMicrophone = async (): Promise<boolean> => {
  if (!state.isMicrophoneAvailable) {
    const micInitialized = await initializeMicrophone()
    if (!micInitialized) {
      return false
    }
  }

  state.currentAudioSourceType = 'microphone'
  if (state.audioElement) {
    state.audioElement.pause()
  }
  connectAudioSource()
  return true
}

// Switch to selected audio output mode
const switchToSelectedOutput = async (): Promise<boolean> => {
  if (!state.isSelectedAudioAvailable) {
    const audioInitialized = await initializeSelectedAudio()
    if (!audioInitialized) {
      return false
    }
  }

  state.currentAudioSourceType = 'selected-output'
  if (state.audioElement) {
    state.audioElement.pause()
  }
  connectAudioSource()
  return true
}

// Toggle between song, microphone, and selected audio output
export const toggleAudioSource = async (): Promise<boolean> => {
  if (!state.audioContext) {
    console.error('Audio context not initialized')
    return false
  }

  switch (state.currentAudioSourceType) {
    case 'song': {
      return await switchToMicrophone()
    }

    case 'microphone': {
      const success = await switchToSelectedOutput()
      if (!success) {
        return await switchToSong()
      }
      return true
    }

    case 'selected-output': {
      return await switchToSong()
    }

    default: {
      return await switchToSong()
    }
  }
}

// Set specific audio source
export const setAudioSource = async (
  sourceType: AudioSourceType,
  deviceId?: string
): Promise<boolean> => {
  if (!state.audioContext) {
    console.error('Audio context not initialized')
    return false
  }

  if (sourceType === 'microphone' && !state.isMicrophoneAvailable) {
    const micInitialized = await initializeMicrophone()
    if (!micInitialized) return false
  }

  if (sourceType === 'selected-output') {
    const audioInitialized = await initializeSelectedAudio(deviceId)
    if (!audioInitialized) return false
  }

  state.currentAudioSourceType = sourceType

  if (sourceType === 'song' && state.audioElement) {
    state.audioElement.play().catch(console.error)
  } else if (state.audioElement) {
    state.audioElement.pause()
  }

  connectAudioSource()
  return true
}

// Get current audio source
export const getAudioSource = (): AudioSourceType => {
  return state.currentAudioSourceType
}

// Check if microphone is available
export const isMicrophoneReady = (): boolean => {
  return state.isMicrophoneAvailable
}

// Cleanup when component unmounts
export const cleanup = (): void => {
  if (state.microphoneStream) {
    state.microphoneStream.getTracks().forEach((track) => track.stop())
    state.microphoneStream = null
  }

  if (state.selectedAudioStream) {
    state.selectedAudioStream.getTracks().forEach((track) => track.stop())
    state.selectedAudioStream = null
  }

  try {
    if (state.songSource) state.songSource.disconnect()
    if (state.microphoneSource) state.microphoneSource.disconnect()
    if (state.selectedAudioSource) state.selectedAudioSource.disconnect()
  } catch (_e) {
    // Sources may not be connected
  }

  state.songSource = null
  state.microphoneSource = null
  state.selectedAudioSource = null
  state.currentAudioSourceType = 'song'
  state.isMicrophoneAvailable = false
  state.isSelectedAudioAvailable = false
  state.availableAudioDevices = []

  if (state.audioElement) {
    state.audioElement = null
  }

  if (state.audioContext) {
    state.audioContext.close()
  }
}
