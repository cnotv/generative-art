<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, toRef, watch } from 'vue'
import {
  PoseLandmarker,
  HandLandmarker,
  DrawingUtils,
  type NormalizedLandmark
} from '@mediapipe/tasks-vision'
import { Circle, Square } from 'lucide-vue-next'
import type { HandSide, HandPoseDefinition } from '@webgamekit/rig'
import Button from '@/components/ui/button/Button.vue'
import Switch from '@/components/ui/switch/Switch.vue'
import { useCameraPoseCapture } from './useCameraPoseCapture'
import { useCameraPhotoPose } from './useCameraPhotoPose'
import { useVideoPoseCapture } from './useVideoPoseCapture'
import { useVideoTimelineSync } from './useVideoTimelineSync'
import { CAMERA_LANDMARK_VISIBILITY_THRESHOLD, type CameraLandmark } from './cameraPoseMapping'
import { CAMERA_PANEL_WIDTH_VW, MEDIA_FILE_ACCEPT } from './config'

const props = defineProps<{
  /** Fraction of each new live-feed frame blended in; tuned from the Config panel. */
  smoothingFactor: number
  /** Furthest a landmark may move in one frame before the excess is clamped off as a sudden
   * jump; tuned from the Config panel. */
  maxJump: number
  /** Whether the mirrored camera preview is actually visible, versus detecting headlessly. */
  showPreview: boolean
  /** Whether the parent is currently sampling the live feed onto the rig timeline as
   * keyframes; only meaningful in camera mode, see `useRigMotionRecording`. */
  isRecording: boolean
  /** The rig timeline's current frame, for keeping an uploaded video's playback in sync with
   * it while `syncEnabled` is on. */
  frame: number
  /** The rig's frame rate, to convert between the timeline's frame numbers and the video
   * element's `currentTime` seconds. */
  fps: number
  /** Which body-part groups (see `bodyPartGroups.ts`), by display label, the Config panel's
   * "Merge Target" checkboxes currently scope this capture to; shown so it's clear before
   * applying rather than only inferable from the panel. */
  targetGroupLabels: string[]
}>()

const emit = defineEmits<{
  apply: [landmarks: CameraLandmark[], handPoses: Partial<Record<HandSide, HandPoseDefinition>>]
  close: []
  toggleRecord: []
  enablePreview: []
  /** The uploaded video was scrubbed via its own native controls; move the rig timeline's
   * playhead to match. */
  seekFrame: [frame: number]
}>()

const videoReference = ref<HTMLVideoElement | null>(null)
const canvasReference = ref<HTMLCanvasElement | null>(null)
const fileInputReference = ref<HTMLInputElement | null>(null)
const camera = useCameraPoseCapture(toRef(props, 'smoothingFactor'), toRef(props, 'maxJump'))
const photo = useCameraPhotoPose()
const uploadedVideo = useVideoPoseCapture(toRef(props, 'smoothingFactor'), toRef(props, 'maxJump'))
const mode = ref<'camera' | 'photo' | 'video'>('camera')
/** Whether the current mode drives the rig from a continuously updating source, the same as a
 * live webcam feed does, versus a single still photo. Both camera and an uploaded video can
 * be recorded from; a still photo cannot. */
const isContinuousMode = computed(() => mode.value === 'camera' || mode.value === 'video')

/** Picks the field from whichever source is active in the current mode. */
const pickByMode = <T,>(cameraValue: T, videoValue: T, photoValue: T): T => {
  if (mode.value === 'camera') return cameraValue
  if (mode.value === 'video') return videoValue
  return photoValue
}

const isLoading = computed(() =>
  pickByMode(camera.isLoading.value, uploadedVideo.isLoading.value, photo.isLoading.value)
)
const error = computed(() =>
  pickByMode(camera.error.value, uploadedVideo.error.value, photo.error.value)
)
const previewLandmarks = computed(() =>
  pickByMode(
    camera.previewLandmarks.value,
    uploadedVideo.previewLandmarks.value,
    photo.previewLandmarks.value
  )
)
const previewHandLandmarks = computed(() =>
  pickByMode(
    camera.previewHandLandmarks.value,
    uploadedVideo.previewHandLandmarks.value,
    photo.previewHandLandmarks.value
  )
)
const worldLandmarks = computed(() =>
  pickByMode(
    camera.worldLandmarks.value,
    uploadedVideo.worldLandmarks.value,
    photo.worldLandmarks.value
  )
)
const handPoses = computed(() =>
  pickByMode(camera.handPoses.value, uploadedVideo.handPoses.value, photo.handPoses.value)
)

let drawingUtilities: DrawingUtils | null = null

