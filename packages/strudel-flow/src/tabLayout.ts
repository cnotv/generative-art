import {
  STRUDEL_FLOW_OPEN_STRINGS,
  STRUDEL_FLOW_TAB_BEAM_BEATS,
  STRUDEL_FLOW_TAB_BEAM_STEP,
  STRUDEL_FLOW_TAB_BEAM_THICKNESS,
  STRUDEL_FLOW_TAB_BOTTOM_SPACE,
  STRUDEL_FLOW_TAB_BRACKET_HOOK,
  STRUDEL_FLOW_TAB_BRACKET_LABEL_BASELINE,
  STRUDEL_FLOW_TAB_BRACKET_LABEL_GAP,
  STRUDEL_FLOW_TAB_BRACKET_OVERHANG,
  STRUDEL_FLOW_TAB_BRACKET_Y,
  STRUDEL_FLOW_TAB_DIGIT_CLEARANCE,
  STRUDEL_FLOW_TAB_DIGIT_WIDTH,
  STRUDEL_FLOW_TAB_FLAG_LENGTH,
  STRUDEL_FLOW_TAB_LINE_GAP,
  STRUDEL_FLOW_TAB_MIN_BAR_WIDTH,
  STRUDEL_FLOW_TAB_SIDE_MARGIN,
  STRUDEL_FLOW_TAB_SPACE_PER_BEAT,
  STRUDEL_FLOW_TAB_STEM_BOTTOM,
  STRUDEL_FLOW_TAB_STEM_SPACE,
  STRUDEL_FLOW_TAB_STEM_TOP,
  STRUDEL_FLOW_TAB_TIE_END_GAP,
  STRUDEL_FLOW_TAB_TIE_SAG,
  STRUDEL_FLOW_TAB_TIE_TOP,
  STRUDEL_FLOW_TAB_TOP_MARGIN,
  STRUDEL_FLOW_TAB_TRIPLET_DENOMINATOR,
  STRUDEL_FLOW_TAB_TRIPLET_NUMERATOR
} from './config'
import { placeStrudelFlowFrets } from './fretPlacement'
import { readStrudelFlowMidiNote } from './noteValues'
import type {
  StrudelFlowFretPosition,
  StrudelFlowNoteBar,
  StrudelFlowNoteEvent,
  StrudelFlowTabBracket,
  StrudelFlowTabFret,
  StrudelFlowTabInstrument,
  StrudelFlowTabLayout,
  StrudelFlowTabSegment
} from './types'

const EPSILON = 1e-6
const GAP = STRUDEL_FLOW_TAB_LINE_GAP
const SHORTEST_BEAMS = STRUDEL_FLOW_TAB_BEAM_BEATS.length - 1

/** One stem's worth of a note: the note itself, or a tied continuation of it. */
type StemUnit = {
  start: number
  beats: number
  beams: number
  isTriplet: boolean
}

type PlacedEvent = StrudelFlowNoteEvent & { positions: StrudelFlowFretPosition[] }

type DrawnUnit = StemUnit & {
  x: number
  barIndex: number
  positions: StrudelFlowFretPosition[]
  /** Where the stem before it in the same note stands, when this one is a tie. */
  tiedFromX: number | null
}

type BarDrawing = { units: DrawnUnit[]; endX: number }

const beatOf = (unit: StemUnit): number => Math.floor(unit.start + EPSILON)

const tripletBeams = (beats: number): number =>
  STRUDEL_FLOW_TAB_BEAM_BEATS.findIndex(
    (unitBeats) =>
      Math.abs(
        (unitBeats * STRUDEL_FLOW_TAB_TRIPLET_NUMERATOR) / STRUDEL_FLOW_TAB_TRIPLET_DENOMINATOR -
          beats
      ) < EPSILON
  )

// Whole beats inside a note, so no stem is drawn across a beat.
const beatPieces = (start: number, beats: number): { start: number; beats: number }[] => {
  const end = start + beats
  const firstBeat = Math.floor(start + EPSILON) + 1
  const cuts = Array.from(
    { length: Math.max(0, Math.ceil(end - EPSILON) - firstBeat) },
    (_, offset) => firstBeat + offset
  )
  const points = [start, ...cuts, end]
  return points
    .slice(1)
    .map((point, index) => ({ start: points[index], beats: point - points[index] }))
}

