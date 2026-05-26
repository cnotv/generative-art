import { describe, it, expect } from 'vitest'
import {
  PLATFORMS,
  OBSTACLES,
  SPAWN_POSITION,
  FINISH_POSITION,
  FINISH_CHECK_Z,
  FALL_THRESHOLD_Y,
  MARBLE_RADIUS,
  MOVE_FORCE,
  MAX_LINEAR_SPEED
} from './config'

describe('PLATFORMS', () => {
  it('defines at least one platform', () => {
    expect(PLATFORMS.length).toBeGreaterThan(0)
  })

  it.each(PLATFORMS.map((p, i) => [i, p] as const))(
    'platform %i has positive size dimensions',
    (_i, platform) => {
      const [w, h, d] = platform.size
      expect(w).toBeGreaterThan(0)
      expect(h).toBeGreaterThan(0)
      expect(d).toBeGreaterThan(0)
    }
  )

  it('has a finish platform marked', () => {
    const finishPlatforms = PLATFORMS.filter((p) => p.isFinish)
    expect(finishPlatforms.length).toBe(1)
  })

  it('start platform (index 0) covers spawn x/z position', () => {
    const start = PLATFORMS[0]
    const [pw, , pd] = start.size
    const [px, , pz] = start.position
    const [sx, , sz] = SPAWN_POSITION
    expect(Math.abs(sx - px)).toBeLessThan(pw / 2)
    expect(Math.abs(sz - pz)).toBeLessThan(pd / 2)
  })
})

describe('OBSTACLES', () => {
  it.each(OBSTACLES.map((o, i) => [i, o] as const))(
    'obstacle %i has positive size dimensions',
    (_i, obstacle) => {
      const [w, h, d] = obstacle.size
      expect(w).toBeGreaterThan(0)
      expect(h).toBeGreaterThan(0)
      expect(d).toBeGreaterThan(0)
    }
  )
})

describe('spawn and finish positions', () => {
  it('spawn Y is above start platform top surface', () => {
    const startPlatform = PLATFORMS[0]
    const platformTop = startPlatform.position[1] + startPlatform.size[1] / 2
    expect(SPAWN_POSITION[1]).toBeGreaterThan(platformTop + MARBLE_RADIUS)
  })

  it('finish check Z is behind finish platform center', () => {
    const finishPlatform = PLATFORMS.find((p) => p.isFinish)!
    const finishPlatformFrontZ = finishPlatform.position[2] + finishPlatform.size[2] / 2
    expect(FINISH_CHECK_Z).toBeLessThan(finishPlatformFrontZ)
  })

  it('FINISH_POSITION x aligns with finish platform', () => {
    const finishPlatform = PLATFORMS.find((p) => p.isFinish)!
    const [pw, ,] = finishPlatform.size
    const [px, ,] = finishPlatform.position
    expect(Math.abs(FINISH_POSITION.x - px)).toBeLessThan(pw / 2)
  })
})

describe('physics constants', () => {
  it('FALL_THRESHOLD_Y is below all platform centers', () => {
    PLATFORMS.forEach(({ position }) => {
      expect(FALL_THRESHOLD_Y).toBeLessThan(position[1])
    })
  })

  it('MARBLE_RADIUS is positive and less than narrowest bridge half-width', () => {
    expect(MARBLE_RADIUS).toBeGreaterThan(0)
    const narrowestBridge = PLATFORMS.reduce((min, p) => Math.min(min, p.size[0]), Infinity)
    expect(MARBLE_RADIUS * 2).toBeLessThan(narrowestBridge)
  })

  it('MOVE_FORCE is positive', () => {
    expect(MOVE_FORCE).toBeGreaterThan(0)
  })

  it('MAX_LINEAR_SPEED is greater than MOVE_FORCE', () => {
    expect(MAX_LINEAR_SPEED).toBeGreaterThan(MOVE_FORCE)
  })
})
