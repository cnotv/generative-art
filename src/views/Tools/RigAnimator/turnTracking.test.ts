import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { angleNearReference, isBoneRollFlip } from './turnTracking'

describe('angleNearReference', () => {
  it.each([
    ['leaves a reading already beside the reference alone', 0.2, 0.1, 0.2],
    ['carries a reading that wrapped past half a turn on round', -3.1, 3.0, -3.1 + 2 * Math.PI],
    ['carries one that wrapped the other way back', 3.1, -3.0, 3.1 - 2 * Math.PI],
    ['picks the nearer of two full turns away', 0.1, 2 * Math.PI, 0.1 + 2 * Math.PI]
  ])('%s', (_name, angle, reference, expected) => {
    expect(angleNearReference(angle, reference)).toBeCloseTo(expected, 6)
  })
})

describe('isBoneRollFlip', () => {
  const FLIP_RADIANS = Math.PI / 2
  const rotated = (axis: THREE.Vector3, degrees: number): THREE.Quaternion =>
    new THREE.Quaternion().setFromAxisAngle(axis, THREE.MathUtils.degToRad(degrees))
  const ALONG_BONE = new THREE.Vector3(0, 1, 0)
  const ACROSS_BONE = new THREE.Vector3(1, 0, 0)

  it.each([
    ['a bone spun half over about its own length', rotated(ALONG_BONE, 180), true],
    ['a bone spun most of the way over', rotated(ALONG_BONE, 140), true],
    ['a bone barely rolled at all', rotated(ALONG_BONE, 20), false],
    ['a limb swung hard, which turns it somewhere else', rotated(ACROSS_BONE, 150), false],
    [
      'a roll that came with a swing, which no flipped cue produces',
      rotated(ALONG_BONE, 180).multiply(rotated(ACROSS_BONE, 120)),
      false
    ]
  ])('reads %s', (_name, change, expected) => {
    // Arrange
    const from = rotated(ACROSS_BONE, 35)

    // Act, Assert
    expect(isBoneRollFlip(from, from.clone().premultiply(change), FLIP_RADIANS)).toBe(expected)
  })
})
