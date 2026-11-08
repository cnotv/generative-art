import type { BiquadCoefficients } from './types'

const BUTTERWORTH_Q = Math.SQRT1_2

const normalise = (
  numerator: [number, number, number],
  denominator: [number, number, number]
): BiquadCoefficients => {
  const [b0, b1, b2] = numerator
  const [a0, a1, a2] = denominator
  return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0 }
}

const readAngle = (sampleRate: number, frequency: number): { cosine: number; sine: number } => {
  const angle = (2 * Math.PI * frequency) / sampleRate
  return { cosine: Math.cos(angle), sine: Math.sin(angle) }
}

/**
 * Second order lowpass from the audio EQ cookbook.
 * @param sampleRate - samples per second
 * @param frequency - corner in Hz
 * @param quality - resonance, a Butterworth flat response by default
 * @returns the filter's coefficients
 */
export const lowpassCoefficients = (
  sampleRate: number,
  frequency: number,
  quality = BUTTERWORTH_Q
): BiquadCoefficients => {
  const { cosine, sine } = readAngle(sampleRate, frequency)
  const alpha = sine / (2 * quality)
  return normalise(
    [(1 - cosine) / 2, 1 - cosine, (1 - cosine) / 2],
    [1 + alpha, -2 * cosine, 1 - alpha]
  )
}

/**
 * Second order highpass from the audio EQ cookbook.
 * @param sampleRate - samples per second
 * @param frequency - corner in Hz
 * @param quality - resonance, a Butterworth flat response by default
 * @returns the filter's coefficients
 */
export const highpassCoefficients = (
  sampleRate: number,
  frequency: number,
  quality = BUTTERWORTH_Q
): BiquadCoefficients => {
  const { cosine, sine } = readAngle(sampleRate, frequency)
  const alpha = sine / (2 * quality)
  return normalise(
    [(1 + cosine) / 2, -(1 + cosine), (1 + cosine) / 2],
    [1 + alpha, -2 * cosine, 1 - alpha]
  )
}

/**
 * Bell filter from the audio EQ cookbook: boosts or cuts a band around a centre frequency.
 * @param sampleRate - samples per second
 * @param frequency - centre in Hz
 * @param gainDecibels - boost when positive, cut when negative
 * @param quality - narrowness of the band
 * @returns the filter's coefficients
 */
export const peakingCoefficients = (
  sampleRate: number,
  frequency: number,
  gainDecibels: number,
  quality = 1
): BiquadCoefficients => {
  const { cosine, sine } = readAngle(sampleRate, frequency)
  const amplitude = 10 ** (gainDecibels / 40)
  const alpha = sine / (2 * quality)
  return normalise(
    [1 + alpha * amplitude, -2 * cosine, 1 - alpha * amplitude],
    [1 + alpha / amplitude, -2 * cosine, 1 - alpha / amplitude]
  )
}

/**
 * Low shelf from the audio EQ cookbook: boosts or cuts everything under a frequency.
 * @param sampleRate - samples per second
 * @param frequency - shelf midpoint in Hz
 * @param gainDecibels - boost when positive, cut when negative
 * @returns the filter's coefficients
 */
export const lowShelfCoefficients = (
  sampleRate: number,
  frequency: number,
  gainDecibels: number
): BiquadCoefficients => {
  const { cosine, sine } = readAngle(sampleRate, frequency)
  const amplitude = 10 ** (gainDecibels / 40)
  const alpha = (sine / 2) * Math.SQRT2
  const root = 2 * Math.sqrt(amplitude) * alpha
  return normalise(
    [
      amplitude * (amplitude + 1 - (amplitude - 1) * cosine + root),
      2 * amplitude * (amplitude - 1 - (amplitude + 1) * cosine),
      amplitude * (amplitude + 1 - (amplitude - 1) * cosine - root)
    ],
    [
      amplitude + 1 + (amplitude - 1) * cosine + root,
      -2 * (amplitude - 1 + (amplitude + 1) * cosine),
      amplitude + 1 + (amplitude - 1) * cosine - root
    ]
  )
}

/**
 * Runs a signal through one biquad filter.
 * @param signal - the input samples, left untouched
 * @param coefficients - the filter to apply
 * @returns the filtered samples as a new buffer
 */
export const applyBiquad = (
  signal: Float32Array,
  coefficients: BiquadCoefficients
): Float32Array => {
  const { b0, b1, b2, a1, a2 } = coefficients
  const memory = { x1: 0, x2: 0, y1: 0, y2: 0 }
  const filtered = new Float32Array(signal.length)
  signal.forEach((input, index) => {
    const output = b0 * input + b1 * memory.x1 + b2 * memory.x2 - a1 * memory.y1 - a2 * memory.y2
    memory.x2 = memory.x1
    memory.x1 = input
    memory.y2 = memory.y1
    memory.y1 = output
    filtered[index] = output
  })
  return filtered
}
