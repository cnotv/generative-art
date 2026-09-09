import { describe, it, expect } from 'vitest'
import { computeSelectionRange, frameIsSelected, keyframesInRange } from './frameSelection'

describe('computeSelectionRange', () => {
  it('returns null while either endpoint is missing', () => {
    expect(computeSelectionRange(null, 5)).toBeNull()
    expect(computeSelectionRange(5, null)).toBeNull()
    expect(computeSelectionRange(null, null)).toBeNull()
  })

  it('orders the range regardless of which endpoint is larger', () => {
    expect(computeSelectionRange(10, 4)).toEqual({ start: 4, end: 10 })
    expect(computeSelectionRange(4, 10)).toEqual({ start: 4, end: 10 })
  })

  it('collapses to a single frame when both endpoints match', () => {
    expect(computeSelectionRange(6, 6)).toEqual({ start: 6, end: 6 })
  })
})

describe('frameIsSelected', () => {
  const range = { start: 4, end: 10 }

  it('is false with no active range', () => {
    expect(frameIsSelected(null, 7)).toBe(false)
  })

  it.each([
    [4, true],
    [7, true],
    [10, true],
    [3, false],
    [11, false]
  ])('frame %i inside [4,10] is %s', (frame, expected) => {
    expect(frameIsSelected(range, frame)).toBe(expected)
  })
})

describe('keyframesInRange', () => {
  it('returns nothing with no active range', () => {
    expect(keyframesInRange(null, [1, 5, 9])).toEqual([])
  })

  it('keeps only the keyframes that fall inside the range', () => {
    expect(keyframesInRange({ start: 4, end: 10 }, [1, 4, 7, 10, 12])).toEqual([4, 7, 10])
  })
})
