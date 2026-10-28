import { STRUDEL_FLOW_CHORD_FRET_SPAN, STRUDEL_FLOW_MAX_FRET } from './config'
import type { StrudelFlowFretPosition } from './types'

type Placement = {
  chords: StrudelFlowFretPosition[][]
  handFret: number
}

const candidatesFor = (midiNote: number, openStrings: number[]): StrudelFlowFretPosition[] =>
  openStrings.flatMap((openNote, lineIndex) => {
    const fret = midiNote - openNote
    return fret >= 0 && fret <= STRUDEL_FLOW_MAX_FRET ? [{ lineIndex, fret }] : []
  })

// Every way to give each note its own string.
const assignments = (candidateLists: StrudelFlowFretPosition[][]): StrudelFlowFretPosition[][] =>
  candidateLists.reduce<StrudelFlowFretPosition[][]>(
    (partials, candidates) =>
      partials.flatMap((partial) =>
        candidates
          .filter((candidate) => !partial.some((taken) => taken.lineIndex === candidate.lineIndex))
          .map((candidate) => [...partial, candidate])
      ),
    [[]]
  )

// Open strings need no finger, so only fretted notes count towards the hand's span.
const isWithinSpan = (positions: StrudelFlowFretPosition[]): boolean => {
  const fretted = positions.filter((position) => position.fret > 0).map((position) => position.fret)
  return (
    fretted.length === 0 ||
    Math.max(...fretted) - Math.min(...fretted) <= STRUDEL_FLOW_CHORD_FRET_SPAN
  )
}

const handMove = (positions: StrudelFlowFretPosition[], handFret: number): number =>
  positions.reduce((total, position) => total + Math.abs(position.fret - handFret), 0)

// More notes than strings, or two notes only one string can play: the highest note goes first.
const placeChord = (
  candidateLists: StrudelFlowFretPosition[][],
  handFret: number
): StrudelFlowFretPosition[] => {
  const options = assignments(candidateLists)
  if (options.length === 0) {
    return placeChord(candidateLists.slice(0, -1), handFret)
  }
  const playable = options.filter(isWithinSpan)
  return (playable.length > 0 ? playable : options).reduce((best, option) =>
    handMove(option, handFret) < handMove(best, handFret) ? option : best
  )
}

/**
 * Picks a string and fret for every note: per chord, the strings that move the hand least from
 * the last one, within the first 24 frets, with a chord kept inside four frets where it can be.
 * @param chords - the MIDI notes struck together, in playing order
 * @param openStrings - the MIDI note of each open string, from the top staff line down
 * @returns the positions of each chord; a note no string reaches is left out
 */
export const placeStrudelFlowFrets = (
  chords: number[][],
  openStrings: number[]
): StrudelFlowFretPosition[][] =>
  chords.reduce<Placement>(
    (placement, chord) => {
      const reachable = chord
        .toSorted((first, second) => first - second)
        .map((midiNote) => candidatesFor(midiNote, openStrings))
        .filter((candidates) => candidates.length > 0)
      const positions = reachable.length === 0 ? [] : placeChord(reachable, placement.handFret)
      const handFret =
        positions.length === 0
          ? placement.handFret
          : positions.reduce((total, position) => total + position.fret, 0) / positions.length
      return { chords: [...placement.chords, positions], handFret }
    },
    { chords: [], handFret: 0 }
  ).chords
