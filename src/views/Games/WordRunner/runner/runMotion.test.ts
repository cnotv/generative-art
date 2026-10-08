import { describe, it, expect } from 'vitest'
import {
  laneAtOffset,
  laneOffset,
  stepLane,
  smoothingFactor,
  gateDistances,
  crossedGateIndices,
  isHintShown,
  popScale
} from './runMotion'

describe('laneOffset', () => {
  it.each([
    [0, 3, 2, -2],
    [1, 3, 2, 0],
    [2, 3, 2, 2],
    [0, 2, 3, -1.5],
    [1, 2, 3, 1.5]
  ])('puts lane %i of %i, %f wide, at x = %f', (lane, laneCount, laneWidth, expected) => {
    expect(laneOffset(lane, laneCount, laneWidth)).toBeCloseTo(expected)
  })
})

describe('stepLane', () => {
  it.each([
    [1, -1, 0],
    [1, 1, 2],
    [0, -1, 0],
    [2, 1, 2]
  ])('from lane %i, a step of %i lands on lane %i', (lane, direction, expected) => {
    expect(stepLane(lane, direction, 3)).toBe(expected)
  })
})

describe('smoothingFactor', () => {
  it('is zero for no time and approaches one for a long time', () => {
    expect(smoothingFactor(10, 0)).toBe(0)
    expect(smoothingFactor(10, 10)).toBeCloseTo(1)
  })

  it('covers the same ground in one long frame as in two half frames', () => {
    const oneFrame = smoothingFactor(8, 0.1)
    const halfFrame = smoothingFactor(8, 0.05)

    expect(1 - (1 - halfFrame) ** 2).toBeCloseTo(oneFrame)
  })
})

describe('gateDistances', () => {
  it('spaces the gates evenly after a lead-in from where the lap starts', () => {
    expect(gateDistances(100, 3, 20, 15)).toEqual([120, 135, 150])
  })

  it('has no gates for an empty lap', () => {
    expect(gateDistances(0, 0, 20, 15)).toEqual([])
  })
})

describe('crossedGateIndices', () => {
  const distances = [120, 135, 150]

  it.each([
    [100, 119, []],
    [119, 120, [0]],
    [120, 121, []],
    [130, 140, [1]],
    [118, 152, [0, 1, 2]]
  ])('moving from %f to %f crosses gates %j', (previous, current, expected) => {
    expect(crossedGateIndices(previous, current, distances)).toEqual(expected)
  })
})

describe('isHintShown', () => {
  it.each([
    ['full', 80, true],
    ['full', 2, true],
    ['late', 80, false],
    ['late', 12, true],
    ['none', 2, false]
  ] as const)('a %s hint %f ahead is shown: %s', (hint, distanceAhead, expected) => {
    expect(isHintShown(hint, distanceAhead, 14)).toBe(expected)
  })
})

describe('laneAtOffset', () => {
  it.each([
    [0, 1],
    [-3.6, 0],
    [3.6, 2],
    [-1.7, 1],
    [1.9, 2],
    [-9, 0],
    [9, 2]
  ])('a ball %f off the centreline is in lane %i', (offset, expected) => {
    expect(laneAtOffset(offset, 3, 3.6)).toBe(expected)
  })

  it('is the lane whose centre laneOffset gives', () => {
    expect([0, 1, 2].map((lane) => laneAtOffset(laneOffset(lane, 3, 3.6), 3, 3.6))).toEqual([
      0, 1, 2
    ])
  })
})

describe('popScale', () => {
  it.each([
    [0, 0],
    [-1, 0],
    [0.4, 1],
    [2, 1]
  ])('at %f seconds into a 0.4 second pop is %f', (ageSeconds, expected) => {
    // Act
    const scale = popScale(ageSeconds, 0.4, 2.5)

    // Assert
    expect(scale).toBeCloseTo(expected)
  })

  it('overshoots full size on the way before settling', () => {
    // Arrange
    const ages = Array.from({ length: 40 }, (_, step) => (step / 40) * 0.4)

    // Act
    const largest = Math.max(...ages.map((age) => popScale(age, 0.4, 2.5)))

    // Assert
    expect(largest).toBeGreaterThan(1.1)
  })

  it('never overshoots with no spring', () => {
    // Arrange
    const ages = Array.from({ length: 40 }, (_, step) => (step / 40) * 0.4)

    // Act
    const largest = Math.max(...ages.map((age) => popScale(age, 0.4, 0)))

    // Assert
    expect(largest).toBeLessThanOrEqual(1)
  })
})
