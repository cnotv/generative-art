import { describe, it, expect } from 'vitest'
import { ref } from 'vue'
import * as THREE from 'three'
import { rigGenerateHumanoidSkeleton, type Vector3Data } from '@webgamekit/rig'
import { useRigCameraPose } from './useRigCameraPose'
import { captureRestPoses, applyGizmoDragToChain, type BoneRestPose } from './boneDragTarget'
import { CAMERA_POSE_MAPPING_OPTIONS_DEFAULT, type CameraLandmark } from './cameraPoseMapping'
import { RIG_BODY_PART_GROUPS, type RigBodyPartGroup } from './bodyPartGroups'

const ALL_GROUPS = new Set(RIG_BODY_PART_GROUPS)
const WORLD_UP = new THREE.Vector3(0, 1, 0)
const WORLD_RIGHT = new THREE.Vector3(1, 0, 0)

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

interface RigOptions {
  /** An object the skeleton root is added under, such as a rotated FBX armature. */
  parent?: THREE.Object3D
  /** Bones taken out of the generated skeleton, their children kept in place under the removed
   * bone's parent, standing in for a rig that never had them. */
  withoutBones?: string[]
}

/** A generated humanoid rig with the same wiring `useRigModel` gives `useRigCameraPose`, built
 * directly for a focused test. */
const buildRig = ({ parent, withoutBones = [] }: RigOptions = {}) => {
  const box = new THREE.Box3(new THREE.Vector3(-0.5, 0, -0.25), new THREE.Vector3(0.5, 2, 0.25))
  const { root, bones: generatedBones } = rigGenerateHumanoidSkeleton(box)
  root.updateMatrixWorld(true)
  generatedBones
    .filter((bone) => withoutBones.includes(bone.name))
    .forEach((removed) => {
      ;[...removed.children].forEach((child) => removed.parent?.attach(child))
      removed.removeFromParent()
    })
  const bones = generatedBones.filter((bone) => !withoutBones.includes(bone.name))
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
  const findBone = (name: string): THREE.Bone => bones.find((bone) => bone.name === name)!
  const { applyCameraPose } = useRigCameraPose(
    ref(bones),
    applyBoneDragTarget,
    resetAllBonesToRest,
    getRestPositions
  )
  return { root, findBone, applyCameraPose }
}

const worldQuaternionOf = (bone: THREE.Object3D): THREE.Quaternion =>
  bone.getWorldQuaternion(new THREE.Quaternion())

const rotation = (axis: THREE.Vector3, angle: number): THREE.Quaternion =>
  new THREE.Quaternion().setFromAxisAngle(axis, angle)

