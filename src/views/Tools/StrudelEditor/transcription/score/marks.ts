import {
  SCORE_ACCIDENTAL_REACH_RATIO,
  SCORE_BAR_LINE_MAX_WIDTH_RATIO,
  SCORE_MARK_MERGE_MARGIN_RATIO,
  SCORE_MARK_MERGE_MAX_RATIO,
  SCORE_MARK_MIN_SIZE_RATIO,
  SCORE_REST_BLOCK_MAX_RATIO,
  SCORE_REST_MAX_STROKE_RATIO,
  SCORE_REST_MAX_WIDTH_RATIO,
  SCORE_REST_MIN_DENSITY,
  SCORE_REST_MIN_WIDTH_RATIO,
  SCORE_REST_QUARTER_MIN_RATIO,
  SCORE_GRACE_REACH_RATIO,
  SCORE_REST_BEATS,
  SCORE_REST_BLOCK_MIN_DENSITY,
  SCORE_REST_BLOCK_MIN_HEIGHT_RATIO,
  SCORE_REST_BLOCK_MIN_WIDTH_RATIO,
  SCORE_REST_CENTRE_REACH_RATIO,
  SCORE_REST_LINE_TOUCH_PIXELS,
  SCORE_STEM_MIN_RATIO,
  SCORE_UNREAD_REACH_RATIO
} from '../../config'
import type { NoteHead, PixelBox, TabSystem } from '../../types'
import { readAccidental, type Accidental } from './accidentals'
import { findComponents, mergeNearComponents, type InkComponent } from './components'
import { isSymbolAt, type ScoreMasks } from './scoreMasks'
import type { StemmedChord } from './stems'

export type ScoreRest = { x: number; beats: number }

export type StaffMarks = {
  rests: ScoreRest[]
  accidentals: { head: NoteHead; accidental: Accidental }[]
  unread: PixelBox[]
}

const contains = (box: PixelBox, x: number, y: number): boolean =>
  x >= box.left && x <= box.right && y >= box.top && y <= box.bottom

const overlaps = (first: PixelBox, second: PixelBox): boolean =>
  first.left <= second.right &&
  second.left <= first.right &&
  first.top <= second.bottom &&
  second.top <= first.bottom

const belongsToNote = (blob: PixelBox, chords: StemmedChord[], heads: NoteHead[]): boolean =>
  heads.some((head) => overlaps(blob, head)) ||
  chords.some((chord) => contains(blob, chord.stem.x, (chord.stem.top + chord.stem.bottom) / 2))

const longestStroke = (masks: ScoreMasks, blob: PixelBox): number =>
  Math.max(
    ...Array.from({ length: blob.bottom - blob.top + 1 }, (_, row) =>
      Math.max(
        ...Array.from(
          { length: blob.right - blob.left + 1 },
          (_, column) => masks.verticalRun[(blob.top + row) * masks.width + blob.left + column]
        )
      )
    )
  )

// Rests are told apart by height alone: a block for a whole or half rest, a short hook for an
// eighth, a tall zigzag for a quarter. A whole rest hangs under the fourth line, a half rest
// sits on the middle one.
const restBeats = (blob: PixelBox, staff: TabSystem, gap: number): number => {
  const height = blob.bottom - blob.top + 1
  if (height <= SCORE_REST_BLOCK_MAX_RATIO * gap) {
    const middle = (blob.top + blob.bottom) / 2
    return middle < (staff.lineYs[1] + staff.lineYs[2]) / 2
      ? SCORE_REST_BEATS.whole
      : SCORE_REST_BEATS.half
  }
  return height >= SCORE_REST_QUARTER_MIN_RATIO * gap
    ? SCORE_REST_BEATS.quarter
    : SCORE_REST_BEATS.eighth
}

const densityOf = (blob: InkComponent): number =>
  blob.pixelCount / ((blob.right - blob.left + 1) * (blob.bottom - blob.top + 1))

// A whole rest hangs from the fourth line and a half rest sits on the middle one, as solid
// blocks; a piece of a tie left by the line removal floats anywhere and is thin.
const isSolidIfBlock = (blob: InkComponent, staff: TabSystem, gap: number): boolean => {
  const height = blob.bottom - blob.top + 1
  const touchesLine =
    Math.abs(blob.top - staff.lineYs[1]) <= SCORE_REST_LINE_TOUCH_PIXELS ||
    Math.abs(blob.bottom - staff.lineYs[2]) <= SCORE_REST_LINE_TOUCH_PIXELS
  return (
    height > SCORE_REST_BLOCK_MAX_RATIO * gap ||
    (touchesLine &&
      height >= SCORE_REST_BLOCK_MIN_HEIGHT_RATIO * gap &&
      blob.right - blob.left + 1 >= SCORE_REST_BLOCK_MIN_WIDTH_RATIO * gap &&
      densityOf(blob) >= SCORE_REST_BLOCK_MIN_DENSITY)
  )
}

