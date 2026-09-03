import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { applyHandPose, resolveHandSide, handPoseRequiredBoneNames } from './handPose'
import { HAND_POSE_PRESETS } from './config'

const buildBone = (name: string): THREE.Bone => {
  const bone = new THREE.Bone()
  bone.name = name
  return bone
}

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
    const bones = handPoseRequiredBoneNames('Right').map(buildBone)
    applyHandPose(bones, 'Right', HAND_POSE_PRESETS.Fist)

    const index1 = bones.find((bone) => bone.name === 'mixamorigRightHandIndex1')!
    expect(index1.rotation.x).toBeCloseTo(HAND_POSE_PRESETS.Fist.index[0])
  })

  it('leaves a finger straight for the Open preset', () => {
    const bones = handPoseRequiredBoneNames('Left').map(buildBone)
    applyHandPose(bones, 'Left', HAND_POSE_PRESETS.Open)

    bones.forEach((bone) => expect(bone.rotation.x).toBe(0))
  })

  it('skips bones the rig does not have instead of throwing', () => {
    const bones = [buildBone('mixamorigLeftHandIndex1')]
    expect(() => applyHandPose(bones, 'Left', HAND_POSE_PRESETS.Fist)).not.toThrow()
    expect(bones[0].rotation.x).toBeCloseTo(HAND_POSE_PRESETS.Fist.index[0])
  })

  it('never touches the other hand', () => {
    const leftBones = handPoseRequiredBoneNames('Left').map(buildBone)
    const rightBones = handPoseRequiredBoneNames('Right').map(buildBone)
    applyHandPose([...leftBones, ...rightBones], 'Right', HAND_POSE_PRESETS.Fist)

    leftBones.forEach((bone) => expect(bone.rotation.x).toBe(0))
  })
})
