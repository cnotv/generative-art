import {
  STRUDEL_FLOW_NOTE_LETTERS,
  STRUDEL_FLOW_SHEET_ACCIDENTAL_SPACE,
  STRUDEL_FLOW_SHEET_BOTTOM_MARGIN,
  STRUDEL_FLOW_SHEET_BOTTOM_STEPS,
  STRUDEL_FLOW_SHEET_BRACKET_RISE,
  STRUDEL_FLOW_SHEET_CLEF_SPACE,
  STRUDEL_FLOW_SHEET_COLUMN_SPACE,
  STRUDEL_FLOW_SHEET_DOT_FACTOR,
  STRUDEL_FLOW_SHEET_DOT_OFFSET,
  STRUDEL_FLOW_SHEET_FLAG_STEP,
  STRUDEL_FLOW_SHEET_HEAD_RADIUS_X,
  STRUDEL_FLOW_SHEET_LINE_GAP,
  STRUDEL_FLOW_SHEET_MIN_BAR_WIDTH,
  STRUDEL_FLOW_SHEET_SPACE_PER_BEAT,
  STRUDEL_FLOW_SHEET_STAFF_DISTANCE,
  STRUDEL_FLOW_SHEET_STEM_LENGTH,
  STRUDEL_FLOW_SHEET_TIE_OFFSET,
  STRUDEL_FLOW_SHEET_TIE_SAG,
  STRUDEL_FLOW_SHEET_TOP_MARGIN,
  STRUDEL_FLOW_SHEET_TREBLE_LOWEST_NOTE,
  STRUDEL_FLOW_SHEET_VALUES,
  STRUDEL_FLOW_TAB_BRACKET_LABEL_GAP,
  STRUDEL_FLOW_TAB_BRACKET_LABEL_BASELINE,
  STRUDEL_FLOW_TAB_BRACKET_HOOK,
  STRUDEL_FLOW_TAB_BRACKET_OVERHANG,
  STRUDEL_FLOW_TAB_TRIPLET_DENOMINATOR,
  STRUDEL_FLOW_TAB_TRIPLET_NUMERATOR
} from './config'
import { sequenceStrudelFlowNoteBar } from './notationSequence'
import { readStrudelFlowSpelledNote } from './noteValues'
import type {
  StrudelFlowNoteBar,
  StrudelFlowSheetAccidental,
  StrudelFlowSheetChord,
  StrudelFlowSheetHead,
  StrudelFlowSheetLayout,
  StrudelFlowSheetRest,
  StrudelFlowSheetStaff,
  StrudelFlowSpelledNote,
  StrudelFlowTabBracket
} from './types'

const EPSILON = 1e-6
const GAP = STRUDEL_FLOW_SHEET_LINE_GAP
const HALF_GAP = GAP / 2
const STEPS_PER_OCTAVE = STRUDEL_FLOW_NOTE_LETTERS.length
/** Steps from the bottom line to the middle and the top line of a five line staff. */
const MIDDLE_LINE_STEP = 4
const TOP_LINE_STEP = 8
const TRIPLET_RATIO = STRUDEL_FLOW_TAB_TRIPLET_NUMERATOR / STRUDEL_FLOW_TAB_TRIPLET_DENOMINATOR
const LONGEST_VALUE = STRUDEL_FLOW_SHEET_VALUES[0].beats
const SHORTEST_VALUE = STRUDEL_FLOW_SHEET_VALUES.at(-1)!.beats

/** One written note or rest length: the value its shape shows, with a dot or as a triplet. */
type SheetUnit = { beats: number; value: number; dotted: boolean; isTriplet: boolean }

/** The notes of one staff in one column, or none for a rest. */
type Column = {
  unit: SheetUnit
  notesByStaff: StrudelFlowSpelledNote[][]
  isFirstUnit: boolean
  tiedForward: boolean
}

type SignState = Map<string, number>

type BarState = {
  x: number
  chords: StrudelFlowSheetChord[]
  rests: StrudelFlowSheetRest[]
  ties: string[]
  tripletXs: number[][]
  signs: SignState
  lastChordByStaff: (StrudelFlowSheetChord | null)[]
}

const WRITTEN_LENGTHS = STRUDEL_FLOW_SHEET_VALUES.flatMap((written) => [
  { beats: written.beats * STRUDEL_FLOW_SHEET_DOT_FACTOR, value: written.beats, dotted: true },
  { beats: written.beats, value: written.beats, dotted: false }
])
  .filter((length) => length.beats <= LONGEST_VALUE + EPSILON)
  .toSorted((first, second) => second.beats - first.beats)

