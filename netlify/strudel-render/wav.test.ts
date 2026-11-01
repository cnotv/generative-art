import { describe, expect, it } from 'vitest'
import { readWavDurationSeconds } from './wav'

const writeAscii = (bytes: Uint8Array, offset: number, text: string): void => {
  bytes.set(new TextEncoder().encode(text), offset)
}

const buildWav = (sampleRate: number, channelCount: number, dataByteCount: number): Uint8Array => {
  const bytes = new Uint8Array(44 + dataByteCount)
  const header = new DataView(bytes.buffer)
  writeAscii(bytes, 0, 'RIFF')
  header.setUint32(4, 36 + dataByteCount, true)
  writeAscii(bytes, 8, 'WAVE')
  writeAscii(bytes, 12, 'fmt ')
  header.setUint32(16, 16, true)
  header.setUint16(20, 1, true)
  header.setUint16(22, channelCount, true)
  header.setUint32(24, sampleRate, true)
  header.setUint32(28, sampleRate * channelCount * 2, true)
  header.setUint16(32, channelCount * 2, true)
  header.setUint16(34, 16, true)
  writeAscii(bytes, 36, 'data')
  header.setUint32(40, dataByteCount, true)
  return bytes
}

describe('readWavDurationSeconds', () => {
  it.each<[string, number, number, number, number]>([
    ['48 kHz stereo', 48_000, 2, 192_000, 1],
    ['44.1 kHz mono', 44_100, 1, 22_050, 0.25],
    ['48 kHz mono', 48_000, 1, 96_000, 1]
  ])('reads %s', (_label, sampleRate, channelCount, dataByteCount, expected) => {
    const bytes = buildWav(sampleRate, channelCount, dataByteCount)

    expect(readWavDurationSeconds(bytes)).toBe(expected)
  })

  it('returns null for a file that is too short', () => {
    expect(readWavDurationSeconds(new Uint8Array(20))).toBeNull()
  })

  it('returns null when the header is not a WAV', () => {
    expect(readWavDurationSeconds(new Uint8Array(44))).toBeNull()
  })

  it('returns null when the data chunk is missing', () => {
    const bytes = buildWav(48_000, 2, 48_000)
    writeAscii(bytes, 36, 'nope')

    expect(readWavDurationSeconds(bytes)).toBeNull()
  })
})
