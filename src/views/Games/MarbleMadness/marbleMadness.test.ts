import { describe, it, expect } from 'vitest'
import { TRACKS, FALL_THRESHOLD_Y, MARBLE_RADIUS, MOVE_FORCE, MAX_LINEAR_SPEED } from './config'

describe('TRACKS', () => {
  it('defines at least one track', () => {
    expect(TRACKS.length).toBeGreaterThan(0)
  })

  it.each(TRACKS.map((t, i) => [i, t] as const))('track %i has a name', (_i, track) => {
    expect(track.name.length).toBeGreaterThan(0)
  })

  it.each(TRACKS.map((t, i) => [i, t] as const))(
    'track %i has at least one platform',
    (_i, track) => {
      expect(track.platforms.length).toBeGreaterThan(0)
    }
  )

  it.each(
    TRACKS.flatMap((track, ti) =>
      track.platforms.map((platform, pi) => [ti, pi, platform] as const)
    )
  )('track %i platform %i has positive size dimensions', (_ti, _pi, platform) => {
    const [w, h, d] = platform.size
    expect(w).toBeGreaterThan(0)
    expect(h).toBeGreaterThan(0)
    expect(d).toBeGreaterThan(0)
  })

  it.each(TRACKS.map((t, i) => [i, t] as const))(
    'track %i has exactly one finish platform',
    (_i, track) => {
      const finishPlatforms = track.platforms.filter((p) => p.isFinish)
      expect(finishPlatforms.length).toBe(1)
    }
  )

  it.each(TRACKS.map((t, i) => [i, t] as const))(
    'track %i start platform covers spawn x/z position',
    (_i, track) => {
      const start = track.platforms[0]
      const [pw, , pd] = start.size
      const [px, , pz] = start.position
      const [sx, , sz] = track.spawnPosition
      expect(Math.abs(sx - px)).toBeLessThan(pw / 2)
      expect(Math.abs(sz - pz)).toBeLessThan(pd / 2)
    }
  )

  it.each(TRACKS.map((t, i) => [i, t] as const))(
    'track %i spawn Y is above start platform top surface',
    (_i, track) => {
      const start = track.platforms[0]
      const platformTop = start.position[1] + start.size[1] / 2
      expect(track.spawnPosition[1]).toBeGreaterThan(platformTop + MARBLE_RADIUS)
    }
  )

  it.each(TRACKS.map((t, i) => [i, t] as const))(
    'track %i obstacles have positive size dimensions',
    (_i, track) => {
      track.obstacles.forEach(({ size }) => {
        const [w, h, d] = size
        expect(w).toBeGreaterThan(0)
        expect(h).toBeGreaterThan(0)
        expect(d).toBeGreaterThan(0)
      })
    }
  )
})

describe('physics constants', () => {
  it('FALL_THRESHOLD_Y is below all platform centers in every track', () => {
    TRACKS.forEach((track) => {
      track.platforms.forEach(({ position }) => {
        expect(FALL_THRESHOLD_Y).toBeLessThan(position[1])
      })
    })
  })

  it('MARBLE_RADIUS is positive and less than narrowest bridge half-width across all tracks', () => {
    expect(MARBLE_RADIUS).toBeGreaterThan(0)
    TRACKS.forEach((track) => {
      const narrowestBridge = track.platforms.reduce((min, p) => Math.min(min, p.size[0]), Infinity)
      expect(MARBLE_RADIUS * 2).toBeLessThan(narrowestBridge)
    })
  })

  it('MOVE_FORCE is positive', () => {
    expect(MOVE_FORCE).toBeGreaterThan(0)
  })

  it('MAX_LINEAR_SPEED is greater than MOVE_FORCE', () => {
    expect(MAX_LINEAR_SPEED).toBeGreaterThan(MOVE_FORCE)
  })
})
