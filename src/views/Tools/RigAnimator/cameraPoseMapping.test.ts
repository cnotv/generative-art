import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { rigGenerateHumanoidSkeleton } from '@webgamekit/rig'
import {
  computeCameraRigAnchor,
  cameraLandmarksToBoneTargets,
  CAMERA_POSE_BONE_LANDMARKS,
  type CameraLandmark
} from './cameraPoseMapping'
import { captureRestPoses, applyGizmoDragToChain } from './boneDragTarget'

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

describe('CAMERA_POSE_BONE_LANDMARKS application order', () => {
  it('applies the head before the hands, so bending the spine for the head does not drag an already-placed hand out of position', () => {
    const box = new THREE.Box3(new THREE.Vector3(-0.5, 0, -0.25), new THREE.Vector3(0.5, 2, 0.25))
    const { root, bones } = rigGenerateHumanoidSkeleton(box)
    root.updateMatrixWorld(true)
    const restPoses = captureRestPoses(bones)

    const leftHand = bones.find((bone) => bone.name === 'mixamorigLeftHand')!
    const head = bones.find((bone) => bone.name === 'mixamorigHead')!
    const leftHandTarget = leftHand.getWorldPosition(new THREE.Vector3())
    // Well off to the side, so aiming the head bends the neck/spine chain hard for it.
    const headTarget = head.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0.6, 0, 0))
    const targetsByBoneName: Record<string, THREE.Vector3> = {
      mixamorigLeftHand: leftHandTarget,
      mixamorigHead: headTarget
    }

    Object.keys(CAMERA_POSE_BONE_LANDMARKS)
      .filter((boneName) => boneName in targetsByBoneName)
      .forEach((boneName) => {
        const bone = bones.find((candidate) => candidate.name === boneName)!
        applyGizmoDragToChain(bone, targetsByBoneName[boneName], restPoses)
      })

    const finalLeftHandPosition = leftHand.getWorldPosition(new THREE.Vector3())
    expect(finalLeftHandPosition.distanceTo(leftHandTarget)).toBeLessThan(0.05)
  })
})

describe('full pipeline: a T-pose maps onto the rig sensibly', () => {
  /** A person facing the camera, standing straight with arms held out level with the shoulders. */
  const buildTPoseLandmarks = (): CameraLandmark[] => {
    const landmarks: CameraLandmark[] = new Array(33).fill(null).map(() => landmark(0, 0, 0, 0))
    landmarks[0] = landmark(0, -0.3, 0) // nose, above the shoulders
    landmarks[11] = landmark(-0.2, 0, 0) // left shoulder
    landmarks[12] = landmark(0.2, 0, 0) // right shoulder
    landmarks[15] = landmark(-0.7, 0, 0) // left wrist, extended out level with the shoulder
    landmarks[16] = landmark(0.7, 0, 0) // right wrist, extended out level with the shoulder
    landmarks[27] = landmark(-0.15, 1.4, 0) // left ankle, near the floor
    landmarks[28] = landmark(0.15, 1.4, 0) // right ankle
    return landmarks
  }

  it('keeps every mapped bone on its own side, extended and above/below the shoulders as a T-pose should read', () => {
    const box = new THREE.Box3(new THREE.Vector3(-0.5, 0, -0.25), new THREE.Vector3(0.5, 2, 0.25))
    const { root, bones } = rigGenerateHumanoidSkeleton(box)
    root.updateMatrixWorld(true)
    const restPoses = captureRestPoses(bones)
    const findBone = (name: string): THREE.Bone => bones.find((bone) => bone.name === name)!

    const anchor = computeCameraRigAnchor(bones)!
    const targets = cameraLandmarksToBoneTargets(buildTPoseLandmarks(), anchor)

    Object.keys(CAMERA_POSE_BONE_LANDMARKS).forEach((boneName) => {
      applyGizmoDragToChain(findBone(boneName), targets[boneName], restPoses)
    })

    const leftShoulderPosition = findBone('mixamorigLeftShoulder').getWorldPosition(
      new THREE.Vector3()
    )
    const rightShoulderPosition = findBone('mixamorigRightShoulder').getWorldPosition(
      new THREE.Vector3()
    )
    const shoulderCenterX = (leftShoulderPosition.x + rightShoulderPosition.x) / 2
    const shoulderHalfWidth = Math.abs(rightShoulderPosition.x - shoulderCenterX)
    const leftHandPosition = findBone('mixamorigLeftHand').getWorldPosition(new THREE.Vector3())
    const rightHandPosition = findBone('mixamorigRightHand').getWorldPosition(new THREE.Vector3())
    const headPosition = findBone('mixamorigHead').getWorldPosition(new THREE.Vector3())
    const leftFootPosition = findBone('mixamorigLeftFoot').getWorldPosition(new THREE.Vector3())
    const rightFootPosition = findBone('mixamorigRightFoot').getWorldPosition(new THREE.Vector3())

    // Neither hand crosses over to the other side of the body.
    expect(leftHandPosition.x).toBeLessThan(shoulderCenterX)
    expect(rightHandPosition.x).toBeGreaterThan(shoulderCenterX)
    // Both arms reach out further than the shoulders themselves, not collapsed inward.
    expect(Math.abs(leftHandPosition.x - shoulderCenterX)).toBeGreaterThan(shoulderHalfWidth)
    expect(Math.abs(rightHandPosition.x - shoulderCenterX)).toBeGreaterThan(shoulderHalfWidth)
    // Both wrists land roughly level with the shoulders, the way an outstretched T-pose arm does.
    const shoulderY = (leftShoulderPosition.y + rightShoulderPosition.y) / 2
    expect(Math.abs(leftHandPosition.y - shoulderY)).toBeLessThan(shoulderHalfWidth)
    expect(Math.abs(rightHandPosition.y - shoulderY)).toBeLessThan(shoulderHalfWidth)
    // The head sits above the shoulders, and both feet sit well below them.
    expect(headPosition.y).toBeGreaterThan(shoulderY)
    expect(leftFootPosition.y).toBeLessThan(shoulderY)
    expect(rightFootPosition.y).toBeLessThan(shoulderY)
    // Neither foot crosses over to the other side of the body either.
    expect(leftFootPosition.x).toBeLessThan(shoulderCenterX)
    expect(rightFootPosition.x).toBeGreaterThan(shoulderCenterX)
  })
})
