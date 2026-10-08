import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref, shallowRef } from 'vue'
import { useVideoLandmarkDetection } from './useVideoLandmarkDetection'
import { buildBodyLandmarks, buildSmoothingSettings } from './fixtures/cameraPoseFixtures'
import type { CameraDetectionOptions, CameraPoseFrame } from './types'

const detectors = vi.hoisted(() => ({
  videoPoseReadings: 0,
  stillPoseReadings: 0,
  stillPoseClosed: 0,
  stillPoseCreated: 0
}))

vi.mock('./cameraPoseDetection', () => ({
  createCameraLandmarkers: async () => ({
    pose: {
      detectForVideo: () => {
        detectors.videoPoseReadings += 1
        return { landmarks: [], worldLandmarks: [] }
      }
    },
    hand: {},
    face: {}
  }),
  createPoseLandmarker: async () => {
    detectors.stillPoseCreated += 1
    return {
      detect: () => {
        detectors.stillPoseReadings += 1
        return { landmarks: [], worldLandmarks: [] }
      },
      close: () => {
        detectors.stillPoseClosed += 1
      }
    }
  },
  closeCameraLandmarkers: () => undefined,
  createCameraCropCanvas: () => ({}),
  detectCameraPose: (): {
    previewLandmarks: null
    previewHandLandmarks: []
    frame: CameraPoseFrame
  } => ({
    previewLandmarks: null,
    previewHandLandmarks: [],
    frame: { bodyLandmarks: buildBodyLandmarks(), handLandmarks: {}, headRotation: null }
  })
}))

const buildDetection = (video: Partial<HTMLVideoElement> | null) =>
  useVideoLandmarkDetection({
    videoElement: shallowRef(video as HTMLVideoElement | null),
    smoothingSettings: ref(buildSmoothingSettings()),
    detectionOptions: ref({ detectOnlyWhilePlaying: true } as CameraDetectionOptions),
    mirror: () => false
  })

const PAUSED_VIDEO = {
  paused: true,
  ended: false,
  currentTime: 0,
  videoWidth: 1080,
  videoHeight: 1920
}

describe('useVideoLandmarkDetection', () => {
  beforeEach(() => {
    Object.assign(detectors, {
      videoPoseReadings: 0,
      stillPoseReadings: 0,
      stillPoseClosed: 0,
      stillPoseCreated: 0
    })
  })

  it('reads the frame a paused video shows with a still-image detector and publishes it', async () => {
    // Arrange
    const detection = buildDetection(PAUSED_VIDEO)
    await detection.startDetectionLoop()

    // Act
    await detection.readStillFrame()

    // Assert
    expect(detectors.videoPoseReadings).toBe(0)
    expect(detectors.stillPoseReadings).toBe(1)
    expect(detection.frame.value?.bodyLandmarks).toHaveLength(33)
  })

  it('loads the still-image detector once, however many frames it reads', async () => {
    // Arrange
    const detection = buildDetection(PAUSED_VIDEO)
    await detection.startDetectionLoop()

    // Act
    await Promise.all([detection.readStillFrame(), detection.readStillFrame()])
    await detection.readStillFrame()

    // Assert
    expect(detectors.stillPoseCreated).toBe(1)
    expect(detectors.stillPoseReadings).toBe(3)
  })

  it('reads nothing before a video is loaded', async () => {
    // Arrange
    const detection = buildDetection(PAUSED_VIDEO)

    // Act
    await detection.readStillFrame()

    // Assert
    expect(detectors.stillPoseReadings).toBe(0)
    expect(detection.frame.value).toBeNull()
  })

  it('releases the still-image detector when detection stops', async () => {
    // Arrange
    const detection = buildDetection(PAUSED_VIDEO)
    await detection.startDetectionLoop()
    await detection.readStillFrame()

    // Act
    detection.stopDetectionLoop()
    await Promise.resolve()

    // Assert
    expect(detectors.stillPoseClosed).toBe(1)
    expect(detection.frame.value).toBeNull()
  })
})
