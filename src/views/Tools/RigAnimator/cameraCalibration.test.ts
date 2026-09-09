import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import {
  computeHandRotationAngle,
  computeBodyCenterImage,
  captureFrontCalibration,
  captureSideCalibration,
  computeBodyOffsetWorld,
  computeHandRotationDelta,
  createEmptyCalibrationBaseline,
  type ImageLandmark,
  type CameraCalibrationBaseline
} from './cameraCalibration'
import type { CameraLandmark } from './cameraPoseMapping'
import type { CameraHandLandmark } from './cameraHandPoseMapping'

const landmark = (x: number, y: number, z: number, visibility = 1): CameraLandmark => ({
  x,
  y,
  z,
  visibility
})

const buildBone = (
  name: string,
  position: [number, number, number],
  parent?: THREE.Bone
): THREE.Bone => {
  const bone = new THREE.Bone()
  bone.name = name
  bone.position.set(...position)
  parent?.add(bone)
  bone.updateWorldMatrix(true, false)
  return bone
}

/** A minimal rig: both shoulders for `computeCameraRigAnchor`'s anchor, plus a left arm chain
 * (shoulder/elbow/hand) with a known 0.6m straight-line reach for `captureSideCalibration`. */
const buildTestRig = (): THREE.Bone[] => {
  const leftArm = buildBone('mixamorigLeftArm', [-0.4, 1, 0])
  const rightArm = buildBone('mixamorigRightArm', [0.4, 1, 0])
  const leftForeArm = buildBone('mixamorigLeftForeArm', [0.3, 0, 0], leftArm)
  const leftHand = buildBone('mixamorigLeftHand', [0.3, 0, 0], leftForeArm)
  return [leftArm, rightArm, leftForeArm, leftHand]
}

describe('computeHandRotationAngle', () => {
  it('reads the wrist-to-middle-knuckle angle in the screen plane', () => {
    const landmarks: CameraHandLandmark[] = new Array(21).fill({ x: 0, y: 0, z: 0 })
    landmarks[0] = { x: 0, y: 0, z: 0 }
    landmarks[9] = { x: 1, y: 1, z: 0 }
    expect(computeHandRotationAngle(landmarks)).toBeCloseTo(Math.PI / 4)
  })
})

describe('computeBodyCenterImage', () => {
  const image = (x: number, y: number, visibility = 1): ImageLandmark => ({ x, y, visibility })

  it('reads the shoulder midpoint', () => {
    const landmarks: ImageLandmark[] = new Array(33).fill(image(0, 0, 0))
    landmarks[11] = image(0.4, 0.5)
    landmarks[12] = image(0.6, 0.5)
    expect(computeBodyCenterImage(landmarks)).toEqual({ x: 0.5, y: 0.5 })
  })

  it('returns null when a shoulder is missing or not confidently detected', () => {
    expect(computeBodyCenterImage(null)).toBeNull()

    const lowVisibility: ImageLandmark[] = new Array(33).fill(image(0, 0, 0))
    lowVisibility[11] = image(0.4, 0.5, 0.1)
    lowVisibility[12] = image(0.6, 0.5)
    expect(computeBodyCenterImage(lowVisibility)).toBeNull()
  })
})

describe('captureFrontCalibration', () => {
  it('adopts the already-computed yaw, hand rotations and body center as the origin', () => {
    const landmarks: CameraLandmark[] = new Array(33).fill(landmark(0, 0, 0, 0))
    landmarks[11] = landmark(0.2, -0.5, 0)
    landmarks[12] = landmark(-0.2, -0.5, 0)

    const result = captureFrontCalibration(landmarks, { x: 0.5, y: 0.4 }, { Left: 0.3 })

    expect(result.originYaw).toBeCloseTo(0)
    expect(result.handRotationOrigin).toEqual({ Left: 0.3 })
    expect(result.originBodyCenterImage).toEqual({ x: 0.5, y: 0.4 })
  })
})

