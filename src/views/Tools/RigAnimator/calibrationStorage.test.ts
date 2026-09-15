import { describe, it, expect, beforeEach } from 'vitest'
import {
  saveCameraCalibration,
  loadCameraCalibration,
  clearCameraCalibration
} from './calibrationStorage'
import type { CameraCalibration } from './types'

const STORAGE_KEY = 'rig-animator-camera-calibration'

const calibration: CameraCalibration = {
  front: {
    shoulderSpanImage: 0.1,
    armSpanImage: 0.5,
    torsoHeightImage: 0.3,
    headHeightImage: 0.1,
    bodyCenterImage: { x: 0.5, y: 0.3 },
    shoulderWidthMeters: 0.4,
    armSpanMeters: 1.8,
    torsoOrientation: { x: 0, y: 0.1, z: 0, w: 0.995 },
    headOrientation: { x: 0.05, y: 0, z: 0, w: 0.999 },
    handAngles: { Left: 0.2 }
  },
  rootBoneNames: { leftArm: 'LeftShoulder' }
}

describe('camera calibration storage', () => {
  beforeEach(() => localStorage.clear())

  it('round-trips a saved calibration', () => {
    saveCameraCalibration(calibration)

    expect(loadCameraCalibration()).toEqual(calibration)
  })

  it('round-trips a calibration whose T-pose recorded no head', () => {
    const withoutHead: CameraCalibration = {
      ...calibration,
      front: { ...calibration.front!, headOrientation: null }
    }

    saveCameraCalibration(withoutHead)

    expect(loadCameraCalibration()).toEqual(withoutHead)
  })

  it('loads a calibration saved alongside the removed side step, without it', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...calibration, side: { depthScale: 2 } }))

    expect(loadCameraCalibration()).toEqual(calibration)
  })

  it('returns null when nothing has been saved', () => {
    expect(loadCameraCalibration()).toBeNull()
  })

  it.each([
    ['a field of the wrong type', { ...calibration.front, shoulderSpanImage: 'wide' }],
    [
      'a front saved before it recorded a torso baseline',
      { ...calibration.front, torsoOrientation: undefined }
    ]
  ])('returns null for a stored front with %s', (_, front) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...calibration, front }))

    expect(loadCameraCalibration()).toBeNull()
  })

  it('clears a saved calibration', () => {
    saveCameraCalibration(calibration)

    clearCameraCalibration()

    expect(loadCameraCalibration()).toBeNull()
  })
})
