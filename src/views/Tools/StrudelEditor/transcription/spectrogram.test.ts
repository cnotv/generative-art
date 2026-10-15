import { describe, it, expect } from 'vitest'
import { computeSpectrogram, extractFrame, hannWindow } from './spectrogram'

describe('hannWindow', () => {
  it('is zero at both ends and one in the middle', () => {
    // Arrange
    const windowSize = 9

    // Act
    const window = hannWindow(windowSize)

    // Assert
    expect(window[0]).toBeCloseTo(0)
    expect(window[8]).toBeCloseTo(0)
    expect(window[4]).toBeCloseTo(1)
  })
})

describe('extractFrame', () => {
  it('pads past the end of the signal with zeros', () => {
    // Arrange
    const samples = Float32Array.from([1, 1, 1])
    const window = Float64Array.from([1, 1, 1, 1])

    // Act
    const frame = extractFrame(samples, 1, window)

    // Assert
    expect([...frame]).toEqual([1, 1, 0, 0])
  })
})

describe('computeSpectrogram', () => {
  it.each([
    [4096, 1024, 512, 7],
    [1024, 1024, 512, 1],
    [500, 1024, 512, 0]
  ])(
    'splits %i samples with frame %i and hop %i into %i frames',
    (sampleCount, frameSize, hopSize, expectedFrames) => {
      // Arrange
      const samples = new Float32Array(sampleCount)

      // Act
      const spectrogram = computeSpectrogram(samples, frameSize, hopSize)

      // Assert
      expect(spectrogram).toHaveLength(expectedFrames)
    }
  )
})
