import {
  STRUDEL_FLOW_DEFAULT_OCTAVE,
  STRUDEL_FLOW_MAX_LENGTH_DENOMINATOR,
  STRUDEL_FLOW_PITCH_CLASSES,
  STRUDEL_FLOW_SHARP_SIGNS,
  STRUDEL_FLOW_SHARP_SPELLINGS
} from './config'
import type { StrudelFlowSpelledNote } from './types'

const NOTE_NAME_PATTERN = /^([a-g])([#bfs]*)(-?\d+)?$/i
const MIDI_NUMBER_PATTERN = /^-?\d+(\.\d+)?$/
const SEMITONES_PER_OCTAVE = 12
const FRACTION_TOLERANCE = 1e-6

const spellMidiNote = (midiNote: number): StrudelFlowSpelledNote => {
  const pitchClass =
    ((midiNote % SEMITONES_PER_OCTAVE) + SEMITONES_PER_OCTAVE) % SEMITONES_PER_OCTAVE
  return {
    ...STRUDEL_FLOW_SHARP_SPELLINGS[pitchClass],
    octave: Math.floor(midiNote / SEMITONES_PER_OCTAVE) - 1,
    midiNote
  }
}

/**
 * A Strudel note value as it would be written: a name such as `c#3`, `eb2` or `a` keeps its
 * letter and accidentals, and a MIDI number is spelled with sharps.
 * @param note - the note as written in mini notation
 * @returns the letter, alteration, octave and MIDI note, or null when it is not a note
 */
export const readStrudelFlowSpelledNote = (note: string): StrudelFlowSpelledNote | null => {
  if (MIDI_NUMBER_PATTERN.test(note)) {
    return spellMidiNote(Math.round(Number(note)))
  }
  const match = NOTE_NAME_PATTERN.exec(note)
  if (match === null) {
    return null
  }
  const [, letter, accidentals, octaveText] = match
  const alteration = [...accidentals].reduce(
    (total, sign) => total + (STRUDEL_FLOW_SHARP_SIGNS.includes(sign) ? 1 : -1),
    0
  )
  const octave = Number(octaveText ?? STRUDEL_FLOW_DEFAULT_OCTAVE)
  return {
    letter: letter.toLowerCase(),
    alteration,
    octave,
    midiNote:
      (octave + 1) * SEMITONES_PER_OCTAVE +
      STRUDEL_FLOW_PITCH_CLASSES[letter.toLowerCase()] +
      alteration
  }
}

/**
 * The MIDI note a Strudel note value names: a name such as `c#3`, `eb2` or `a`, or a number.
 * @param note - the note as written in mini notation
 * @returns the MIDI note, or null when it is not a note
 */
export const readStrudelFlowMidiNote = (note: string): number | null =>
  readStrudelFlowSpelledNote(note)?.midiNote ?? null

/**
 * A note length as a musician reads it: whole beats, or a fraction such as 1/2 or 1/6.
 * @param beats - the length in beats
 * @returns the length as text
 */
export const formatStrudelFlowBeats = (beats: number): string => {
  const denominator = Array.from(
    { length: STRUDEL_FLOW_MAX_LENGTH_DENOMINATOR },
    (_, index) => index + 1
  ).find(
    (candidate) =>
      Math.abs(beats * candidate - Math.round(beats * candidate)) < FRACTION_TOLERANCE * candidate
  )
  if (denominator === undefined) {
    return String(Math.round(beats * 100) / 100)
  }
  const numerator = Math.round(beats * denominator)
  return denominator === 1 ? String(numerator) : `${numerator}/${denominator}`
}
