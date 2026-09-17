import { ref, shallowRef, onUnmounted, type Ref } from 'vue'
import { useVideoLandmarkDetection } from './useVideoLandmarkDetection'
import type { CameraDetectionOptions, CameraSmoothingSettings } from './types'

/**
 * Owns an uploaded video file for the camera pose capture dialog: the video-file counterpart to
 * `useCameraPoseCapture`, playing the file at its own rate and running the same live detection
 * via `useVideoLandmarkDetection` against it instead of a webcam stream. Useful for testing
 * against a known performance, or when there is no working camera.
 * @param smoothingSettings The Config panel's smoothing sliders, read fresh every frame
 * @param detectionOptions The Config panel's detection switches, read fresh every frame
 */
export const useVideoPoseCapture = (
  smoothingSettings: Ref<CameraSmoothingSettings>,
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
    smoothingSettings,
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

  /** Play or pause the loaded video on its own, without touching Record Motion or the timeline.
   * Playing a video that already reached its end starts it over. */
  const togglePlayback = async (): Promise<void> => {
    const video = videoElement.value
    if (!video || !isActive.value) return
    if (video.paused) await video.play()
    else video.pause()
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
    togglePlayback,
    stop
  }
}
