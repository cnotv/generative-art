import { createFourierTransform, magnitudeSpectrum } from './fft'

const HANN_HALF_AMPLITUDE = 0.5

/**
 * Hann window, which tapers each frame so its edges do not smear energy across bins.
 * @param windowSize - number of samples in the window
 * @returns the window coefficients
 */
export const hannWindow = (windowSize: number): Float64Array =>
  Float64Array.from(
    { length: windowSize },
    (_, sampleIndex) =>
      HANN_HALF_AMPLITUDE -
      HANN_HALF_AMPLITUDE * Math.cos((2 * Math.PI * sampleIndex) / (windowSize - 1))
  )

/**
 * Windowed copy of one frame, zero-padded past the end of the signal.
 * @param samples - the whole signal
 * @param startIndex - first sample of the frame
 * @param window - window coefficients, whose length is the frame size
 * @returns the windowed frame
 */
export const extractFrame = (
  samples: Float32Array,
  startIndex: number,
  window: Float64Array
): Float64Array =>
  Float64Array.from(
    { length: window.length },
    (_, sampleIndex) => (samples[startIndex + sampleIndex] ?? 0) * window[sampleIndex]
  )

/**
 * Magnitude spectrum of each frame (STFT, short-time Fourier transform).
 * @param samples - the whole signal
 * @param frameSize - samples per frame, a power of two
 * @param hopSize - samples between frame starts
 * @returns one magnitude spectrum per frame
 */
export const computeSpectrogram = (
  samples: Float32Array,
  frameSize: number,
  hopSize: number
): Float64Array[] => {
  const frameCount =
    samples.length < frameSize ? 0 : Math.floor((samples.length - frameSize) / hopSize) + 1
  const window = hannWindow(frameSize)
  const transform = createFourierTransform(frameSize)
  return Array.from({ length: frameCount }, (_, frameIndex) =>
    magnitudeSpectrum(extractFrame(samples, frameIndex * hopSize, window), transform)
  )
}
