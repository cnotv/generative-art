<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { PoseLandmarker, DrawingUtils } from '@mediapipe/tasks-vision'
import Button from '@/components/ui/button/Button.vue'
import { useCameraPoseCapture } from './useCameraPoseCapture'
import type { CameraLandmark } from './cameraPoseMapping'

const emit = defineEmits<{
  capture: [landmarks: CameraLandmark[]]
  close: []
}>()

const videoReference = ref<HTMLVideoElement | null>(null)
const canvasReference = ref<HTMLCanvasElement | null>(null)
const capture = useCameraPoseCapture()

let drawingUtilities: DrawingUtils | null = null

/** Redraws the skeleton overlay from the latest preview landmarks, sized to the video's own resolution. */
const drawOverlay = (): void => {
  const canvas = canvasReference.value
  const video = videoReference.value
  const context = canvas?.getContext('2d')
  if (!canvas || !video || !context) return
  if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
  }
  context.clearRect(0, 0, canvas.width, canvas.height)
  if (!capture.previewLandmarks.value) return
  drawingUtilities ??= new DrawingUtils(context)
  drawingUtilities.drawConnectors(capture.previewLandmarks.value, PoseLandmarker.POSE_CONNECTIONS, {
    color: '#f0a8a0',
    lineWidth: 2
  })
  drawingUtilities.drawLandmarks(capture.previewLandmarks.value, { color: '#b8c4f0', radius: 3 })
}

watch(capture.previewLandmarks, drawOverlay)

const handleCapture = (): void => {
  if (capture.worldLandmarks.value) emit('capture', capture.worldLandmarks.value)
}

onMounted(async () => {
  capture.videoElement.value = videoReference.value
  await capture.start()
})

onUnmounted(() => capture.stop())
</script>

<template>
  <div class="camera-pose-capture">
    <div class="camera-pose-capture__card">
      <div class="camera-pose-capture__preview">
        <video ref="videoReference" class="camera-pose-capture__video" muted playsinline></video>
        <canvas ref="canvasReference" class="camera-pose-capture__overlay"></canvas>
      </div>
      <p v-if="capture.isLoading.value" class="camera-pose-capture__status">Starting camera…</p>
      <p
        v-else-if="capture.error.value"
        class="camera-pose-capture__status camera-pose-capture__status--error"
      >
        {{ capture.error.value }}
      </p>
      <p
        v-else-if="capture.isActive.value && !capture.worldLandmarks.value"
        class="camera-pose-capture__status"
      >
        No person detected yet. Step into frame.
      </p>
      <div class="camera-pose-capture__actions">
        <Button
          size="sm"
          variant="secondary"
          :disabled="!capture.worldLandmarks.value"
          @click="handleCapture"
        >
          Capture Pose
        </Button>
        <Button size="sm" variant="secondary" @click="emit('close')">Cancel</Button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.camera-pose-capture {
  position: fixed;
  inset: 0;
  z-index: calc(var(--z-overlay) + 2);
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgb(0 0 0 / 70%);
  backdrop-filter: blur(4px);
}

.camera-pose-capture__card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-4);
  padding: var(--spacing-6);
  border-radius: var(--radius-lg);
  background: var(--color-background);
  border: 1px solid var(--color-border);
}

.camera-pose-capture__preview {
  position: relative;
  width: 480px;
  max-width: 80vw;
  aspect-ratio: 4 / 3;
  border-radius: var(--radius-md);
  overflow: hidden;
  background: #000;

  /* A webcam feed reads as a mirror, matching how the person sees themselves. */
  transform: scaleX(-1);
}

.camera-pose-capture__video,
.camera-pose-capture__overlay {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.camera-pose-capture__status {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-muted-foreground);
  text-align: center;
}

.camera-pose-capture__status--error {
  color: var(--color-destructive);
}

.camera-pose-capture__actions {
  display: flex;
  gap: var(--spacing-2);
}
</style>
