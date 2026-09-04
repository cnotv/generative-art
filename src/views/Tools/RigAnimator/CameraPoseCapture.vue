<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { PoseLandmarker, DrawingUtils, type NormalizedLandmark } from '@mediapipe/tasks-vision'
import Button from '@/components/ui/button/Button.vue'
import { useCameraPoseCapture } from './useCameraPoseCapture'
import { useCameraPhotoPose } from './useCameraPhotoPose'
import { CAMERA_LANDMARK_VISIBILITY_THRESHOLD, type CameraLandmark } from './cameraPoseMapping'

const emit = defineEmits<{
  capture: [landmarks: CameraLandmark[]]
  close: []
}>()

const videoReference = ref<HTMLVideoElement | null>(null)
const canvasReference = ref<HTMLCanvasElement | null>(null)
const fileInputReference = ref<HTMLInputElement | null>(null)
const camera = useCameraPoseCapture()
const photo = useCameraPhotoPose()
const mode = ref<'camera' | 'photo'>('camera')

const isLoading = computed(() =>
  mode.value === 'camera' ? camera.isLoading.value : photo.isLoading.value
)
const error = computed(() => (mode.value === 'camera' ? camera.error.value : photo.error.value))
const previewLandmarks = computed(() =>
  mode.value === 'camera' ? camera.previewLandmarks.value : photo.previewLandmarks.value
)
const worldLandmarks = computed(() =>
  mode.value === 'camera' ? camera.worldLandmarks.value : photo.worldLandmarks.value
)

let drawingUtilities: DrawingUtils | null = null

/** Redraws the preview: the photo (in photo mode) or nothing behind the live video, then the
 * skeleton overlay on top, for whichever landmarks a detection actually found confidently. */
const drawOverlay = (): void => {
  const canvas = canvasReference.value
  const video = videoReference.value
  const context = canvas?.getContext('2d')
  if (!canvas || !video || !context) return

  if (mode.value === 'photo' && photo.photoImage.value) {
    canvas.width = photo.photoImage.value.width
    canvas.height = photo.photoImage.value.height
    context.drawImage(photo.photoImage.value, 0, 0)
  } else {
    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
    }
    context.clearRect(0, 0, canvas.width, canvas.height)
  }

  if (!previewLandmarks.value) return
  // A landmark MediaPipe isn't actually confident about (typically off frame, like the hips
  // when a webcam is framed for arms and head) still gets a guessed position; drawing it would
  // show a confident-looking line to something that isn't really there. drawConnectors/
  // drawLandmarks both skip a hole in the array, so leaving one out is safe at runtime even
  // though the type only says NormalizedLandmark.
  const visibleLandmarks = previewLandmarks.value.map((landmark) =>
    landmark.visibility >= CAMERA_LANDMARK_VISIBILITY_THRESHOLD ? landmark : undefined
  ) as NormalizedLandmark[]
  drawingUtilities ??= new DrawingUtils(context)
  drawingUtilities.drawConnectors(visibleLandmarks, PoseLandmarker.POSE_CONNECTIONS, {
    color: '#f0a8a0',
    lineWidth: 2
  })
  drawingUtilities.drawLandmarks(visibleLandmarks, { color: '#b8c4f0', radius: 3 })
}

watch([previewLandmarks, () => photo.photoImage.value], drawOverlay)

const handleCapture = (): void => {
  if (worldLandmarks.value) emit('capture', worldLandmarks.value)
}

const handlePhotoChange = (event: Event): void => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  camera.stop()
  mode.value = 'photo'
  photo.detectPhoto(file)
}

const handleUseCamera = (): void => {
  photo.reset()
  mode.value = 'camera'
  camera.start()
}

onMounted(async () => {
  camera.videoElement.value = videoReference.value
  await camera.start()
})

onUnmounted(() => camera.stop())
</script>

<template>
  <div class="camera-pose-capture">
    <div class="camera-pose-capture__card">
      <div
        class="camera-pose-capture__preview"
        :class="{ 'camera-pose-capture__preview--mirrored': mode === 'camera' }"
      >
        <video
          v-show="mode === 'camera'"
          ref="videoReference"
          class="camera-pose-capture__video"
          muted
          playsinline
        ></video>
        <canvas ref="canvasReference" class="camera-pose-capture__overlay"></canvas>
      </div>
      <p v-if="isLoading" class="camera-pose-capture__status">
        {{ mode === 'camera' ? 'Starting camera…' : 'Reading photo…' }}
      </p>
      <p v-else-if="error" class="camera-pose-capture__status camera-pose-capture__status--error">
        {{ error }}
      </p>
      <p
        v-else-if="mode === 'camera' && camera.isActive.value && !worldLandmarks"
        class="camera-pose-capture__status"
      >
        No person detected yet. Step into frame.
      </p>
      <p
        v-else-if="mode === 'photo' && photo.photoImage.value && !worldLandmarks"
        class="camera-pose-capture__status"
      >
        No person detected in this photo.
      </p>
      <input
        ref="fileInputReference"
        type="file"
        accept="image/*"
        class="camera-pose-capture__hidden-input"
        @change="handlePhotoChange"
      />
      <div class="camera-pose-capture__actions">
        <Button
          v-if="error"
          size="sm"
          variant="secondary"
          @click="mode === 'camera' ? camera.start() : fileInputReference?.click()"
        >
          Try Again
        </Button>
        <Button
          v-else
          size="sm"
          variant="secondary"
          :disabled="!worldLandmarks"
          @click="handleCapture"
        >
          Capture Pose
        </Button>
        <Button
          v-if="mode === 'camera'"
          size="sm"
          variant="secondary"
          @click="fileInputReference?.click()"
        >
          Upload Photo
        </Button>
        <Button v-else size="sm" variant="secondary" @click="handleUseCamera">Use Camera</Button>
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
  height: 92vh;
  padding: var(--spacing-6);
  border-radius: var(--radius-lg);
  background: var(--color-background);
  border: 1px solid var(--color-border);
}

.camera-pose-capture__preview {
  position: relative;
  flex: 1;
  min-height: 0;
  width: auto;
  max-width: 90vw;
  aspect-ratio: 3 / 4;
  border-radius: var(--radius-md);
  overflow: hidden;
  background: #000;
}

.camera-pose-capture__preview--mirrored {
  /* A live webcam feed reads as a mirror, matching how the person sees themselves. A static
     photo is left as it is, since it isn't a self-view. */
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
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--spacing-2);
}

.camera-pose-capture__hidden-input {
  display: none;
}
</style>
