import { BASS_MAX_HZ, BASS_MIN_HZ, BASS_MIN_RELATIVE_LEVEL, NOTE_NAMES } from '../config'

const A4_MIDI_NOTE = 69
const A4_FREQUENCY_HZ = 440
const SEMITONES_PER_OCTAVE = 12
const PARABOLA_VERTEX_SCALE = 0.5

/**
 * Nearest equal-tempered MIDI note; the inverse of midiNoteToFreq in `@webgamekit/audio`.
 * @param frequencyHz - frequency to name
 * @returns the closest MIDI note number
 */
export const frequencyToMidiNote = (frequencyHz: number): number =>
  Math.round(A4_MIDI_NOTE + SEMITONES_PER_OCTAVE * Math.log2(frequencyHz / A4_FREQUENCY_HZ))

/**
 * Strudel note name for a MIDI note, such as "a2" or "c#4".
 * @param midiNote - MIDI note number
 * @returns the lower-case note name with its octave
 */
export const midiNoteToName = (midiNote: number): string =>
  `${NOTE_NAMES[midiNote % SEMITONES_PER_OCTAVE]}${Math.floor(midiNote / SEMITONES_PER_OCTAVE) - 1}`

/**
 * Refines a peak bin to a fractional bin by fitting a parabola through it and its two
 * neighbours, since low notes sit only a few bins apart.
 * @param spectrum - magnitude spectrum
 * @param peakBin - index of the strongest bin
 * @returns the peak position in fractional bins
 */
const interpolatePeakBin = (spectrum: Float64Array, peakBin: number): number => {
  const left = spectrum[peakBin - 1] ?? 0
  const center = spectrum[peakBin]
  const right = spectrum[peakBin + 1] ?? 0
  const curvature = left - 2 * center + right
  return curvature === 0 ? peakBin : peakBin + (PARABOLA_VERTEX_SCALE * (left - right)) / curvature
}

/**
 * Note name of the strongest peak in the bass band, or null when the bass is too quiet
 * next to the loudest bin in the frame.
 * @param spectrum - magnitude spectrum of the frame
 * @param binWidthHz - frequency spacing of the bins
 * @returns the bass note name, or null
 */
export const dominantBassNote = (spectrum: Float64Array, binWidthHz: number): string | null => {
  const firstBin = Math.ceil(BASS_MIN_HZ / binWidthHz)
  const lastBin = Math.floor(BASS_MAX_HZ / binWidthHz)
  const bassBins = Array.from({ length: lastBin - firstBin + 1 }, (_, index) => firstBin + index)
  const peakBin = bassBins.reduce((bestBin, binIndex) =>
    spectrum[binIndex] > spectrum[bestBin] ? binIndex : bestBin
  )
  const loudestMagnitude = Math.max(...spectrum)
  if (loudestMagnitude === 0 || spectrum[peakBin] < loudestMagnitude * BASS_MIN_RELATIVE_LEVEL) {
    return null
  }
  return midiNoteToName(frequencyToMidiNote(interpolatePeakBin(spectrum, peakBin) * binWidthHz))
}
