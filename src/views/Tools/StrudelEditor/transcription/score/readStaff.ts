import {
  SCORE_DOT_FACTOR,
  SCORE_HOLLOW_BEATS,
  SCORE_ONSET_GROUP_RATIO,
  SCORE_REST_BEATS,
  SCORE_WHOLE_NOTE_MIN_WIDTH_RATIO,
  TAB_BEAM_BEATS
} from '../../config'
import type { NoteHead, PixelBox, StaffPrelude, TabBarSpan, TabEvent, TabSystem } from '../../types'
import { ALTERATION_BY_ACCIDENTAL } from './accidentals'
import { readStaffMarks } from './marks'
import { findNoteHeads } from './noteHeads'
import { nameBarHeads } from './pitch'
import type { ScoreMasks } from './scoreMasks'
import { attachHeads, findStems, isDotted, type StemmedChord } from './stems'

type TimedEvent = { x: number; heads: NoteHead[]; beats: number }

export type StaffReading = {
  /** One list of events per bar. */
  bars: TabEvent[][]
  /** The x of every mark that was skipped, to report by bar. */
  unreadXs: number[]
}

const chordBeats = (chord: StemmedChord, masks: ScoreMasks, gap: number): number => {
  const plain = chord.heads.some((head) => head.isHollow)
    ? SCORE_HOLLOW_BEATS
    : TAB_BEAM_BEATS[chord.beams]
  return chord.heads.some((head) => isDotted(masks, head, gap)) ? plain * SCORE_DOT_FACTOR : plain
}

const meanX = (heads: NoteHead[]): number =>
  heads.reduce((total, head) => total + head.centerX, 0) / heads.length

// A whole note is a hollow head with no stem, wider than a half note's.
const isWholeNote = (head: NoteHead, gap: number): boolean =>
  head.isHollow && head.right - head.left + 1 >= SCORE_WHOLE_NOTE_MIN_WIDTH_RATIO * gap

type Onset = { x: number; heads: NoteHead[]; lengths: number[] }

const ONSET_TOLERANCE = 0.01

// Notes struck together, possibly by two voices on one staff, start one moment.
const groupOnsets = (events: TimedEvent[], gap: number): Onset[] =>
  events
    .toSorted((first, second) => first.x - second.x)
    .reduce<Onset[]>((onsets, event) => {
      const previous = onsets.at(-1)
      return previous !== undefined && event.x - previous.x <= SCORE_ONSET_GROUP_RATIO * gap
        ? [
            ...onsets.slice(0, -1),
            {
              x: previous.x,
              heads: [...previous.heads, ...event.heads],
              lengths: [...previous.lengths, event.beats]
            }
          ]
        : [...onsets, { x: event.x, heads: event.heads, lengths: [event.beats] }]
    }, [])

// Each moment lasts until the first note or rest still sounding ends, whichever voice it is in,
// so a long note in one voice under short ones in the other is counted once.
const timeOnsets = (onsets: Onset[]): TimedEvent[] =>
  onsets.reduce<{ time: number; ends: number[]; events: TimedEvent[] }>(
    (state, onset) => {
      const ends = [...state.ends, ...onset.lengths.map((length) => state.time + length)]
      const next = Math.min(...ends.filter((end) => end > state.time + ONSET_TOLERANCE))
      return {
        time: next,
        ends,
        events: [...state.events, { x: onset.x, heads: onset.heads, beats: next - state.time }]
      }
    },
    { time: 0, ends: [], events: [] }
  ).events

const nameOnsets = (
  onsets: TimedEvent[],
  alterations: Map<NoteHead, number>,
  context: { staff: TabSystem; prelude: StaffPrelude }
): TabEvent[] => {
  const heads = onsets.flatMap((onset) => onset.heads)
  const names = nameBarHeads(heads, alterations, context)
  const nameOf = new Map(heads.map((head, index) => [head, names[index]]))
  return onsets.map((onset) => ({
    notes: [...new Set(onset.heads.map((head) => nameOf.get(head)!))],
    beats: onset.beats
  }))
}

/**
 * Reads one staff of a grand staff into bars of timed notes: heads, stems with their beams and
 * dots, rests, and the accidentals in front of heads.
 * @param masks - the score masks
 * @param zone - the staff's zone, from the end of its prelude to its end
 * @param context - the staff, its prelude, the bars of the system and the line gap
 * @param context.staff - the five line staff
 * @param context.prelude - its clef, key and where the music starts
 * @param context.spans - the bars of the system
 * @param context.gap - the staff line gap in pixels
 * @returns the bars and the marks it skipped
 */
export const readStaff = (
  masks: ScoreMasks,
  zone: PixelBox,
  context: { staff: TabSystem; prelude: StaffPrelude; spans: TabBarSpan[]; gap: number }
): StaffReading => {
  const { staff, prelude, spans, gap } = context
  const isNearBarLine = (x: number): boolean => spans.some((span) => Math.abs(span.endX - x) <= 2)
  const heads = findNoteHeads(masks, zone, gap)
  const stems = findStems(masks, zone, gap).filter((stem) => !isNearBarLine(stem.x))
  const chords = attachHeads(masks, stems, heads, gap)
  const chordHeads = new Set(chords.flatMap((chord) => chord.heads))
  const wholeNotes = heads.filter((head) => !chordHeads.has(head) && isWholeNote(head, gap))
  const noteHeads = [...chordHeads, ...wholeNotes]
  const marks = readStaffMarks(masks, zone, { staff, chords, heads: noteHeads, gap })
  const events: TimedEvent[] = [
    ...chords.map((chord) => ({
      x: meanX(chord.heads),
      heads: chord.heads,
      beats: chordBeats(chord, masks, gap)
    })),
    ...wholeNotes.map((head) => ({
      x: head.centerX,
      heads: [head],
      beats: SCORE_REST_BEATS.whole
    })),
    ...marks.rests.map((rest) => ({ x: rest.x, heads: [], beats: rest.beats }))
  ]
  const alterations = new Map(
    marks.accidentals.map(({ head, accidental }) => [
      head,
      ALTERATION_BY_ACCIDENTAL[accidental.kind]
    ])
  )
  return {
    bars: spans.map((span) => {
      const inBar = events.filter((event) => event.x >= span.startX && event.x < span.endX)
      const onsets = timeOnsets(groupOnsets(inBar, gap)).map((onset) => ({
        ...onset,
        heads: onset.heads.toSorted((first, second) => first.centerX - second.centerX)
      }))
      return nameOnsets(onsets, alterations, { staff, prelude })
    }),
    unreadXs: marks.unread.map((mark) => (mark.left + mark.right) / 2)
  }
}