const leadsIntoHead = (blob: PixelBox, heads: NoteHead[], gap: number): boolean =>
  heads.some(
    (head) =>
      head.left > blob.right &&
      head.left - blob.right <= SCORE_GRACE_REACH_RATIO * gap &&
      head.centerY >= blob.top - gap &&
      head.centerY <= blob.bottom + gap
  )

const isRestShaped = (
  masks: ScoreMasks,
  blob: InkComponent,
  staff: TabSystem,
  gap: number
): boolean => {
  const width = blob.right - blob.left + 1
  const middle = (blob.top + blob.bottom) / 2
  return (
    isSolidIfBlock(blob, staff, gap) &&
    width >= SCORE_REST_MIN_WIDTH_RATIO * gap &&
    width <= SCORE_REST_MAX_WIDTH_RATIO * gap &&
    Math.abs(middle - staff.lineYs[2]) <= SCORE_REST_CENTRE_REACH_RATIO * gap &&
    (longestStroke(masks, blob) < SCORE_REST_MAX_STROKE_RATIO * gap ||
      densityOf(blob) >= SCORE_REST_MIN_DENSITY)
  )
}

const headAltered = (
  accidental: Accidental,
  heads: NoteHead[],
  gap: number
): NoteHead | undefined =>
  heads.find(
    (head) =>
      head.left >= accidental.right - 1 &&
      head.left - accidental.right <= SCORE_ACCIDENTAL_REACH_RATIO * gap &&
      Math.abs(head.centerY - accidental.centerY) <= gap / 2
  )

type MarkContext = {
  masks: ScoreMasks
  staff: TabSystem
  chords: StemmedChord[]
  heads: NoteHead[]
  gap: number
}

// Grace notes and ornaments sit on the staff; words, dynamics and pedal marks sit further out
// and are left out without a mention.
const isInStaff = (blob: PixelBox, staff: TabSystem, gap: number): boolean => {
  const middle = (blob.top + blob.bottom) / 2
  return (
    middle >= staff.lineYs[0] - SCORE_UNREAD_REACH_RATIO * gap &&
    middle <= staff.lineYs.at(-1)! + SCORE_UNREAD_REACH_RATIO * gap
  )
}

const isBarLine = (blob: PixelBox, gap: number): boolean =>
  blob.right - blob.left + 1 <= SCORE_BAR_LINE_MAX_WIDTH_RATIO * gap &&
  blob.bottom - blob.top + 1 >= SCORE_STEM_MIN_RATIO * gap

const classify = (blob: InkComponent, context: MarkContext): Partial<StaffMarks> => {
  const { masks, staff, chords, heads, gap } = context
  const minimum = SCORE_MARK_MIN_SIZE_RATIO * gap
  if (
    belongsToNote(blob, chords, heads) ||
    (blob.right - blob.left + 1 < minimum && blob.bottom - blob.top + 1 < minimum)
  ) {
    return {}
  }
  const accidental = readAccidental(masks, blob, gap)
  const head = accidental === null ? undefined : headAltered(accidental, heads, gap)
  if (accidental !== null && head !== undefined) {
    return { accidentals: [{ head, accidental }] }
  }
  if (isRestShaped(masks, blob, staff, gap) && !leadsIntoHead(blob, heads, gap)) {
    return { rests: [{ x: (blob.left + blob.right) / 2, beats: restBeats(blob, staff, gap) }] }
  }
  return isInStaff(blob, staff, gap) && !isBarLine(blob, gap) ? { unread: [blob] } : {}
}

/**
 * Sorts every other mark in a staff's zone into rests, accidentals in front of a head, and marks
 * that are none of these, such as grace notes, ornaments, dynamics and words, which are skipped.
 * @param masks - the score masks
 * @param zone - the staff's zone after its clef and key
 * @param context - the staff, its chords, the heads that are notes and the line gap
 * @param context.staff - the five line staff
 * @param context.chords - the chords found on stems
 * @param context.heads - every head that is a note
 * @param context.gap - the staff line gap in pixels
 * @returns the rests, accidentals and unread marks
 */
export const readStaffMarks = (
  masks: ScoreMasks,
  zone: PixelBox,
  context: Omit<MarkContext, 'masks'>
): StaffMarks => {
  const found = findComponents((x, y) => isSymbolAt(masks, x, y), zone)
  const isSmall = (blob: InkComponent): boolean =>
    Math.max(blob.right - blob.left, blob.bottom - blob.top) + 1 <=
    SCORE_MARK_MERGE_MAX_RATIO * context.gap
  const blobs = [
    ...mergeNearComponents(
      found.filter(isSmall),
      Math.round(SCORE_MARK_MERGE_MARGIN_RATIO * context.gap)
    ),
    ...found.filter((blob) => !isSmall(blob))
  ]
  return blobs
    .map((blob) => classify(blob, { ...context, masks }))
    .reduce<StaffMarks>(
      (marks, found) => ({
        rests: [...marks.rests, ...(found.rests ?? [])],
        accidentals: [...marks.accidentals, ...(found.accidentals ?? [])],
        unread: [...marks.unread, ...(found.unread ?? [])]
      }),
      { rests: [], accidentals: [], unread: [] }
    )
}
