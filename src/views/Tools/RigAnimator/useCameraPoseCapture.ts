import { ref, shallowRef, onUnmounted, type Ref } from 'vue'
import type { HandSide, HandPoseDefinition } from '@webgamekit/rig'
import {
  FilesetResolver,
  PoseLandmarker,
  HandLandmarker,
  type NormalizedLandmark
} from '@mediapipe/tasks-vision'
import {
  MEDIAPIPE_WASM_BASE_PATH,
  MEDIAPIPE_POSE_MODEL_URL,
  MEDIAPIPE_HAND_MODEL_URL,
  CAMERA_LANDMARK_SMOOTHING_FACTOR,
  CAMERA_LANDMARK_MAX_JUMP_METERS
} from './config'
import { smoothCameraLandmarks, type CameraLandmark } from './cameraPoseMapping'
import {
  cameraDetectedHandsToPoses,
  resolveCameraHandSide,
  smoothCameraHandLandmarks,
  type CameraHandLandmark
} from './cameraHandPoseMapping'

/**
 * Owns the webcam stream and the MediaPipe Pose and Hand Landmarkers for the camera pose
 * capture dialog: starting/stopping the camera, running live detection for the on-screen
 * skeleton overlay, and exposing the latest detected body and finger poses for a caller to read.
 * @param smoothingFactor Fraction of each new frame blended in, read fresh every frame so a
 *   Config panel slider takes effect immediately rather than only on the next `start()`
 * @param maxJump The furthest a landmark may move from its previous position in one frame,
 *   read fresh every frame the same way `smoothingFactor` is
 */
export const useCameraPoseCapture = (
  smoothingFactor: Ref<number> = ref(CAMERA_LANDMARK_SMOOTHING_FACTOR),
  maxJump: Ref<number> = ref(CAMERA_LANDMARK_MAX_JUMP_METERS)
) => {
  const videoElement = shallowRef<HTMLVideoElement | null>(null)
  const isActive = ref(false)
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  /** Normalized [0,1] image-space landmarks, for drawing the overlay on the video. */
  const previewLandmarks = shallowRef<NormalizedLandmark[] | null>(null)
  /** Metric world-space landmarks, for mapping onto the rig's bones. */
  const worldLandmarks = shallowRef<CameraLandmark[] | null>(null)
  /** Detected finger curl per side, for whichever hand(s) are in frame. */
  const handPoses = shallowRef<Partial<Record<HandSide, HandPoseDefinition>>>({})

  let landmarker: PoseLandmarker | null = null
  let handLandmarker: HandLandmarker | null = null
  let stream: MediaStream | null = null
  let animationFrame: number | null = null
  /** The last smoothed frame, so the next one blends against it instead of the raw detection. */
  let previousWorldLandmarks: CameraLandmark[] | null = null
  /**
   * The last smoothed landmarks per hand side, keyed by the resolved side rather than MediaPipe's
   * own per-frame array index: a hand entering or leaving frame can shift which index the other
   * hand reports at, and blending against the wrong hand's last position would read as a jump.
   */
  let previousHandLandmarksBySide: Partial<Record<HandSide, CameraHandLandmark[]>> = {}

  const detectFrame = (): void => {
    if (!videoElement.value || !landmarker || !handLandmarker) return
    const timestamp = performance.now()
    const result = landmarker.detectForVideo(videoElement.value, timestamp)
    previewLandmarks.value = result.landmarks[0] ?? null
    const rawWorldLandmarks = (result.worldLandmarks[0] as CameraLandmark[] | undefined) ?? null
    worldLandmarks.value = rawWorldLandmarks
      ? smoothCameraLandmarks(
          previousWorldLandmarks,
          rawWorldLandmarks,
          smoothingFactor.value,
          maxJump.value
        )
      : null
    previousWorldLandmarks = worldLandmarks.value

    const handResult = handLandmarker.detectForVideo(videoElement.value, timestamp)
    const smoothedHands = handResult.worldLandmarks.map((landmarksForHand, index) => {
      const categoryName = handResult.handedness[index]?.[0]?.categoryName ?? ''
      const side = resolveCameraHandSide(categoryName)
      const smoothed = smoothCameraHandLandmarks(
        side ? (previousHandLandmarksBySide[side] ?? null) : null,
        landmarksForHand as CameraHandLandmark[],
        smoothingFactor.value,
        maxJump.value
      )
      if (side) previousHandLandmarksBySide = { ...previousHandLandmarksBySide, [side]: smoothed }
      return { worldLandmarks: smoothed, categoryName }
    })
    handPoses.value = cameraDetectedHandsToPoses(smoothedHands)

    animationFrame = requestAnimationFrame(detectFrame)
  }

  /** Request the camera and load the pose model, then start live detection. */
  const start = async (): Promise<void> => {
    if (isActive.value || isLoading.value) return
    isLoading.value = true
    error.value = null
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: true })
      if (!videoElement.value) throw new Error('Camera preview is not ready')
      videoElement.value.srcObject = stream
      await videoElement.value.play()

      const fileset = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_BASE_PATH)
      landmarker = await PoseLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MEDIAPIPE_POSE_MODEL_URL, delegate: 'CPU' },
        runningMode: 'VIDEO',
        numPoses: 1
      })
      handLandmarker = await HandLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MEDIAPIPE_HAND_MODEL_URL, delegate: 'CPU' },
        runningMode: 'VIDEO',
        numHands: 2
      })

      isActive.value = true
      detectFrame()
    } catch (caught) {
      error.value = caught instanceof Error ? caught.message : 'Could not start the camera'
      stop()
    } finally {
      isLoading.value = false
    }
  }

  /** Release the camera and the pose model. Safe to call even if `start` never succeeded. */
  const stop = (): void => {
    if (animationFrame !== null) cancelAnimationFrame(animationFrame)
    animationFrame = null
    stream?.getTracks().forEach((track) => track.stop())
    stream = null
    if (videoElement.value) videoElement.value.srcObject = null
    // A throw here must never skip clearing the rest of the state below.
    try {
      landmarker?.close()
    } catch {
      // Nothing to recover: the landmarker is being thrown away either way.
    }
    try {
      handLandmarker?.close()
    } catch {
      // Nothing to recover: the landmarker is being thrown away either way.
    }
    landmarker = null
    handLandmarker = null
    isActive.value = false
    previewLandmarks.value = null
    worldLandmarks.value = null
    handPoses.value = {}
    previousWorldLandmarks = null
    previousHandLandmarksBySide = {}
  }

  onUnmounted(stop)

  return {
    videoElement,
    isActive,
    isLoading,
    error,
    previewLandmarks,
    worldLandmarks,
    handPoses,
    start,
    stop
  }
}