describe('useRigCameraPose', () => {
  it('resets a bone camera capture never drives back to rest, instead of leaving it mixed in from an earlier edit', () => {
    const { findBone, applyCameraPose } = buildRig()
    // Simulate a stale pose: the shoulder is rotated by a manual edit or an earlier capture,
    // and the hand's two-bone chain has no reach back up to it.
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
})

describe('useRigCameraPose, root offset', () => {
  it('moves the skeleton root by the root offset without turning it', () => {
    const { root, applyCameraPose } = buildRig()
    const restWorldPosition = root.getWorldPosition(new THREE.Vector3())
    const restWorldQuaternion = worldQuaternionOf(root)
    const rootOffset: Vector3Data = { x: 0.3, y: 0, z: -0.2 }

    applyCameraPose(
      buildTPoseLandmarks(),
      CAMERA_POSE_MAPPING_OPTIONS_DEFAULT,
      ALL_GROUPS,
      undefined,
      { rootOffset }
    )

    const movedWorldPosition = root.getWorldPosition(new THREE.Vector3())
    expect(movedWorldPosition.x).toBeCloseTo(restWorldPosition.x + 0.3)
    expect(movedWorldPosition.z).toBeCloseTo(restWorldPosition.z - 0.2)
    expect(worldQuaternionOf(root).angleTo(restWorldQuaternion)).toBeCloseTo(0)
  })

  it('moves the root in world space even under a rotated parent', () => {
    const armature = new THREE.Group()
    armature.rotation.x = -Math.PI / 2
    const { root, applyCameraPose } = buildRig({ parent: armature })
    const restWorldPosition = root.getWorldPosition(new THREE.Vector3())

    applyCameraPose(
      buildTPoseLandmarks(),
      CAMERA_POSE_MAPPING_OPTIONS_DEFAULT,
      ALL_GROUPS,
      undefined,
      { rootOffset: { x: 0.3, y: 0, z: 0 } }
    )

    expect(root.getWorldPosition(new THREE.Vector3()).x).toBeCloseTo(restWorldPosition.x + 0.3)
  })

  it('ignores the root offset when Spine / Head is outside the target groups', () => {
    const { root, applyCameraPose } = buildRig()
    const restPosition = root.position.clone()

    applyCameraPose(
      buildTPoseLandmarks(),
      CAMERA_POSE_MAPPING_OPTIONS_DEFAULT,
      new Set<RigBodyPartGroup>(['leftArm']),
      undefined,
      { rootOffset: { x: 0.3, y: 0, z: 0 } }
    )

    expect(root.position.equals(restPosition)).toBe(true)
  })

  it('holds the root where the offset last put it on a frame with no offset', () => {
    const { root, applyCameraPose } = buildRig()
    applyCameraPose(
      buildTPoseLandmarks(),
      CAMERA_POSE_MAPPING_OPTIONS_DEFAULT,
      ALL_GROUPS,
      undefined,
      { rootOffset: { x: 0.3, y: 0, z: 0 } }
    )
    const drivenPosition = root.position.clone()

    applyCameraPose(buildTPoseLandmarks(), CAMERA_POSE_MAPPING_OPTIONS_DEFAULT, ALL_GROUPS)

    expect(root.position.equals(drivenPosition)).toBe(true)
  })
})

describe('useRigCameraPose, torso and neck', () => {
  it.each([
    ['every spine bone', [], { mixamorigSpine: 1 / 3, mixamorigSpine1: 2 / 3, mixamorigSpine2: 1 }],
    [
      'only the spine bones the rig has',
      ['mixamorigSpine1'],
      { mixamorigSpine: 1 / 2, mixamorigSpine2: 1 }
    ]
  ])('spreads the torso rotation evenly over %s', (_, withoutBones, shareByBone) => {
    const { findBone, applyCameraPose } = buildRig({ withoutBones })
    const angle = 0.6
    const restWorldByBone = new Map(
      Object.keys(shareByBone).map((name) => [name, worldQuaternionOf(findBone(name))])
    )

    applyCameraPose(
      buildTPoseLandmarks(),
      CAMERA_POSE_MAPPING_OPTIONS_DEFAULT,
      ALL_GROUPS,
      undefined,
      { torso: rotation(WORLD_UP, angle) }
    )

    Object.entries(shareByBone).forEach(([name, share]) => {
      const expected = rotation(WORLD_UP, angle * share).multiply(restWorldByBone.get(name)!)
      expect(worldQuaternionOf(findBone(name)).angleTo(expected)).toBeCloseTo(0)
    })
  })

  it('turns the neck alone for a neck rotation, leaving the spine and shoulders at rest', () => {
    const { findBone, applyCameraPose } = buildRig()
    const neck = rotation(WORLD_UP, 0.5)
    const restNeckWorld = worldQuaternionOf(findBone('mixamorigNeck'))
    const restSpine = findBone('mixamorigSpine2').quaternion.clone()
    const restShoulderWorld = worldQuaternionOf(findBone('mixamorigLeftShoulder'))

    applyCameraPose(
      buildTPoseLandmarks(),
      CAMERA_POSE_MAPPING_OPTIONS_DEFAULT,
      ALL_GROUPS,
      undefined,
      { neck }
    )

    expect(
      worldQuaternionOf(findBone('mixamorigNeck')).angleTo(neck.clone().multiply(restNeckWorld))
    ).toBeCloseTo(0)
    expect(findBone('mixamorigSpine2').quaternion.angleTo(restSpine)).toBeCloseTo(0)
    expect(
      worldQuaternionOf(findBone('mixamorigLeftShoulder')).angleTo(restShoulderWorld)
    ).toBeCloseTo(0)
  })

  it('turns the neck in the frame of the torso it rides on', () => {
    const { findBone, applyCameraPose } = buildRig()
    const torso = rotation(WORLD_UP, 0.4)
    const neck = rotation(WORLD_RIGHT, 0.3)
    const restNeckWorld = worldQuaternionOf(findBone('mixamorigNeck'))

    applyCameraPose(
      buildTPoseLandmarks(),
      CAMERA_POSE_MAPPING_OPTIONS_DEFAULT,
      ALL_GROUPS,
      undefined,
      { torso, neck }
    )

    const expected = torso.clone().multiply(neck).multiply(restNeckWorld)
    expect(worldQuaternionOf(findBone('mixamorigNeck')).angleTo(expected)).toBeCloseTo(0)
  })

  it.each([
    ['a neck the capture did not detect', []],
    ['a rig without a neck bone', ['mixamorigNeck']]
  ])('carries the head along with the torso for %s', (_, withoutBones) => {
    const { findBone, applyCameraPose } = buildRig({ withoutBones })
    const torso = rotation(WORLD_UP, 0.4)
    const restHeadWorld = worldQuaternionOf(findBone('mixamorigHead'))

    applyCameraPose(
      buildTPoseLandmarks(),
      CAMERA_POSE_MAPPING_OPTIONS_DEFAULT,
      ALL_GROUPS,
      undefined,
      { torso, neck: null }
    )

    expect(
      worldQuaternionOf(findBone('mixamorigHead')).angleTo(torso.clone().multiply(restHeadWorld))
    ).toBeCloseTo(0)
  })

  it('leaves the spine and neck as they were when Spine / Head is outside the target groups', () => {
    const { findBone, applyCameraPose } = buildRig()
    const spine = findBone('mixamorigSpine1')
    spine.quaternion.setFromEuler(new THREE.Euler(0.2, 0, 0))
    const staleSpine = spine.quaternion.clone()
    const neckBone = findBone('mixamorigNeck')
    const staleNeck = neckBone.quaternion.clone()

    applyCameraPose(
      buildTPoseLandmarks(),
      CAMERA_POSE_MAPPING_OPTIONS_DEFAULT,
      new Set<RigBodyPartGroup>(['leftArm']),
      undefined,
      { torso: rotation(WORLD_UP, 0.4), neck: rotation(WORLD_UP, 0.4) }
    )

    expect(spine.quaternion.equals(staleSpine)).toBe(true)
    expect(neckBone.quaternion.equals(staleNeck)).toBe(true)
  })
})
