import { describe, it, expect } from 'vitest'
import { buildMarbleSpawnPlan } from './marbles'
import {
  MARBLE_DROP_HEIGHT_FRACTION,
  MARBLE_PALETTE,
  MARBLE_RADIUS_FRACTION_RANGE,
  MARBLE_SPREAD_FRACTION,
  MARBLE_STACK_HEIGHT_FRACTION
} from './config'

const RIG_DIAGONAL = 2
const OPTIONS = {
  count: 24,
  seed: 7,
  center: [1, 0, -2] as [number, number, number],
  rigDiagonal: RIG_DIAGONAL
}

describe('buildMarbleSpawnPlan', () => {
  it('plans exactly the requested number of marbles', () => {
    expect(buildMarbleSpawnPlan(OPTIONS)).toHaveLength(24)
  })

  it.each([0, -5])('plans nothing for a count of %s', (count) => {
    expect(buildMarbleSpawnPlan({ ...OPTIONS, count })).toEqual([])
  })

  it('lays the same marbles out every time for one seed', () => {
    expect(buildMarbleSpawnPlan(OPTIONS)).toEqual(buildMarbleSpawnPlan(OPTIONS))
  })

  it('lays a different set out for a different seed', () => {
    const first = buildMarbleSpawnPlan(OPTIONS)
    const second = buildMarbleSpawnPlan({ ...OPTIONS, seed: 8 })

    expect(first).not.toEqual(second)
  })

  it('keeps the opening marbles when the count grows, so raising it only adds', () => {
    const smaller = buildMarbleSpawnPlan({ ...OPTIONS, count: 5 })
    const larger = buildMarbleSpawnPlan({ ...OPTIONS, count: 9 })

    expect(larger.slice(0, 5)).toEqual(smaller)
  })

  it('drops every marble inside the spread square around the centre', () => {
    const spread = RIG_DIAGONAL * MARBLE_SPREAD_FRACTION

    buildMarbleSpawnPlan(OPTIONS).forEach(({ position }) => {
      expect(Math.abs(position[0] - OPTIONS.center[0])).toBeLessThanOrEqual(spread)
      expect(Math.abs(position[2] - OPTIONS.center[2])).toBeLessThanOrEqual(spread)
    })
  })

  it('stacks every marble above the rig, within the drop column', () => {
    const lowest = OPTIONS.center[1] + RIG_DIAGONAL * MARBLE_DROP_HEIGHT_FRACTION
    const highest = lowest + RIG_DIAGONAL * MARBLE_STACK_HEIGHT_FRACTION

    buildMarbleSpawnPlan(OPTIONS).forEach(({ position }) => {
      expect(position[1]).toBeGreaterThanOrEqual(lowest)
      expect(position[1]).toBeLessThanOrEqual(highest)
    })
  })

  it('sizes every marble within the range the rig scales to', () => {
    const [smallest, largest] = MARBLE_RADIUS_FRACTION_RANGE

    buildMarbleSpawnPlan(OPTIONS).forEach(({ radius }) => {
      expect(radius).toBeGreaterThanOrEqual(RIG_DIAGONAL * smallest)
      expect(radius).toBeLessThanOrEqual(RIG_DIAGONAL * largest)
    })
  })

  it('paints every marble from a matched pair in the palette', () => {
    buildMarbleSpawnPlan(OPTIONS).forEach(({ baseColor, swirlColor }) => {
      expect(MARBLE_PALETTE).toContainEqual({ base: baseColor, swirl: swirlColor })
    })
  })

  it('varies the palette across a plan rather than repeating one tint', () => {
    const usedColors = new Set(buildMarbleSpawnPlan(OPTIONS).map(({ baseColor }) => baseColor))

    expect(usedColors.size).toBeGreaterThan(1)
  })

  it('gives each marble its own swirl seed, so no two share a pattern', () => {
    const swirlSeeds = buildMarbleSpawnPlan(OPTIONS).map(({ swirlSeed }) => swirlSeed)

    expect(new Set(swirlSeeds).size).toBe(swirlSeeds.length)
  })
})
