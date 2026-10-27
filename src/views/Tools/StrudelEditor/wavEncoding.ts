const WAV_HEADER_BYTES = 44
const BYTES_PER_SAMPLE = 2
const PCM_FORMAT = 1
const MAX_SAMPLE_VALUE = 0x7f_ff

const writeText = (view: DataView, offset: number, text: string): void =>
  [...text].forEach((character, index) => view.setUint8(offset + index, character.charCodeAt(0)))

const writeHeader = (
  view: DataView,
  channelCount: number,
  sampleRate: number,
  dataBytes: number
): void => {
  writeText(view, 0, 'RIFF')
  view.setUint32(4, 36 + dataBytes, true)
  writeText(view, 8, 'WAVE')
  writeText(view, 12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, PCM_FORMAT, true)
  view.setUint16(22, channelCount, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * channelCount * BYTES_PER_SAMPLE, true)
  view.setUint16(32, channelCount * BYTES_PER_SAMPLE, true)
  view.setUint16(34, BYTES_PER_SAMPLE * 8, true)
  writeText(view, 36, 'data')
  view.setUint32(40, dataBytes, true)
}

/**
 * Encodes rendered audio as a 16-bit PCM WAV file, channels interleaved frame by frame and
 * every sample clipped to the -1 to 1 range first.
 * @param channels - one buffer of samples per channel, all the same length
 * @param sampleRate - samples per second
 * @returns the complete file
 */
export const encodeWav = (channels: Float32Array[], sampleRate: number): ArrayBuffer => {
  const frameCount = channels[0]?.length ?? 0
  const dataBytes = frameCount * channels.length * BYTES_PER_SAMPLE
  const buffer = new ArrayBuffer(WAV_HEADER_BYTES + dataBytes)
  const view = new DataView(buffer)
  writeHeader(view, channels.length, sampleRate, dataBytes)
  Array.from({ length: frameCount }).forEach((_, frameIndex) =>
    channels.forEach((channel, channelIndex) => {
      const sample = Math.max(-1, Math.min(1, channel[frameIndex] ?? 0))
      view.setInt16(
        WAV_HEADER_BYTES + (frameIndex * channels.length + channelIndex) * BYTES_PER_SAMPLE,
        Math.round(sample * MAX_SAMPLE_VALUE),
        true
      )
    })
  )
  return buffer
}
