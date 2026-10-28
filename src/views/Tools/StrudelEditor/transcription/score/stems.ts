import {
  SCORE_BEAM_FAR_RATIO,
  SCORE_BEAM_NEAR_RATIO,
  SCORE_ACCIDENTAL_STROKE_RATIO,
  SCORE_BEAM_SEARCH_RATIO,
  SCORE_DOT_FAR_RATIO,
  SCORE_DOT_MAX_SIZE_RATIO,
  SCORE_DOT_ABOVE_RATIO,
  SCORE_DOT_BELOW_RATIO,
  SCORE_HEAD_HALF_WIDTH_RATIO,
  SCORE_STEM_ATTACH_RATIO,
  SCORE_STEM_MIN_RATIO,
  TAB_MAX_BEAMS
} from '../../config'
import type { NoteHead, PixelBox } from '../../types'
import { groupRuns } from '../tab/imageProbes'
import { findComponents } from './components'
import { isSymbolAt, runsAlong, type ScoreMasks } from './scoreMasks'

export type Stem = { x: number; top: number; bottom: number }

export type StemmedChord = {
  stem: Stem
  heads: NoteHead[]
  beams: number
}

/**
 * Every vertical stroke at least a stem long in a zone, neighbouring columns joined.
 * @param masks - the score masks
 * @param zone - the part of the page to search
 * @param gap - the staff line gap in pixels
 * @returns the strokes from left to right
 */
export const findStems = (masks: ScoreMasks, zone: PixelBox, gap: number): Stem[] => {
  const minimum = SCORE_STEM_MIN_RATIO * gap
  const segments = Array.from(
    { length: zone.right - zone.left + 1 },
    (_, offset) => zone.left + offset
  ).flatMap((x) =>
    runsAlong(zone.bottom - zone.top + 1, (offset) => {
      const index = (zone.top + offset) * masks.width + x
      return masks.symbol[index] === 1 && masks.verticalRun[index] >= minimum
    }).map(([first, last]) => ({ x, top: zone.top + first, bottom: zone.top + last }))
  )
  return segments.reduce<Stem[]>((stems, segment) => {
    const previous = stems.at(-1)
    const joins =
      previous !== undefined &&
      segment.x - previous.x <= 1.5 &&
      segment.top <= previous.bottom &&
      segment.bottom >= previous.top
    return joins
      ? [
          ...stems.slice(0, -1),
          {
            x: (previous.x + segment.x) / 2,
            top: Math.min(previous.top, segment.top),
            bottom: Math.max(previous.bottom, segment.bottom)
          }
        ]
      : [...stems, segment]
  }, [])
}

const reachesPast = (stem: Stem, head: NoteHead, gap: number): boolean =>
  stem.top <= head.centerY - SCORE_STEM_MIN_RATIO * gap * 0.75 ||
  stem.bottom >= head.centerY + SCORE_STEM_MIN_RATIO * gap * 0.75

const isAttached = (stem: Stem, head: NoteHead, gap: number): boolean =>
  Math.abs(stem.x - head.centerX) <= SCORE_STEM_ATTACH_RATIO * gap &&
  stem.top <= head.bottom &&
  stem.bottom >= head.top &&
  reachesPast(stem, head, gap)

// Beams and flags sit at the stem's free end, reaching out to the side; each separate band of
// ink there is one more halving of the length. A long upright stroke beside the tip is a
// neighbour's accidental or stem, not a beam.
const countBeams = (masks: ScoreMasks, stem: Stem, heads: NoteHead[], gap: number): number => {
  const headsMiddle = heads.reduce((total, head) => total + head.centerY, 0) / heads.length
  const isTipAtTop = headsMiddle - stem.top > stem.bottom - headsMiddle
  const nearestHead = isTipAtTop
    ? Math.min(...heads.map((head) => head.top))
    : Math.max(...heads.map((head) => head.bottom))
  const length = Math.round(SCORE_BEAM_SEARCH_RATIO * gap)
  const rows = Array.from({ length }, (_, step) =>
    isTipAtTop ? stem.top + step : stem.bottom - step
  )
    .filter((y) => (isTipAtTop ? y < nearestHead : y > nearestHead))
    .toSorted((first, second) => first - second)
  const near = Math.round(SCORE_BEAM_NEAR_RATIO * gap)
  const far = Math.round(SCORE_BEAM_FAR_RATIO * gap)
  const centre = Math.round(stem.x)
  const sides = Array.from({ length: far - near + 1 }, (_, offset) => near + offset).flatMap(
    (reach) => [centre - reach, centre + reach]
  )
  const isBeamInk = (x: number, y: number): boolean =>
    isSymbolAt(masks, x, y) &&
    masks.verticalRun[y * masks.width + x] < SCORE_ACCIDENTAL_STROKE_RATIO * gap
  const beamRows = rows.filter((y) => sides.some((x) => isBeamInk(x, y)))
  return Math.min(groupRuns(beamRows).length, TAB_MAX_BEAMS)
}

/**
 * The chords that hang on stems: each stem with the heads it touches and its beams or flags.
 * @param masks - the score masks
 * @param stems - the vertical strokes of the staff
 * @param heads - the note heads of the staff
 * @param gap - the staff line gap in pixels
 * @returns one chord per stem that carries at least one head
 */
export const attachHeads = (
  masks: ScoreMasks,
  stems: Stem[],
  heads: NoteHead[],
  gap: number
): StemmedChord[] =>
  stems.flatMap((stem) => {
    const attached = heads.filter((head) => isAttached(stem, head, gap))
    return attached.length === 0
      ? []
      : [{ stem, heads: attached, beams: countBeams(masks, stem, attached, gap) }]
  })

/**
 * Whether a head carries an augmentation dot: a small separate speck just to its right, level
 * with it or half a gap up when the head sits on a line.
 * @param masks - the score masks
 * @param head - the note head
 * @param gap - the staff line gap in pixels
 * @returns true when the note is dotted
 */
export const isDotted = (masks: ScoreMasks, head: NoteHead, gap: number): boolean => {
  const halfWidth = SCORE_HEAD_HALF_WIDTH_RATIO * gap
  const region = {
    left: Math.round(head.centerX + halfWidth + 1),
    right: Math.round(head.centerX + halfWidth + SCORE_DOT_FAR_RATIO * gap),
    top: Math.round(head.centerY - SCORE_DOT_ABOVE_RATIO * gap),
    bottom: Math.round(head.centerY + SCORE_DOT_BELOW_RATIO * gap)
  }
  const maximum = SCORE_DOT_MAX_SIZE_RATIO * gap
  return findComponents((x, y) => isSymbolAt(masks, x, y), region).some(
    (speck) =>
      speck.left > region.left &&
      speck.right - speck.left + 1 <= maximum &&
      speck.bottom - speck.top + 1 <= maximum &&
      speck.top > region.top &&
      speck.bottom < region.bottom &&
      speck.bottom > speck.top
  )
}
