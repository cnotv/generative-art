/**
 * The largest absolute sample across one or more buffers.
 * @param signals - buffers to scan
 * @returns the peak, 0 for silence
 */
export const readPeak = (...signals: Float32Array[]): number =>
  signals.reduce(
    (peak, signal) => signal.reduce((best, sample) => Math.max(best, Math.abs(sample)), peak),
    0
  )

/**
 * Multiplies every sample by one factor.
 * @param signal - the input, left untouched
 * @param factor - the gain
 * @returns the scaled samples as a new buffer
 */
export const scaleSignal = (signal: Float32Array, factor: number): Float32Array =>
  signal.map((sample) => sample * factor)

/**
 * Scales a buffer so its peak is exactly the target; silence stays silent.
 * @param signal - the input, left untouched
 * @param targetPeak - the wanted peak
 * @returns the scaled samples as a new buffer
 */
export const normalisePeak = (signal: Float32Array, targetPeak: number): Float32Array => {
  const peak = readPeak(signal)
  return peak === 0 ? new Float32Array(signal) : scaleSignal(signal, targetPeak / peak)
}
