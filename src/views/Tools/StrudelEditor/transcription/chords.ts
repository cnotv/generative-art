import { CHORD_MIN_SIMILARITY, CHORD_ROOT_NAMES, CHROMA_MAX_HZ, CHROMA_MIN_HZ } from '../config'
import { frequencyToMidiNote } from './pitch'

const PITCH_CLASS_COUNT = 12
const MAJOR_THIRD = 4
const MINOR_THIRD = 3
const PERFECT_FIFTH = 7

type TriadTemplate = {
  name: string
  pitchClasses: number[]
}

const TRIAD_TEMPLATES: TriadTemplate[] = CHORD_ROOT_NAMES.flatMap((rootName, rootClass) => [
  {
    name: rootName,
    pitchClasses: [0, MAJOR_THIRD, PERFECT_FIFTH].map(
      (interval) => (rootClass + interval) % PITCH_CLASS_COUNT
    )
  },
  {
    name: `${rootName}m`,
    pitchClasses: [0, MINOR_THIRD, PERFECT_FIFTH].map(
      (interval) => (rootClass + interval) % PITCH_CLASS_COUNT
    )
  }
])

/**
 * Energy per pitch class (C to B), folding every octave in the chord range together.
 * @param spectrum - magnitude spectrum of the frame
 * @param binWidthHz - frequency spacing of the bins
 * @returns twelve energies, index 0 for C
 */
export const computeChroma = (spectrum: Float64Array, binWidthHz: number): Float64Array =>
  spectrum.reduce((chroma, magnitude, binIndex) => {
    const frequencyHz = binIndex * binWidthHz
    if (frequencyHz < CHROMA_MIN_HZ || frequencyHz > CHROMA_MAX_HZ) {
      return chroma
    }
    const pitchClass = frequencyToMidiNote(frequencyHz) % PITCH_CLASS_COUNT
    return chroma.map((energy, classIndex) =>
      classIndex === pitchClass ? energy + magnitude * magnitude : energy
    )
  }, new Float64Array(PITCH_CLASS_COUNT))

const cosineSimilarity = (chroma: Float64Array, template: TriadTemplate): number => {
  const chromaLength = Math.hypot(...chroma)
  const overlap = template.pitchClasses.reduce((sum, pitchClass) => sum + chroma[pitchClass], 0)
  return overlap / (chromaLength * Math.sqrt(template.pitchClasses.length))
}

/**
 * Major or minor triad whose pitch classes best match the chroma.
 * @param chroma - twelve pitch-class energies
 * @returns a chord symbol such as "Am" or "F#", or null when nothing matches well
 */
export const matchTriad = (chroma: Float64Array): string | null => {
  if (chroma.every((energy) => energy === 0)) {
    return null
  }
  const best = TRIAD_TEMPLATES.map((template) => ({
    name: template.name,
    similarity: cosineSimilarity(chroma, template)
  })).reduce((winner, candidate) => (candidate.similarity > winner.similarity ? candidate : winner))
  return best.similarity >= CHORD_MIN_SIMILARITY ? best.name : null
}
