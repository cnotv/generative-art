import { describe, it, expect } from 'vitest'
import { spawnPosition } from './useRockRun'
import { createTrackPath } from '../trackPath'
import { ROCK_RADIUS, ROCK_SPAWN_HEIGHT, SPAWN_GATE_SPREAD } from '../config'

const path = createTrackPath(2024)

describe('spawnPosition', () => {
  // The rock is held still through the countdown, so any gap above the deck
  // would only show up as a lurch the instant it is released.
  it('rests the rock on the deck rather than above it', () => {
    const [, y] = spawnPosition(path, 1, 0)
    const ground = path.sampleAt(0).position.y

    expect(y - ground).toBeGreaterThanOrEqual(ROCK_RADIUS)
    expect(y - ground).toBeLessThan(ROCK_RADIUS + 0.5)
    expect(ROCK_SPAWN_HEIGHT).toBeGreaterThanOrEqual(ROCK_RADIUS)
  })

  it('puts a lone player on the centreline', () => {
    const [x, , z] = spawnPosition(path, 1, 0)
    const centre = path.sampleAt(0).position

    expect(x).toBeCloseTo(centre.x)
    expect(z).toBeCloseTo(centre.z)
  })

  it.each([
    [2, 0],
    [2, 1],
    [4, 0],
    [4, 3]
  ])('keeps %i players inside the start line at slot %i', (count, index) => {
    const [x, , z] = spawnPosition(path, count, index)
    const centre = path.sampleAt(0).position
    const offset = Math.hypot(x - centre.x, z - centre.z)

    expect(offset).toBeLessThanOrEqual(SPAWN_GATE_SPREAD + 1e-6)
  })

  it('spreads players apart so they cannot spawn inside each other', () => {
    const first = spawnPosition(path, 3, 0)
    const last = spawnPosition(path, 3, 2)
    const gap = Math.hypot(first[0] - last[0], first[2] - last[2])

    expect(gap).toBeGreaterThan(ROCK_RADIUS * 2)
  })

  it('spawns every player at the same height', () => {
    const heights = [0, 1, 2].map((index) => spawnPosition(path, 3, index)[1])

    expect(new Set(heights.map((height) => height.toFixed(6))).size).toBe(1)
  })
})
