---
sidebar_position: 5
---

# Package: @webgamekit/audio

Audio playback utilities for games and interactive experiences.

## Installation

```bash
pnpm add @webgamekit/audio
```

## Basic Usage

```typescript
import { initializeAudio, createSound, playSound } from '@webgamekit/audio';

// Initialize audio context (must be called after user interaction)
const audioContext = initializeAudio();

// Create and play sounds
const jumpSound = createSound(audioContext, '/audio/jump.mp3');
playSound(jumpSound);
```

## API Reference

### initializeAudio()

Initializes the Web Audio API context. Must be called after a user interaction (click, keypress) due to browser autoplay policies.

**Returns**: `AudioContext`

### createSound(context, url, config?)

Creates a sound instance from an audio file.

**Parameters**:
- `context`: AudioContext from `initializeAudio()`
- `url`: Path to the audio file
- `config`: Optional `SoundConfig` object

**Returns**: `Sound` instance

### playSound(sound, options?)

Plays a sound instance.

**Parameters**:
- `sound`: Sound instance from `createSound()`
- `options`: Optional playback options (volume, loop, etc.)

### SoundConfig

```typescript
interface SoundConfig {
  volume?: number;      // 0.0 to 1.0 (default: 1.0)
  loop?: boolean;       // Whether to loop (default: false)
  autoplay?: boolean;   // Play immediately when loaded (default: false)
  preload?: boolean;    // Preload audio data (default: true)
}
```

## Usage Patterns

### Background Music

```typescript
import { initializeAudio, createSound, playSound, stopSound } from '@webgamekit/audio';

let audioContext: AudioContext;
let bgMusic: Sound;

const startGame = () => {
  // Initialize on first user interaction
  if (!audioContext) {
    audioContext = initializeAudio();
  }
  
  bgMusic = createSound(audioContext, '/audio/background.mp3', {
    volume: 0.5,
    loop: true
  });
  
  playSound(bgMusic);
};

const pauseGame = () => {
  stopSound(bgMusic);
};
```

### Sound Effects

```typescript
const sounds = {
  jump: null as Sound | null,
  collect: null as Sound | null,
  hit: null as Sound | null
};

// Preload sounds
const preloadSounds = (audioContext: AudioContext) => {
  sounds.jump = createSound(audioContext, '/audio/jump.wav', { preload: true });
  sounds.collect = createSound(audioContext, '/audio/coin.wav', { preload: true });
  sounds.hit = createSound(audioContext, '/audio/hit.wav', { preload: true });
};

// Play on events
const onPlayerJump = () => {
  if (sounds.jump) playSound(sounds.jump);
};

const onCollectCoin = () => {
  if (sounds.collect) playSound(sounds.collect, { volume: 0.7 });
};
```

### With Game State

```typescript
import { createGame } from '@webgamekit/game';
import { initializeAudio, createSound, playSound, stopSound } from '@webgamekit/audio';

const game = createGame({ score: 0, muted: false });
let audioContext: AudioContext;
let bgMusic: Sound;

const toggleMute = () => {
  game.setData('muted', !game.data.muted);
  
  if (game.data.muted) {
    stopSound(bgMusic);
  } else {
    playSound(bgMusic);
  }
};

const playSFX = (sound: Sound) => {
  if (!game.data.muted) {
    playSound(sound);
  }
};
```

### Vue 3 Integration

```vue
<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { initializeAudio, createSound, playSound, stopSound } from '@webgamekit/audio';

const audioContext = ref<AudioContext>();
const isPlaying = ref(false);
let bgMusic: Sound;

const initAudio = () => {
  if (!audioContext.value) {
    audioContext.value = initializeAudio();
    bgMusic = createSound(audioContext.value, '/audio/music.mp3', { loop: true });
  }
};

const toggleMusic = () => {
  initAudio();
  
  if (isPlaying.value) {
    stopSound(bgMusic);
  } else {
    playSound(bgMusic);
  }
  isPlaying.value = !isPlaying.value;
};

onUnmounted(() => {
  if (bgMusic) stopSound(bgMusic);
  if (audioContext.value) audioContext.value.close();
});
</script>

<template>
  <button @click="toggleMusic">
    {{ isPlaying ? '🔊 Mute' : '🔇 Unmute' }}
  </button>
</template>
```

## Browser Autoplay Policy

Modern browsers block audio autoplay. You must initialize audio after a user interaction:

```typescript
// ❌ Won't work - no user interaction
window.onload = () => {
  const ctx = initializeAudio(); // Blocked by browser
};

// ✅ Works - triggered by user click
button.onclick = () => {
  const ctx = initializeAudio(); // Allowed
};
```

### Handling Suspended Context

```typescript
const ensureAudioContext = async (audioContext: AudioContext) => {
  if (audioContext.state === 'suspended') {
    await audioContext.resume();
  }
};

// Before playing any sound
await ensureAudioContext(audioContext);
playSound(mySound);
```

## Audio File Formats

Recommended formats for web:

| Format | Browser Support | Best For |
|--------|-----------------|----------|
| MP3 | All browsers | Music, long audio |
| WAV | All browsers | Short SFX, high quality |
| OGG | Most browsers (not Safari) | Music, compressed |
| WebM | Modern browsers | Music, modern apps |

### Fallback Pattern

```typescript
const createSoundWithFallback = (context: AudioContext, basePath: string) => {
  // Try modern format first, fall back to MP3
  const formats = ['.webm', '.ogg', '.mp3'];
  
  for (const format of formats) {
    try {
      return createSound(context, basePath + format);
    } catch (e) {
      continue;
    }
  }
  
  console.warn(`Failed to load audio: ${basePath}`);
  return null;
};
```

## Best Practices

1. **Always preload sounds** for time-critical effects (SFX)
2. **Use lower sample rates** for non-critical audio to reduce file size
3. **Implement a sound manager** to centralize audio control
4. **Respect user preferences** - provide mute/volume controls
5. **Clean up on unmount** - stop sounds and close context