const takeLengths = (left: number): SheetUnit[] => {
  const length = WRITTEN_LENGTHS.find((candidate) => candidate.beats <= left + EPSILON)
  return length === undefined
    ? []
    : [{ ...length, isTriplet: false }, ...takeLengths(left - length.beats)]
}

// A triplet is one shape at two thirds of its length; anything else is the fewest written
// lengths, dotted where that saves a tie, tied together.
const sheetUnits = (beats: number): SheetUnit[] => {
  const tripletValue = STRUDEL_FLOW_SHEET_VALUES.find(
    (written) => Math.abs(written.beats * TRIPLET_RATIO - beats) < EPSILON
  )?.beats
  if (tripletValue !== undefined) {
    return [{ beats, value: tripletValue, dotted: false, isTriplet: true }]
  }
  const units = takeLengths(beats)
  // ponytail: a length under a 32nd is drawn as a 32nd; finer values need more flags.
  return units.length > 0
    ? units
    : [{ beats, value: SHORTEST_VALUE, dotted: false, isTriplet: false }]
}

const stepOf = (note: StrudelFlowSpelledNote): number =>
  STRUDEL_FLOW_NOTE_LETTERS.indexOf(note.letter) + STEPS_PER_OCTAVE * note.octave

const createStaves = (notes: StrudelFlowSpelledNote[]): StrudelFlowSheetStaff[] => {
  const hasTreble =
    notes.length === 0 ||
    notes.some((note) => note.midiNote >= STRUDEL_FLOW_SHEET_TREBLE_LOWEST_NOTE)
  const hasBass = notes.some((note) => note.midiNote < STRUDEL_FLOW_SHEET_TREBLE_LOWEST_NOTE)
  const clefs = [...(hasTreble ? ['treble' as const] : []), ...(hasBass ? ['bass' as const] : [])]
  return clefs.map((clef, index) => {
    const topY = (STRUDEL_FLOW_SHEET_TOP_MARGIN + index * STRUDEL_FLOW_SHEET_STAFF_DISTANCE) * GAP
    return {
      clef,
      topY,
      bottomY: topY + TOP_LINE_STEP * HALF_GAP,
      bottomStep: STRUDEL_FLOW_SHEET_BOTTOM_STEPS[clef]
    }
  })
}

const staffIndexOf = (note: StrudelFlowSpelledNote, staves: StrudelFlowSheetStaff[]): number =>
  staves.length === 1 || note.midiNote >= STRUDEL_FLOW_SHEET_TREBLE_LOWEST_NOTE ? 0 : 1

const restColumns = (beats: number, staffCount: number): Column[] =>
  beats > EPSILON
    ? sheetUnits(beats).map((unit) => ({
        unit,
        notesByStaff: Array.from({ length: staffCount }, () => []),
        isFirstUnit: true,
        tiedForward: false
      }))
    : []

const barColumns = (
  bar: StrudelFlowNoteBar,
  staves: StrudelFlowSheetStaff[],
  beatsPerBar: number
): Column[] => {
  const walked = sequenceStrudelFlowNoteBar(bar).reduce<{ beat: number; columns: Column[] }>(
    (state, event) => {
      const notes = event.notes.flatMap((note) => {
        const spelled = readStrudelFlowSpelledNote(note)
        return spelled === null ? [] : [spelled]
      })
      const notesByStaff = staves.map((_, staffIndex) =>
        notes.filter((note) => staffIndexOf(note, staves) === staffIndex)
      )
      const units = sheetUnits(event.beats)
      return {
        beat: event.start + event.beats,
        columns: [
          ...state.columns,
          ...restColumns(event.start - state.beat, staves.length),
          ...units.map((unit, unitIndex) => ({
            unit,
            notesByStaff,
            isFirstUnit: unitIndex === 0,
            tiedForward: unitIndex < units.length - 1
          }))
        ]
      }
    },
    { beat: 0, columns: [] }
  )
  return [...walked.columns, ...restColumns(beatsPerBar - walked.beat, staves.length)]
}

const accidentalFor = (alteration: number): StrudelFlowSheetAccidental => {
  if (alteration > 0) {
    return 'sharp'
  }
  return alteration < 0 ? 'flat' : 'natural'
}

