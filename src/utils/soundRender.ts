import type { SoundSlot } from '@/types/soundPanel'
import type { StrudelPlayback } from '@/views/Tools/StrudelEditor/types'

export const PEAK_TARGET = 0.9
export const SEAM_CROSSFADE_SECONDS = 0.03
const SAMPLE_RATE = 44100
const WAV_HEADER_BYTES = 44
const MAX_SAMPLE = 32767
const NO_OP = (): void => undefined

const playbackCache: { load: Promise<StrudelPlayback> | null } = { load: null }

/**
 * Loads the Strudel engine the first time a sound is rendered, then reuses it. It is a dynamic
 * import so a game never carries the engine until someone opens the Sound panel and applies.
 * @returns The playback that renders offline.
 */
const loadPlayback = (): Promise<StrudelPlayback> => {
  playbackCache.load ??= import('@/views/Tools/StrudelEditor/strudelPlayback')
    .then(({ loadDefaultStrudelPlayback }) =>
      loadDefaultStrudelPlayback({
        onEvaluated: NO_OP,
        onFrame: NO_OP,
        onStopped: NO_OP,
        getDrawContext: () => null
      })
    )
    .catch((error: unknown) => {
      playbackCache.load = null
      throw error
    })
  return playbackCache.load
}

/**
 * Scales a 16-bit WAV so its loudest sample sits at the target level. Strudel patterns are
 * written with whatever gains sound right in the editor, which can be very quiet as a file.
 * @param wav A 16-bit PCM WAV with a 44 byte header.
 * @returns A new file; a silent one comes back unchanged.
 */
export const normalizeWavPeak = (wav: ArrayBuffer): ArrayBuffer => {
  const copy = wav.slice(0, wav.byteLength)
  const samples = new Int16Array(copy, WAV_HEADER_BYTES, (copy.byteLength - WAV_HEADER_BYTES) / 2)
  const peak = samples.reduce((loudest, sample) => Math.max(loudest, Math.abs(sample)), 0)
  if (peak === 0) return copy
  const gain = (PEAK_TARGET * MAX_SAMPLE) / peak
  samples.forEach((sample, index) => {
    samples[index] = Math.round(sample * gain)
  })
  return copy
}

const CHANNEL_COUNT_OFFSET = 22
const SAMPLE_RATE_OFFSET = 24
const RIFF_SIZE_OFFSET = 4
const DATA_SIZE_OFFSET = 40
const BYTES_PER_SAMPLE = 2
// The chunk sizes in the header cover everything after these fields.
const HEADER_AFTER_RIFF_SIZE = 36

/**
 * Makes a loop repeat without a click. A render stops dead at its last cycle, so the end of the
 * file and its start are unrelated and the repeat steps from one to the other. The last stretch
 * is blended into the first at constant power, the two being unrelated noise, and the loop
 * becomes one stretch shorter, which nothing depends on.
 * @param wav A 16-bit PCM WAV with a 44 byte header.
 * @returns A new file; one too short to hold two stretches comes back unchanged.
 */
export const crossfadeLoopSeam = (wav: ArrayBuffer): ArrayBuffer => {
  const view = new DataView(wav)
  const channelCount = view.getUint16(CHANNEL_COUNT_OFFSET, true)
  const fadeFrames = Math.round(SEAM_CROSSFADE_SECONDS * view.getUint32(SAMPLE_RATE_OFFSET, true))
  const samples = new Int16Array(wav, WAV_HEADER_BYTES, (wav.byteLength - WAV_HEADER_BYTES) / 2)
  const frameCount = samples.length / channelCount
  if (fadeFrames < 2 || frameCount < fadeFrames * 3) return wav.slice(0, wav.byteLength)
  const outputFrames = frameCount - fadeFrames
  const output = new ArrayBuffer(WAV_HEADER_BYTES + outputFrames * channelCount * BYTES_PER_SAMPLE)
  new Uint8Array(output).set(new Uint8Array(wav, 0, WAV_HEADER_BYTES))
  const outputView = new DataView(output)
  const dataBytes = outputFrames * channelCount * BYTES_PER_SAMPLE
  outputView.setUint32(RIFF_SIZE_OFFSET, HEADER_AFTER_RIFF_SIZE + dataBytes, true)
  outputView.setUint32(DATA_SIZE_OFFSET, dataBytes, true)
  const written = new Int16Array(output, WAV_HEADER_BYTES, outputFrames * channelCount)
  written.forEach((_, index) => {
    const frame = Math.floor(index / channelCount)
    const channel = index % channelCount
    if (frame >= fadeFrames) {
      written[index] = samples[frame * channelCount + channel]
      return
    }
    const angle = (Math.PI / 2) * (frame / (fadeFrames - 1))
    const tail = samples[(frameCount - fadeFrames + frame) * channelCount + channel]
    const head = samples[frame * channelCount + channel]
    written[index] = Math.round(tail * Math.cos(angle) + head * Math.sin(angle))
  })
  return output
}

/**
 * Renders a sound's Strudel code to a WAV, offline and in the browser.
 * @param code The Strudel code to render.
 * @param slot The sound it belongs to, which says how many cycles to render.
 * @returns The WAV at a normal level.
 */
export const renderStrudelSound = async (code: string, slot: SoundSlot): Promise<ArrayBuffer> => {
  const playback = await loadPlayback()
  const endCycle =
    slot.cycles ?? (slot.kind === 'loop' ? 1 : await playback.measureRepetition(code))
  const result = await playback.renderToWavBytes(code, {
    format: 'wav',
    startCycle: 0,
    endCycle,
    sampleRate: SAMPLE_RATE,
    fileName: slot.id
  })
  if (!result.success || !result.file) {
    throw new Error(result.errorMessage ?? 'The code did not render')
  }
  const level = normalizeWavPeak(result.file)
  return slot.crossfadeSeam ? crossfadeLoopSeam(level) : level
}
