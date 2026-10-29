import type { SoundSlot } from '@/types/soundPanel'
import type { StrudelPlayback } from '@/views/Tools/StrudelEditor/types'

export const PEAK_TARGET = 0.9
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

/**
 * Renders a sound's Strudel code to a WAV, offline and in the browser.
 * @param code The Strudel code to render.
 * @param slot The sound it belongs to, which says how many cycles to render.
 * @returns The WAV at a normal level.
 */
export const renderStrudelSound = async (code: string, slot: SoundSlot): Promise<ArrayBuffer> => {
  const playback = await loadPlayback()
  const endCycle =
    slot.kind === 'loop' ? (slot.loopCycles ?? 1) : await playback.measureRepetition(code)
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
  return normalizeWavPeak(result.file)
}
