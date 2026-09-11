import { describe, it, expect } from 'vitest'
import { ref } from 'vue'
import * as THREE from 'three'
import { rigGenerateHumanoidSkeleton } from '@webgamekit/rig'
import { useRigCameraPose } from './useRigCameraPose'
import { captureRestPoses, applyGizmoDragToChain, type BoneRestPose } from './boneDragTarget'
import { CAMERA_POSE_MAPPING_OPTIONS_DEFAULT, type CameraLandmark } from './cameraPoseMapping'
import { RIG_BODY_PART_GROUPS, type RigBodyPartGroup } from './bodyPartGroups'
import type { RootMotion } from './types'

const ALL_GROUPS = new Set(RIG_BODY_PART_GROUPS)
const WORLD_UP = new THREE.Vector3(0, 1, 0)

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

/** A generated humanoid rig, optionally under a parent, with the same wiring `useRigModel`
 * gives `useRigCameraPose`, built directly for a focused test. */
const buildRig = (parent?: THREE.Object3D) => {
  const box = new THREE.Box3(new THREE.Vector3(-0.5, 0, -0.25), new THREE.Vector3(0.5, 2, 0.25))
  const { root, bones } = rigGenerateHumanoidSkeleton(box)
  parent?.add(root)
  const top = parent ?? root
  top.updateMatrixWorld(true)
  const restPoses: Map<string, BoneRestPose> = captureRestPoses(bones)
  const applyBoneDragTarget = (bone: THREE.Bone, target: THREE.Vector3): void =>
    applyGizmoDragToChain(bone, target, restPoses)
  const resetAllBonesToRest = (excludeBoneNames?: Set<string>): void => {
    bones.forEach((bone) => {
      if (excludeBoneNames?.has(bone.name)) return
      const rest = restPoses.get(bone.name)
      if (rest) {
        bone.position.copy(rest.position)
        bone.quaternion.copy(rest.quaternion)
      }
    })
  }
  const getRestPositions = (): Map<string, THREE.Vector3> =>
    new Map([...restPoses.entries()].map(([name, rest]) => [name, rest.position]))
  const getRestQuaternions = (): Map<string, THREE.Quaternion> =>
    new Map([...restPoses.entries()].map(([name, rest]) => [name, rest.quaternion]))
  const findBone = (name: string): THREE.Bone => bones.find((bone) => bone.name === name)!
  const { applyCameraPose } = useRigCameraPose(
    ref(bones),
    applyBoneDragTarget,
    resetAllBonesToRest,
    getRestPositions,
    getRestQuaternions
  )
  return { root, findBone, applyCameraPose }
}

const yawAboutWorldUp = (yaw: number, from: THREE.Quaternion): THREE.Quaternion =>
  new THREE.Quaternion().setFromAxisAngle(WORLD_UP, yaw).multiply(from)

