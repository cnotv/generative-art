import { describe, it, expect } from 'vitest'
import { clampFrameMax } from './frameRange'

describe('clampFrameMax', () => {
  it('accepts a requested range above every floor', () => {
    expect(clampFrameMax(300, 10, [50, 120])).toBe(300)
  })

  it('never shrinks past the furthest keyframe', () => {
    expect(clampFrameMax(50, 10, [50, 120])).toBe(120)
  })

  it('never shrinks past the current frame', () => {
    expect(clampFrameMax(20, 180, [50, 120])).toBe(180)
  })

  it('never shrinks past the configured floor with nothing else to hold it up', () => {
    expect(clampFrameMax(1, 0, [])).toBeGreaterThanOrEqual(10)
  })

  it('rounds a fractional request', () => {
    expect(clampFrameMax(200.6, 0, [])).toBe(201)
  })
})
