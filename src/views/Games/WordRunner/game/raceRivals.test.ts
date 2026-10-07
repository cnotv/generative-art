import { describe, it, expect } from 'vitest'
import { followRemote } from './raceRivals'

describe('followRemote', () => {
  it('keeps rolling at the base speed between two reports', () => {
    expect(followRemote(100, 100, 10, 0.1)).toBeGreaterThan(100)
  })

  it('closes in on where the room last reported the ball', () => {
    const behind = followRemote(80, 120, 10, 0.1)

    expect(behind).toBeGreaterThan(81)
    expect(behind).toBeLessThan(120)
  })

  it('never runs past a ball that has finished', () => {
    expect(followRemote(499.9, 500, 10, 0.1, true)).toBeLessThanOrEqual(500)
  })
})