describe('useRigCameraPose', () => {
  it('resets a bone camera capture never drives back to rest, instead of leaving it mixed in from an earlier edit', () => {
    const { findBone, applyCameraPose } = buildRig()
    // Simulate a stale pose: the shoulder is rotated by a manual edit or an earlier capture,
    // and neither the head's aim nor the hand's two-bone chain has any reach back up to it.
    const shoulder = findBone('mixamorigLeftShoulder')
    shoulder.quaternion.setFromEuler(new THREE.Euler(0, 0, Math.PI / 2))

    applyCameraPose(buildTPoseLandmarks(), CAMERA_POSE_MAPPING_OPTIONS_DEFAULT, ALL_GROUPS)

    expect(shoulder.quaternion.angleTo(new THREE.Quaternion())).toBeCloseTo(0)
  })

  it('still applies the detected pose to the mapped bones after resetting the rig', () => {
    const { findBone, applyCameraPose } = buildRig()

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

  it('leaves a bone outside the target groups exactly as it was, even though the capture has data for it', () => {
    const { findBone, applyCameraPose } = buildRig()
    // A stale pose on the right shoulder, from an earlier source, that a left-arm-only capture
    // must not touch.
    const rightShoulder = findBone('mixamorigRightShoulder')
    rightShoulder.quaternion.setFromEuler(new THREE.Euler(0, 0, Math.PI / 4))
    const staleRightShoulder = rightShoulder.quaternion.clone()

    applyCameraPose(
      buildTPoseLandmarks(),
      CAMERA_POSE_MAPPING_OPTIONS_DEFAULT,
      new Set<RigBodyPartGroup>(['leftArm'])
    )

    const leftHandPosition = findBone('mixamorigLeftHand').getWorldPosition(new THREE.Vector3())
    expect(leftHandPosition.x).toBeLessThan(0)
    expect(rightShoulder.quaternion.equals(staleRightShoulder)).toBe(true)
  })

  it('re-shooting the same group with a new capture replaces only that group', () => {
    const { findBone, applyCameraPose } = buildRig()
    const leftArmOnly = new Set<RigBodyPartGroup>(['leftArm'])
    const rightArmOnly = new Set<RigBodyPartGroup>(['rightArm'])
    applyCameraPose(buildTPoseLandmarks(), CAMERA_POSE_MAPPING_OPTIONS_DEFAULT, leftArmOnly)
    const leftHandAfterFirstShoot = findBone('mixamorigLeftHand')
      .getWorldPosition(new THREE.Vector3())
      .clone()

    // A different source drives the right arm; the left arm's own last capture must survive it.
    applyCameraPose(buildTPoseLandmarks(), CAMERA_POSE_MAPPING_OPTIONS_DEFAULT, rightArmOnly)
    const leftHandAfterOtherGroup = findBone('mixamorigLeftHand').getWorldPosition(
      new THREE.Vector3()
    )
    // Re-shooting the left arm with a raised-arm pose replaces its own earlier capture.
    const raisedLeftArmLandmarks = buildTPoseLandmarks()
    raisedLeftArmLandmarks[15] = landmark(-0.2, -0.6, 0) // left wrist, raised above the head
    applyCameraPose(raisedLeftArmLandmarks, CAMERA_POSE_MAPPING_OPTIONS_DEFAULT, leftArmOnly)

    const leftHandAfterReshoot = findBone('mixamorigLeftHand').getWorldPosition(new THREE.Vector3())
    expect(leftHandAfterOtherGroup.equals(leftHandAfterFirstShoot)).toBe(true)
    expect(leftHandAfterReshoot.equals(leftHandAfterFirstShoot)).toBe(false)
  })

  it('classifies bones by a calibrated root-bone override instead of the fixed mixamorig names', () => {
    const { findBone, applyCameraPose } = buildRig()
    // Points "leftArm" at the arm bone instead of the shoulder, so the shoulder itself now falls
    // outside a leftArm-only capture's scope and must be left exactly as it was.
    const shoulder = findBone('mixamorigLeftShoulder')
    shoulder.quaternion.setFromEuler(new THREE.Euler(0, 0, Math.PI / 4))
    const staleShoulder = shoulder.quaternion.clone()

    applyCameraPose(
      buildTPoseLandmarks(),
      CAMERA_POSE_MAPPING_OPTIONS_DEFAULT,
      new Set<RigBodyPartGroup>(['leftArm']),
      { leftArm: 'mixamorigLeftArm' }
    )

    expect(shoulder.quaternion.equals(staleShoulder)).toBe(true)
  })

  it('moves the skeleton root by the root motion offset and turns it about world up by its yaw', () => {
    const { root, applyCameraPose } = buildRig()
    const restWorldPosition = root.getWorldPosition(new THREE.Vector3())
    const restWorldQuaternion = root.getWorldQuaternion(new THREE.Quaternion())
    const motion: RootMotion = { offset: { x: 0.3, y: 0, z: -0.2 }, yaw: Math.PI / 2 }

    applyCameraPose(
      buildTPoseLandmarks(),
      CAMERA_POSE_MAPPING_OPTIONS_DEFAULT,
      ALL_GROUPS,
      undefined,
      motion
    )

    const movedWorldPosition = root.getWorldPosition(new THREE.Vector3())
    const movedWorldQuaternion = root.getWorldQuaternion(new THREE.Quaternion())
    expect(movedWorldPosition.x).toBeCloseTo(restWorldPosition.x + 0.3)
    expect(movedWorldPosition.z).toBeCloseTo(restWorldPosition.z - 0.2)
    expect(
      movedWorldQuaternion.angleTo(yawAboutWorldUp(Math.PI / 2, restWorldQuaternion))
    ).toBeCloseTo(0)
  })

  it('turns and moves the root in world space even under a rotated parent', () => {
    const armature = new THREE.Group()
    armature.rotation.x = -Math.PI / 2
    const { root, applyCameraPose } = buildRig(armature)
    const restWorldPosition = root.getWorldPosition(new THREE.Vector3())
    const restWorldQuaternion = root.getWorldQuaternion(new THREE.Quaternion())
    const motion: RootMotion = { offset: { x: 0.3, y: 0, z: 0 }, yaw: Math.PI / 4 }

    applyCameraPose(
      buildTPoseLandmarks(),
      CAMERA_POSE_MAPPING_OPTIONS_DEFAULT,
      ALL_GROUPS,
      undefined,
      motion
    )

    expect(root.getWorldPosition(new THREE.Vector3()).x).toBeCloseTo(restWorldPosition.x + 0.3)
    expect(
      root
        .getWorldQuaternion(new THREE.Quaternion())
        .angleTo(yawAboutWorldUp(Math.PI / 4, restWorldQuaternion))
    ).toBeCloseTo(0)
  })

  it('ignores root motion when Spine / Head is outside the target groups', () => {
    const { root, applyCameraPose } = buildRig()
    const restPosition = root.position.clone()
    const restQuaternion = root.quaternion.clone()
    const motion: RootMotion = { offset: { x: 0.3, y: 0, z: 0 }, yaw: Math.PI / 2 }

    applyCameraPose(
      buildTPoseLandmarks(),
      CAMERA_POSE_MAPPING_OPTIONS_DEFAULT,
      new Set<RigBodyPartGroup>(['leftArm']),
      undefined,
      motion
    )

    expect(root.position.equals(restPosition)).toBe(true)
    expect(root.quaternion.equals(restQuaternion)).toBe(true)
  })

  it('holds the root where root motion last put it on a frame with no root motion', () => {
    const { root, applyCameraPose } = buildRig()
    const motion: RootMotion = { offset: { x: 0.3, y: 0, z: 0 }, yaw: Math.PI / 2 }
    applyCameraPose(
      buildTPoseLandmarks(),
      CAMERA_POSE_MAPPING_OPTIONS_DEFAULT,
      ALL_GROUPS,
      undefined,
      motion
    )
    const drivenPosition = root.position.clone()
    const drivenQuaternion = root.quaternion.clone()

    applyCameraPose(buildTPoseLandmarks(), CAMERA_POSE_MAPPING_OPTIONS_DEFAULT, ALL_GROUPS)

    expect(root.position.equals(drivenPosition)).toBe(true)
    expect(root.quaternion.equals(drivenQuaternion)).toBe(true)
  })
})