const greedyLengths = (beats: number): number[] =>
  STRUDEL_FLOW_TAB_BEAM_BEATS.reduce<{ left: number; lengths: number[] }>(
    (split, unitBeats) => {
      const count = Math.floor((split.left + EPSILON) / unitBeats)
      return {
        left: split.left - count * unitBeats,
        lengths: [...split.lengths, ...Array.from({ length: count }, () => unitBeats)]
      }
    },
    { left: beats, lengths: [] }
  ).lengths

const stemUnitsOf = (event: StrudelFlowNoteEvent): StemUnit[] => {
  const triplet = tripletBeams(event.beats)
  if (triplet !== -1) {
    return [{ start: event.start, beats: event.beats, beams: triplet, isTriplet: true }]
  }
  const units = beatPieces(event.start, event.beats).flatMap((piece) =>
    greedyLengths(piece.beats).reduce<StemUnit[]>((pieceUnits, unitBeats) => {
      const unitStart = pieceUnits.reduce((total, unit) => total + unit.beats, piece.start)
      return [
        ...pieceUnits,
        {
          start: unitStart,
          beats: unitBeats,
          beams: STRUDEL_FLOW_TAB_BEAM_BEATS.indexOf(unitBeats),
          isTriplet: false
        }
      ]
    }, [])
  )
  // ponytail: a note shorter than a 32nd is drawn as one; finer lengths need more beams.
  return units.length > 0
    ? units
    : [{ start: event.start, beats: event.beats, beams: SHORTEST_BEAMS, isTriplet: false }]
}

// Strudel can overlap two notes that do not start together; a tab plays one after the other.
const sequencedEvents = (bar: StrudelFlowNoteBar): StrudelFlowNoteEvent[] => {
  const sorted = bar.toSorted((first, second) => first.start - second.start)
  return sorted.map((event, index) => {
    const nextStart = sorted[index + 1]?.start ?? Infinity
    return { ...event, beats: Math.min(event.beats, nextStart - event.start) }
  })
}

const placeEvents = (bars: StrudelFlowNoteBar[], openStrings: number[]): PlacedEvent[][] => {
  const sequenced = bars.map(sequencedEvents)
  const chords = sequenced.flat().map((event) =>
    event.notes.flatMap((note) => {
      const midiNote = readStrudelFlowMidiNote(note)
      return midiNote === null ? [] : [midiNote]
    })
  )
  const positions = placeStrudelFlowFrets(chords, openStrings)
  const offsets = sequenced.map((_, barIndex) =>
    sequenced.slice(0, barIndex).reduce((total, bar) => total + bar.length, 0)
  )
  return sequenced.map((bar, barIndex) =>
    bar.map((event, index) => ({ ...event, positions: positions[offsets[barIndex] + index] }))
  )
}

const drawBar = (
  events: PlacedEvent[],
  barIndex: number,
  contentX: number
): { x: number; units: DrawnUnit[] } =>
  events.reduce<{ beat: number; x: number; units: DrawnUnit[] }>(
    (drawing, event) => {
      const startX =
        drawing.x + Math.max(0, event.start - drawing.beat) * STRUDEL_FLOW_TAB_SPACE_PER_BEAT * GAP
      const nextBeat = event.start + event.beats
      if (event.positions.length === 0) {
        return {
          beat: nextBeat,
          x: startX + event.beats * STRUDEL_FLOW_TAB_SPACE_PER_BEAT * GAP,
          units: drawing.units
        }
      }
      const placed = stemUnitsOf(event).reduce<{ x: number; units: DrawnUnit[] }>(
        (unitDrawing, unit, unitIndex) => ({
          x:
            unitDrawing.x +
            (STRUDEL_FLOW_TAB_STEM_SPACE + STRUDEL_FLOW_TAB_SPACE_PER_BEAT * unit.beats) * GAP,
          units: [
            ...unitDrawing.units,
            {
              ...unit,
              x: unitDrawing.x + (STRUDEL_FLOW_TAB_STEM_SPACE / 2) * GAP,
              barIndex,
              positions: event.positions,
              tiedFromX: unitIndex === 0 ? null : (unitDrawing.units.at(-1)?.x ?? null)
            }
          ]
        }),
        { x: startX, units: [] }
      )
      return { beat: nextBeat, x: placed.x, units: [...drawing.units, ...placed.units] }
    },
    { beat: 0, x: contentX, units: [] }
  )

