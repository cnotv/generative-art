import { shallowRef, type Ref, type ShallowRef } from 'vue'
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
  MEDIAPIPE_HAND_MODEL_URL
} from './config'
import {
  smoothCameraLandmarks,
  mirrorCameraLandmarks,
  type CameraLandmark
} from './cameraPoseMapping'
import {
  cameraDetectedHandsToPoses,
  mirrorCameraHandPoses,
  mirrorCameraHandRotations,
  resolveCameraHandSide,
  smoothCameraHandLandmarks,
  type CameraHandLandmark
} from './cameraHandPoseMapping'
import { computeHandRotationAngle } from './cameraCalibration'

interface Dependencies {
  videoElement: ShallowRef<HTMLVideoElement | null>
  smoothingFactor: Ref<number>
  maxJump: Ref<number>
  /** Whether the source reads as a mirror (a live self-view, matching how the subject sees
   * themselves) or should be taken as shown (an uploaded clip is not a self-view, the same as
   * an uploaded photo isn't) — see `mirrorCameraLandmarks`'s own doc comment for why this has
   * to flip both the landmarks and the derived hand poses together. */
  mirror: boolean
}

/**
 * Runs MediaPipe's Pose and Hand Landmarkers against a playing `<video>` element in a
 * `requestAnimationFrame` loop, in VIDEO running mode. Shared between the live webcam feed and
 * an uploaded video file, which differ only in how the video element's own source is acquired
 * (`getUserMedia` versus a local file) and whether the result reads as mirrored.
 */
export const useVideoLandmarkDetection = ({
  videoElement,
  smoothingFactor,
  maxJump,
  mirror
}: Dependencies) => {
  const previewLandmarks = shallowRef<NormalizedLandmark[] | null>(null)
  const previewHandLandmarks = shallowRef<NormalizedLandmark[][] | null>(null)
  const worldLandmarks = shallowRef<CameraLandmark[] | null>(null)
  const handPoses = shallowRef<Partial<Record<HandSide, HandPoseDefinition>>>({})
  /** Wrist-rotation angle per detected hand, alongside `handPoses`' curl angles; see
   * `computeHandRotationAngle` and the camera calibration flow that reads its baseline off it. */
  const handRotations = shallowRef<Partial<Record<HandSide, number>>>({})

  let landmarker: PoseLandmarker | null = null
  let handLandmarker: HandLandmarker | null = null
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
    const orientedWorldLandmarks =
      rawWorldLandmarks && mirror ? mirrorCameraLandmarks(rawWorldLandmarks) : rawWorldLandmarks
    worldLandmarks.value = orientedWorldLandmarks
      ? smoothCameraLandmarks(
          previousWorldLandmarks,
          orientedWorldLandmarks,
          smoothingFactor.value,
          maxJump.value
        )
      : null
    previousWorldLandmarks = worldLandmarks.value

    const handResult = handLandmarker.detectForVideo(videoElement.value, timestamp)
    previewHandLandmarks.value = handResult.landmarks.length > 0 ? handResult.landmarks : null
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
    const detectedHandPoses = cameraDetectedHandsToPoses(smoothedHands)
    handPoses.value = mirror ? mirrorCameraHandPoses(detectedHandPoses) : detectedHandPoses

    const detectedHandRotations = Object.fromEntries(
      smoothedHands
        .map((hand): [HandSide | null, number] => [
          resolveCameraHandSide(hand.categoryName),
          computeHandRotationAngle(hand.worldLandmarks)
        ])
        .filter((entry): entry is [HandSide, number] => entry[0] !== null)
    )
    handRotations.value = mirror
      ? mirrorCameraHandRotations(detectedHandRotations)
      : detectedHandRotations

    animationFrame = requestAnimationFrame(detectFrame)
  }

  /** Load both landmarkers in VIDEO running mode and start the detection loop against whatever
   * the video element is already playing. The caller is responsible for that: acquiring the
   * stream or file and starting playback happens before this is called. */
  const startDetectionLoop = async (): Promise<void> => {
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
    detectFrame()
  }

  /** Stop the loop and release both landmarkers. Safe to call even if the loop never started. */
  const stopDetectionLoop = (): void => {
    if (animationFrame !== null) cancelAnimationFrame(animationFrame)
    animationFrame = null
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
    previewLandmarks.value = null
    previewHandLandmarks.value = null
    worldLandmarks.value = null
    handPoses.value = {}
    handRotations.value = {}
    previousWorldLandmarks = null
    previousHandLandmarksBySide = {}
  }

  return {
    previewLandmarks,
    previewHandLandmarks,
    worldLandmarks,
    handPoses,
    handRotations,
    startDetectionLoop,
    stopDetectionLoop
  }
}
