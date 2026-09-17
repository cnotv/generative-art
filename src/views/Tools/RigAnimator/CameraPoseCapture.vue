<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, toRef, watch } from 'vue'
import {
  PoseLandmarker,
  HandLandmarker,
  DrawingUtils,
  type NormalizedLandmark
} from '@mediapipe/tasks-vision'
import {
  Camera as CameraIcon,
  Link as LinkIcon,
  Pause,
  Play,
  Unlink as UnlinkIcon,
  Upload,
  X as CloseIcon
} from 'lucide-vue-next'
import Button from '@/components/ui/button/Button.vue'
import IconButton from '@/components/IconButton.vue'
import { useCameraPoseCapture } from './useCameraPoseCapture'
import { useCameraPhotoPose } from './useCameraPhotoPose'
import { useVideoPoseCapture } from './useVideoPoseCapture'
import { useVideoTimelineSync } from './useVideoTimelineSync'
import { hasCameraPoseContent } from './cameraPoseFrame'
import {
  CAMERA_LANDMARK_VISIBILITY_THRESHOLD,
  CAMERA_PANEL_WIDTH_VW,
  MEDIA_FILE_ACCEPT,
  RECORDING_SAMPLES_PER_FRAME
} from './config'
import type { CameraDetectionOptions, CameraPoseFrame, CameraSmoothingSettings } from './types'

const props = defineProps<{
  /** The Config panel's smoothing sliders for the live feed. */
  smoothingSettings: CameraSmoothingSettings
  /** The Config panel's detection switches, each rule on or off. */
  detectionOptions: CameraDetectionOptions
  /** Whether the mirrored camera preview is actually visible, versus detecting headlessly. */
  showPreview: boolean
  /** Whether the parent is currently sampling the live feed onto the rig timeline as
   * keyframes; only meaningful in camera mode, see `useRigMotionRecording`. */
  isRecording: boolean
  /** The rig timeline's current frame, for keeping an uploaded video's playback in sync with
   * it while `syncEnabled` is on. */
  frame: number
  /** How many times slower an uploaded video plays, and how many poses a take samples per frame of it. */
  videoSlowdownRatio: number
  /** The rig's frame rate, to convert between the timeline's frame numbers and the video
   * element's `currentTime` seconds. */
  fps: number
  /** Which body-part groups (see `bodyPartGroups.ts`), by display label, the Config panel's
   * "Merge Target" checkboxes currently scope this capture to; shown so it's clear before
   * applying rather than only inferable from the panel. */
  targetGroupLabels: string[]
}>()

const emit = defineEmits<{
  apply: [frame: CameraPoseFrame]
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
const detectionOptions = toRef(props, 'detectionOptions')
const smoothingSettings = toRef(props, 'smoothingSettings')
const camera = useCameraPoseCapture(smoothingSettings, detectionOptions)
const photo = useCameraPhotoPose(detectionOptions)
const uploadedVideo = useVideoPoseCapture(
  smoothingSettings,
  detectionOptions,
  computed(() => 1 / props.videoSlowdownRatio)
)
const mode = ref<'camera' | 'photo' | 'video'>('camera')

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
const detectedFrame = computed(() =>
  pickByMode(camera.frame.value, uploadedVideo.frame.value, photo.frame.value)
)
/** Mirrors the video element's own play and pause events, so the Play/Pause icon matches it
 * however playback changed: this button, the native controls or the clip reaching its end. */
const isVideoPlaying = ref(false)

/** Whether the current source found anything to apply: a body, a hand or a face. */
const hasDetection = computed(
  () => detectedFrame.value !== null && hasCameraPoseContent(detectedFrame.value)
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
// mapping matches, rather than only a snapshot of it. A frame with only a hand or only a face
// applies too: a close-up of one hand still curls the rig's fingers.
watch(detectedFrame, (detected) => {
  if (detected && hasCameraPoseContent(detected)) emit('apply', detected)
})

/** An uploaded photo or video is the whole reason to look at this panel right then, so its
 * preview always comes on regardless of whatever the Config panel's checkbox was last left at
 * — leaving it off would run detection against the upload with nothing on screen to show for
 * it. A video plays at its own rate and samples live the exact same way the camera does,
 * useful for testing against a known performance; a photo applies once. A video does not start
 * Record Motion on its own: it can be played and paused to watch the mapping first, and the
 * record icon starts a take whenever it is wanted. */
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
  } else {
    uploadedVideo.stop()
    mode.value = 'photo'
    photo.detectPhoto(file)
  }
  emit('enablePreview')
}

/** Whether the live camera is tracking right now, rather than idle or showing an upload. */
const isCameraActive = computed(() => mode.value === 'camera' && camera.isActive.value)

/** Whether there is a continuous source running to record from: the live camera or a video. */
const canRecord = computed(() =>
  mode.value === 'video' ? uploadedVideo.isActive.value : isCameraActive.value
)

/**
 * The camera icon: start tracking the live camera, switching away from an uploaded photo or video,
 * or stop it when it is already tracking. Opening the panel never starts it on its own.
 */
const toggleCamera = (): void => {
  // A take runs on its source's own clock; carried over to another one it would jump.
  if (props.isRecording) emit('toggleRecord')
  if (isCameraActive.value) {
    camera.stop()
    return
  }
  photo.reset()
  uploadedVideo.stop()
  mode.value = 'camera'
  camera.start()
}

