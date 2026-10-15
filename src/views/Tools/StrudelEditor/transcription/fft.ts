export type ComplexSpectrum = {
  real: Float64Array
  imaginary: Float64Array
}

export type FourierTransform = (samples: Float64Array) => ComplexSpectrum

type StageIndices = {
  firstIndex: Int32Array
  secondIndex: Int32Array
  twiddleIndex: Int32Array
  isOddOutput: Uint8Array
}

type TwiddleTable = {
  cosine: Float64Array
  sine: Float64Array
}

const FULL_TURN_RADIANS = 2 * Math.PI

const isPowerOfTwo = (value: number): boolean => value > 0 && (value & (value - 1)) === 0

/**
 * Where each output of one radix-2 Stockham stage reads its butterfly inputs from. The
 * tables depend only on the frame size, so they are built once and every frame reuses
 * them: computing the indices inside the transform made it about fifty times slower.
 */
const buildStageIndices = (size: number, stride: number): StageIndices => {
  const halfSpan = size / stride / 2
  const positionOf = (outputIndex: number): number =>
    (outputIndex - (outputIndex % stride)) / stride
  const firstIndexOf = (outputIndex: number): number =>
    (outputIndex % stride) + stride * (positionOf(outputIndex) >> 1)
  return {
    firstIndex: Int32Array.from({ length: size }, (_, outputIndex) => firstIndexOf(outputIndex)),
    secondIndex: Int32Array.from(
      { length: size },
      (_, outputIndex) => firstIndexOf(outputIndex) + stride * halfSpan
    ),
    twiddleIndex: Int32Array.from(
      { length: size },
      (_, outputIndex) => (positionOf(outputIndex) >> 1) * stride
    ),
    isOddOutput: Uint8Array.from({ length: size }, (_, outputIndex) => positionOf(outputIndex) & 1)
  }
}

/**
 * One radix-2 Stockham stage. Each stage reads the previous arrays and writes fresh ones,
 * so the transform needs no bit-reversal pass and never mutates its input.
 */
const applyStockhamStage = (
  spectrum: ComplexSpectrum,
  indices: StageIndices,
  twiddles: TwiddleTable
): ComplexSpectrum => {
  const { real, imaginary } = spectrum
  const { firstIndex, secondIndex, twiddleIndex, isOddOutput } = indices
  return {
    real: real.map((_, outputIndex) => {
      const first = firstIndex[outputIndex]
      const second = secondIndex[outputIndex]
      if (isOddOutput[outputIndex] === 0) {
        return real[first] + real[second]
      }
      const twiddle = twiddleIndex[outputIndex]
      return (
        (real[first] - real[second]) * twiddles.cosine[twiddle] -
        (imaginary[first] - imaginary[second]) * twiddles.sine[twiddle]
      )
    }),
    imaginary: imaginary.map((_, outputIndex) => {
      const first = firstIndex[outputIndex]
      const second = secondIndex[outputIndex]
      if (isOddOutput[outputIndex] === 0) {
        return imaginary[first] + imaginary[second]
      }
      const twiddle = twiddleIndex[outputIndex]
      return (
        (real[first] - real[second]) * twiddles.sine[twiddle] +
        (imaginary[first] - imaginary[second]) * twiddles.cosine[twiddle]
      )
    })
  }
}

/**
 * Builds an FFT (fast Fourier transform) for one frame size, with its twiddle factors
 * computed once so every frame of a spectrogram reuses them.
 * @param size - frame length, a power of two
 * @returns a transform from real samples to their complex spectrum
 */
export const createFourierTransform = (size: number): FourierTransform => {
  if (!isPowerOfTwo(size)) {
    throw new Error(`FFT length ${size} is not a power of two`)
  }
  const twiddles: TwiddleTable = {
    cosine: Float64Array.from({ length: size / 2 }, (_, index) =>
      Math.cos((-FULL_TURN_RADIANS * index) / size)
    ),
    sine: Float64Array.from({ length: size / 2 }, (_, index) =>
      Math.sin((-FULL_TURN_RADIANS * index) / size)
    )
  }
  const stages = Array.from({ length: Math.log2(size) }, (_, stageIndex) =>
    buildStageIndices(size, 2 ** stageIndex)
  )
  return (samples: Float64Array): ComplexSpectrum => {
    if (samples.length !== size) {
      throw new Error(`FFT expected ${size} samples, got ${samples.length}`)
    }
    return stages.reduce<ComplexSpectrum>(
      (spectrum, indices) => applyStockhamStage(spectrum, indices, twiddles),
      { real: Float64Array.from(samples), imaginary: new Float64Array(size) }
    )
  }
}

/**
 * FFT of a single real signal; build a transform with createFourierTransform when
 * transforming many frames of the same size.
 * @param samples - real input whose length is a power of two
 * @returns the complex spectrum, as long as the input
 */
export const fastFourierTransform = (samples: Float64Array): ComplexSpectrum =>
  createFourierTransform(samples.length)(samples)

/**
 * Magnitude of each frequency bin up to Nyquist.
 * @param samples - real input whose length is a power of two
 * @param transform - a prebuilt transform for this length, reused across frames
 * @returns one magnitude per bin, half as many as the input samples
 */
export const magnitudeSpectrum = (
  samples: Float64Array,
  transform: FourierTransform = createFourierTransform(samples.length)
): Float64Array => {
  const { real, imaginary } = transform(samples)
  return Float64Array.from({ length: samples.length / 2 }, (_, binIndex) =>
    Math.hypot(real[binIndex], imaginary[binIndex])
  )
}
