import { applyBiquad, lowpassCoefficients } from './biquad'
import {
  STONER_GUITAR_MUTED_DECAY_SECONDS,
  STONER_GUITAR_MUTED_LOWPASS_HZ,
  STONER_GUITAR_PICK_POSITION
} from './config'
import type { PluckedStringOptions } from './types'

const EXCITATION_SOFTENING = 0.5

/**
 * A small deterministic random generator, so a render is the same every time and a test can
 * compare two of them.
 * @param seed - any integer
 * @returns a function giving numbers from 0 up to but not including 1
 */
export const createSeededRandom = (seed: number): (() => number) => {
  const state = { value: seed >>> 0 }
  return () => {
    state.value = (state.value + 0x6d_2b_79_f5) >>> 0
    const mixed = Math.imul(state.value ^ (state.value >>> 15), state.value | 1)
    const scrambled = mixed ^ (mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61))
    return ((scrambled ^ (scrambled >>> 14)) >>> 0) / 4_294_967_296
  }
}

const buildNoiseBurst = (periodSamples: number, seed: number): Float32Array => {
  const random = createSeededRandom(seed)
  const noise = Float32Array.from({ length: periodSamples }, () => random() * 2 - 1)
  const mean = noise.reduce((sum, sample) => sum + sample, 0) / periodSamples
  const softened = { previous: 0 }
  return noise.map((sample) => {
    softened.previous += EXCITATION_SOFTENING * (sample - mean - softened.previous)
    return softened.previous
  })
}

// A pick near the bridge cancels the harmonics that have a node there; the comb is that cancellation.
const applyPickPosition = (burst: Float32Array, periodSamples: number): Float32Array => {
  const pickOffset = Math.max(1, Math.round(STONER_GUITAR_PICK_POSITION * periodSamples))
  return Float32Array.from(
    { length: burst.length + pickOffset },
    (_, index) => (burst[index] ?? 0) - (burst[index - pickOffset] ?? 0)
  )
}

/**
 * Extended Karplus-Strong string: a noise burst circulating in a delay line with a fractional
 * delay for tuning and a two tap average as the damping. The loss per pass is set from a decay
 * time, so a low string and a high string ring for the same number of seconds.
 * @param options - pitch, length, decay, seed and whether the palm rests on the string
 * @returns the string's output, mono
 */
export const renderPluckedString = (options: PluckedStringOptions): Float32Array => {
  const { frequency, sampleRate, durationSeconds, decaySeconds, seed, palmMuted } = options
  const sampleCount = Math.round(sampleRate * durationSeconds)
  const loopDelay = sampleRate / frequency - 0.5
  const wholeDelay = Math.floor(loopDelay)
  const fraction = loopDelay - wholeDelay
  const effectiveDecay = palmMuted ? STONER_GUITAR_MUTED_DECAY_SECONDS : decaySeconds
  const lossPerPass = 10 ** (-3 / (effectiveDecay * frequency))
  const excitation = applyPickPosition(
    buildNoiseBurst(Math.round(sampleRate / frequency), seed),
    sampleRate / frequency
  )
  const output = new Float32Array(sampleCount)
  const readOutput = (index: number): number => (index < 0 ? 0 : (output[index] ?? 0))
  output.forEach((_, index) => {
    const delayed =
      (1 - fraction) * readOutput(index - wholeDelay) +
      fraction * readOutput(index - wholeDelay - 1)
    const delayedBefore =
      (1 - fraction) * readOutput(index - wholeDelay - 1) +
      fraction * readOutput(index - wholeDelay - 2)
    output[index] = (excitation[index] ?? 0) + lossPerPass * 0.5 * (delayed + delayedBefore)
  })
  return palmMuted
    ? applyBiquad(output, lowpassCoefficients(sampleRate, STONER_GUITAR_MUTED_LOWPASS_HZ))
    : output
}
