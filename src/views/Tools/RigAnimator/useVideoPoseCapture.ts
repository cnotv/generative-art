import { ref, shallowRef, onUnmounted, type Ref } from 'vue'
import { useVideoLandmarkDetection } from './useVideoLandmarkDetection'
import type { CameraDetectionOptions } from './types'

/**
 * Owns an uploaded video file for the camera pose capture dialog: the video-file counterpart to
 * `useCameraPoseCapture`, playing the file at its own rate and running the same live detection
 * via `useVideoLandmarkDetection` against it instead of a webcam stream — useful for testing
 * against a known performance, or when there is no working camera.
 * @param smoothingMilliseconds How long a landmark held still takes to settle, read fresh every
 *   frame the same way `useCameraPoseCapture`'s own is
 * @param maxJump The furthest a landmark may move from its previous position in one frame, read
 *   fresh every frame the same way `smoothingMilliseconds` is
 * @param detectionOptions The Config panel's detection switches, read fresh every frame
 */
export const useVideoPoseCapture = (
  smoothingMilliseconds: Ref<number>,
  maxJump: Ref<number>,
  detectionOptions: Ref<CameraDetectionOptions>
) => {
  const videoElement = shallowRef<HTMLVideoElement | null>(null)
  const isActive = ref(false)
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  let objectUrl: string | null = null

  // An uploaded clip is not a self-view the way a live webcam feed is, the same reasoning
  // `useCameraPhotoPose` already applies to an uploaded photo.
  const detection = useVideoLandmarkDetection({
    videoElement,
    smoothingMilliseconds,
    maxJump,
    detectionOptions,
    mirror: () => false
  })

  /** Play an uploaded video file through once and start live detection against it, replacing
   * whatever was loaded before. Plays once rather than looping: a caller driving Record Motion
   * from this needs a real end to stop the take on, see `CameraPoseCapture.vue`'s own
   * `ended` handling. */
  const loadVideo = async (file: File): Promise<void> => {
    if (isLoading.value) return
    isLoading.value = true
    error.value = null
    try {
      if (!videoElement.value) throw new Error('Video preview is not ready')
      objectUrl = URL.createObjectURL(file)
      videoElement.value.src = objectUrl
      videoElement.value.loop = false
      await videoElement.value.play()
      await detection.startDetectionLoop()
      isActive.value = true
    } catch (caught) {
      error.value = caught instanceof Error ? caught.message : 'Could not read that video'
      stop()
    } finally {
      isLoading.value = false
    }
  }

  /** Stop playback and detection, and release the file. Safe to call even if a video was never
   * loaded. */
  const stop = (): void => {
    detection.stopDetectionLoop()
    if (videoElement.value) {
      videoElement.value.pause()
      videoElement.value.removeAttribute('src')
      videoElement.value.load()
    }
    if (objectUrl) URL.revokeObjectURL(objectUrl)
    objectUrl = null
    isActive.value = false
  }

  onUnmounted(stop)

  return {
    videoElement,
    isActive,
    isLoading,
    error,
    ...detection,
    loadVideo,
    stop
  }
}
