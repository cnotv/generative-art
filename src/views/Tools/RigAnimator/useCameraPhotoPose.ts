import { ref, shallowRef } from 'vue'
import { FilesetResolver, PoseLandmarker, type NormalizedLandmark } from '@mediapipe/tasks-vision'
import { MEDIAPIPE_WASM_BASE_PATH, MEDIAPIPE_POSE_MODEL_URL } from './config'
import type { CameraLandmark } from './cameraPoseMapping'

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
  /** Metric world-space landmarks, for mapping onto the rig's bones. */
  const worldLandmarks = shallowRef<CameraLandmark[] | null>(null)

  /** Read a person's pose out of an uploaded photo file, replacing whatever was detected before. */
  const detectPhoto = async (file: File): Promise<void> => {
    isLoading.value = true
    error.value = null
    previewLandmarks.value = null
    worldLandmarks.value = null
    let landmarker: PoseLandmarker | null = null
    try {
      photoImage.value = await createImageBitmap(file)
      const fileset = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_BASE_PATH)
      landmarker = await PoseLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MEDIAPIPE_POSE_MODEL_URL, delegate: 'CPU' },
        runningMode: 'IMAGE',
        numPoses: 1
      })
      const result = landmarker.detect(photoImage.value)
      previewLandmarks.value = result.landmarks[0] ?? null
      worldLandmarks.value = (result.worldLandmarks[0] as CameraLandmark[] | undefined) ?? null
    } catch (caught) {
      error.value = caught instanceof Error ? caught.message : 'Could not read that photo'
    } finally {
      landmarker?.close()
      isLoading.value = false
    }
  }

  /** Drop the loaded photo and whatever was detected from it. */
  const reset = (): void => {
    photoImage.value = null
    previewLandmarks.value = null
    worldLandmarks.value = null
    error.value = null
  }

  return { photoImage, isLoading, error, previewLandmarks, worldLandmarks, detectPhoto, reset }
}