const ledgerYs = (staff: StrudelFlowSheetStaff, step: number): number[] => {
  const below = Array.from(
    { length: Math.max(0, Math.floor(-step / 2)) },
    (_, index) => -2 * (index + 1)
  )
  const above = Array.from(
    { length: Math.max(0, Math.floor((step - TOP_LINE_STEP) / 2)) },
    (_, index) => TOP_LINE_STEP + 2 * (index + 1)
  )
  return [...below, ...above].map((ledgerStep) => staff.bottomY - ledgerStep * HALF_GAP)
}

// A sign is written when a note differs from what the bar has said so far about that line or
// space; a tied continuation says nothing new.
const placeHeads = (
  notes: StrudelFlowSpelledNote[],
  staff: StrudelFlowSheetStaff,
  signs: SignState,
  writesSigns: boolean
): { heads: (StrudelFlowSheetHead & { step: number })[]; signs: SignState } =>
  notes
    .toSorted((first, second) => stepOf(first) - stepOf(second))
    .reduce<{ heads: (StrudelFlowSheetHead & { step: number })[]; signs: SignState }>(
      (state, note) => {
        const key = String(stepOf(note))
        const step = stepOf(note) - staff.bottomStep
        const needsSign = writesSigns && (state.signs.get(key) ?? 0) !== note.alteration
        return {
          signs: needsSign ? new Map(state.signs).set(key, note.alteration) : state.signs,
          heads: [
            ...state.heads,
            {
              y: staff.bottomY - step * HALF_GAP,
              step,
              accidental: needsSign ? accidentalFor(note.alteration) : null,
              ledgerYs: ledgerYs(staff, step)
            }
          ]
        }
      },
      { heads: [], signs }
    )

const flagPath = (x: number, startY: number, direction: number): string =>
  `M ${x} ${startY} c ${0.1 * GAP} ${direction * 0.8 * GAP} ${1.1 * GAP} ${direction * GAP} ${0.9 * GAP} ${direction * 2 * GAP}`

const buildChord = (
  heads: (StrudelFlowSheetHead & { step: number })[],
  column: Column,
  staffIndex: number,
  x: number
): StrudelFlowSheetChord => {
  const written = STRUDEL_FLOW_SHEET_VALUES.find((value) => value.beats === column.unit.value)!
  const stemUp =
    heads.reduce((total, head) => total + head.step, 0) / heads.length < MIDDLE_LINE_STEP
  const ys = heads.map((head) => head.y)
  const direction = stemUp ? -1 : 1
  const stemX = x + (stemUp ? 1 : -1) * STRUDEL_FLOW_SHEET_HEAD_RADIUS_X * GAP
  const stemStart = stemUp ? Math.max(...ys) : Math.min(...ys)
  const stemEnd =
    (stemUp ? Math.min(...ys) : Math.max(...ys)) + direction * STRUDEL_FLOW_SHEET_STEM_LENGTH * GAP
  return {
    x,
    staffIndex,
    heads: heads.map(({ y, accidental, ledgerYs: ledgers }) => ({
      y,
      accidental,
      ledgerYs: ledgers
    })),
    filled: written.filled,
    stem: written.stem ? { x1: stemX, y1: stemStart, x2: stemX, y2: stemEnd } : null,
    flags: Array.from({ length: written.flags }, (_, index) =>
      flagPath(stemX, stemEnd - direction * index * STRUDEL_FLOW_SHEET_FLAG_STEP * GAP, -direction)
    ),
    dots: column.unit.dotted
      ? heads.map((head) => ({
          x: x + STRUDEL_FLOW_SHEET_DOT_OFFSET * GAP,
          y: head.step % 2 === 0 ? head.y - HALF_GAP : head.y
        }))
      : [],
    isTriplet: column.unit.isTriplet,
    tiedForward: column.tiedForward
  }
}

