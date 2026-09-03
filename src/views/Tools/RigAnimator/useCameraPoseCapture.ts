import { ref, shallowRef, onUnmounted } from 'vue'
import { FilesetResolver, PoseLandmarker, type NormalizedLandmark } from '@mediapipe/tasks-vision'
import { MEDIAPIPE_WASM_BASE_PATH, MEDIAPIPE_POSE_MODEL_URL } from './config'
import type { CameraLandmark } from './cameraPoseMapping'

/**
 * Owns the webcam stream and the MediaPipe Pose Landmarker for the camera pose capture dialog:
 * starting/stopping the camera, running live detection for the on-screen skeleton overlay, and
 * exposing the latest detected landmarks for a Capture click to read.
 */
export const useCameraPoseCapture = () => {
  const videoElement = shallowRef<HTMLVideoElement | null>(null)
  const isActive = ref(false)
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  /** Normalized [0,1] image-space landmarks, for drawing the overlay on the video. */
  const previewLandmarks = shallowRef<NormalizedLandmark[] | null>(null)
  /** Metric world-space landmarks, for mapping onto the rig's bones. */
  const worldLandmarks = shallowRef<CameraLandmark[] | null>(null)

  let landmarker: PoseLandmarker | null = null
  let stream: MediaStream | null = null
  let animationFrame: number | null = null

  const detectFrame = (): void => {
    if (!videoElement.value || !landmarker) return
    const result = landmarker.detectForVideo(videoElement.value, performance.now())
    previewLandmarks.value = result.landmarks[0] ?? null
    worldLandmarks.value = (result.worldLandmarks[0] as CameraLandmark[] | undefined) ?? null
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
    landmarker?.close()
    landmarker = null
    isActive.value = false
    previewLandmarks.value = null
    worldLandmarks.value = null
  }

  onUnmounted(stop)

  return { videoElement, isActive, isLoading, error, previewLandmarks, worldLandmarks, start, stop }
}