/** Redraws the preview: the photo (in photo mode) or nothing behind the live/uploaded video,
 * then the skeleton overlay on top, for whichever landmarks a detection actually found
 * confidently. */
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
    // Camera and an uploaded video are both a literal <video> element already showing its own
    // frames; the canvas only ever needs to carry the skeleton overlay on top of it.
    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
    }
    context.clearRect(0, 0, canvas.width, canvas.height)
  }

  drawingUtilities ??= new DrawingUtils(context)

  if (previewLandmarks.value) {
    // A landmark MediaPipe isn't actually confident about (typically off frame, like the hips
    // when a webcam is framed for arms and head) still gets a guessed position; drawing it would
    // show a confident-looking line to something that isn't really there. drawConnectors reads a
    // connection's two endpoints by their original array index and already skips a missing one,
    // so a hole is safe there; drawLandmarks just iterates whatever it is given with no such
    // guard, so it needs the holes actually removed rather than left as `undefined` entries.
    const landmarksByIndex = previewLandmarks.value.map((landmark) =>
      landmark.visibility >= CAMERA_LANDMARK_VISIBILITY_THRESHOLD ? landmark : undefined
    ) as NormalizedLandmark[]
    const visibleLandmarksOnly = landmarksByIndex.filter(
      (landmark): landmark is NormalizedLandmark => landmark !== undefined
    )
    drawingUtilities.drawConnectors(landmarksByIndex, PoseLandmarker.POSE_CONNECTIONS, {
      color: '#f0a8a0',
      lineWidth: 2
    })
    drawingUtilities.drawLandmarks(visibleLandmarksOnly, { color: '#b8c4f0', radius: 3 })
  }

  // Every one of a detected hand's 21 landmarks is always present with no per-point confidence
  // (unlike the body pose above), so there is never a hole to filter out here.
  previewHandLandmarks.value?.forEach((landmarksForHand) => {
    drawingUtilities?.drawConnectors(landmarksForHand, HandLandmarker.HAND_CONNECTIONS, {
      color: '#e8c874',
      lineWidth: 2
    })
    drawingUtilities?.drawLandmarks(landmarksForHand, { color: '#a8d8c8', radius: 2 })
  })
}

watch([previewLandmarks, previewHandLandmarks, () => photo.photoImage.value], drawOverlay)

// Applies live: every newly detected frame (continuous for the camera, once for a photo) goes
// straight to the rig, so the model mirrors the source in real time instead of waiting for a
// separate capture click. This is what makes the side-by-side comparison actually prove the
// mapping matches, rather than only a snapshot of it. Hand poses ride along on the same emit,
// since both detections finish within the same detectFrame/detectPhoto call.
watch(worldLandmarks, (landmarks) => {
  if (landmarks) emit('apply', landmarks, handPoses.value)
})

/** An uploaded photo or video is the whole reason to look at this panel right then, so its
 * preview always comes on regardless of whatever the Config panel's checkbox was last left at
 * — leaving it off would run detection against the upload with nothing on screen to show for
 * it. A video plays at its own rate and samples live the exact same way the camera does,
 * useful for testing against a known performance; a photo applies once. Uploading a video
 * also starts Record Motion automatically, since scrubbing back through the timeline to redo
 * a manual start is exactly the friction this dialog exists to avoid. */
const handleMediaChange = async (event: Event): Promise<void> => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  if (props.isRecording) emit('toggleRecord')
  camera.stop()
  if (file.type.startsWith('video/')) {
    mode.value = 'video'
    await uploadedVideo.loadVideo(file)
    if (uploadedVideo.isActive.value) emit('toggleRecord')
  } else {
    uploadedVideo.stop()
    mode.value = 'photo'
    photo.detectPhoto(file)
  }
  emit('enablePreview')
}

const handleUseCamera = (): void => {
  photo.reset()
  uploadedVideo.stop()
  mode.value = 'camera'
  camera.start()
}

/** The uploaded video reached its natural end: stop recording the same as a manual click
 * would, rather than leaving the take open with nothing left to sample. A live camera feed's
 * `srcObject` stream never fires this, so the handler only ever does anything in video mode. */
const handleVideoEnded = (): void => {
  if (mode.value === 'video' && props.isRecording) emit('toggleRecord')
}

const { syncEnabled, handleVideoSeeked: resolveSeekedFrame } = useVideoTimelineSync({
  videoElement: videoReference,
  frame: () => props.frame,
  fps: () => props.fps,
  isVideoMode: () => mode.value === 'video',
  isRecording: () => props.isRecording
})

const handleVideoSeeked = (): void => {
  const seekedFrame = resolveSeekedFrame()
  if (seekedFrame !== null) emit('seekFrame', seekedFrame)
}

onMounted(async () => {
  camera.videoElement.value = videoReference.value
  uploadedVideo.videoElement.value = videoReference.value
  await camera.start()
})

onUnmounted(() => {
  camera.stop()
  uploadedVideo.stop()
})
</script>

