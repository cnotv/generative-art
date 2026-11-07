import { getStrudelFlowChordNotes, MAJOR_SCALE, MINOR_SCALE } from './chords'
import { STRUDEL_FLOW_CHORD_SCALE_OPTIONS } from './config'
import type { StrudelFlowChordsData } from './types'

type ScaleType = StrudelFlowChordsData['scaleType']

const SEMITONES_PER_OCTAVE = 12
const CHORD_NOTE_OFFSETS = [0, 2, 4]
const REST = '~'
const SYMBOL_PATTERN = /^([A-G]#?)(m|dim)?$/
const ROOT_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

const SCALE_INTERVALS: Record<ScaleType, number[]> = { major: MAJOR_SCALE, minor: MINOR_SCALE }

// The suffix of the triad built on each scale degree.
const DEGREE_SUFFIXES: Record<ScaleType, string[]> = {
  major: ['', 'm', 'm', '', '', 'm', 'dim'],
  minor: ['m', 'dim', '', 'm', 'm', '', '']
}

type Chord = { rootPitch: number; suffix: string } | null

const readChordSymbol = (symbol: string): Chord | undefined => {
  if (symbol === REST) {
    return null
  }
  const match = SYMBOL_PATTERN.exec(symbol)
  return match === null
    ? undefined
    : { rootPitch: ROOT_NAMES.indexOf(match[1]), suffix: match[2] ?? '' }
}

const findDegree = (chord: Chord, keyPitch: number, scaleType: ScaleType): number | undefined => {
  if (chord === null) {
    return 0
  }
  const interval = (chord.rootPitch - keyPitch + SEMITONES_PER_OCTAVE) % SEMITONES_PER_OCTAVE
  const degree = SCALE_INTERVALS[scaleType].indexOf(interval)
  return degree !== -1 && DEGREE_SUFFIXES[scaleType][degree] === chord.suffix ? degree : undefined
}

type Reading = { key: string; scaleType: ScaleType; degrees: number[] }

const readInKey = (chords: Chord[], keyPitch: number, scaleType: ScaleType): Reading | null => {
  const degrees = chords.map((chord) => findDegree(chord, keyPitch, scaleType))
  return degrees.every((degree) => degree !== undefined)
    ? { key: ROOT_NAMES[keyPitch], scaleType, degrees: degrees as number[] }
    : null
}

const opensOnTonic = (reading: Reading): boolean => reading.degrees[0] === 0

/**
 * Reads `<C Am F G>` into a Chords node, in the key whose tonic opens the progression when
 * more than one key holds every chord.
 * @param pattern - the mini notation inside `chord("...")`
 * @returns the Chords node, or null when a symbol is not a plain major, minor or diminished
 *   triad, the chords share no key, or the pattern is not one chord per cycle
 */
export const readStrudelFlowChordSymbols = (pattern: string): StrudelFlowChordsData | null => {
  const text = pattern.trim()
  if (!text.startsWith('<') || !text.endsWith('>')) {
    return null
  }
  const chords = text.slice(1, -1).trim().split(/\s+/).map(readChordSymbol)
  if (chords.some((chord) => chord === undefined) || chords.every((chord) => chord === null)) {
    return null
  }
  const readings = STRUDEL_FLOW_CHORD_SCALE_OPTIONS.flatMap((option) =>
    ROOT_NAMES.map((_, keyPitch) =>
      readInKey(chords as Chord[], keyPitch, option.value as ScaleType)
    )
  ).filter((reading): reading is Reading => reading !== null)
  const reading = readings.find(opensOnTonic) ?? readings[0]
  if (reading === undefined) {
    return null
  }
  const hasRest = chords.some((chord) => chord === null)
  return {
    kind: 'chords',
    key: reading.key,
    octave: 4,
    scaleType: reading.scaleType,
    chordProgression: reading.degrees,
    chordSymbols: true,
    ...(hasRest
      ? {
          chordNotes: reading.degrees.map((degree, index) =>
            chords[index] === null ? [] : CHORD_NOTE_OFFSETS.map((offset) => degree + offset)
          )
        }
      : {})
  }
}

/**
 * Writes a Chords node as the chord symbols of `chord("<...>")`.
 * @param data - the node's key, scale, progression and rests
 * @returns the pattern, such as `<C Am F G>`
 */
export const writeStrudelFlowChordSymbols = (data: StrudelFlowChordsData): string => {
  const keyPitch = ROOT_NAMES.indexOf(data.key)
  const intervals = SCALE_INTERVALS[data.scaleType]
  const symbols = getStrudelFlowChordNotes(data).map((notes) => {
    if (notes.length === 0) {
      return REST
    }
    const degree = notes[0] % intervals.length
    const root = ROOT_NAMES[(keyPitch + intervals[degree]) % SEMITONES_PER_OCTAVE]
    return `${root}${DEGREE_SUFFIXES[data.scaleType][degree]}`
  })
  return `<${symbols.join(' ')}>`
}
