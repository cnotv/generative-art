import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { findBoneCrossings } from './boneCrossings'
import type { RigBoneMapping } from './types'

/** A flat rig of loose bones, each parked where the test wants it, matrices already current. */
const buildBones = (positions: Record<string, [number, number, number]>): THREE.Bone[] =>
  Object.entries(positions).map(([name, [x, y, z]]) => {
    const bone = new THREE.Bone()
    bone.name = name
    bone.position.set(x, y, z)
    bone.updateMatrixWorld(true)
    return bone
  })

const APART: Record<string, [number, number, number]> = {
  mixamorigLeftHand: [-0.5, 1, 0],
  mixamorigRightHand: [0.5, 1, 0],
  mixamorigHead: [0, 1.7, 0],
  mixamorigLeftForeArm: [-0.4, 1.2, 0],
  mixamorigRightForeArm: [0.4, 1.2, 0],
  mixamorigLeftFoot: [-0.2, 0, 0],
  mixamorigRightFoot: [0.2, 0, 0]
}

describe('findBoneCrossings', () => {
  it('finds nothing on a rig standing with its limbs apart', () => {
    // Arrange
    const bones = buildBones(APART)

    // Act
    const crossings = findBoneCrossings(bones, {}, 0.1)

    // Assert
    expect(crossings).toEqual([])
  })

  it.each([
    ['hands meeting each other', { mixamorigRightHand: [-0.48, 1, 0] }, 'Hand L meets Hand R'],
    ['a hand reaching the head', { mixamorigLeftHand: [0, 1.72, 0] }, 'Hand L meets Head'],
    ['feet through one another', { mixamorigRightFoot: [-0.18, 0, 0] }, 'Foot L meets Foot R']
  ])('reports %s', (_, moved, expected) => {
    // Arrange
    const bones = buildBones({ ...APART, ...(moved as Record<string, [number, number, number]>) })

    // Act
    const crossings = findBoneCrossings(bones, {}, 0.1)

    // Assert
    expect(crossings).toContain(expected)
  })

  it('watches the bones a custom rig maps to each role, not the canonical names', () => {
    // Arrange
    const bones = buildBones({ hand_l: [0, 1, 0], hand_r: [0.02, 1, 0] })
    const mapping: RigBoneMapping = {
      mixamorigLeftHand: 'hand_l',
      mixamorigRightHand: 'hand_r'
    }

    // Act
    const crossings = findBoneCrossings(bones, mapping, 0.1)

    // Assert
    expect(crossings).toEqual(['Hand L meets Hand R'])
  })

  it('skips a pair whose bones the rig does not have', () => {
    // Arrange
    const bones = buildBones({ mixamorigLeftHand: [0, 1, 0] })

    // Act
    const crossings = findBoneCrossings(bones, {}, 0.1)

    // Assert
    expect(crossings).toEqual([])
  })
})
