import { describe, it, expect } from 'vitest'
import {
  boneNameCanonicalizer,
  boneNameSide,
  boneSlotLabel,
  guessBoneMapping,
  resolveBoneName
} from './boneMapping'

const MIXAMO_BONES = [
  'mixamorigHips',
  'mixamorigSpine',
  'mixamorigNeck',
  'mixamorigHead',
  'mixamorigLeftShoulder',
  'mixamorigLeftArm',
  'mixamorigLeftForeArm',
  'mixamorigLeftHand',
  'mixamorigLeftHandIndex1',
  'mixamorigRightShoulder',
  'mixamorigRightArm',
  'mixamorigRightForeArm',
  'mixamorigRightHand',
  'mixamorigLeftUpLeg',
  'mixamorigLeftLeg',
  'mixamorigLeftFoot',
  'mixamorigLeftToeBase',
  'mixamorigRightUpLeg',
  'mixamorigRightLeg',
  'mixamorigRightFoot',
  'mixamorigRightToeBase'
]

const BLENDER_BONES = [
  'pelvis',
  'spine_01',
  'neck_01',
  'head',
  'clavicle_l',
  'upperarm_l',
  'lowerarm_l',
  'hand_l',
  'clavicle_r',
  'upperarm_r',
  'lowerarm_r',
  'hand_r',
  'thigh_l',
  'calf_l',
  'foot_l',
  'ball_l',
  'thigh_r',
  'calf_r',
  'foot_r',
  'ball_r'
]

describe('boneNameSide', () => {
  it.each([
    ['a spelled-out left', 'mixamorigLeftForeArm', 'left'],
    ['a spelled-out right', 'RightUpLeg', 'right'],
    ['a trailing letter', 'hand_l', 'left'],
    ['a leading letter', 'R.upperarm', 'right'],
    ['a letter between separators', 'arm L 001', 'left'],
    ['a letter inside a word', 'shoulder', 'center'],
    ['no side at all', 'mixamorigHips', 'center']
  ])('reads %s', (_, name, expected) => {
    // Arrange, Act
    const side = boneNameSide(name)

    // Assert
    expect(side).toBe(expected)
  })
})

describe('guessBoneMapping', () => {
  it('maps every canonical role to itself on a rig that already carries those names', () => {
    // Arrange, Act
    const mapping = guessBoneMapping(MIXAMO_BONES)

    // Assert
    expect(mapping.mixamorigLeftForeArm).toBe('mixamorigLeftForeArm')
    expect(mapping.mixamorigRightToeBase).toBe('mixamorigRightToeBase')
    expect(boneNameCanonicalizer(mapping)).toBeNull()
  })

  it.each([
    ['hips from a pelvis', 'mixamorigHips', 'pelvis'],
    ['the head', 'mixamorigHead', 'head'],
    ['an upper arm, not the forearm beside it', 'mixamorigLeftArm', 'upperarm_l'],
    ['a forearm from a lower arm', 'mixamorigLeftForeArm', 'lowerarm_l'],
    ['a hand', 'mixamorigRightHand', 'hand_r'],
    ['a thigh', 'mixamorigRightUpLeg', 'thigh_r'],
    ['a shin from a calf', 'mixamorigLeftLeg', 'calf_l'],
    ['toes from a ball', 'mixamorigLeftToeBase', 'ball_l'],
    ['a shoulder from a clavicle', 'mixamorigRightShoulder', 'clavicle_r']
  ])('matches %s', (_, canonical, expected) => {
    // Arrange, Act
    const mapping = guessBoneMapping(BLENDER_BONES)

    // Assert
    expect(mapping[canonical]).toBe(expected)
  })

  it('keeps a thigh out of the shin slot when both match the same fragment', () => {
    // Arrange
    const boneNames = ['Leg_L', 'UpLeg_L', 'Leg_R', 'UpLeg_R']

    // Act
    const mapping = guessBoneMapping(boneNames)

    // Assert
    expect(mapping.mixamorigLeftLeg).toBe('Leg_L')
    expect(mapping.mixamorigLeftUpLeg).toBe('UpLeg_L')
  })

  it('takes the hand itself rather than a finger hanging off it', () => {
    // Arrange, Act
    const mapping = guessBoneMapping(MIXAMO_BONES)

    // Assert
    expect(mapping.mixamorigLeftHand).toBe('mixamorigLeftHand')
  })

  it('leaves a role unmapped when no bone name says anything about it', () => {
    // Arrange, Act
    const mapping = guessBoneMapping(['Bone', 'Bone.001', 'Bone.002'])

    // Assert
    expect(mapping.mixamorigHips).toBeUndefined()
    expect(resolveBoneName(mapping, 'mixamorigHips')).toBe('mixamorigHips')
  })
})

describe('boneNameCanonicalizer', () => {
  it('reads a renamed rig back into canonical names, leaving its other bones alone', () => {
    // Arrange
    const mapping = guessBoneMapping(BLENDER_BONES)

    // Act
    const canonicalOf = boneNameCanonicalizer(mapping)

    // Assert
    expect(canonicalOf).not.toBeNull()
    expect(canonicalOf!('lowerarm_l')).toBe('mixamorigLeftForeArm')
    expect(canonicalOf!('spine_01')).toBe('spine_01')
  })
})

describe('boneSlotLabel', () => {
  it('labels a mapped role, and falls back to the name of one with no slot', () => {
    // Arrange, Act, Assert
    expect(boneSlotLabel('mixamorigLeftHand')).toBe('Hand L')
    expect(boneSlotLabel('mixamorigSpine2')).toBe('mixamorigSpine2')
  })
})
