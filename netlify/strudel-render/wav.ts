import { STRUDEL_WAV_HEADER } from './config'

const readAscii = (bytes: Uint8Array, offset: number, length: number): string =>
  String.fromCharCode(...bytes.subarray(offset, offset + length))

/**
 * Reads the duration of a 16-bit PCM WAV file from its header.
 * @param bytes - the complete WAV file
 * @returns the duration in seconds, or null when the bytes are not a WAV file
 */
export const readWavDurationSeconds = (bytes: Uint8Array): number | null => {
  if (bytes.byteLength < STRUDEL_WAV_HEADER.size) return null
  if (readAscii(bytes, 0, 4) !== 'RIFF') return null
  if (readAscii(bytes, STRUDEL_WAV_HEADER.waveLabel, 4) !== 'WAVE') return null
  if (readAscii(bytes, STRUDEL_WAV_HEADER.dataLabel, 4) !== 'data') return null

  const header = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const channelCount = header.getUint16(STRUDEL_WAV_HEADER.channelCount, true)
  const sampleRate = header.getUint32(STRUDEL_WAV_HEADER.sampleRate, true)
  const dataByteCount = header.getUint32(STRUDEL_WAV_HEADER.dataSize, true)
  if (channelCount === 0 || sampleRate === 0) return null

  const bytesPerSample = STRUDEL_WAV_HEADER.bitsPerSample / STRUDEL_WAV_HEADER.bitsPerByte
  return dataByteCount / (sampleRate * channelCount * bytesPerSample)
}
