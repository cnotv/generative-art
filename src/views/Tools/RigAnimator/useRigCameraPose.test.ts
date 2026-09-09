import { describe, it, expect } from 'vitest'
import { ref } from 'vue'
import * as THREE from 'three'
import { rigGenerateHumanoidSkeleton } from '@webgamekit/rig'
import { useRigCameraPose } from './useRigCameraPose'
import { captureRestPoses, applyGizmoDragToChain, type BoneRestPose } from './boneDragTarget'
import { CAMERA_POSE_MAPPING_OPTIONS_DEFAULT, type CameraLandmark } from './cameraPoseMapping'
import { RIG_BODY_PART_GROUPS, type RigBodyPartGroup } from './bodyPartGroups'

const ALL_GROUPS = new Set(RIG_BODY_PART_GROUPS)

const landmark = (x: number, y: number, z: number, visibility = 1): CameraLandmark => ({
  x,
  y,
  z,
  visibility
})

/** A person facing the camera, standing straight with arms held out level with the shoulders. */
const buildTPoseLandmarks = (): CameraLandmark[] => {
  const landmarks: CameraLandmark[] = new Array(33).fill(null).map(() => landmark(0, 0, 0, 0))
  landmarks[0] = landmark(0, -0.3, 0) // nose, above the shoulders
  landmarks[11] = landmark(-0.2, 0, 0) // left shoulder
  landmarks[12] = landmark(0.2, 0, 0) // right shoulder
  landmarks[15] = landmark(-0.7, 0, 0) // left wrist, extended out level with the shoulder
  landmarks[16] = landmark(0.7, 0, 0) // right wrist, extended out level with the shoulder
  landmarks[23] = landmark(-0.15, 0.9, 0) // left hip
  landmarks[24] = landmark(0.15, 0.9, 0) // right hip
  landmarks[27] = landmark(-0.15, 1.4, 0) // left ankle, near the floor
  landmarks[28] = landmark(0.15, 1.4, 0) // right ankle
  return landmarks
}

/** The same landmarks, but with the hips occluded this frame, the way a webcam framed tight on
 * the upper body or a brief tracking dropout leaves them. */
const withHipsOccluded = (landmarks: CameraLandmark[]): CameraLandmark[] => {
  const occluded = [...landmarks]
  occluded[23] = landmark(0, 0, 0, 0)
  occluded[24] = landmark(0, 0, 0, 0)
  return occluded
}

/** The same wiring `useRigModel` gives `useRigCameraPose`, built directly for a focused test. */
const buildRigWiring = (bones: THREE.Bone[]) => {
  const restPoses: Map<string, BoneRestPose> = captureRestPoses(bones)
  const applyBoneDragTarget = (
    bone: THREE.Bone,
    target: THREE.Vector3,
    allowRootFollow?: boolean
  ): void => applyGizmoDragToChain(bone, target, restPoses, allowRootFollow)
  return { applyBoneDragTarget }
}

