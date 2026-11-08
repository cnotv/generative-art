import { applyBiquad, highpassCoefficients, lowpassCoefficients } from './biquad'

export const TEST_SAMPLE_RATE = 32000

/**
 * Root mean square of a stretch of a signal.
 * @param signal - the samples
 * @param from - first sample
 * @param to - end sample, exclusive
 * @returns the level
 */
export const readRms = (signal: Float32Array, from = 0, to = signal.length): number => {
  const slice = signal.slice(from, to)
  return Math.sqrt(slice.reduce((sum, sample) => sum + sample * sample, 0) / slice.length)
}

/**
 * Autocorrelation peak near the expected pitch, with a parabola through its top for sub sample accuracy.
 * @param signal - the samples
 * @param expectedFrequency - where to look, in Hz
 * @param analysisSeconds - how much of the start to read
 * @returns the detected frequency in Hz
 */
export const detectFrequency = (
  signal: Float32Array,
  expectedFrequency: number,
  analysisSeconds = 0.5
): number => {
  const window = signal.slice(0, Math.round(TEST_SAMPLE_RATE * analysisSeconds))
  const correlate = (lag: number): number =>
    window.reduce((sum, sample, index) => sum + sample * (window[index + lag] ?? 0), 0)
  const expectedLag = Math.round(TEST_SAMPLE_RATE / expectedFrequency)
  const lags = Array.from(
    { length: Math.round(expectedLag * 0.2) * 2 + 1 },
    (_, index) => Math.round(expectedLag * 0.8) + index
  )
  const bestLag = lags.reduce((best, lag) => (correlate(lag) > correlate(best) ? lag : best))
  const before = correlate(bestLag - 1)
  const centre = correlate(bestLag)
  const after = correlate(bestLag + 1)
  const offset = (0.5 * (before - after)) / (before - 2 * centre + after)
  return TEST_SAMPLE_RATE / (bestLag + offset)
}

/**
 * The share of a signal's energy below one frequency, or above another.
 * @param signal - the samples
 * @param band - the corner and which side of it to count
 * @returns a share from 0 to 1
 */
export const readEnergyShare = (
  signal: Float32Array,
  band: { belowHz: number } | { aboveHz: number }
): number => {
  const filtered = applyBiquad(
    applyBiquad(
      signal,
      'belowHz' in band
        ? lowpassCoefficients(TEST_SAMPLE_RATE, band.belowHz)
        : highpassCoefficients(TEST_SAMPLE_RATE, band.aboveHz)
    ),
    'belowHz' in band
      ? lowpassCoefficients(TEST_SAMPLE_RATE, band.belowHz)
      : highpassCoefficients(TEST_SAMPLE_RATE, band.aboveHz)
  )
  return readRms(filtered) ** 2 / readRms(signal) ** 2
}
