import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import {
  computeCameraRigAnchor,
  cameraLandmarksToBoneTargets,
  CAMERA_POSE_BONE_LANDMARKS,
  type CameraLandmark
} from './cameraPoseMapping'

const buildBone = (name: string, position: [number, number, number], parent?: THREE.Bone) => {
  const bone = new THREE.Bone()
  bone.name = name
  bone.position.set(...position)
  parent?.add(bone)
  return bone
}

/** A minimal humanoid rig with just the bones camera pose capture reads. */
const buildTestRig = (): THREE.Bone[] => {
  const hips = buildBone('mixamorigHips', [0, 1, 0])
  const leftShoulder = buildBone('mixamorigLeftShoulder', [-0.4, 1, 0], hips)
  const rightShoulder = buildBone('mixamorigRightShoulder', [0.4, 1, 0], hips)
  const bones = [hips, leftShoulder, rightShoulder]
  bones.forEach((bone) => bone.updateWorldMatrix(true, false))
  return bones
}

const landmark = (x: number, y: number, z: number, visibility = 1): CameraLandmark => ({
  x,
  y,
  z,
  visibility
})

/** A fully visible person, hips at the origin, shoulders 0.4 apart, matching the test rig's own 0.8. */
const buildTestLandmarks = (): CameraLandmark[] => {
  const landmarks: CameraLandmark[] = new Array(33).fill(null).map(() => landmark(0, 0, 0, 0))
  landmarks[0] = landmark(0, -1, 0) // nose, above the hips (smaller y is up)
  landmarks[11] = landmark(-0.2, -0.5, 0) // left shoulder
  landmarks[12] = landmark(0.2, -0.5, 0) // right shoulder
  landmarks[15] = landmark(-0.5, -0.5, 0) // left wrist
  landmarks[16] = landmark(0.5, -0.5, 0) // right wrist
  landmarks[23] = landmark(-0.1, 0, 0) // left hip
  landmarks[24] = landmark(0.1, 0, 0) // right hip
  landmarks[27] = landmark(-0.1, 1, 0) // left ankle, below the hips
  landmarks[28] = landmark(0.1, 1, 0) // right ankle
  return landmarks
}

describe('computeCameraRigAnchor', () => {
  it('reads the hip world position and shoulder width from the rig', () => {
    const anchor = computeCameraRigAnchor(buildTestRig())
    expect(anchor?.hipWorldPosition.toArray()).toEqual([0, 1, 0])
    expect(anchor?.shoulderWidthWorld).toBeCloseTo(0.8)
  })

  it('returns null when a required bone is missing', () => {
    const [hips] = buildTestRig()
    expect(computeCameraRigAnchor([hips])).toBeNull()
  })
})

describe('cameraLandmarksToBoneTargets', () => {
  const anchor = computeCameraRigAnchor(buildTestRig())!

  it('maps every bone with a visible landmark', () => {
    const targets = cameraLandmarksToBoneTargets(buildTestLandmarks(), anchor)
    expect(Object.keys(targets).sort()).toEqual(Object.keys(CAMERA_POSE_BONE_LANDMARKS).sort())
  })

  it('places a landmark above hip center above the rig anchor, scaled to the rig', () => {
    const targets = cameraLandmarksToBoneTargets(buildTestLandmarks(), anchor)
    // Landmark shoulder width is 0.4, the rig's is 0.8, so offsets double.
    // Nose offset from hip center is (0, -1, 0); y flips and scales: +2.
    expect(targets.mixamorigHead.y).toBeCloseTo(anchor.hipWorldPosition.y + 2)
  })

  it('places a landmark below hip center below the rig anchor', () => {
    const targets = cameraLandmarksToBoneTargets(buildTestLandmarks(), anchor)
    expect(targets.mixamorigLeftFoot.y).toBeLessThan(anchor.hipWorldPosition.y)
  })

  it('skips a bone whose landmark visibility is below the threshold', () => {
    const landmarks = buildTestLandmarks()
    landmarks[15] = { ...landmarks[15], visibility: 0.1 }
    const targets = cameraLandmarksToBoneTargets(landmarks, anchor)
    expect(targets.mixamorigLeftHand).toBeUndefined()
    expect(targets.mixamorigRightHand).toBeDefined()
  })

  it('returns no targets when the detected shoulders coincide (zero span, avoids a divide by zero)', () => {
    const landmarks = buildTestLandmarks()
    landmarks[11] = landmark(0, -0.5, 0)
    landmarks[12] = landmark(0, -0.5, 0)
    expect(cameraLandmarksToBoneTargets(landmarks, anchor)).toEqual({})
  })
})