describe('useRigCameraPose', () => {
  it('leaves a bone camera capture never drives exactly where it already was', () => {
    const box = new THREE.Box3(new THREE.Vector3(-0.5, 0, -0.25), new THREE.Vector3(0.5, 2, 0.25))
    const { root, bones } = rigGenerateHumanoidSkeleton(box)
    root.updateMatrixWorld(true)
    const { applyBoneDragTarget } = buildRigWiring(bones)
    const findBone = (name: string): THREE.Bone => bones.find((bone) => bone.name === name)!

    // A pose from an earlier capture, or a manual edit, on a bone neither the head's aim nor
    // the hand's two-bone chain has any reach back up to.
    const shoulder = findBone('mixamorigLeftShoulder')
    shoulder.quaternion.setFromEuler(new THREE.Euler(0, 0, Math.PI / 2))
    const quaternionBefore = shoulder.quaternion.clone()

    const { applyCameraPose } = useRigCameraPose(ref(bones), applyBoneDragTarget)
    applyCameraPose(buildTPoseLandmarks(), CAMERA_POSE_MAPPING_OPTIONS_DEFAULT, ALL_GROUPS)

    expect(shoulder.quaternion.angleTo(quaternionBefore)).toBeCloseTo(0)
  })

  it('still applies the detected pose to the mapped bones', () => {
    const box = new THREE.Box3(new THREE.Vector3(-0.5, 0, -0.25), new THREE.Vector3(0.5, 2, 0.25))
    const { root, bones } = rigGenerateHumanoidSkeleton(box)
    root.updateMatrixWorld(true)
    const { applyBoneDragTarget } = buildRigWiring(bones)
    const findBone = (name: string): THREE.Bone => bones.find((bone) => bone.name === name)!

    const { applyCameraPose } = useRigCameraPose(ref(bones), applyBoneDragTarget)
    applyCameraPose(buildTPoseLandmarks(), CAMERA_POSE_MAPPING_OPTIONS_DEFAULT, ALL_GROUPS)

    const leftShoulderPosition = findBone('mixamorigLeftShoulder').getWorldPosition(
      new THREE.Vector3()
    )
    const rightShoulderPosition = findBone('mixamorigRightShoulder').getWorldPosition(
      new THREE.Vector3()
    )
    const shoulderCenterX = (leftShoulderPosition.x + rightShoulderPosition.x) / 2
    const leftHandPosition = findBone('mixamorigLeftHand').getWorldPosition(new THREE.Vector3())
    const rightHandPosition = findBone('mixamorigRightHand').getWorldPosition(new THREE.Vector3())

    expect(leftHandPosition.x).toBeLessThan(shoulderCenterX)
    expect(rightHandPosition.x).toBeGreaterThan(shoulderCenterX)
  })

  it('keeps the root bone at its last driven position when hips drop out, instead of snapping it back to rest', () => {
    const box = new THREE.Box3(new THREE.Vector3(-0.5, 0, -0.25), new THREE.Vector3(0.5, 2, 0.25))
    const { root, bones } = rigGenerateHumanoidSkeleton(box)
    root.updateMatrixWorld(true)
    const { applyBoneDragTarget } = buildRigWiring(bones)
    const findBone = (name: string): THREE.Bone => bones.find((bone) => bone.name === name)!
    const options = { ...CAMERA_POSE_MAPPING_OPTIONS_DEFAULT, includeHips: true }

    const { applyCameraPose } = useRigCameraPose(ref(bones), applyBoneDragTarget)
    applyCameraPose(buildTPoseLandmarks(), options, ALL_GROUPS)
    const hips = findBone('mixamorigHips')
    const drivenPosition = hips.position.clone()
    expect(drivenPosition.equals(new THREE.Vector3(0, 0, 0))).toBe(false)

    applyCameraPose(withHipsOccluded(buildTPoseLandmarks()), options, ALL_GROUPS)

    expect(hips.position.equals(drivenPosition)).toBe(true)
  })

  it('leaves a bone outside the target groups exactly as it was, even though the capture has data for it', () => {
    const box = new THREE.Box3(new THREE.Vector3(-0.5, 0, -0.25), new THREE.Vector3(0.5, 2, 0.25))
    const { root, bones } = rigGenerateHumanoidSkeleton(box)
    root.updateMatrixWorld(true)
    const { applyBoneDragTarget } = buildRigWiring(bones)
    const findBone = (name: string): THREE.Bone => bones.find((bone) => bone.name === name)!

    // A stale pose on the right shoulder, from an earlier source, that a left-arm-only capture
    // must not touch.
    const rightShoulder = findBone('mixamorigRightShoulder')
    rightShoulder.quaternion.setFromEuler(new THREE.Euler(0, 0, Math.PI / 4))
    const staleRightShoulder = rightShoulder.quaternion.clone()

    const { applyCameraPose } = useRigCameraPose(ref(bones), applyBoneDragTarget)
    applyCameraPose(
      buildTPoseLandmarks(),
      CAMERA_POSE_MAPPING_OPTIONS_DEFAULT,
      new Set<RigBodyPartGroup>(['leftArm'])
    )

    const shoulderCenterX = 0
    const leftHandPosition = findBone('mixamorigLeftHand').getWorldPosition(new THREE.Vector3())
    expect(leftHandPosition.x).toBeLessThan(shoulderCenterX)
    expect(rightShoulder.quaternion.equals(staleRightShoulder)).toBe(true)
  })

  it('re-shooting the same group with a new capture replaces only that group', () => {
    const box = new THREE.Box3(new THREE.Vector3(-0.5, 0, -0.25), new THREE.Vector3(0.5, 2, 0.25))
    const { root, bones } = rigGenerateHumanoidSkeleton(box)
    root.updateMatrixWorld(true)
    const { applyBoneDragTarget } = buildRigWiring(bones)
    const findBone = (name: string): THREE.Bone => bones.find((bone) => bone.name === name)!
    const leftArmOnly = new Set<RigBodyPartGroup>(['leftArm'])
    const rightArmOnly = new Set<RigBodyPartGroup>(['rightArm'])

    const { applyCameraPose } = useRigCameraPose(ref(bones), applyBoneDragTarget)
    applyCameraPose(buildTPoseLandmarks(), CAMERA_POSE_MAPPING_OPTIONS_DEFAULT, leftArmOnly)
    const leftHandAfterFirstShoot = findBone('mixamorigLeftHand')
      .getWorldPosition(new THREE.Vector3())
      .clone()

    // A different source drives the right arm; the left arm's own last capture must survive it.
    applyCameraPose(buildTPoseLandmarks(), CAMERA_POSE_MAPPING_OPTIONS_DEFAULT, rightArmOnly)
    expect(
      findBone('mixamorigLeftHand')
        .getWorldPosition(new THREE.Vector3())
        .equals(leftHandAfterFirstShoot)
    ).toBe(true)

    // Re-shooting the left arm with a raised-arm pose replaces its own earlier capture.
    const raisedLeftArmLandmarks = buildTPoseLandmarks()
    raisedLeftArmLandmarks[15] = landmark(-0.2, -0.6, 0) // left wrist, raised above the head
    applyCameraPose(raisedLeftArmLandmarks, CAMERA_POSE_MAPPING_OPTIONS_DEFAULT, leftArmOnly)

    const leftHandAfterReshoot = findBone('mixamorigLeftHand').getWorldPosition(new THREE.Vector3())
    expect(leftHandAfterReshoot.equals(leftHandAfterFirstShoot)).toBe(false)
  })
})
