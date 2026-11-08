const NOTE_PATTERN = /^([a-g])([#bs]?)(\d+)$/
const SEMITONES_BY_LETTER: Record<string, number> = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 }
const SEMITONES_PER_OCTAVE = 12
const A4_MIDI = 69
const A4_HZ = 440

/**
 * The note's number as superdough counts it, where c4 is 60; `s` and `#` sharpen, `b` flattens.
 * @param noteName - such as `c2` or `ds3`
 * @returns the midi note number
 */
export const readNoteMidi = (noteName: string): number => {
  const match = NOTE_PATTERN.exec(noteName)
  if (match === null) {
    throw new Error(`not a note name: "${noteName}"`)
  }
  const [, letter = 'c', accidental = '', octave = '0'] = match
  const shift = accidental === 'b' ? -1 : accidental === '' ? 0 : 1
  return (Number(octave) + 1) * SEMITONES_PER_OCTAVE + (SEMITONES_BY_LETTER[letter] ?? 0) + shift
}

/**
 * The note's pitch in Hz, tuned to A4 = 440.
 * @param noteName - such as `c2`
 * @returns the frequency in Hz
 */
export const readNoteFrequency = (noteName: string): number =>
  A4_HZ * 2 ** ((readNoteMidi(noteName) - A4_MIDI) / SEMITONES_PER_OCTAVE)
