import { describe, it, expect } from 'vitest'
import { RR_TRACK_CONTROLS, RR_WALL_CONTROLS, MAX_TERRAIN_WIDTH } from './trackPanel'
import { MIN_TURN_RADIUS, TERRAIN_WIDTH, TRACK_WIDTH } from './config'

describe('MAX_TERRAIN_WIDTH', () => {
  // A swept ribbon folds through itself once its half-width passes the path's
  // tightest turn radius, so the slider cannot be allowed to reach it.
  it('keeps the widest selectable ground inside the tightest turn', () => {
    expect(MAX_TERRAIN_WIDTH / 2).toBeLessThan(MIN_TURN_RADIUS)
  })

  it('is the ceiling the default ground already sits at', () => {
    expect(TERRAIN_WIDTH).toBeLessThanOrEqual(MAX_TERRAIN_WIDTH)
  })

  // Anything wider needs the countryside rebuilt as world-space tiles rather
  // than a ribbon swept along the path, so this number cannot simply be raised.
  it('leaves no headroom above the fold limit', () => {
    expect(MAX_TERRAIN_WIDTH + 2).toBeGreaterThanOrEqual(Math.floor(MIN_TURN_RADIUS * 2))
  })
})

describe('RR_TRACK_CONTROLS', () => {
  it('exposes the path width and the side ground width', () => {
    expect(Object.keys(RR_TRACK_CONTROLS)).toEqual(['trackWidth', 'terrainWidth'])
  })

  it('never lets the side ground be set narrower than the path', () => {
    expect(RR_TRACK_CONTROLS.terrainWidth.min).toBe(TRACK_WIDTH)
  })

  it('caps the side ground at the fold limit', () => {
    expect(RR_TRACK_CONTROLS.terrainWidth.max).toBe(MAX_TERRAIN_WIDTH)
  })

  it('labels both controls for the panel', () => {
    expect(RR_TRACK_CONTROLS.trackWidth.label).toBe('Path width')
    expect(RR_TRACK_CONTROLS.terrainWidth.label).toBe('Side ground width')
  })
})

describe('RR_WALL_CONTROLS', () => {
  it('exposes height and thickness', () => {
    expect(Object.keys(RR_WALL_CONTROLS)).toEqual(['height', 'thickness'])
  })

  it('never allows a zero-thickness wall', () => {
    expect(RR_WALL_CONTROLS.thickness.min).toBeGreaterThan(0)
  })
})
