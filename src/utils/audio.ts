// Audio utility for game sound effects and soundtrack
type SoundConfig = {
  startFreq: number;
  endFreq: number;
  duration: number;
  volume: number;
  waveType?: OscillatorType;
  attackTime?: number;
  releaseTime?: number;
};

type NoteSequence = [number, number][];

let gameAudioContext: AudioContext | null = null;
let soundtrackTimeout: number | null = null;
let musicPlaying = false;

// Initialize audio context on first user interaction (required for iOS)
const initializeAudio = async () => {
  try {
    if (!gameAudioContext) {
      gameAudioContext = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
    }
    
    if (gameAudioContext.state === "suspended") {
      await gameAudioContext.resume();
    }
    
    // Play a silent sound to "unlock" audio on iOS
    const oscillator = gameAudioContext.createOscillator();
    const gainNode = gameAudioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(gameAudioContext.destination);
    
    gainNode.gain.setValueAtTime(0, gameAudioContext.currentTime);
    oscillator.frequency.setValueAtTime(440, gameAudioContext.currentTime);
    
    oscillator.start(gameAudioContext.currentTime);
    oscillator.stop(gameAudioContext.currentTime + 0.001);
    
    console.log("Audio context initialized successfully");
  } catch (error) {
    console.warn("Failed to initialize audio:", error);
  }
};

// Abstracted sound creation system
const createSound = async (config: SoundConfig) => {
  try {
    // Initialize audio context if needed
    if (!gameAudioContext) {
      gameAudioContext = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
    }

    // Resume if suspended (browser requirement - especially important for iOS)
    if (gameAudioContext.state === "suspended") {
      await gameAudioContext.resume();
    }

    const ctx = gameAudioContext;
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    // Configure sound based on parameters
    oscillator.type = config.waveType || "sine";
    oscillator.frequency.setValueAtTime(config.startFreq, ctx.currentTime);

    // Frequency sweep
    if (config.startFreq !== config.endFreq) {
      oscillator.frequency.exponentialRampToValueAtTime(
        config.endFreq,
        ctx.currentTime + config.duration
      );
    }

    // Volume envelope
    const attackTime = config.attackTime || 0.01;
    const releaseTime = config.releaseTime || config.duration * 0.3;

    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(config.volume, ctx.currentTime + attackTime);
    gainNode.gain.exponentialRampToValueAtTime(
      0.001,
      ctx.currentTime + config.duration - releaseTime
    );

    // Play the sound
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + config.duration);
  } catch (error) {
    console.warn("Audio not available:", error);
  }
};

const playMusicNote = (note: number, duration: number, volume: number) => {
  if (note === 0) return; // Rest note - silence

  createSound({
    startFreq: note,
    endFreq: note, // No frequency sweep for musical notes
    duration: duration,
    volume: volume,
    waveType: "square", // Square wave for classic 8-bit sound
    attackTime: 0.01,
    releaseTime: duration * 0.1, // Quick release for crisp notes
  });
};

const playMusic = (sequence: NoteSequence, gameScore = 0) => {
  if (!musicPlaying) return;

  let currentIndex = 0;

  const playNextNote = () => {
    if (!musicPlaying || currentIndex >= sequence.length) {
      // Loop the soundtrack
      currentIndex = 0;
      if (musicPlaying) {
        soundtrackTimeout = window.setTimeout(playNextNote, 500); // Brief pause before looping
      }
      return;
    }

    const [note, duration] = sequence[currentIndex];
    const volume = 0.08; // Fixed volume for all notes

    // Calculate dynamic speed based on score - music gets faster as score increases (faster tempo, reduced influence)
    const baseSpeed = 0.8; // Faster base speed
    const speedMultiplier = Math.max(0.4, baseSpeed - gameScore * 0.0006); // Gets faster more gradually, minimum 0.4x speed
    const adjustedDuration = duration * speedMultiplier;

    // Play the note
    playMusicNote(note, adjustedDuration, volume);

    // Schedule next note with adjusted timing
    currentIndex++;
    soundtrackTimeout = window.setTimeout(playNextNote, adjustedDuration * 1000);
  };

  playNextNote();
};

const startMusic = (sequence: NoteSequence, gameScore = 0) => {
  if (musicPlaying) return;
  musicPlaying = true;
  playMusic(sequence, gameScore);
};

const stopMusic = () => {
  musicPlaying = false;
  if (soundtrackTimeout) {
    clearTimeout(soundtrackTimeout);
    soundtrackTimeout = null;
  }
};

// Check if soundtrack is currently playing
const isMusicPlaying = () => musicPlaying;

// Play audio file with optional volume control
const playAudioFile = (audioFile: string, volume: number = 1) => {
  const audio = new Audio(audioFile);
  audio.volume = Math.max(0, Math.min(1, volume)); // Clamp volume between 0 and 1
  audio.play().catch(() => {
    // Silently handle audio play failures (e.g., no user interaction yet)
  });
};

export {
  type SoundConfig,
  type NoteSequence,
  initializeAudio,
  createSound,
  startMusic,
  stopMusic,
  isMusicPlaying,
  playAudioFile
};
