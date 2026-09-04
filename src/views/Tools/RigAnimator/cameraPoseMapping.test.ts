import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import {
  computeCameraRigAnchor,
  cameraLandmarksToBoneTargets,
  CAMERA_POSE_BONE_LANDMARKS,
  type CameraLandmark
} from './cameraPoseMapping'

const buildBone = (name: string, position: [number, number, number]): THREE.Bone => {
  const bone = new THREE.Bone()
  bone.name = name
  bone.position.set(...position)
  bone.updateWorldMatrix(true, false)
  return bone
}

/** A minimal rig with just the bones camera pose capture reads. */
const buildTestRig = (): THREE.Bone[] => [
  buildBone('mixamorigLeftShoulder', [-0.4, 1, 0]),
  buildBone('mixamorigRightShoulder', [0.4, 1, 0])
]

const landmark = (x: number, y: number, z: number, visibility = 1): CameraLandmark => ({
  x,
  y,
  z,
  visibility
})

/** A fully visible person, shoulders at (0, -0.5, 0) and 0.4 apart, half the test rig's 0.8. */
const buildTestLandmarks = (): CameraLandmark[] => {
  const landmarks: CameraLandmark[] = new Array(33).fill(null).map(() => landmark(0, 0, 0, 0))
  landmarks[0] = landmark(0, -1.5, -0.3) // nose: above shoulder height, toward the camera
  landmarks[11] = landmark(-0.2, -0.5, 0) // left shoulder
  landmarks[12] = landmark(0.2, -0.5, 0) // right shoulder
  landmarks[15] = landmark(-0.5, -0.5, 0) // left wrist
  landmarks[16] = landmark(0.5, -0.5, 0) // right wrist
  landmarks[27] = landmark(-0.1, 0.5, 0) // left ankle, below shoulder height
  landmarks[28] = landmark(0.1, 0.5, 0) // right ankle
  return landmarks
}

describe('computeCameraRigAnchor', () => {
  it('reads the shoulder center world position and shoulder width from the rig', () => {
    const anchor = computeCameraRigAnchor(buildTestRig())
    expect(anchor?.shoulderCenterWorldPosition.toArray()).toEqual([0, 1, 0])
    expect(anchor?.shoulderWidthWorld).toBeCloseTo(0.8)
  })

  it('returns null when a required bone is missing', () => {
    const [leftShoulder] = buildTestRig()
    expect(computeCameraRigAnchor([leftShoulder])).toBeNull()
  })
})

describe('cameraLandmarksToBoneTargets', () => {
  const anchor = computeCameraRigAnchor(buildTestRig())!

  it('maps every bone with a visible landmark', () => {
    const targets = cameraLandmarksToBoneTargets(buildTestLandmarks(), anchor)
    expect(Object.keys(targets).sort()).toEqual(Object.keys(CAMERA_POSE_BONE_LANDMARKS).sort())
  })

  it('places a landmark above shoulder height above the rig anchor, scaled to the rig', () => {
    const targets = cameraLandmarksToBoneTargets(buildTestLandmarks(), anchor)
    // Landmark shoulder width is 0.4, the rig's is 0.8, so offsets double.
    // Nose offset from shoulder center is (0, -1, -0.3); y flips and scales: +2.
    expect(targets.mixamorigHead.y).toBeCloseTo(anchor.shoulderCenterWorldPosition.y + 2)
  })

  it('places a landmark closer to the camera toward the viewer, scaled to the rig', () => {
    const targets = cameraLandmarksToBoneTargets(buildTestLandmarks(), anchor)
    // z offset from shoulder center is -0.3 (closer to camera); z flips and scales: +0.6.
    expect(targets.mixamorigHead.z).toBeCloseTo(anchor.shoulderCenterWorldPosition.z + 0.6)
  })

  it('places a landmark below shoulder height below the rig anchor', () => {
    const targets = cameraLandmarksToBoneTargets(buildTestLandmarks(), anchor)
    expect(targets.mixamorigLeftFoot.y).toBeLessThan(anchor.shoulderCenterWorldPosition.y)
  })

  it('skips a bone whose landmark visibility is below the threshold', () => {
    const landmarks = buildTestLandmarks()
    landmarks[15] = { ...landmarks[15], visibility: 0.1 }
    const targets = cameraLandmarksToBoneTargets(landmarks, anchor)
    expect(targets.mixamorigLeftHand).toBeUndefined()
    expect(targets.mixamorigRightHand).toBeDefined()
  })

  it('returns no targets when a shoulder landmark is below the visibility threshold', () => {
    const landmarks = buildTestLandmarks()
    landmarks[11] = { ...landmarks[11], visibility: 0.1 }
    expect(cameraLandmarksToBoneTargets(landmarks, anchor)).toEqual({})
  })

  it('returns no targets when the detected shoulders coincide (zero span, avoids a divide by zero)', () => {
    const landmarks = buildTestLandmarks()
    landmarks[11] = landmark(0, -0.5, 0)
    landmarks[12] = landmark(0, -0.5, 0)
    expect(cameraLandmarksToBoneTargets(landmarks, anchor)).toEqual({})
  })
})
