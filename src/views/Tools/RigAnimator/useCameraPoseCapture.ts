import { ref, shallowRef, onUnmounted, type Ref } from 'vue'
import { useVideoLandmarkDetection } from './useVideoLandmarkDetection'
import type { CameraDetectionOptions, CameraSmoothingSettings } from './types'

/**
 * Owns the webcam stream for the camera pose capture dialog: starting/stopping the camera and
 * running live detection for the on-screen skeleton overlay via `useVideoLandmarkDetection`,
 * exposing the latest detected body, hands and head for a caller to read.
 * @param smoothingSettings The Config panel's smoothing sliders, read fresh every frame so a
 *   change takes effect immediately rather than only on the next `start()`
 * @param detectionOptions The Config panel's detection switches, read fresh every frame
 */
export const useCameraPoseCapture = (
  smoothingSettings: Ref<CameraSmoothingSettings>,
  detectionOptions: Ref<CameraDetectionOptions>
) => {
  const videoElement = shallowRef<HTMLVideoElement | null>(null)
  const isActive = ref(false)
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  let stream: MediaStream | null = null
  /**
   * Bumped by every `stop`, so a `start` still waiting on the camera permission prompt or the
   * detectors can tell it was cancelled meanwhile, typically by a video uploaded into the same
   * `<video>` element, and must not take that element over once it resumes.
   */
  let startAttempt = 0

  // A live webcam feed reads as a mirror, matching how the subject sees themselves.
  const detection = useVideoLandmarkDetection({
    videoElement,
    smoothingSettings,
    detectionOptions,
    mirror: () => detectionOptions.value.mirrorLiveCamera
  })

  /** Request the camera and load the detectors, then start live detection. */
  const start = async (): Promise<void> => {
    if (isActive.value || isLoading.value) return
    startAttempt += 1
    const attempt = startAttempt
    isLoading.value = true
    error.value = null
    try {
      const requestedStream = await navigator.mediaDevices.getUserMedia({ video: true })
      if (attempt !== startAttempt) {
        requestedStream.getTracks().forEach((track) => track.stop())
        return
      }
      stream = requestedStream
      if (!videoElement.value) throw new Error('Camera preview is not ready')
      videoElement.value.srcObject = stream
      await videoElement.value.play()
      await detection.startDetectionLoop()
      if (attempt !== startAttempt) {
        detection.stopDetectionLoop()
        return
      }
      isActive.value = true
    } catch (caught) {
      if (attempt !== startAttempt) return
      error.value = caught instanceof Error ? caught.message : 'Could not start the camera'
      stop()
    } finally {
      isLoading.value = false
    }
  }

  /** Release the camera and the detectors. Safe to call even if `start` never succeeded. */
  const stop = (): void => {
    startAttempt += 1
    detection.stopDetectionLoop()
    stream?.getTracks().forEach((track) => track.stop())
    stream = null
    // Assigning srcObject reloads the element even when it was already null, which rewinds and
    // pauses an uploaded video playing in this same element: only clear a stream actually set.
    if (videoElement.value?.srcObject) videoElement.value.srcObject = null
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
