import { describe, it, expect } from 'vitest'
import { supportedPlaybackRate } from './useVideoPoseCapture'

describe('supportedPlaybackRate', () => {
  it.each([
    { slowdown: 1, expected: 1 },
    { slowdown: 6, expected: 1 / 6 },
    { slowdown: 16, expected: 1 / 16 },
    { slowdown: 20, expected: 1 / 16 }
  ])(
    'plays a video slowed $slowdown times at $expected, never slower than a browser allows',
    ({ slowdown, expected }) => {
      // Act
      const rate = supportedPlaybackRate(1 / slowdown)

      // Assert
      expect(rate).toBeCloseTo(expected)
    }
  )
})