<template>
  <div
    class="camera-pose-capture"
    :style="{ width: showPreview ? `${CAMERA_PANEL_WIDTH_VW}vw` : 'auto' }"
  >
    <div
      class="camera-pose-capture__preview"
      :class="{
        'camera-pose-capture__preview--mirrored': mode === 'camera',
        'camera-pose-capture__preview--hidden': !showPreview
      }"
    >
      <video
        v-show="mode === 'camera' || mode === 'video'"
        ref="videoReference"
        class="camera-pose-capture__video"
        muted
        playsinline
        :controls="mode === 'video'"
        @ended="handleVideoEnded"
        @seeked="handleVideoSeeked"
      ></video>
      <canvas ref="canvasReference" class="camera-pose-capture__overlay"></canvas>
    </div>
    <p class="camera-pose-capture__status camera-pose-capture__status--scope">
      {{
        targetGroupLabels.length > 0
          ? `Posing: ${targetGroupLabels.join(', ')}`
          : 'No merge target selected — nothing will be posed.'
      }}
    </p>
    <p v-if="isLoading" class="camera-pose-capture__status">
      {{ pickByMode('Starting camera…', 'Reading video…', 'Reading photo…') }}
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
      v-else-if="mode === 'video' && uploadedVideo.isActive.value && !worldLandmarks"
      class="camera-pose-capture__status"
    >
      No person detected in this video.
    </p>
    <p
      v-else-if="mode === 'photo' && photo.photoImage.value && !worldLandmarks"
      class="camera-pose-capture__status"
    >
      No person detected in this photo.
    </p>
    <p v-else-if="isRecording" class="camera-pose-capture__status">
      Recording motion onto the timeline…
    </p>
    <p v-else class="camera-pose-capture__status">Applying live to the model.</p>
    <input
      ref="fileInputReference"
      type="file"
      :accept="MEDIA_FILE_ACCEPT"
      class="camera-pose-capture__hidden-input"
      @change="handleMediaChange"
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
      <Button size="sm" variant="secondary" @click="fileInputReference?.click()">
        Upload Photo/Video
      </Button>
      <Button
        v-if="mode === 'photo' || mode === 'video'"
        size="sm"
        variant="secondary"
        @click="handleUseCamera"
      >
        Use Camera
      </Button>
      <label v-if="mode === 'video'" class="camera-pose-capture__sync-toggle">
        <Switch v-model="syncEnabled" />
        Sync timeline to video
      </label>
      <Button
        v-if="isContinuousMode"
        size="lg"
        variant="ghost"
        class="camera-pose-capture__record-toggle"
        :class="{ 'camera-pose-capture__record-toggle--active': isRecording }"
        @click="emit('toggleRecord')"
      >
        <Square v-if="isRecording" class="camera-pose-capture__record-icon" />
        <Circle v-else class="camera-pose-capture__record-icon" />
        {{ isRecording ? 'Stop Recording' : 'Record Motion' }}
      </Button>
      <Button size="sm" variant="secondary" @click="emit('close')">Close</Button>
    </div>
  </div>
</template>

<style scoped>
.camera-pose-capture {
  position: fixed;
  top: 0;
  right: 0;

  /* Stops above the rig timeline bar, which docks along the same bottom edge with a higher
     z-index: without this, the timeline bar covers this panel's own action buttons. */
  bottom: var(--rig-timeline-height);
  z-index: var(--z-overlay);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-4);
  padding: var(--spacing-6);
  background: var(--color-background);
  border-left: 1px solid var(--color-border);
}

.camera-pose-capture__preview {
  position: relative;
  flex: 1;
  min-height: 0;
  width: 100%;
  border-radius: var(--radius-md);
  overflow: hidden;
  background: #000;
}

.camera-pose-capture__preview--mirrored {
  /* A live webcam feed reads as a mirror, matching how the person sees themselves. A static
     photo is left as it is, since it isn't a self-view. */
  transform: scaleX(-1);
}

.camera-pose-capture__preview--hidden {
  /* Opacity, not display or v-if: the <video> element has to stay in the DOM and playing for
     detection to keep reading frames from it, only what the person sees needs to disappear.
     Fixed positioning takes it out of this panel's own flex flow entirely, so the panel itself
     shrinks down to just its status text and action buttons instead of keeping a black box
     reserved on screen with nothing to show in it. */
  position: fixed;
  top: 0;
  left: 0;
  width: 2px;
  height: 2px;
  opacity: 0;
  pointer-events: none;
}

.camera-pose-capture__video,
.camera-pose-capture__overlay {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
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

.camera-pose-capture__status--scope {
  font-style: italic;
}

.camera-pose-capture__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--spacing-2);
}

/* Ghost variant carries no background of its own; the red colour is what makes the toggle
   read as a record control at a glance instead of blending into the row. */
.camera-pose-capture__record-toggle {
  color: var(--color-destructive);
}

.camera-pose-capture__record-toggle--active {
  font-weight: 700;
}

.camera-pose-capture__record-icon {
  width: var(--spacing-5);
  height: var(--spacing-5);
  margin-right: var(--spacing-2);
}

.camera-pose-capture__sync-toggle {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  font-size: var(--font-size-sm);
  color: var(--color-muted-foreground);
  cursor: pointer;
}

.camera-pose-capture__hidden-input {
  display: none;
}
</style>
