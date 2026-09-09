import { describe, it, expect } from 'vitest'
import { buildMarbleDropPosition, pickMarbleRadius, pickMarbleTexture } from './marbles'
import { MARBLE_FLOW_JITTER_FRACTION, MARBLE_RADIUS_FRACTION_RANGE } from './config'
import { MARBLE_OPTIONS } from '@/views/Games/MarbleMadness/config'

const RIG_DIAGONAL = 2
const CENTER: [number, number, number] = [1, 0, -2]

describe('buildMarbleDropPosition', () => {
  it.each([0, 0.5, 1])('keeps the horizontal jitter within range for random() = %s', (random) => {
    const jitter = RIG_DIAGONAL * MARBLE_FLOW_JITTER_FRACTION
    const position = buildMarbleDropPosition(CENTER, 3, RIG_DIAGONAL, () => random)

    expect(Math.abs(position[0] - CENTER[0])).toBeLessThanOrEqual(jitter + Number.EPSILON)
    expect(Math.abs(position[2] - CENTER[2])).toBeLessThanOrEqual(jitter + Number.EPSILON)
  })

  it('drops at the given height above the centre', () => {
    const position = buildMarbleDropPosition(CENTER, 3, RIG_DIAGONAL, () => 0.5)

    expect(position[1]).toBe(CENTER[1] + 3)
  })
})

describe('pickMarbleRadius', () => {
  it.each([0, 0.5, 1])('stays within the configured range for random() = %s', (random) => {
    const [minimum, maximum] = MARBLE_RADIUS_FRACTION_RANGE
    const radius = pickMarbleRadius(RIG_DIAGONAL, () => random)

    expect(radius).toBeGreaterThanOrEqual(RIG_DIAGONAL * minimum)
    expect(radius).toBeLessThanOrEqual(RIG_DIAGONAL * maximum)
  })
})

describe('pickMarbleTexture', () => {
  it('always picks one of the Marble Editor textures', () => {
    const texture = pickMarbleTexture(() => 0.999)

    expect(MARBLE_OPTIONS.map((option) => option.url)).toContain(texture)
  })
})