/** Starting a take on a paused video plays it too, since a take on a frame that never changes
 * would record nothing. Stopping one leaves playback as it is. */
const handleRecordClick = (): void => {
  if (mode.value === 'video' && !props.isRecording && !isVideoPlaying.value) {
    uploadedVideo.togglePlayback()
  }
  emit('toggleRecord')
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

watch(
  () => props.videoSlowdownRatio,
  () => {
    if (mode.value === 'video') uploadedVideo.applyPlaybackRate()
  }
)

/** The clock Record Motion reads, in milliseconds: an uploaded video's own playback position, so a
 * slowed video still records at its real speed, and wall time for the live camera. */
const captureClockMilliseconds = (): number =>
  mode.value === 'video' && videoReference.value
    ? videoReference.value.currentTime * 1000
    : performance.now()

/** How many poses Record Motion samples per frame: as many as the video is slowed down, since that
 * is how many readings detection gets of each of its frames, and a fixed rate for the camera. */
const captureSamplesPerFrame = (): number =>
  mode.value === 'video' ? props.videoSlowdownRatio : RECORDING_SAMPLES_PER_FRAME

defineExpose({
  captureClockMilliseconds,
  captureSamplesPerFrame,
  toggleCamera,
  toggleRecord: handleRecordClick,
  isCameraActive,
  canRecord
})

onMounted(() => {
  camera.videoElement.value = videoReference.value
  uploadedVideo.videoElement.value = videoReference.value
})

onUnmounted(() => {
  camera.stop()
  uploadedVideo.stop()
})
</script>

<template>
  <div class="camera-pose-capture" :style="{ width: `${CAMERA_PANEL_WIDTH_VW}vw` }">
    <IconButton
      size="sm"
      variant="ghost"
      title="Close Rig Panel"
      class="camera-pose-capture__close"
      @click="emit('close')"
    >
      <CloseIcon />
    </IconButton>
    <div
      class="camera-pose-capture__preview"
      :class="{
        'camera-pose-capture__preview--mirrored':
          mode === 'camera' && detectionOptions.mirrorLiveCamera,
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
        @play="isVideoPlaying = true"
        @pause="isVideoPlaying = false"
        @emptied="isVideoPlaying = false"
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
    <p v-else-if="mode === 'camera' && !camera.isActive.value" class="camera-pose-capture__status">
      Start the camera, or upload a photo or video, to pose the model.
    </p>
    <p
      v-else-if="mode === 'camera' && camera.isActive.value && !hasDetection"
      class="camera-pose-capture__status"
    >
      No person detected yet. Step into frame.
    </p>
    <p
      v-else-if="
        mode === 'video' && uploadedVideo.isActive.value && !uploadedVideo.isDetecting.value
      "
      class="camera-pose-capture__status"
    >
      Detection paused. Play the video to keep posing the model.
    </p>
    <p
      v-else-if="mode === 'video' && uploadedVideo.isActive.value && !hasDetection"
      class="camera-pose-capture__status"
    >
      No person detected in this video.
    </p>
    <p
      v-else-if="mode === 'photo' && photo.photoImage.value && !hasDetection"
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
      <IconButton
        size="sm"
        variant="outline"
        title="Upload Photo/Video"
        @click="fileInputReference?.click()"
      >
        <Upload />
      </IconButton>
      <IconButton
        size="sm"
        variant="outline"
        :active="isCameraActive"
        :title="isCameraActive ? 'Stop Camera' : 'Start Camera'"
        @click="toggleCamera"
      >
        <CameraIcon />
      </IconButton>
      <IconButton
        v-if="mode === 'video'"
        size="sm"
        variant="outline"
        :title="isVideoPlaying ? 'Pause Video' : 'Play Video'"
        @click="uploadedVideo.togglePlayback()"
      >
        <Pause v-if="isVideoPlaying" />
        <Play v-else />
      </IconButton>
      <IconButton
        v-if="mode === 'video'"
        size="sm"
        variant="outline"
        :active="syncEnabled"
        :title="syncEnabled ? 'Unsync Timeline from Video' : 'Sync Timeline to Video'"
        @click="syncEnabled = !syncEnabled"
      >
        <LinkIcon v-if="syncEnabled" />
        <UnlinkIcon v-else />
      </IconButton>
    </div>
    <slot />
  </div>
</template>

<style scoped>
.camera-pose-capture {
  position: fixed;
  top: 0;
  right: 0;

  /* The panel also holds every setting; it scrolls rather than running under the rig timeline. */
  max-height: calc(100vh - var(--rig-timeline-height));
  overflow-y: auto;
  z-index: var(--z-overlay);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-3);
  padding: var(--spacing-3) var(--spacing-4) var(--spacing-4);
  background: var(--color-background);
  border-bottom: 1px solid var(--color-border);
  border-left: 1px solid var(--color-border);
}

.camera-pose-capture__close {
  align-self: flex-end;
}

.camera-pose-capture__preview {
  position: relative;
  width: 100%;

  /* A typical webcam frame rather than the full height of the screen; the video and overlay
     letterbox anything shaped differently through their own object-fit. */
  aspect-ratio: 4 / 3;
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

.camera-pose-capture__overlay {
  /* The skeleton is drawn over the whole video, so without this it swallows every click meant for
     the video's own controls: play, pause, seeking and playback speed. */
  pointer-events: none;
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

.camera-pose-capture__hidden-input {
  display: none;
}
</style>
