import { ref, shallowRef, type Ref } from 'vue'
import type { NormalizedLandmark } from '@mediapipe/tasks-vision'
import {
  closeCameraLandmarkers,
  createCameraCropCanvas,
  createCameraLandmarkers,
  detectCameraPose
} from './cameraPoseDetection'
import type { CameraDetectionOptions, CameraLandmarkers, CameraPoseFrame } from './types'

/**
 * Owns detecting a pose from a single uploaded photo, the static-image counterpart to
 * `useCameraPoseCapture`: useful for posing from a reference photo, and for anyone without a
 * working webcam.
 * @param detectionOptions The Config panel's detection switches, read when a photo is detected
 */
export const useCameraPhotoPose = (detectionOptions: Ref<CameraDetectionOptions>) => {
  const photoImage = shallowRef<ImageBitmap | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  /** Normalized [0,1] image-space landmarks, for drawing the overlay on the photo. */
  const previewLandmarks = shallowRef<NormalizedLandmark[] | null>(null)
  /** Normalized [0,1] image-space landmarks per detected hand, for drawing the finger overlay. */
  const previewHandLandmarks = shallowRef<NormalizedLandmark[][] | null>(null)
  /** The body, hands and head found in the photo, for applying to the rig. */
  const frame = shallowRef<CameraPoseFrame | null>(null)

  const clearDetection = (): void => {
    previewLandmarks.value = null
    previewHandLandmarks.value = null
    frame.value = null
  }

  /** Read a person's pose out of an uploaded photo file, replacing whatever was detected before. */
  const detectPhoto = async (file: File): Promise<void> => {
    isLoading.value = true
    error.value = null
    clearDetection()
    let landmarkers: CameraLandmarkers | null = null
    try {
      const image = await createImageBitmap(file)
      photoImage.value = image
      landmarkers = await createCameraLandmarkers('IMAGE')
      const detection = detectCameraPose(
        {
          source: image,
          frameSize: { width: image.width, height: image.height },
          landmarkers,
          cropCanvas: createCameraCropCanvas(),
          options: detectionOptions.value
        },
        landmarkers.pose.detect(image)
      )
      previewLandmarks.value = detection.previewLandmarks
      previewHandLandmarks.value =
        detection.previewHandLandmarks.length > 0 ? detection.previewHandLandmarks : null
      frame.value = detection.frame
    } catch (caught) {
      error.value = caught instanceof Error ? caught.message : 'Could not read that photo'
    } finally {
      // isLoading has to clear even if the detection above succeeded and closing a detector
      // then throws, or the dialog is stuck showing "Reading photo…" despite having a result.
      isLoading.value = false
      closeCameraLandmarkers(landmarkers)
    }
  }

  /** Drop the loaded photo and whatever was detected from it. */
  const reset = (): void => {
    photoImage.value = null
    clearDetection()
    error.value = null
  }

  return {
    photoImage,
    isLoading,
    error,
    previewLandmarks,
    previewHandLandmarks,
    frame,
    detectPhoto,
    reset
  }
}
