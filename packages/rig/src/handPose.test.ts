import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { applyHandPose, resolveHandSide, handPoseRequiredBoneNames } from './handPose'
import { HAND_POSE_PRESETS } from './config'

const buildBone = (name: string): THREE.Bone => {
  const bone = new THREE.Bone()
  bone.name = name
  return bone
}

/** An identity rest quaternion for every named bone, the no-twist case every straight finger
 * (everything but the thumb) rests at on a mixamorig-named rig. */
const identityRestQuaternions = (names: string[]): Map<string, THREE.Quaternion> =>
  new Map(names.map((name) => [name, new THREE.Quaternion()]))

describe('resolveHandSide', () => {
  it.each([
    ['mixamorigLeftHand', 'Left'],
    ['mixamorigLeftHandIndex1', 'Left'],
    ['mixamorigRightHand', 'Right'],
    ['mixamorigRightHandPinky3', 'Right'],
    ['mixamorigHead', null],
    ['mixamorigLeftForeArm', null]
  ])('resolves %s to %s', (boneName, expected) => {
    expect(resolveHandSide(boneName)).toBe(expected)
  })
})

describe('handPoseRequiredBoneNames', () => {
  it('lists all 15 finger bones for a side', () => {
    const names = handPoseRequiredBoneNames('Left')
    expect(names).toHaveLength(15)
    expect(names).toContain('mixamorigLeftHandThumb1')
    expect(names).toContain('mixamorigLeftHandPinky3')
  })
})