const drawBars = (bars: PlacedEvent[][], staffStartX: number): BarDrawing[] =>
  bars.reduce<BarDrawing[]>((drawings, events, barIndex) => {
    const barStartX = drawings.at(-1)?.endX ?? staffStartX
    const isFirst = barIndex === 0
    const isLast = barIndex === bars.length - 1
    // The staff's own ends need clear line around them, or a reader takes a number for the edge.
    const contentX = barStartX + (isFirst ? STRUDEL_FLOW_TAB_SIDE_MARGIN * GAP : 0)
    const drawn = drawBar(events, barIndex, contentX)
    const endX = Math.max(
      drawn.x + (isLast ? STRUDEL_FLOW_TAB_SIDE_MARGIN * GAP : 0),
      barStartX + STRUDEL_FLOW_TAB_MIN_BAR_WIDTH * GAP
    )
    return [...drawings, { units: drawn.units, endX }]
  }, [])

const groupRuns = <Item>(items: Item[], joins: (previous: Item, item: Item) => boolean): Item[][] =>
  items.reduce<Item[][]>((runs, item, index) => {
    const previous = items[index - 1]
    return previous !== undefined && joins(previous, item)
      ? [...runs.slice(0, -1), [...runs.at(-1)!, item]]
      : [...runs, [item]]
  }, [])

const beamY = (stemBottom: number, level: number): number =>
  stemBottom -
  (STRUDEL_FLOW_TAB_BEAM_THICKNESS / 2 + (level - 1) * STRUDEL_FLOW_TAB_BEAM_STEP) * GAP

// Within one beat, stems that both carry a beam at a level are joined at that level; a stem
// alone at its level gets a flag pointing into its group.
const beamsOfGroup = (group: DrawnUnit[], stemBottom: number): StrudelFlowTabSegment[] =>
  Array.from({ length: SHORTEST_BEAMS }, (_, offset) => offset + 1).flatMap((level) => {
    const y = beamY(stemBottom, level)
    const runs = groupRuns(
      group,
      (previous, unit) => previous.beams >= level && unit.beams >= level
    ).filter((run) => run[0].beams >= level)
    return runs.map((run) => {
      if (run.length > 1) {
        return { x1: run[0].x, y1: y, x2: run.at(-1)!.x, y2: y }
      }
      const direction = run[0] === group[0] ? 1 : -1
      return {
        x1: run[0].x,
        y1: y,
        x2: run[0].x + direction * STRUDEL_FLOW_TAB_FLAG_LENGTH * GAP,
        y2: y
      }
    })
  })

const beamsOf = (units: DrawnUnit[], stemBottom: number): StrudelFlowTabSegment[] =>
  groupRuns(
    units,
    (previous, unit) =>
      previous.beams > 0 &&
      unit.beams > 0 &&
      previous.barIndex === unit.barIndex &&
      beatOf(previous) === beatOf(unit)
  )
    .filter((group) => group[0].beams > 0)
    .flatMap((group) => beamsOfGroup(group, stemBottom))

const bracketsOf = (units: DrawnUnit[], bracketY: number): StrudelFlowTabBracket[] =>
  groupRuns(
    units,
    (previous, unit) => previous.isTriplet && unit.isTriplet && previous.barIndex === unit.barIndex
  )
    .filter((run) => run[0].isTriplet)
    .map((run) => {
      const startX = run[0].x - STRUDEL_FLOW_TAB_BRACKET_OVERHANG * GAP
      const endX = run.at(-1)!.x + STRUDEL_FLOW_TAB_BRACKET_OVERHANG * GAP
      const labelX = (startX + endX) / 2
      const hookY = bracketY - STRUDEL_FLOW_TAB_BRACKET_HOOK * GAP
      const labelGap = STRUDEL_FLOW_TAB_BRACKET_LABEL_GAP * GAP
      return {
        labelX,
        path: [
          `M ${startX} ${hookY} L ${startX} ${bracketY} L ${labelX - labelGap} ${bracketY}`,
          `M ${labelX + labelGap} ${bracketY} L ${endX} ${bracketY} L ${endX} ${hookY}`
        ].join(' ')
      }
    })

