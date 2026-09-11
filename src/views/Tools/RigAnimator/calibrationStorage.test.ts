import { describe, it, expect, beforeEach } from 'vitest'
import {
  saveCameraCalibration,
  loadCameraCalibration,
  clearCameraCalibration
} from './calibrationStorage'
import type { CameraCalibration } from './types'

const calibration: CameraCalibration = {
  front: {
    shoulderSpanImage: 0.1,
    armSpanImage: 0.5,
    torsoHeightImage: 0.3,
    headHeightImage: 0.1,
    bodyCenterImage: { x: 0.5, y: 0.3 },
    shoulderWidthMeters: 0.4,
    armSpanMeters: 1.8,
    shoulderDirectionScene: { x: -1, z: 0 },
    handAngles: { Left: 0.2 }
  },
  side: { depthScale: 2 },
  rootBoneNames: { leftArm: 'LeftShoulder' }
}

describe('camera calibration storage', () => {
  beforeEach(() => localStorage.clear())

  it('round-trips a saved calibration', () => {
    saveCameraCalibration(calibration)

    expect(loadCameraCalibration()).toEqual(calibration)
  })

  it('round-trips a calibration with only its front step captured', () => {
    const frontOnly: CameraCalibration = { ...calibration, side: null }

    saveCameraCalibration(frontOnly)

    expect(loadCameraCalibration()).toEqual(frontOnly)
  })

  it('returns null when nothing has been saved', () => {
    expect(loadCameraCalibration()).toBeNull()
  })

  it('returns null for a stored value that does not match the expected shape', () => {
    localStorage.setItem(
      'rig-animator-camera-calibration',
      JSON.stringify({ front: { shoulderSpanImage: 'wide' }, side: null, rootBoneNames: {} })
    )

    expect(loadCameraCalibration()).toBeNull()
  })

  it('clears a saved calibration', () => {
    saveCameraCalibration(calibration)

    clearCameraCalibration()

    expect(loadCameraCalibration()).toBeNull()
  })
})
