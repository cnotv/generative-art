import { describe, it, expect } from 'vitest'
import { encodeWav } from './wavEncoding'

const readText = (view: DataView, offset: number, length: number): string =>
  String.fromCharCode(...Array.from({ length }, (_, index) => view.getUint8(offset + index)))

describe('encodeWav', () => {
  it('writes a 16-bit PCM header for the channels and rate', () => {
    // Arrange
    const channels = [new Float32Array(3), new Float32Array(3)]

    // Act
    const view = new DataView(encodeWav(channels, 48000))

    // Assert
    expect(view.byteLength).toBe(44 + 3 * 2 * 2)
    expect(readText(view, 0, 4)).toBe('RIFF')
    expect(readText(view, 8, 4)).toBe('WAVE')
    expect(view.getUint16(22, true)).toBe(2)
    expect(view.getUint32(24, true)).toBe(48000)
    expect(view.getUint16(34, true)).toBe(16)
    expect(view.getUint32(40, true)).toBe(12)
  })

  it.each([
    [0.5, 16384],
    [2, 32767],
    [-2, -32767],
    [0, 0]
  ])('interleaves and clips a sample of %s to %s', (sample, expected) => {
    // Arrange
    const left = Float32Array.of(sample)
    const right = Float32Array.of(0)

    // Act
    const view = new DataView(encodeWav([left, right], 44100))

    // Assert
    expect(view.getInt16(44, true)).toBe(expected)
    expect(view.getInt16(46, true)).toBe(0)
  })
})
