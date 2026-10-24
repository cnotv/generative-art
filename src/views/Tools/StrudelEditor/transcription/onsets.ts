import {
  DRUM_HIGH_BAND_MIN_HZ,
  DRUM_LOW_BAND_MAX_HZ,
  ONSET_THRESHOLD_OFFSET,
  ONSET_THRESHOLD_RADIUS_FRAMES
} from '../config'

type FrequencyBand = {
  firstBin: number
  endBin: number
}

const splitIntoBands = (binCount: number, binWidthHz: number): FrequencyBand[] => {
  const lowEnd = Math.min(binCount, Math.ceil(DRUM_LOW_BAND_MAX_HZ / binWidthHz))
  const highStart = Math.min(binCount, Math.ceil(DRUM_HIGH_BAND_MIN_HZ / binWidthHz))
  return [
    { firstBin: 0, endBin: lowEnd },
    { firstBin: lowEnd, endBin: highStart },
    { firstBin: highStart, endBin: binCount }
  ].filter((band) => band.endBin > band.firstBin)
}

const bandFlux = (current: Float64Array, previous: Float64Array, band: FrequencyBand): number =>
  current
    .subarray(band.firstBin, band.endBin)
    .reduce(
      (fluxSum, magnitude, offset) =>
        fluxSum + Math.max(0, Math.log1p(magnitude) - Math.log1p(previous[band.firstBin + offset])),
      0
    ) /
  (band.endBin - band.firstBin)

/**
 * Spectral flux: how much new energy each frame adds over the previous one, on a log
 * scale. Each drum band is averaged on its own before the bands are added, because a
 * plain sum over bins lets a hi-hat, which lifts hundreds of bins, bury a kick that lifts
 * only the handful below 150 Hz. The first frame is measured against silence, so a song
 * that opens on its downbeat keeps that onset.
 * @param spectrogram - magnitude spectrum per frame
 * @param binWidthHz - frequency spacing of the bins
 * @returns one non-negative flux value per frame
 */
export const computeSpectralFlux = (
  spectrogram: Float64Array[],
  binWidthHz: number
): Float64Array => {
  const binCount = spectrogram[0]?.length ?? 0
  const bands = splitIntoBands(binCount, binWidthHz)
  const silentFrame = new Float64Array(binCount)
  return Float64Array.from({ length: spectrogram.length }, (_, frameIndex) =>
    bands.reduce(
      (fluxSum, band) =>
        fluxSum +
        bandFlux(spectrogram[frameIndex], spectrogram[frameIndex - 1] ?? silentFrame, band),
      0
    )
  )
}

const neighbourhood = (values: Float64Array, centerIndex: number, radius: number): number[] => [
  ...values.subarray(Math.max(0, centerIndex - radius), centerIndex + radius + 1)
]

const isOnsetPeak = (normalizedFlux: Float64Array, frameIndex: number, radius: number): boolean => {
  const value = normalizedFlux[frameIndex]
  const window = neighbourhood(normalizedFlux, frameIndex, radius)
  const windowMean = window.reduce((sum, windowValue) => sum + windowValue, 0) / window.length
  const isLocalMaximum = window.every((windowValue) => windowValue <= value)
  const risesFromPrevious = frameIndex === 0 || normalizedFlux[frameIndex - 1] < value
  return isLocalMaximum && risesFromPrevious && value > windowMean + ONSET_THRESHOLD_OFFSET
}

/**
 * Frames where the flux peaks above a moving-average threshold.
 * @param flux - spectral flux per frame
 * @param radius - frames either side used for the local maximum and the threshold
 * @returns indices of onset frames, in order
 */
export const pickOnsetPeaks = (
  flux: Float64Array,
  radius = ONSET_THRESHOLD_RADIUS_FRAMES
): number[] => {
  const maximumFlux = Math.max(0, ...flux)
  if (maximumFlux === 0) {
    return []
  }
  const normalizedFlux = flux.map((value) => value / maximumFlux)
  return Array.from({ length: flux.length }, (_, frameIndex) => frameIndex).filter((frameIndex) =>
    isOnsetPeak(normalizedFlux, frameIndex, radius)
  )
}
