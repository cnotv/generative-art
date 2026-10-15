import {
  DRUM_HAT_MIN_SHARE,
  DRUM_HIGH_BAND_MIN_HZ,
  DRUM_KICK_MIN_SHARE,
  DRUM_LOW_BAND_MAX_HZ,
  DRUM_SNARE_MIN_SHARE
} from '../config'
import type { DrumSound } from '../types'

type BandShares = {
  low: number
  mid: number
  high: number
}

const bandShares = (
  spectrum: Float64Array,
  previousSpectrum: Float64Array,
  binWidthHz: number
): BandShares | null => {
  const energies = spectrum.reduce(
    (totals, magnitude, binIndex) => {
      const frequencyHz = binIndex * binWidthHz
      const previousMagnitude = previousSpectrum[binIndex] ?? 0
      const energy = Math.max(0, magnitude * magnitude - previousMagnitude * previousMagnitude)
      if (frequencyHz < DRUM_LOW_BAND_MAX_HZ) {
        return { ...totals, low: totals.low + energy }
      }
      if (frequencyHz < DRUM_HIGH_BAND_MIN_HZ) {
        return { ...totals, mid: totals.mid + energy }
      }
      return { ...totals, high: totals.high + energy }
    },
    { low: 0, mid: 0, high: 0 }
  )
  const totalEnergy = energies.low + energies.mid + energies.high
  if (totalEnergy === 0) {
    return null
  }
  return {
    low: energies.low / totalEnergy,
    mid: energies.mid / totalEnergy,
    high: energies.high / totalEnergy
  }
}

/**
 * Guesses which drums sound at an onset from where its new energy sits: a kick is mostly
 * below 150 Hz, a hi-hat mostly above 5 kHz, and a snare fills the band between. Only
 * energy the onset adds over the frame before counts, or a bass note still ringing under
 * a hi-hat fills the low band and turns the hat into a kick.
 * @param spectrum - magnitude spectrum of the onset frame
 * @param binWidthHz - frequency spacing of the bins
 * @param previousSpectrum - magnitude spectrum of the frame before, silence by default
 * @returns the drums heard, empty for silence
 */
export const classifyDrumHit = (
  spectrum: Float64Array,
  binWidthHz: number,
  previousSpectrum: Float64Array = new Float64Array(spectrum.length)
): DrumSound[] => {
  const shares = bandShares(spectrum, previousSpectrum, binWidthHz)
  if (shares === null) {
    return []
  }
  const isKick = shares.low >= DRUM_KICK_MIN_SHARE
  const isHat = shares.high >= DRUM_HAT_MIN_SHARE
  const isSnare = !isKick && shares.mid >= DRUM_SNARE_MIN_SHARE
  return [isKick && 'bd', isSnare && 'sd', isHat && 'hh'].filter(
    (drum): drum is DrumSound => drum !== false
  )
}
