import { ref, shallowRef } from 'vue'
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
import type { CameraLandmark } from './cameraPoseMapping'
import { cameraDetectedHandsToPoses } from './cameraHandPoseMapping'

/**
 * Owns detecting a pose from a single uploaded photo, the static-image counterpart to
 * `useCameraPoseCapture`: useful for posing from a reference photo, and for anyone without a
 * working webcam.
 */
export const useCameraPhotoPose = () => {
  const photoImage = shallowRef<ImageBitmap | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  /** Normalized [0,1] image-space landmarks, for drawing the overlay on the photo. */
  const previewLandmarks = shallowRef<NormalizedLandmark[] | null>(null)
  /** Normalized [0,1] image-space landmarks per detected hand, for drawing the finger overlay. */
  const previewHandLandmarks = shallowRef<NormalizedLandmark[][] | null>(null)
  /** Metric world-space landmarks, for mapping onto the rig's bones. */
  const worldLandmarks = shallowRef<CameraLandmark[] | null>(null)
  /** Detected finger curl per side, for whichever hand(s) the photo shows. */
  const handPoses = shallowRef<Partial<Record<HandSide, HandPoseDefinition>>>({})

  /** Read a person's pose out of an uploaded photo file, replacing whatever was detected before. */
  const detectPhoto = async (file: File): Promise<void> => {
    isLoading.value = true
    error.value = null
    previewLandmarks.value = null
    previewHandLandmarks.value = null
    worldLandmarks.value = null
    handPoses.value = {}
    let landmarker: PoseLandmarker | null = null
    let handLandmarker: HandLandmarker | null = null
    try {
      photoImage.value = await createImageBitmap(file)
      const fileset = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_BASE_PATH)
      landmarker = await PoseLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MEDIAPIPE_POSE_MODEL_URL, delegate: 'CPU' },
        runningMode: 'IMAGE',
        numPoses: 1
      })
      handLandmarker = await HandLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MEDIAPIPE_HAND_MODEL_URL, delegate: 'CPU' },
        runningMode: 'IMAGE',
        numHands: 2
      })
      const result = landmarker.detect(photoImage.value)
      previewLandmarks.value = result.landmarks[0] ?? null
      worldLandmarks.value = (result.worldLandmarks[0] as CameraLandmark[] | undefined) ?? null

      const handResult = handLandmarker.detect(photoImage.value)
      previewHandLandmarks.value = handResult.landmarks.length > 0 ? handResult.landmarks : null
      handPoses.value = cameraDetectedHandsToPoses(
        handResult.worldLandmarks.map((landmarksForHand, index) => ({
          worldLandmarks: landmarksForHand,
          categoryName: handResult.handedness[index]?.[0]?.categoryName ?? ''
        }))
      )
    } catch (caught) {
      error.value = caught instanceof Error ? caught.message : 'Could not read that photo'
    } finally {
      // isLoading has to clear even if the detection above succeeded and closing the
      // landmarker itself then throws, or the dialog is stuck showing "Reading photo…"
      // forever despite already having a result.
      isLoading.value = false
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
    }
  }

  /** Drop the loaded photo and whatever was detected from it. */
  const reset = (): void => {
    photoImage.value = null
    previewLandmarks.value = null
    previewHandLandmarks.value = null
    worldLandmarks.value = null
    handPoses.value = {}
    error.value = null
  }

  return {
    photoImage,
    isLoading,
    error,
    previewLandmarks,
    previewHandLandmarks,
    worldLandmarks,
    handPoses,
    detectPhoto,
    reset
  }
}
