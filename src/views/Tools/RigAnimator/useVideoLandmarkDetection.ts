import { ref, shallowRef, type Ref, type ShallowRef } from 'vue'
import type { NormalizedLandmark } from '@mediapipe/tasks-vision'
import {
  closeCameraLandmarkers,
  createCameraCropCanvas,
  createCameraLandmarkers,
  detectCameraPose
} from './cameraPoseDetection'
import {
  holdUndetectedCameraPoseFrame,
  mirrorCameraPoseFrame,
  smoothCameraPoseFrame,
  steadyCameraHands
} from './cameraPoseFrame'
import type {
  CameraDetectionOptions,
  CameraHandTracks,
  CameraLandmarkers,
  CameraPoseFrame,
  CameraSmoothingSettings
} from './types'

interface Dependencies {
  videoElement: ShallowRef<HTMLVideoElement | null>
  /** The Config panel's smoothing sliders, read fresh every frame. */
  smoothingSettings: Ref<CameraSmoothingSettings>
  /** The Config panel's detection switches, read fresh every frame. */
  detectionOptions: Ref<CameraDetectionOptions>
  /** Whether the source reads as a mirror (a live self-view, matching how the subject sees
   * themselves) or should be taken as shown (an uploaded clip is not a self-view, the same as
   * an uploaded photo isn't). See `mirrorCameraPoseFrame` for why body, hands and head have to
   * flip together. Read every frame, so a Config panel switch applies straight away. */
  mirror: () => boolean
}

/**
 * Runs MediaPipe's pose, hand and face detectors against a playing `<video>` element in a
 * `requestAnimationFrame` loop. Shared between the live webcam feed and an uploaded video file,
 * which differ only in how the video element's own source is acquired (`getUserMedia` versus a
 * local file) and whether the result reads as mirrored.
 */
export const useVideoLandmarkDetection = ({
  videoElement,
  smoothingSettings,
  detectionOptions,
  mirror
}: Dependencies) => {
  const previewLandmarks = shallowRef<NormalizedLandmark[] | null>(null)
  const previewHandLandmarks = shallowRef<NormalizedLandmark[][] | null>(null)
  /** The latest oriented, smoothed detection; the next reading is smoothed against it. */
  const frame = shallowRef<CameraPoseFrame | null>(null)
  /** Whether frames are being read right now: the source is playing, not paused or finished. */
  const isDetecting = ref(false)
  const cropCanvas = createCameraCropCanvas()

  let landmarkers: CameraLandmarkers | null = null
  let animationFrame: number | null = null
  let handTracks: CameraHandTracks = {}

  const detectFrame = (): void => {
    const video = videoElement.value
    if (!video || !landmarkers) return
    animationFrame = requestAnimationFrame(detectFrame)
    const options = detectionOptions.value
    // A paused or finished video shows the same frame over and over: detecting it again would
    // only keep applying a pose nobody is performing, and keep a recording sampling it.
    isDetecting.value = !options.detectOnlyWhilePlaying || (!video.paused && !video.ended)
    if (!isDetecting.value) return
    const timestamp = performance.now()
    const detection = detectCameraPose(
      {
        source: video,
        frameSize: { width: video.videoWidth, height: video.videoHeight },
        landmarkers,
        cropCanvas,
        options
      },
      landmarkers.pose.detectForVideo(video, timestamp)
    )
    previewLandmarks.value = detection.previewLandmarks
    previewHandLandmarks.value =
      detection.previewHandLandmarks.length > 0 ? detection.previewHandLandmarks : null
    const orientedFrame = mirror() ? mirrorCameraPoseFrame(detection.frame) : detection.frame
    const settings = smoothingSettings.value
    const steadied = steadyCameraHands(handTracks, orientedFrame, timestamp, settings)
    handTracks = steadied.tracks
    const heldFrame = settings.holdUndetectedLandmarks
      ? holdUndetectedCameraPoseFrame(frame.value, steadied.frame, settings.visibilityThreshold)
      : steadied.frame
    frame.value = smoothCameraPoseFrame(frame.value, heldFrame, timestamp, settings)
  }

  /** Load the detectors and start the loop against whatever the video element is already
   * playing. The caller is responsible for that: acquiring the stream or file and starting
   * playback happens before this is called. */
  const startDetectionLoop = async (): Promise<void> => {
    landmarkers = await createCameraLandmarkers('VIDEO')
    detectFrame()
  }

  /** Stop the loop and release the detectors. Safe to call even if the loop never started. */
  const stopDetectionLoop = (): void => {
    if (animationFrame !== null) cancelAnimationFrame(animationFrame)
    animationFrame = null
    closeCameraLandmarkers(landmarkers)
    landmarkers = null
    handTracks = {}
    isDetecting.value = false
    previewLandmarks.value = null
    previewHandLandmarks.value = null
    frame.value = null
  }

  return {
    previewLandmarks,
    previewHandLandmarks,
    frame,
    isDetecting,
    startDetectionLoop,
    stopDetectionLoop
  }
}
