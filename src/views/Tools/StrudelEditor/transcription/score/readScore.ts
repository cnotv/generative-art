import {
  MIDI_DEFAULT_BEATS_PER_MINUTE,
  SCORE_COMMON_TIME_BEATS,
  SCORE_TEMPO_BAND,
  SCORE_ZONE_REACH_RATIO
} from '../../config'
import type {
  GrandStaff,
  PixelBox,
  ScoreBar,
  ScoreTranscription,
  TabBarSpan,
  TabEvent,
  TabImage,
  TabSystem
} from '../../types'
import { readTempo } from '../tab/readTempo'
import { lineGapOf } from '../tab/staffLines'
import { findGrandStaffBars, findGrandStaves } from './grandStaves'
import { readPrelude } from './prelude'
import { readStaff, type StaffReading } from './readStaff'
import { buildScoreMasks, type ScoreMasks } from './scoreMasks'

const BEAT_TOLERANCE = 0.01

type SystemReading = {
  rightHand: StaffReading
  leftHand: StaffReading
  spans: TabBarSpan[]
  beatsPerBar: number | null
}

const zoneOf = (
  staff: TabSystem,
  from: number,
  rows: { top: number; bottom: number }
): PixelBox => ({
  left: from,
  right: staff.endX,
  top: Math.max(0, Math.round(rows.top)),
  bottom: Math.round(rows.bottom)
})

const readSystem = (
  image: TabImage,
  masks: ScoreMasks,
  grandStaff: GrandStaff,
  isFirst: boolean
): SystemReading => {
  const { treble, bass } = grandStaff
  const gap = lineGapOf(treble)
  const spans = findGrandStaffBars(image, grandStaff)
  const between = (treble.lineYs.at(-1)! + bass.lineYs[0]) / 2
  const reach = SCORE_ZONE_REACH_RATIO * gap
  const read = (staff: TabSystem, rows: { top: number; bottom: number }): StaffReading => {
    const prelude = readPrelude(image, masks, staff, isFirst)
    return readStaff(masks, zoneOf(staff, prelude.endX + 1, rows), { staff, prelude, spans, gap })
  }
  return {
    rightHand: read(treble, { top: treble.lineYs[0] - reach, bottom: between }),
    leftHand: read(bass, {
      top: between + 1,
      bottom: Math.min(masks.height - 1, bass.lineYs.at(-1)! + reach)
    }),
    spans,
    beatsPerBar: isFirst ? readPrelude(image, masks, treble, true).beatsPerBar : null
  }
}

const beatsOf = (events: TabEvent[]): number =>
  events.reduce((total, event) => total + event.beats, 0)

const rest = (beats: number): TabEvent[] => (beats > BEAT_TOLERANCE ? [{ notes: [], beats }] : [])

// A bar that comes up short is filled with a rest so both hands stay in step: in front of the
// notes for an opening pickup bar, after them anywhere else.
const fillBar = (bar: ScoreBar, beatsPerBar: number, isPickup: boolean): ScoreBar => {
  const fill = (events: TabEvent[]): TabEvent[] => {
    const shortBy = beatsPerBar - beatsOf(events)
    return isPickup ? [...rest(shortBy), ...events] : [...events, ...rest(shortBy)]
  }
  return { rightHand: fill(bar.rightHand), leftHand: fill(bar.leftHand) }
}

const roundedBeats = (beats: number): number => Math.round(beats * 100) / 100

const barWarnings = (bars: ScoreBar[], beatsPerBar: number): string[] =>
  bars.flatMap((bar, index) =>
    (
      [
        ['right', bar.rightHand],
        ['left', bar.leftHand]
      ] as const
    ).flatMap(([hand, events]) => {
      const beats = beatsOf(events)
      const isPickup = index === 0 && beats < beatsPerBar
      return isPickup || Math.abs(beats - beatsPerBar) <= BEAT_TOLERANCE
        ? []
        : [`Bar ${index + 1}, ${hand} hand: holds ${roundedBeats(beats)} beats, not ${beatsPerBar}`]
    })
  )

const skippedWarning = (systems: SystemReading[]): string[] => {
  const barNumbers = systems.reduce<{ first: number; numbers: number[] }>(
    ({ first, numbers }, system) => {
      const xs = [...system.rightHand.unreadXs, ...system.leftHand.unreadXs]
      const found = system.spans.flatMap((span, index) =>
        xs.some((x) => x >= span.startX && x < span.endX) ? [first + index + 1] : []
      )
      return { first: first + system.spans.length, numbers: [...numbers, ...found] }
    },
    { first: 0, numbers: [] }
  ).numbers
  return barNumbers.length === 0
    ? []
    : [
        `Skipped marks it could not read, such as grace notes, ornaments, dynamics or words, in bars ${barNumbers.join(', ')}`
      ]
}

/**
 * Reads a piano score image: each grand staff's clefs, key and bar lines, then the notes,
 * rhythm and rests of both hands. Plain image processing, no model.
 * @param image - the score image
 * @returns the bars of both hands, or an error when no grand staff is found
 */
export const readScore = (image: TabImage): ScoreTranscription => {
  const grandStaves = findGrandStaves(image)
  if (grandStaves.length === 0) {
    throw new Error('No grand staff (a treble and a bass staff) was found in the image')
  }
  const masks = buildScoreMasks(image, lineGapOf(grandStaves[0].treble))
  const systems = grandStaves.map((grandStaff, index) =>
    readSystem(image, masks, grandStaff, index === 0)
  )
  const beatsPerBar = systems[0].beatsPerBar ?? SCORE_COMMON_TIME_BEATS
  const readBars = systems.flatMap((system) =>
    system.rightHand.bars.map((rightHand, index) => ({
      rightHand,
      leftHand: system.leftHand.bars[index]
    }))
  )
  const isPickup =
    readBars.length > 1 &&
    beatsOf(readBars[0].rightHand) < beatsPerBar - BEAT_TOLERANCE &&
    beatsOf(readBars[0].leftHand) < beatsPerBar - BEAT_TOLERANCE
  return {
    kind: 'score',
    beatsPerMinute:
      readTempo(image, grandStaves[0].treble, SCORE_TEMPO_BAND) ?? MIDI_DEFAULT_BEATS_PER_MINUTE,
    beatsPerBar,
    bars: readBars.map((bar, index) => fillBar(bar, beatsPerBar, isPickup && index === 0)),
    warnings: [
      ...(systems[0].beatsPerBar === null
        ? [`No metre was read, so ${SCORE_COMMON_TIME_BEATS}/4 is assumed`]
        : []),
      ...barWarnings(readBars, beatsPerBar),
      ...skippedWarning(systems)
    ]
  }
}
