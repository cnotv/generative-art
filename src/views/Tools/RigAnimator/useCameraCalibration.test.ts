import { describe, it, expect, beforeEach } from 'vitest'
import { useCameraCalibration } from './useCameraCalibration'
import type { CalibrationFrame, ImageLandmark } from './types'
import type { CameraLandmark } from './cameraPoseMapping'

const SETTINGS = { countdownSeconds: 1, toleranceDegrees: 20 }

/** A square-on T-pose in raw image space and in world space, hips out of frame. */
const tPoseFrame = (): CalibrationFrame => {
  const image: Record<number, ImageLandmark> = {
    0: { x: 0.5, y: 0.2 },
    11: { x: 0.55, y: 0.3 },
    12: { x: 0.45, y: 0.3 },
    13: { x: 0.65, y: 0.3 },
    14: { x: 0.35, y: 0.3 },
    15: { x: 0.75, y: 0.3 },
    16: { x: 0.25, y: 0.3 }
  }
  const world: Record<number, CameraLandmark> = {
    11: { x: 0.2, y: 0, z: 0, visibility: 1 },
    12: { x: -0.2, y: 0, z: 0, visibility: 1 },
    15: { x: 0.8, y: 0, z: 0, visibility: 1 },
    16: { x: -0.8, y: 0, z: 0, visibility: 1 }
  }
  return {
    image: Array.from({ length: 33 }, (_, index) => image[index] ?? { x: 0, y: 0, visibility: 0 }),
    world: Array.from(
      { length: 33 },
      (_, index) => world[index] ?? { x: 0, y: 0, z: 0, visibility: 0 }
    ),
    aspect: 1
  }
}

describe('useCameraCalibration', () => {
  beforeEach(() => localStorage.clear())

  it('finishes once the front T-pose is captured, with no side step to follow', () => {
    const calibration = useCameraCalibration()
    calibration.goToStep('front')

    calibration.feedFrame(tPoseFrame(), {}, 0, SETTINGS)
    const captured = calibration.feedFrame(tPoseFrame(), {}, 1000, SETTINGS)

    expect(captured).toBe(true)
    expect(calibration.step.value).toBeNull()
    expect(calibration.isCalibrated.value).toBe(true)
  })
})
