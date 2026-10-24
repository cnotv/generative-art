import { describe, it, expect } from 'vitest'
import { fastFourierTransform, magnitudeSpectrum } from './fft'

const FRAME_SIZE = 1024

const sineAtBin = (binIndex: number): Float64Array =>
  Float64Array.from({ length: FRAME_SIZE }, (_, sampleIndex) =>
    Math.sin((2 * Math.PI * binIndex * sampleIndex) / FRAME_SIZE)
  )

const indexOfMaximum = (values: Float64Array): number =>
  values.reduce((bestIndex, value, index) => (value > values[bestIndex] ? index : bestIndex), 0)

describe('magnitudeSpectrum', () => {
  it.each([[8], [64], [200], [511]])('puts a sine at bin %i in that bin', (binIndex) => {
    // Arrange
    const frame = sineAtBin(binIndex)

    // Act
    const spectrum = magnitudeSpectrum(frame)

    // Assert
    expect(indexOfMaximum(spectrum)).toBe(binIndex)
  })

  it('returns half as many bins as samples', () => {
    // Arrange
    const frame = sineAtBin(8)

    // Act
    const spectrum = magnitudeSpectrum(frame)

    // Assert
    expect(spectrum).toHaveLength(FRAME_SIZE / 2)
  })
})

describe('fastFourierTransform', () => {
  it('turns a unit impulse into a flat spectrum', () => {
    // Arrange
    const impulse = Float64Array.from({ length: 16 }, (_, index) => (index === 0 ? 1 : 0))

    // Act
    const { real, imaginary } = fastFourierTransform(impulse)

    // Assert
    expect([...real].every((value) => Math.abs(value - 1) < 1e-12)).toBe(true)
    expect([...imaginary].every((value) => Math.abs(value) < 1e-12)).toBe(true)
  })

  it('matches a direct DFT (discrete Fourier transform) on an arbitrary signal', () => {
    // Arrange
    const signal = Float64Array.from({ length: 8 }, (_, index) => Math.sin(index * 1.7) + index / 4)
    const directReal = Array.from({ length: 8 }, (_, frequency) =>
      signal.reduce(
        (sum, value, time) => sum + value * Math.cos((-2 * Math.PI * frequency * time) / 8),
        0
      )
    )
    const directImaginary = Array.from({ length: 8 }, (_, frequency) =>
      signal.reduce(
        (sum, value, time) => sum + value * Math.sin((-2 * Math.PI * frequency * time) / 8),
        0
      )
    )

    // Act
    const { real, imaginary } = fastFourierTransform(signal)

    // Assert
    directReal.forEach((value, index) => expect(real[index]).toBeCloseTo(value, 10))
    directImaginary.forEach((value, index) => expect(imaginary[index]).toBeCloseTo(value, 10))
  })

  it('rejects a length that is not a power of two', () => {
    // Arrange
    const frame = new Float64Array(12)

    // Act
    const transform = (): unknown => fastFourierTransform(frame)

    // Assert
    expect(transform).toThrow('power of two')
  })
})
