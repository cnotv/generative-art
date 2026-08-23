import { describe, it, expect } from 'vitest'
import {
  trackPose,
  isFollowCase,
  isPlacementCase,
  isPassiveCase,
  toCameraCase,
  stepCameraCase
} from './cameraShowcase'
import { TRACK_RADIUS, TRACK_SECONDS, TARGET_HEIGHT, CAMERA_CASES } from './config'

describe('trackPose', () => {
  it('starts the target at the front of the circle', () => {
    const { position } = trackPose(0)

    expect(position[0]).toBeCloseTo(TRACK_RADIUS)
    expect(position[2]).toBeCloseTo(0)
  })

  it('keeps the target on the track at every point in the lap', () => {
    // Arrange: eight samples across one lap.
    const samples = Array.from({ length: 8 }, (_, index) => (index * TRACK_SECONDS) / 8)

    const radii = samples.map((seconds) => {
      const { position } = trackPose(seconds)
      return Math.hypot(position[0], position[2])
    })

    radii.forEach((radius) => expect(radius).toBeCloseTo(TRACK_RADIUS))
  })

  it('returns to the start after a full lap', () => {
    const start = trackPose(0).position
    const lap = trackPose(TRACK_SECONDS).position

    expect(lap[0]).toBeCloseTo(start[0])
    expect(lap[2]).toBeCloseTo(start[2])
  })

  it('holds the target at a constant height', () => {
    const heights = [0, 3, 7.5, 19].map((seconds) => trackPose(seconds).position[1])

    heights.forEach((height) => expect(height).toBe(TARGET_HEIGHT))
  })

  it('points the heading along the direction of travel, not at the centre', () => {
    // A tangent is perpendicular to the radius; a heading pointing inward or outward would
    // make first-person look at the ground or the horizon instead of down the track.
    const { position, direction } = trackPose(3)
    const dot = position[0] * direction[0] + position[2] * direction[2]

    expect(dot).toBeCloseTo(0)
  })

  it('returns a unit heading, so follow offsets are not scaled by it', () => {
    const lengths = [0, 4, 11].map((seconds) => {
      const { direction } = trackPose(seconds)
      return Math.hypot(direction[0], direction[1], direction[2])
    })

    lengths.forEach((length) => expect(length).toBeCloseTo(1))
  })
})

describe('case classification', () => {
  it.each([
    { value: 'third', follow: true, placement: false },
    { value: 'first', follow: true, placement: false },
    { value: 'free', follow: true, placement: false },
    { value: 'path', follow: false, placement: false },
    { value: 'side', follow: false, placement: true }
  ] as const)(
    'reads $value as follow=$follow placement=$placement',
    ({ value, follow, placement }) => {
      expect(isFollowCase(value)).toBe(follow)
      expect(isPlacementCase(value)).toBe(placement)
    }
  )

  it('classifies every declared case, so a new one cannot be silently ignored', () => {
    const unclassified = CAMERA_CASES.filter(
      (value) =>
        !isFollowCase(value) && !isPlacementCase(value) && !isPassiveCase(value) && value !== 'path'
    )

    expect(unclassified).toEqual([])
  })
})

describe('toCameraCase', () => {
  it.each(CAMERA_CASES)('keeps the known case %s', (value) => {
    expect(toCameraCase(value)).toBe(value)
  })

  it.each([
    { scenario: 'a stale panel value', value: 'orbit-cam' },
    { scenario: 'undefined', value: undefined },
    { scenario: 'a number', value: 3 }
  ])('falls back to third person for $scenario', ({ value }) => {
    expect(toCameraCase(value)).toBe('third')
  })
})

describe('stepCameraCase', () => {
  it('moves forward one place', () => {
    expect(stepCameraCase('third', 1)).toBe('first')
  })

  it('moves back one place', () => {
    expect(stepCameraCase('first', -1)).toBe('third')
  })

  it('wraps past the end rather than falling off it', () => {
    const last = CAMERA_CASES[CAMERA_CASES.length - 1]

    expect(stepCameraCase(last, 1)).toBe(CAMERA_CASES[0])
  })

  it('wraps before the start', () => {
    expect(stepCameraCase(CAMERA_CASES[0], -1)).toBe(CAMERA_CASES[CAMERA_CASES.length - 1])
  })

  it('returns to where it started after a full cycle', () => {
    const cycled = CAMERA_CASES.reduce((value) => stepCameraCase(value, 1), CAMERA_CASES[0])

    expect(cycled).toBe(CAMERA_CASES[0])
  })
})