describe('applyHandPose', () => {
  it('curls every finger joint to the preset angle', () => {
    const names = handPoseRequiredBoneNames('Right')
    const bones = names.map(buildBone)
    applyHandPose(bones, 'Right', HAND_POSE_PRESETS.Fist, identityRestQuaternions(names))

    const index1 = bones.find((bone) => bone.name === 'mixamorigRightHandIndex1')!
    expect(index1.rotation.x).toBeCloseTo(HAND_POSE_PRESETS.Fist.index[0])
  })

  it('leaves a finger straight for the Open preset', () => {
    const names = handPoseRequiredBoneNames('Left')
    const bones = names.map(buildBone)
    applyHandPose(bones, 'Left', HAND_POSE_PRESETS.Open, identityRestQuaternions(names))

    bones.forEach((bone) => expect(bone.rotation.x).toBeCloseTo(0))
  })

  it('skips bones the rig does not have instead of throwing', () => {
    const bones = [buildBone('mixamorigLeftHandIndex1')]
    const restQuaternions = identityRestQuaternions(['mixamorigLeftHandIndex1'])
    expect(() =>
      applyHandPose(bones, 'Left', HAND_POSE_PRESETS.Fist, restQuaternions)
    ).not.toThrow()
    expect(bones[0].rotation.x).toBeCloseTo(HAND_POSE_PRESETS.Fist.index[0])
  })

  it('skips a bone with no recorded rest quaternion instead of throwing', () => {
    const bones = [buildBone('mixamorigLeftHandIndex1')]
    expect(() => applyHandPose(bones, 'Left', HAND_POSE_PRESETS.Fist, new Map())).not.toThrow()
    expect(bones[0].rotation.x).toBe(0)
  })

  it('never touches the other hand', () => {
    const leftNames = handPoseRequiredBoneNames('Left')
    const rightNames = handPoseRequiredBoneNames('Right')
    const leftBones = leftNames.map(buildBone)
    const rightBones = rightNames.map(buildBone)
    const restQuaternions = identityRestQuaternions([...leftNames, ...rightNames])
    applyHandPose([...leftBones, ...rightBones], 'Right', HAND_POSE_PRESETS.Fist, restQuaternions)

    leftBones.forEach((bone) => expect(bone.rotation.x).toBe(0))
  })

  it('composes the curl on top of a joint’s own rest tilt, not just its Euler X component', () => {
    // The thumb's real rest pose on a mixamorig-named rig: a substantial tilt on every axis,
    // not the near-zero rest the four straight fingers have. Confirmed against the bundled
    // model's own actual FBX-loaded rest pose (rotation.x/y/z roughly 0.30/0.20/0.58 for
    // mixamorigLeftHandThumb1), an anatomical fact of thumb opposition rather than noise.
    const name = 'mixamorigLeftHandThumb1'
    const bone = buildBone(name)
    const restQuaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.3, 0.2, 0.58))
    const restQuaternions = new Map([[name, restQuaternion]])
    const preset: typeof HAND_POSE_PRESETS.Fist = {
      ...HAND_POSE_PRESETS.Open,
      thumb: [0.7, 0, 0]
    }

    applyHandPose([bone], 'Left', preset, restQuaternions)

    // This joint's angle is negated (see `THUMB_CMC_JOINT_INDEX`'s own doc comment), so the
    // composed rotation uses -0.7, not the preset's own +0.7.
    const expectedQuaternion = restQuaternion
      .clone()
      .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -0.7))
    expect(bone.quaternion.angleTo(expectedQuaternion)).toBeLessThan(1e-6)
    // Overwriting just the Euler X component and leaving the rest pose's own y/z in place
    // would have landed somewhere else entirely; this is the exact bug the composition fixes.
    expect(bone.quaternion.angleTo(restQuaternion)).toBeGreaterThan(0.1)
  })

  it('does not negate the thumb’s other two joints, whose own rest carries no twist', () => {
    // mixamorigLeftHandThumb2 and Thumb3's own real rest pose on a mixamorig-named rig: close
    // enough to identity (roughly -0.06/0/0 and -0.04/0/0) that they behave like the straight
    // fingers, unlike the thumb's first joint.
    const name = 'mixamorigLeftHandThumb2'
    const bone = buildBone(name)
    const restQuaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.06, 0, 0))
    const restQuaternions = new Map([[name, restQuaternion]])
    const preset: typeof HAND_POSE_PRESETS.Fist = {
      ...HAND_POSE_PRESETS.Open,
      thumb: [0, 0.6, 0]
    }

    applyHandPose([bone], 'Left', preset, restQuaternions)

    const expectedQuaternion = restQuaternion
      .clone()
      .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), 0.6))
    expect(bone.quaternion.angleTo(expectedQuaternion)).toBeLessThan(1e-6)
  })

  it('curls the thumb toward the palm, not away from it, the failure this fixes', () => {
    // A minimal three-joint thumb chain off a hand root, using the bundled model's own real
    // rest orientations, plus a reference point standing in for the rest of the palm. Confirms
    // the actual, physical direction of the fix (tip distance to the palm shrinks), not just
    // that some rotation composed correctly.
    const hand = buildBone('mixamorigLeftHand')
    const thumb1 = buildBone('mixamorigLeftHandThumb1')
    const thumb2 = buildBone('mixamorigLeftHandThumb2')
    const thumb3 = buildBone('mixamorigLeftHandThumb3')
    const palmReference = buildBone('mixamorigLeftHandMiddle1')
    thumb1.position.set(0, 1, 0)
    thumb2.position.set(0, 1, 0)
    thumb3.position.set(0, 1, 0)
    palmReference.position.set(1, 0, 0)
    thumb1.rotation.set(0.3, 0.2, 0.58)
    thumb2.rotation.set(-0.06, 0, 0)
    thumb3.rotation.set(-0.04, 0, 0)
    hand.add(thumb1)
    thumb1.add(thumb2)
    thumb2.add(thumb3)
    hand.add(palmReference)
    hand.updateMatrixWorld(true)

    const bones = [hand, thumb1, thumb2, thumb3, palmReference]
    const restQuaternions = new Map(bones.map((bone) => [bone.name, bone.quaternion.clone()]))
    const palmPosition = palmReference.getWorldPosition(new THREE.Vector3())
    const distanceBefore = thumb3.getWorldPosition(new THREE.Vector3()).distanceTo(palmPosition)

    applyHandPose(bones, 'Left', HAND_POSE_PRESETS.Fist, restQuaternions)
    hand.updateMatrixWorld(true)

    const distanceAfter = thumb3.getWorldPosition(new THREE.Vector3()).distanceTo(palmPosition)
    expect(distanceAfter).toBeLessThan(distanceBefore)
  })
})
