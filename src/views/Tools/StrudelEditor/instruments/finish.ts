import {
  INSTRUMENT_FADE_IN_SECONDS,
  INSTRUMENT_FADE_OUT_SECONDS,
  INSTRUMENT_SAMPLE_RATE
} from './config'
import { blend } from './knobs'
import { readPeak, scaleSignal } from './signal'

/**
 * Fades a sound in and out so both ends are exactly zero and the sampler cannot click.
 * @param signal - the sound
 * @param fadeInSeconds - length of the fade in
 * @param fadeOutSeconds - length of the fade out
 * @returns the faded sound as a new buffer
 */
export const applyFades = (
  signal: Float32Array,
  fadeInSeconds = INSTRUMENT_FADE_IN_SECONDS,
  fadeOutSeconds = INSTRUMENT_FADE_OUT_SECONDS
): Float32Array => {
  const fadeInSamples = Math.max(1, Math.round(fadeInSeconds * INSTRUMENT_SAMPLE_RATE))
  const fadeOutSamples = Math.max(1, Math.round(fadeOutSeconds * INSTRUMENT_SAMPLE_RATE))
  return signal.map((sample, index) => {
    const fadeIn = Math.min(1, index / fadeInSamples)
    const fadeOut = Math.min(1, (signal.length - 1 - index) / fadeOutSamples)
    return sample * fadeIn * fadeOut
  })
}

/**
 * Two takes as a stereo pair, scaled so the louder channel reaches the peak. At full width the
 * takes sit hard left and right; at zero the right channel repeats the left.
 * @param left - the first take
 * @param right - the second take
 * @param options - the stereo width from 0 to 1 and the wanted peak
 * @returns the left and right channels
 */
export const finishStereo = (
  left: Float32Array,
  right: Float32Array,
  options: { width: number; peak: number }
): Float32Array[] => {
  const widened = right.map((sample, index) => blend(left[index] ?? 0, sample, options.width))
  const peak = readPeak(left, widened)
  const scale = peak === 0 ? 1 : options.peak / peak
  return [scaleSignal(left, scale), scaleSignal(widened, scale)]
}
