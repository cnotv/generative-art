import { ref, shallowRef, type Ref, type ShallowRef } from 'vue'
import type { NormalizedLandmark, PoseLandmarker } from '@mediapipe/tasks-vision'
import {
  closeCameraLandmarkers,
  createCameraCropCanvas,
  createCameraLandmarkers,
  createPoseLandmarker,
  detectCameraPose
} from './cameraPoseDetection'
import {
  continuesPreviousReading,
  mirrorCameraPoseFrame,
  smoothCameraPoseFrame,
  steadyCameraHands
} from './cameraPoseFrame'
import type {
  CameraDetection,
  CameraDetectionOptions,
  CameraHandTracks,
  CameraLandmarkers,
  CameraPoseFrame,
  CameraSmoothingSettings
} from './types'

interface Dependencies {
  videoElement: ShallowRef<HTMLVideoElement | null>
  /** The Config panel's smoothing sliders, read fresh every frame. */
  smoothingSettings: Ref<CameraSmoothingSettings>
  /** The Config panel's detection switches, read fresh every frame. */
  detectionOptions: Ref<CameraDetectionOptions>
  /** Whether the source reads as a mirror (a live self-view, matching how the subject sees
   * themselves) or should be taken as shown (an uploaded clip is not a self-view, the same as
   * an uploaded photo isn't). See `mirrorCameraPoseFrame` for why body, hands and head have to
   * flip together. Read every frame, so a Config panel switch applies straight away. */
  mirror: () => boolean
}

/**
 * Runs MediaPipe's pose, hand and face detectors against a playing `<video>` element in a
 * `requestAnimationFrame` loop. Shared between the live webcam feed and an uploaded video file,
 * which differ only in how the video element's own source is acquired (`getUserMedia` versus a
 * local file) and whether the result reads as mirrored.
 */
export const useVideoLandmarkDetection = ({
  videoElement,
  smoothingSettings,
  detectionOptions,
  mirror
}: Dependencies) => {
  const previewLandmarks = shallowRef<NormalizedLandmark[] | null>(null)
  const previewHandLandmarks = shallowRef<NormalizedLandmark[][] | null>(null)
  /** The latest oriented, smoothed detection; the next reading is smoothed against it. */
  const frame = shallowRef<CameraPoseFrame | null>(null)
  /** Whether frames are being read right now: the source is playing, not paused or finished. */
  const isDetecting = ref(false)
  const cropCanvas = createCameraCropCanvas()

  let landmarkers: CameraLandmarkers | null = null
  let animationFrame: number | null = null
  let handTracks: CameraHandTracks = {}
  /** The video time of the last reading of this run, null until the run's first reading. */
  let lastReadingVideoSeconds: number | null = null
  /** The still-image pose detector a paused frame is read with, loaded the first time one is. */
  let stillPose: Promise<PoseLandmarker> | null = null

  const detectFrame = (): void => {
    const video = videoElement.value
    if (!video || !landmarkers) return
    animationFrame = requestAnimationFrame(detectFrame)
    // A paused or finished video shows the same frame over and over: detecting it again would
    // only keep applying a pose nobody is performing, and keep a recording sampling it.
    isDetecting.value =
      !detectionOptions.value.detectOnlyWhilePlaying || (!video.paused && !video.ended)
    if (!isDetecting.value) {
      lastReadingVideoSeconds = null
      return
    }
    const timestamp = performance.now()
    const poseResult = landmarkers.pose.detectForVideo(video, timestamp)
    const isTracked = continuesPreviousReading(lastReadingVideoSeconds, video.currentTime)
    lastReadingVideoSeconds = video.currentTime
    // The first reading after a start, a pause or a seek only primes the pose tracker, see
    // `continuesPreviousReading`: applied or recorded, it is the malformed first frame of a take.
    if (!isTracked) return
    publishDetection(detectInVideo(video, landmarkers, poseResult), timestamp, frame.value)
  }

  const detectInVideo = (
    video: HTMLVideoElement,
    loaded: CameraLandmarkers,
    poseResult: ReturnType<PoseLandmarker['detect']>
  ): CameraDetection =>
    detectCameraPose(
      {
        source: video,
        frameSize: { width: video.videoWidth, height: video.videoHeight },
        landmarkers: loaded,
        cropCanvas,
        options: detectionOptions.value
      },
      poseResult
    )

  /** Show a detection on the preview and hand it to the rig, smoothed against `previous`. */
  const publishDetection = (
    detection: CameraDetection,
    timestamp: number,
    previous: CameraPoseFrame | null
  ): void => {
    previewLandmarks.value = detection.previewLandmarks
    previewHandLandmarks.value =
      detection.previewHandLandmarks.length > 0 ? detection.previewHandLandmarks : null
    const orientedFrame = mirror() ? mirrorCameraPoseFrame(detection.frame) : detection.frame
    const steadied = steadyCameraHands(
      handTracks,
      orientedFrame,
      timestamp,
      smoothingSettings.value
    )
    handTracks = steadied.tracks
    frame.value = smoothCameraPoseFrame(
      previous,
      steadied.frame,
      timestamp,
      smoothingSettings.value
    )
  }

  /**
   * Read the one frame a paused video shows, as after seeking it, so the rig matches the frame on
   * screen instead of keeping the last played pose or whatever the timeline holds there. It uses a
   * still-image pose detector: the video one tracks from the previous reading, and its first
   * reading after a seek is the malformed one `continuesPreviousReading` skips. Nothing is smoothed
   * into it, since the last reading was of another moment.
   */
  const readStillFrame = async (): Promise<void> => {
    const video = videoElement.value
    if (!video || !landmarkers) return
    stillPose ??= createPoseLandmarker('IMAGE')
    const detector = await stillPose
    if (!landmarkers) return
    handTracks = {}
    publishDetection(
      detectInVideo(video, landmarkers, detector.detect(video)),
      performance.now(),
      null
    )
  }

  /** Load the detectors and start the loop against whatever the video element is already
   * playing. The caller is responsible for that: acquiring the stream or file and starting
   * playback happens before this is called. */
  const startDetectionLoop = async (): Promise<void> => {
    landmarkers = await createCameraLandmarkers('VIDEO')
    detectFrame()
  }

  /** Stop the loop and release the detectors. Safe to call even if the loop never started. */
  const stopDetectionLoop = (): void => {
    if (animationFrame !== null) cancelAnimationFrame(animationFrame)
    animationFrame = null
    closeCameraLandmarkers(landmarkers)
    landmarkers = null
    stillPose?.then((detector) => detector.close())
    stillPose = null
    handTracks = {}
    lastReadingVideoSeconds = null
    isDetecting.value = false
    previewLandmarks.value = null
    previewHandLandmarks.value = null
    frame.value = null
  }

  return {
    previewLandmarks,
    previewHandLandmarks,
    frame,
    isDetecting,
    readStillFrame,
    startDetectionLoop,
    stopDetectionLoop
  }
}
