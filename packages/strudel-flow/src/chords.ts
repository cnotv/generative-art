import type { StrudelFlowChordsData } from './types'

const PITCH_NAMES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B']

const KEY_PITCHES: Record<string, number> = {
  C: 0,
  'C#': 1,
  Db: 1,
  D: 2,
  'D#': 3,
  Eb: 3,
  E: 4,
  F: 5,
  'F#': 6,
  Gb: 6,
  G: 7,
  'G#': 8,
  Ab: 8,
  A: 9,
  'A#': 10,
  Bb: 10,
  B: 11
}

const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11]
const MINOR_SCALE = [0, 2, 3, 5, 7, 8, 10]

const DEGREE_LABELS = {
  major: ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'],
  minor: ['i', 'ii°', 'III', 'iv', 'v', 'VI', 'VII']
}

export const STRUDEL_FLOW_CHORD_PRESETS = [
  { label: 'Home', steps: [0, 5, 3, 4] },
  { label: 'Turnaround', steps: [1, 4, 0, 0] },
  { label: 'Descending', steps: [0, 6, 5, 4] }
] as const

/** The number of scale degrees a chord covers at each size. */
const CHORD_SIZE = 3

/**
 * The root degrees a progression plays, derived from its first notes when hand-edited.
 * @param data - the chord node's progression or hand-edited notes
 * @returns one root scale degree per progression step
 */
export const getStrudelFlowChordProgression = (data: StrudelFlowChordsData): number[] =>
  data.chordNotes?.map((notes) => (notes[0] ?? 0) % 7) ?? data.chordProgression

/**
 * The scale degrees under each progression step, built from the played root.
 * @param root - the scale degree of the chord's root
 * @returns the three degrees that make the chord
 */
const buildChord = (root: number): number[] =>
  Array.from({ length: CHORD_SIZE }, (_, index) => root + index * 2)

/**
 * The notes each progression step plays.
 * @param data - the chord node's progression or hand-edited notes
 * @returns the chord notes as scale degrees
 */
export const getStrudelFlowChordNotes = (data: StrudelFlowChordsData): number[][] =>
  data.chordNotes ?? getStrudelFlowChordProgression(data).map(buildChord)

/**
 * Names for the chord cards, editor degrees and preset previews.
 * @param data - the chord node's key, octave, scale and hand-edited notes
 * @returns the Roman numerals, note names and chord names the UI prints
 */
export const getStrudelFlowChordLabels = (data: StrudelFlowChordsData) => {
  const scale = data.scaleType === 'minor' ? MINOR_SCALE : MAJOR_SCALE
  const degrees = DEGREE_LABELS[data.scaleType]
  const pitch = (degree: number): number =>
    (KEY_PITCHES[data.key] ?? 0) + scale[degree % 7] + Math.floor(degree / 7) * 12
  const noteName = (degree: number): string => PITCH_NAMES[pitch(degree) % 12]
  const chordName = (degree: number): string => {
    const degreeLabel = degrees[degree % 7]
    if (degreeLabel.includes('°')) {
      return `${noteName(degree)}°`
    }
    return `${noteName(degree)}${degreeLabel === degreeLabel.toLowerCase() ? 'm' : ''}`
  }
  const noteLabel = (note: number): string =>
    `${noteName(note)}${data.octave + Math.floor(pitch(note) / 12)}`

  return { degrees, noteName, noteLabel, chordName }
}

/**
 * A fresh copy of a chord, safe to edit without changing the previous step.
 * @param notes - the chord's scale degrees
 * @returns a new array with the same notes
 */
export const copyStrudelFlowChord = (notes: number[]): number[] => [...notes]