const restPath = (value: number, x: number, staff: StrudelFlowSheetStaff): string => {
  const middle = staff.topY + MIDDLE_LINE_STEP * HALF_GAP
  if (value >= 2) {
    // A whole rest hangs under the second line, a half rest sits on the middle one.
    const top = value === LONGEST_VALUE ? staff.topY + GAP : middle - HALF_GAP
    return `M ${x - 0.6 * GAP} ${top} h ${1.2 * GAP} v ${HALF_GAP} h ${-1.2 * GAP} Z`
  }
  if (value === 1) {
    return `M ${x - 0.2 * GAP} ${middle - 1.5 * GAP} l ${0.6 * GAP} ${0.8 * GAP} l ${-0.5 * GAP} ${0.6 * GAP} l ${0.5 * GAP} ${0.8 * GAP} c ${-0.6 * GAP} ${-0.3 * GAP} ${-0.9 * GAP} ${0.2 * GAP} ${-0.3 * GAP} ${0.8 * GAP}`
  }
  const hooks = Math.round(Math.log2(1 / value))
  // Each hook is a dot with a short stroke curling to the rest's slanted stem.
  const hookPaths = Array.from({ length: hooks }, (_, index) => {
    const y = middle - 0.6 * GAP + index * 0.7 * GAP
    const dotX = x - 0.35 * GAP
    const radius = 0.16 * GAP
    return [
      `M ${dotX - radius} ${y} a ${radius} ${radius} 0 1 0 ${2 * radius} 0 a ${radius} ${radius} 0 1 0 ${-2 * radius} 0`,
      `M ${dotX} ${y + radius} q ${0.4 * GAP} ${0.15 * GAP} ${0.75 * GAP} ${-0.25 * GAP}`
    ].join(' ')
  })
  return [
    ...hookPaths,
    `M ${x + 0.4 * GAP} ${middle - 0.8 * GAP} L ${x - 0.1 * GAP} ${middle + 1.2 * GAP}`
  ].join(' ')
}

const tiePath = (from: StrudelFlowSheetChord, to: StrudelFlowSheetChord, y: number): string => {
  const direction = from.stem === null || from.stem.y2 < from.stem.y1 ? 1 : -1
  const startX = from.x + STRUDEL_FLOW_SHEET_TIE_OFFSET * GAP
  const endX = to.x - STRUDEL_FLOW_SHEET_TIE_OFFSET * GAP
  const edgeY = y + direction * STRUDEL_FLOW_SHEET_TIE_OFFSET * GAP
  const sagY = edgeY + direction * STRUDEL_FLOW_SHEET_TIE_SAG * GAP
  return `M ${startX} ${edgeY} Q ${(startX + endX) / 2} ${sagY} ${endX} ${edgeY}`
}

const columnWidth = (unit: SheetUnit): number =>
  (STRUDEL_FLOW_SHEET_COLUMN_SPACE + STRUDEL_FLOW_SHEET_SPACE_PER_BEAT * unit.beats) * GAP

const drawColumn = (state: BarState, column: Column, staves: StrudelFlowSheetStaff[]): BarState => {
  const placed = staves.map((staff, staffIndex) =>
    placeHeads(column.notesByStaff[staffIndex], staff, state.signs, column.isFirstUnit)
  )
  const hasSign = placed.some((staffHeads) =>
    staffHeads.heads.some((head) => head.accidental !== null)
  )
  const x =
    state.x +
    (hasSign ? STRUDEL_FLOW_SHEET_ACCIDENTAL_SPACE * GAP : 0) +
    (STRUDEL_FLOW_SHEET_COLUMN_SPACE / 2) * GAP
  const signs = placed.reduce<SignState>(
    (merged, staffHeads) => new Map([...merged, ...staffHeads.signs]),
    state.signs
  )
  const marks = staves.map((staff, staffIndex) =>
    placed[staffIndex].heads.length === 0
      ? {
          chord: null,
          rest: {
            x,
            staffIndex,
            beats: column.unit.value,
            dotted: column.unit.dotted,
            isTriplet: column.unit.isTriplet,
            path: restPath(column.unit.value, x, staff),
            solid: column.unit.value >= 2
          }
        }
      : { chord: buildChord(placed[staffIndex].heads, column, staffIndex, x), rest: null }
  )
  const ties = marks.flatMap((mark, staffIndex) => {
    const previous = state.lastChordByStaff[staffIndex]
    return mark.chord !== null && !column.isFirstUnit && previous !== null
      ? mark.chord.heads.map((head) => tiePath(previous, mark.chord!, head.y))
      : []
  })
  const lastTriplets = state.tripletXs.at(-1)
  return {
    x: x + columnWidth(column.unit) - (STRUDEL_FLOW_SHEET_COLUMN_SPACE / 2) * GAP,
    chords: [
      ...state.chords,
      ...marks.flatMap((mark) => (mark.chord === null ? [] : [mark.chord]))
    ],
    rests: [...state.rests, ...marks.flatMap((mark) => (mark.rest === null ? [] : [mark.rest]))],
    ties: [...state.ties, ...ties],
    tripletXs: column.unit.isTriplet
      ? [...state.tripletXs.slice(0, -1), [...(lastTriplets ?? []), x]]
      : lastTriplets === undefined || lastTriplets.length > 0
        ? [...state.tripletXs, []]
        : state.tripletXs,
    signs,
    lastChordByStaff: marks.map((mark) => mark.chord)
  }
}