const tiePath = (fromX: number, toX: number, y: number): string => {
  const top = y + STRUDEL_FLOW_TAB_TIE_TOP * GAP
  const sag = y + STRUDEL_FLOW_TAB_TIE_SAG * GAP
  const startX = fromX + STRUDEL_FLOW_TAB_DIGIT_WIDTH * GAP
  const endX = toX - STRUDEL_FLOW_TAB_TIE_END_GAP * GAP
  return `M ${startX} ${top} Q ${(startX + endX) / 2} ${sag} ${endX} ${top}`
}

const digitHalfWidth = (fret: number): number =>
  (String(fret).length * STRUDEL_FLOW_TAB_DIGIT_WIDTH * GAP) / 2 +
  STRUDEL_FLOW_TAB_DIGIT_CLEARANCE * GAP

const stringSegments = (
  lineIndex: number,
  y: number,
  frets: StrudelFlowTabFret[],
  staffStartX: number,
  staffEndX: number
): StrudelFlowTabSegment[] => {
  const cuts = frets
    .filter((fret) => fret.lineIndex === lineIndex)
    .map((fret) => [fret.x - digitHalfWidth(fret.fret), fret.x + digitHalfWidth(fret.fret)])
    .toSorted((first, second) => first[0] - second[0])
  const split = cuts.reduce<{ fromX: number; segments: StrudelFlowTabSegment[] }>(
    (state, [cutStart, cutEnd]) => ({
      fromX: Math.max(state.fromX, cutEnd),
      segments:
        cutStart > state.fromX
          ? [...state.segments, { x1: state.fromX, y1: y, x2: cutStart, y2: y }]
          : state.segments
    }),
    { fromX: staffStartX, segments: [] }
  )
  return [...split.segments, { x1: split.fromX, y1: y, x2: staffEndX, y2: y }]
}

/**
 * Lays out a tab staff the way the tab import reads one: fret numbers on the strings, a stem
 * per note under the staff with beams for its length, ties where a note rings across a beat,
 * and triplet brackets. Rests are left as space.
 * @param bars - the notes of each bar
 * @param instrument - bass for four strings, guitar for six
 * @returns every mark of the staff in drawing units
 */
export const layoutStrudelFlowTab = (
  bars: StrudelFlowNoteBar[],
  instrument: StrudelFlowTabInstrument
): StrudelFlowTabLayout => {
  const openStrings = STRUDEL_FLOW_OPEN_STRINGS[instrument]
  const lineYs = openStrings.map((_, lineIndex) => (STRUDEL_FLOW_TAB_TOP_MARGIN + lineIndex) * GAP)
  const bottomY = lineYs.at(-1)!
  const staffStartX = GAP / 2
  const drawings = drawBars(placeEvents(bars, openStrings), staffStartX)
  const staffEndX = drawings.at(-1)?.endX ?? staffStartX + STRUDEL_FLOW_TAB_MIN_BAR_WIDTH * GAP
  const units = drawings.flatMap((drawing) => drawing.units)
  const stemBottom = bottomY + STRUDEL_FLOW_TAB_STEM_BOTTOM * GAP
  const bracketY = bottomY + STRUDEL_FLOW_TAB_BRACKET_Y * GAP
  const frets = units
    .filter((unit) => unit.tiedFromX === null)
    .flatMap((unit) =>
      unit.positions.map((position) => ({ ...position, x: unit.x, y: lineYs[position.lineIndex] }))
    )
  const ties = units.flatMap((unit) =>
    unit.tiedFromX === null
      ? []
      : unit.positions.map((position) =>
          tiePath(unit.tiedFromX!, unit.x, lineYs[position.lineIndex])
        )
  )
  return {
    width: staffEndX + GAP / 2,
    height: bottomY + STRUDEL_FLOW_TAB_BOTTOM_SPACE * GAP,
    lineGap: GAP,
    strings: lineYs.map((y, lineIndex) =>
      stringSegments(lineIndex, y, frets, staffStartX, staffEndX)
    ),
    barLines: [staffStartX, ...drawings.map((drawing) => drawing.endX)].map((x) => ({
      x1: x,
      y1: lineYs[0],
      x2: x,
      y2: bottomY
    })),
    frets,
    stems: units.map((unit) => ({ x: unit.x })),
    beams: beamsOf(units, stemBottom),
    ties,
    brackets: bracketsOf(units, bracketY),
    stemTop: bottomY + STRUDEL_FLOW_TAB_STEM_TOP * GAP,
    stemBottom,
    bracketLabelY: bracketY + STRUDEL_FLOW_TAB_BRACKET_LABEL_BASELINE * GAP
  }
}
