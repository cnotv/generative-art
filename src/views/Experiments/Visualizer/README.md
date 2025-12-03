# Music Visualizer System

This folder contains a modular music visualizer system built with Vue.js 3, Three.js, and Web Audio API.

## 📁 File Structure

```
Visualizer/
├── README.md              # This documentation
├── index.vue             # Main visualizer component
├── audio.ts              # Audio processing module
├── visualizer.ts         # Visualizer type definitions and loader
└── visualizers/          # Individual visualizer implementations
    ├── bars.ts          # Bar spectrum visualizer
    ├── basic.ts         # Glass pipes visualizer
    ├── cubes.ts         # Moving cubes visualizer
    ├── particles.ts     # Particle system visualizer
    ├── terrain.ts       # Terrain height visualizer
    └── index.ts         # Auto-loader for visualizers
```

## 🎵 How the Audio System Works

### 1. Audio Setup (`audio.ts`)

The audio system uses the **Web Audio API** to analyze music in real-time:

```typescript
// Creates audio context and analyzer
audioContext = new AudioContext();
analyser = audioContext.createAnalyser();
analyser.fftSize = 64; // 32 frequency bins

// Connects audio element to analyzer
const source = audioContext.createMediaElementSource(audioElement);
source.connect(analyser);
analyser.connect(audioContext.destination);
```

### 2. Real-time Audio Analysis

The system extracts frequency data every frame:

- **`getAudioData()`**: Returns 32 frequency bins (0-1 normalized)
- **`getWaveformData()`**: Returns time-domain data for waveforms
- **`getFrequencyRanges()`**: Separates bass, mid, and treble frequencies
- **`getAverageVolume()`**: Returns overall volume level

### 3. Visualizer Integration

Each visualizer uses audio data to drive animations:

```typescript
// Example from any visualizer
const audioData = getAudioData();
const average = audioData.reduce((a, b) => a + b, 0) / audioData.length;

// Use audio data to scale objects
object.scale.setScalar(1 + average * 3);
```

## 🎨 Visualizer System

### Dynamic Loading

The visualizer system automatically discovers and loads visualizers:

```typescript
// visualizers/index.ts uses import.meta.glob
const visualizerModules = import.meta.glob('./*.ts', { eager: true });

// Automatically registers all .ts files as visualizers
export const getVisualizer = (name: string) => {
  return visualizers[name] || null;
};
```

### Visualizer Interface

Each visualizer must implement the `VisualizerSetup` interface:

```typescript
export interface VisualizerSetup {
  name: string;                                    // Display name
  song: number;                                   // Song index (0-based)
  setup: (scene: THREE.Scene) => Record<string, any>;    // Initialize 3D objects
  animate: (objects: Record<string, any>) => void;       // Animation loop
}
```

## 🎶 Adding New Songs

### 1. Add Audio File
Place your audio file in the `public/` folder:
```
public/
├── your-song.mp3
└── existing-songs.mp3
```

### 2. Update Songs Array
Add to the songs array in `index.vue`:
```typescript
const songs = [
  {
    src: "/your-song.mp3",
    title: "Song Title",
    artist: "Artist Name",
    link: "https://artist-link.com"
  }
];
```

### 3. Reference in Visualizers
Use the song index in your visualizer:
```typescript
export const myVisualizer: VisualizerSetup = {
  name: "My Visualizer",
  song: 1, // Index of your song in the array
  // ...
};
```

## 🆕 Creating New Visualizers

### 1. Create Visualizer File
Create a new `.ts` file in `visualizers/` folder:

```typescript
// visualizers/my-visualizer.ts
import * as THREE from "three";
import { getAudioData } from "../audio";
import type { VisualizerSetup } from "../visualizer";

export const myVisualizer: VisualizerSetup = {
  name: "My Visualizer",
  song: 0,

  setup: (scene: THREE.Scene) => {
    // Create 3D objects
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial({ color: 0xff0000 })
    );
    scene.add(mesh);
    
    return { mesh }; // Return objects for animation
  },

  animate: (objects: Record<string, any>) => {
    const { mesh } = objects;
    const audioData = getAudioData();
    const average = audioData.reduce((a, b) => a + b, 0) / audioData.length;
    
    // Animate based on audio
    mesh.scale.setScalar(1 + average * 2);
    mesh.rotation.y += 0.01;
  }
};
```

### 2. Automatic Registration
The visualizer is automatically detected and added to the dropdown menu. No manual registration needed!

## 🎯 Audio Data Usage Patterns

### Basic Volume Response
```typescript
const average = audioData.reduce((a, b) => a + b, 0) / audioData.length;
object.scale.setScalar(1 + average * multiplier);
```

### Frequency-Specific Response
```typescript
const { bass, mid, treble } = getFrequencyRanges();
bassObject.scale.y = 1 + bass * 5;
midObject.scale.y = 1 + mid * 3;
trebleObject.scale.y = 1 + treble * 2;
```

### Individual Frequency Bars
```typescript
const audioData = getAudioData();
bars.forEach((bar, index) => {
  bar.scale.y = audioData[index] * maxHeight;
});
```

## 🔧 Technical Details

### Browser Compatibility
- **Web Audio API**: Modern browsers only
- **Three.js**: WebGL required
- **Audio Formats**: MP3, WAV, OGG supported

### Performance Considerations
- **FFT Size**: Set to 64 for 32 frequency bins (good balance)
- **Update Rate**: Runs at 60fps with animation loop
- **Memory**: Audio context reused across visualizer switches

### User Interaction
- **Audio Context**: Requires user interaction to start (browser security)
- **Auto-resume**: Handles suspended audio context states
- **Cross-origin**: Audio files support CORS for external sources

## 🚀 Getting Started

1. **Run the dev server**: `pnpm run dev`
2. **Navigate to visualizer**: Go to the visualizer route
3. **Play music**: Click play on the audio controls
4. **Switch visualizers**: Use the dropdown menu
5. **Enjoy**: Watch the music come to life!

## 🎨 Current Visualizers

- **Glass Pipes**: Two facing curved glass pipes with rotating lights
- **Bars**: Classic frequency spectrum bars
- **Particles**: Audio-reactive particle system with distance-based sizing
- **Cubes**: Moving cubes that appear/disappear with music
- **Terrain**: Height-mapped terrain that moves and morphs with audio

Each visualizer responds to different aspects of the audio for unique visual experiences!
