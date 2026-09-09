import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { rigGenerateHumanoidSkeleton } from '@webgamekit/rig'
import {
  RIG_BODY_PART_GROUPS,
  boneBodyPartGroup,
  boneNamesInGroups,
  selectedBodyPartGroups,
  type RigBodyPartGroup
} from './bodyPartGroups'
import type { RigAnimatorConfig } from './types'

const buildBones = (): THREE.Bone[] => {
  const box = new THREE.Box3(new THREE.Vector3(-0.5, 0, -0.25), new THREE.Vector3(0.5, 2, 0.25))
  const { bones } = rigGenerateHumanoidSkeleton(box)
  return bones
}

const findBone = (bones: THREE.Bone[], name: string): THREE.Bone => {
  const bone = bones.find((candidate) => candidate.name === name)
  if (!bone) throw new Error(`missing bone ${name}`)
  return bone
}

describe('boneBodyPartGroup', () => {
  it.each([
    ['mixamorigLeftShoulder', 'leftArm'],
    ['mixamorigLeftArm', 'leftArm'],
    ['mixamorigLeftForeArm', 'leftArm'],
    ['mixamorigLeftHand', 'leftArm'],
    ['mixamorigRightShoulder', 'rightArm'],
    ['mixamorigRightHand', 'rightArm'],
    ['mixamorigLeftUpLeg', 'leftLeg'],
    ['mixamorigLeftFoot', 'leftLeg'],
    ['mixamorigRightUpLeg', 'rightLeg'],
    ['mixamorigRightFoot', 'rightLeg'],
    ['mixamorigHips', 'spineHead'],
    ['mixamorigSpine1', 'spineHead'],
    ['mixamorigNeck', 'spineHead'],
    ['mixamorigHead', 'spineHead']
  ] as [string, RigBodyPartGroup][])('classifies %s as %s', (boneName, expectedGroup) => {
    const bones = buildBones()
    expect(boneBodyPartGroup(findBone(bones, boneName))).toBe(expectedGroup)
  })

  it('classifies a finger bone by walking up to its hand, not just its immediate parent', () => {
    const bones = buildBones()
    const hand = findBone(bones, 'mixamorigLeftHand')
    const finger = new THREE.Bone()
    finger.name = 'mixamorigLeftHandThumb1'
    hand.add(finger)

    expect(boneBodyPartGroup(finger)).toBe('leftArm')
  })
})

describe('boneNamesInGroups', () => {
  it('resolves every bone whose group is in the selection, and none whose group is not', () => {
    const bones = buildBones()
    const names = boneNamesInGroups(bones, new Set<RigBodyPartGroup>(['leftArm']))

    expect(names.has('mixamorigLeftShoulder')).toBe(true)
    expect(names.has('mixamorigLeftArm')).toBe(true)
    expect(names.has('mixamorigLeftHand')).toBe(true)
    expect(names.has('mixamorigRightArm')).toBe(false)
    expect(names.has('mixamorigLeftUpLeg')).toBe(false)
    expect(names.has('mixamorigHips')).toBe(false)
  })

  it('resolves every bone when every group is selected', () => {
    const bones = buildBones()
    const names = boneNamesInGroups(bones, new Set(RIG_BODY_PART_GROUPS))
    expect(names.size).toBe(bones.length)
  })

  it('resolves no bone when no group is selected', () => {
    const bones = buildBones()
    const names = boneNamesInGroups(bones, new Set())
    expect(names.size).toBe(0)
  })
})

describe('selectedBodyPartGroups', () => {
  const baseConfig = {
    targetLeftArm: false,
    targetRightArm: false,
    targetLeftLeg: false,
    targetRightLeg: false,
    targetSpineHead: false
  } as unknown as RigAnimatorConfig

  it('reads only the groups whose config flag is true', () => {
    const groups = selectedBodyPartGroups({
      ...baseConfig,
      targetLeftArm: true,
      targetSpineHead: true
    })
    expect(groups).toEqual(new Set<RigBodyPartGroup>(['leftArm', 'spineHead']))
  })

  it('returns an empty set when every flag is false', () => {
    expect(selectedBodyPartGroups(baseConfig).size).toBe(0)
  })
})
