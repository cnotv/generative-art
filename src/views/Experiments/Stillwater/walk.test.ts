import { describe, it, expect } from 'vitest'
import { advanceWalk } from './walk'

describe('advanceWalk', () => {
  it('moves forward while the far end is still ahead', () => {
    expect(advanceWalk(-300, 9, -300, 300)).toBe(-291)
  })

  it('stays put when the walk speed is zero', () => {
    expect(advanceWalk(0, 0, -300, 300)).toBe(0)
  })

  it('reaches the far end without wrapping', () => {
    expect(advanceWalk(295, 5, -300, 300)).toBe(300)
  })

  it('carries the overshoot across the wrap rather than dropping it', () => {
    expect(advanceWalk(298, 5, -300, 300)).toBe(-297)
  })

  it('wraps a distance longer than the whole loop back into it', () => {
    expect(advanceWalk(0, 1500, -300, 300)).toBe(-300)
  })

  it('leaves the position alone when the loop has no length to travel', () => {
    expect(advanceWalk(10, 5, 300, 300)).toBe(15)
  })
})