describe('captureSideCalibration', () => {
  it("derives a reach multiplier from the more-stretched side, against the chain's own reach", () => {
    const bones = buildTestRig()
    const landmarks: CameraLandmark[] = new Array(33).fill(landmark(0, 0, 0, 0))
    landmarks[11] = landmark(-0.2, -0.5, 0) // left shoulder
    landmarks[12] = landmark(0.2, -0.5, 0) // right shoulder, 0.4 apart landmark-space
    landmarks[15] = landmark(-1.0, -0.5, 0) // left wrist, stretched out: reach 0.8
    landmarks[16] = landmark(0.25, -0.5, 0) // right wrist, barely moved: reach 0.05

    const result = captureSideCalibration(landmarks, bones)

    // anchor shoulder width 0.8m over landmark span 0.4 gives scale 2, so the left wrist maps
    // to a 1.6m reach at multiplier 1; the rig's own chain (0.3 + 0.3) only reaches 0.6m.
    expect(result?.side).toBe('Left')
    expect(result?.autoReachMultiplier).toBeCloseTo(0.6 / 1.6)
  })

  it('returns null when neither wrist is confidently detected', () => {
    const bones = buildTestRig()
    const landmarks: CameraLandmark[] = new Array(33).fill(landmark(0, 0, 0, 0))
    landmarks[11] = landmark(-0.2, -0.5, 0)
    landmarks[12] = landmark(0.2, -0.5, 0)
    expect(captureSideCalibration(landmarks, bones)).toBeNull()
  })

  it('returns null when the rig has no matching arm chain to measure against', () => {
    const landmarks: CameraLandmark[] = new Array(33).fill(landmark(0, 0, 0, 0))
    landmarks[11] = landmark(-0.2, -0.5, 0)
    landmarks[12] = landmark(0.2, -0.5, 0)
    landmarks[15] = landmark(-1.0, -0.5, 0)
    const armsOnly = [
      buildBone('mixamorigLeftArm', [-0.4, 1, 0]),
      buildBone('mixamorigRightArm', [0.4, 1, 0])
    ]
    expect(captureSideCalibration(landmarks, armsOnly)).toBeNull()
  })
})

describe('computeBodyOffsetWorld', () => {
  const anchor = {
    shoulderCenterWorldPosition: new THREE.Vector3(0, 1, 0),
    shoulderWidthWorld: 0.8,
    hipCenterWorldPosition: null,
    hipWidthWorld: null
  }
  const landmarks: CameraLandmark[] = new Array(33).fill(landmark(0, 0, 0, 0))
  landmarks[11] = landmark(-0.2, -0.5, 0)
  landmarks[12] = landmark(0.2, -0.5, 0)

  it('scales image-space drift from the calibrated origin into world units', () => {
    const baseline: CameraCalibrationBaseline = {
      ...createEmptyCalibrationBaseline(),
      originBodyCenterImage: { x: 0.5, y: 0.5 }
    }
    const offset = computeBodyOffsetWorld({ x: 0.6, y: 0.4 }, baseline, landmarks, anchor)
    // shoulder span 0.4 landmark-space scales to 0.8m, so scale is 2; y flips (image grows
    // down, scene grows up).
    expect(offset?.x).toBeCloseTo(0.2)
    expect(offset?.y).toBeCloseTo(0.2)
    expect(offset?.z).toBe(0)
  })

  it('returns null when uncalibrated or the current frame has no body center', () => {
    const uncalibrated = createEmptyCalibrationBaseline()
    expect(computeBodyOffsetWorld({ x: 0.6, y: 0.4 }, uncalibrated, landmarks, anchor)).toBeNull()

    const calibrated: CameraCalibrationBaseline = {
      ...createEmptyCalibrationBaseline(),
      originBodyCenterImage: { x: 0.5, y: 0.5 }
    }
    expect(computeBodyOffsetWorld(null, calibrated, landmarks, anchor)).toBeNull()
  })
})

describe('computeHandRotationDelta', () => {
  it("reads the change from a calibrated side's origin angle", () => {
    const baseline: CameraCalibrationBaseline = {
      ...createEmptyCalibrationBaseline(),
      handRotationOrigin: { Left: 0.3 }
    }
    expect(computeHandRotationDelta(0.5, 'Left', baseline)).toBeCloseTo(0.2)
  })

  it('is zero for a side that was never calibrated, rather than snapping to an arbitrary angle', () => {
    const baseline = createEmptyCalibrationBaseline()
    expect(computeHandRotationDelta(0.5, 'Right', baseline)).toBe(0)
  })
})