const bracketOf = (xs: number[], y: number): StrudelFlowTabBracket => {
  const startX = xs[0] - STRUDEL_FLOW_TAB_BRACKET_OVERHANG * GAP
  const endX = xs.at(-1)! + STRUDEL_FLOW_TAB_BRACKET_OVERHANG * GAP
  const labelX = (startX + endX) / 2
  const hookY = y + STRUDEL_FLOW_TAB_BRACKET_HOOK * GAP
  const labelGap = STRUDEL_FLOW_TAB_BRACKET_LABEL_GAP * GAP
  return {
    labelX,
    path: [
      `M ${startX} ${hookY} L ${startX} ${y} L ${labelX - labelGap} ${y}`,
      `M ${labelX + labelGap} ${y} L ${endX} ${y} L ${endX} ${hookY}`
    ].join(' ')
  }
}

/**
 * Lays out notes as piano sheet music: a treble staff for middle C and up, a bass staff below
 * it, both as a grand staff when the notes need both. Heads sit on lines and spaces with ledger
 * lines beyond the staff, accidentals are written once per bar, lengths become heads, stems,
 * flags, dots, ties and triplet brackets, and silence becomes rests.
 * @param bars - the notes of each bar
 * @param beatsPerBar - how long a bar is, so a bar that stops early ends in a rest
 * @returns every mark of the sheet in drawing units
 */
export const layoutStrudelFlowSheet = (
  bars: StrudelFlowNoteBar[],
  beatsPerBar: number
): StrudelFlowSheetLayout => {
  const allNotes = bars.flat().flatMap((event) =>
    event.notes.flatMap((note) => {
      const spelled = readStrudelFlowSpelledNote(note)
      return spelled === null ? [] : [spelled]
    })
  )
  const staves = createStaves(allNotes)
  const staffStartX = HALF_GAP
  const drawn = bars.reduce<{
    x: number
    barEndXs: number[]
    chords: StrudelFlowSheetChord[]
    rests: StrudelFlowSheetRest[]
    ties: string[]
    tripletXs: number[][]
  }>(
    (sheet, bar) => {
      const barStartX = sheet.x
      const barState = barColumns(bar, staves, beatsPerBar).reduce<BarState>(
        (state, column) => drawColumn(state, column, staves),
        {
          x: barStartX,
          chords: [],
          rests: [],
          ties: [],
          tripletXs: [],
          signs: new Map(),
          lastChordByStaff: staves.map(() => null)
        }
      )
      const endX = Math.max(barState.x + GAP, barStartX + STRUDEL_FLOW_SHEET_MIN_BAR_WIDTH * GAP)
      return {
        x: endX,
        barEndXs: [...sheet.barEndXs, endX],
        chords: [...sheet.chords, ...barState.chords],
        rests: [...sheet.rests, ...barState.rests],
        ties: [...sheet.ties, ...barState.ties],
        tripletXs: [...sheet.tripletXs, ...barState.tripletXs]
      }
    },
    {
      x: staffStartX + STRUDEL_FLOW_SHEET_CLEF_SPACE * GAP,
      barEndXs: [],
      chords: [],
      rests: [],
      ties: [],
      tripletXs: []
    }
  )
  const staffEndX = drawn.barEndXs.at(-1) ?? drawn.x
  const bracketY = staves[0].topY - STRUDEL_FLOW_SHEET_BRACKET_RISE * GAP
  return {
    width: staffEndX + HALF_GAP,
    height: staves.at(-1)!.bottomY + STRUDEL_FLOW_SHEET_BOTTOM_MARGIN * GAP,
    lineGap: GAP,
    staves,
    staffStartX,
    staffEndX,
    barEndXs: drawn.barEndXs,
    chords: drawn.chords,
    rests: drawn.rests,
    ties: drawn.ties,
    brackets: drawn.tripletXs.filter((xs) => xs.length > 0).map((xs) => bracketOf(xs, bracketY)),
    bracketLabelY: bracketY + STRUDEL_FLOW_TAB_BRACKET_LABEL_BASELINE * GAP
  }
}
