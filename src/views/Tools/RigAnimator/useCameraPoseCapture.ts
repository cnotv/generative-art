import { ref, shallowRef, onUnmounted, type Ref } from 'vue'
import { CAMERA_LANDMARK_SMOOTHING_FACTOR, CAMERA_LANDMARK_MAX_JUMP_METERS } from './config'
import { useVideoLandmarkDetection } from './useVideoLandmarkDetection'

/**
 * Owns the webcam stream for the camera pose capture dialog: starting/stopping the camera and
 * running live detection for the on-screen skeleton overlay via `useVideoLandmarkDetection`,
 * exposing the latest detected body and finger poses for a caller to read.
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
  let stream: MediaStream | null = null

  // A live webcam feed reads as a mirror, matching how the subject sees themselves.
  const detection = useVideoLandmarkDetection({
    videoElement,
    smoothingFactor,
    maxJump,
    mirror: true
  })

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
      await detection.startDetectionLoop()
      isActive.value = true
    } catch (caught) {
      error.value = caught instanceof Error ? caught.message : 'Could not start the camera'
      stop()
    } finally {
      isLoading.value = false
    }
  }

  /** Release the camera and the pose model. Safe to call even if `start` never succeeded. */
  const stop = (): void => {
    detection.stopDetectionLoop()
    stream?.getTracks().forEach((track) => track.stop())
    stream = null
    if (videoElement.value) videoElement.value.srcObject = null
    isActive.value = false
  }

  onUnmounted(stop)

  return {
    videoElement,
    isActive,
    isLoading,
    error,
    ...detection,
    start,
    stop
  }
}
