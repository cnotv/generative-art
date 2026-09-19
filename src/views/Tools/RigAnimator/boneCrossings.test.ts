import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { boneCrossingRestDistances, findBoneCrossings } from './boneCrossings'

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

/** The rig at rest, and the same rig with some bones moved, judged against those rest distances. */
const crossingsAfterMoving = (moved: Record<string, [number, number, number]> = {}): string[] => {
  const restDistances = boneCrossingRestDistances(buildBones(APART))
  return findBoneCrossings(buildBones({ ...APART, ...moved }), restDistances, 0.35)
}

describe('findBoneCrossings', () => {
  it('finds nothing on the rig it measured at rest, feet included', () => {
    // Arrange, Act
    const crossings = crossingsAfterMoving()

    // Assert
    expect(crossings).toEqual([])
  })

  it.each([
    ['hands meeting each other', { mixamorigRightHand: [-0.48, 1, 0] }, 'Hand L meets Hand R'],
    ['a hand reaching the head', { mixamorigLeftHand: [0, 1.72, 0] }, 'Hand L meets Head'],
    ['feet through one another', { mixamorigRightFoot: [-0.18, 0, 0] }, 'Foot L meets Foot R']
  ])('reports %s', (_, moved, expected) => {
    // Arrange, Act
    const crossings = crossingsAfterMoving(moved as Record<string, [number, number, number]>)

    // Assert
    expect(crossings).toContain(expected)
  })

  it('judges each pair against its own rest distance, not one distance for the rig', () => {
    // Arrange: the feet stand a fifth as far apart as the hands do, and both stay at rest.
    const restDistances = boneCrossingRestDistances(buildBones(APART))

    // Act
    const feetApart = restDistances.get('Foot L meets Foot R')!
    const handsApart = restDistances.get('Hand L meets Hand R')!

    // Assert: one shared threshold between the two would have to sit outside both.
    expect(feetApart).toBeLessThan(handsApart / 2)
    expect(crossingsAfterMoving({ mixamorigRightFoot: [0.18, 0, 0] })).toEqual([])
  })

  it('skips a pair whose bones the rig does not have', () => {
    // Arrange
    const bones = buildBones({ mixamorigLeftHand: [0, 1, 0] })

    // Act
    const crossings = findBoneCrossings(bones, boneCrossingRestDistances(bones), 0.35)

    // Assert
    expect(crossings).toEqual([])
  })
})
