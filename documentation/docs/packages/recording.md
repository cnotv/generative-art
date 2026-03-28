---
sidebar_position: 6
---

# Package: @webgamekit/recording

Canvas video recording utilities using the MediaRecorder API.

## Installation

```bash
pnpm add @webgamekit/recording
```

## Basic Usage

```typescript
import { recordCreate } from '@webgamekit/recording';

const recorder = recordCreate({
  canvas: canvasElement,
  duration: 10,      // auto-stop after 10 seconds (optional)
  format: 'webm',    // 'webm' | 'mp4' (default: 'webm')
  frameRate: 30,     // default: 30
});

// Start recording
recorder.recordStart();

// Stop and get the blob
const blob = await recorder.recordStop();
const url = URL.createObjectURL(blob);
```

## API Reference

### recordCreate(config)

Create a recorder instance bound to a canvas element.

**Parameters:**

```typescript
interface RecorderConfig {
  canvas: HTMLCanvasElement;
  duration?: number;         // Auto-stop after N seconds
  format?: RecorderFormat;   // 'webm' | 'mp4' (default: 'webm')
  frameRate?: number;        // Frames per second (default: 30)
}
```

**Returns:** `Recorder`

### Recorder

```typescript
interface Recorder {
  recordStart: () => void;
  recordStop: () => Promise<Blob>;
  recordGetState: () => RecorderState;
  recordOnStateChange: (callback: StateChangeCallback) => () => void;  // Returns unsubscribe fn
  recordDestroy: () => void;
}
```

### RecorderState

```typescript
interface RecorderState {
  isRecording: boolean;
  elapsed: number;   // Seconds elapsed since start
  blob: Blob | null; // Available after recording stops
}
```

## Vue 3 Integration

```vue
<script setup lang="ts">
import { ref, onUnmounted } from 'vue';
import { recordCreate, type Recorder, type RecorderState } from '@webgamekit/recording';

const canvasRef = ref<HTMLCanvasElement | null>(null);
const recorderState = ref<RecorderState>();
let recorder: Recorder | null = null;

const startRecording = () => {
  if (!canvasRef.value) return;

  recorder = recordCreate({
    canvas: canvasRef.value,
    format: 'webm',
    frameRate: 30,
  });

  recorder.recordOnStateChange((state) => {
    recorderState.value = state;
  });

  recorder.recordStart();
};

const stopRecording = async () => {
  if (!recorder) return;
  const blob = await recorder.recordStop();

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'recording.webm';
  link.click();
  URL.revokeObjectURL(url);
};

onUnmounted(() => {
  recorder?.recordDestroy();
});
</script>

<template>
  <canvas ref="canvasRef" />
  <button v-if="!recorderState?.isRecording" @click="startRecording">Record</button>
  <button v-else @click="stopRecording">Stop ({{ recorderState?.elapsed }}s)</button>
</template>
```

## Auto-Stop Recording

```typescript
const recorder = recordCreate({
  canvas,
  duration: 5,  // Automatically stops after 5 seconds
});

recorder.recordStart();

// Blob is available on state change after auto-stop
recorder.recordOnStateChange((state) => {
  if (!state.isRecording && state.blob) {
    downloadBlob(state.blob);
  }
});
```

## State Change Subscriptions

```typescript
const recorder = recordCreate({ canvas });

// Subscribe to state changes — returns an unsubscribe function
const unsubscribe = recorder.recordOnStateChange((state) => {
  console.log('isRecording:', state.isRecording);
  console.log('elapsed:', state.elapsed);
  if (state.blob) {
    console.log('Recording ready:', state.blob.size, 'bytes');
  }
});

// Unsubscribe when done
unsubscribe();
```

## Types

```typescript
import type {
  RecorderConfig,
  RecorderState,
  RecorderFormat,
  StateChangeCallback,
  Recorder,
} from '@webgamekit/recording';

type RecorderFormat = 'webm' | 'mp4';
type StateChangeCallback = (state: RecorderState) => void;
```
