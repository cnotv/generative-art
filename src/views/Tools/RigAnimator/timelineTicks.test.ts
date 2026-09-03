import { describe, it, expect } from 'vitest'
import { computeTickInterval, computeTimelineTicks } from './timelineTicks'

describe('computeTickInterval', () => {
  it.each([
    [150, 10],
    [10, 1],
    [50, 5],
    [1000, 100],
    [10000, 1000]
  ])('picks interval %s for a frame range of %s', (frameMax, expectedInterval) => {
    expect(computeTickInterval(frameMax)).toBe(expectedInterval)
  })
})

describe('computeTimelineTicks', () => {
  it('marks every interval from zero up to the frame range', () => {
    expect(computeTimelineTicks(50)).toEqual([0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50])
  })

  it('adds the frame range itself when it does not land on an interval', () => {
    expect(computeTimelineTicks(153)).toEqual([0, 20, 40, 60, 80, 100, 120, 140, 153])
  })

  it('returns a single tick for a zero frame range', () => {
    expect(computeTimelineTicks(0)).toEqual([0])
  })
})
