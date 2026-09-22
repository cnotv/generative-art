import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { angleNearReference, isBoneRollFlip, trackBoneRoll } from './boneRollTracking'
import type { BoneRollFlipSettings, BoneRollTrack } from './types'

const SETTINGS: BoneRollFlipSettings = {
  flipRadians: Math.PI / 2,
  confirmReadings: 3,
  maxVelocityRadiansPerSecond: 2 * Math.PI,
  resetSeconds: 0.5
}

const FRAME_SECONDS = 1 / 30

const trackAt = (angle: number, velocity: number, pendingReadings = 0): BoneRollTrack => ({
  angle,
  velocity,
  pendingReadings
})

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

describe('trackBoneRoll', () => {
  it('takes a first reading as it stands, with no movement behind it', () => {
    const { angle, track } = trackBoneRoll(undefined, 1.2, FRAME_SECONDS, SETTINGS)

    expect(angle).toBeCloseTo(1.2, 6)
    expect(track).toEqual({ angle: 1.2, velocity: 0, pendingReadings: 0 })
  })

  it('starts over after a gap longer than the reset, so a resumed capture lands whole', () => {
    const { angle, track } = trackBoneRoll(trackAt(3.0, 2), -3.0, 1, SETTINGS)

    expect(angle).toBeCloseTo(-3.0, 6)
    expect(track.velocity).toBe(0)
  })

  it('runs a roll on past half a turn rather than letting it jump sign', () => {
    const crossing = trackBoneRoll(trackAt(3.1, 1), -3.1, FRAME_SECONDS, SETTINGS)

    expect(crossing.angle).toBeCloseTo(-3.1 + 2 * Math.PI, 6)
    expect(crossing.track.velocity).toBeGreaterThan(0)
  })

  it('reads the direction of movement from an accepted reading', () => {
    const turning = trackBoneRoll(trackAt(0, 0), 0.2, FRAME_SECONDS, SETTINGS)

    expect(turning.track.velocity).toBeCloseTo(0.2 * 30, 6)
    expect(turning.track.pendingReadings).toBe(0)
  })

  it('holds a reading that reverses the direction of movement by more than the flip threshold', () => {
    const flipped = trackBoneRoll(trackAt(0.1, 4), -2.5, FRAME_SECONDS, SETTINGS)

    expect(flipped.angle).toBeCloseTo(0.1, 6)
    expect(flipped.track.velocity).toBe(0)
    expect(flipped.track.pendingReadings).toBe(1)
  })

  it('accepts the departure once enough readings in a row agree it is real', () => {
    const confirmed = trackBoneRoll(trackAt(0.1, 0, 2), -2.5, FRAME_SECONDS, SETTINGS)

    expect(confirmed.angle).toBeCloseTo(-2.5, 6)
    expect(confirmed.track.pendingReadings).toBe(0)
  })

  it('lets a fast turn already under way through, since it is where the roll was heading', () => {
    const settings = { ...SETTINGS, maxVelocityRadiansPerSecond: 60 }
    const heading = trackBoneRoll(trackAt(0, 45), 1.5, FRAME_SECONDS, settings)

    expect(heading.angle).toBeCloseTo(1.5, 6)
    expect(heading.track.pendingReadings).toBe(0)
  })

  it('never remembers a roll moving faster than the cap, so one jump cannot run the guess away', () => {
    const jumped = trackBoneRoll(trackAt(0, 0, 2), 1.4, FRAME_SECONDS, SETTINGS)

    expect(jumped.track.velocity).toBeCloseTo(SETTINGS.maxVelocityRadiansPerSecond, 6)
  })

  it('keeps a still roll still, rather than drifting on its own', () => {
    const held = trackBoneRoll(trackAt(0.8, 0), 0.8, FRAME_SECONDS, SETTINGS)

    expect(held.angle).toBeCloseTo(0.8, 6)
    expect(held.track.velocity).toBeCloseTo(0, 6)
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
