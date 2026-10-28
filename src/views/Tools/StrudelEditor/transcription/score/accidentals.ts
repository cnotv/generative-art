import {
  SCORE_ACCIDENTAL_MAX_WIDTH_RATIO,
  SCORE_ACCIDENTAL_MIN_HEIGHT_RATIO,
  SCORE_ACCIDENTAL_STROKE_RATIO,
  SCORE_FLAT_BOWL_RATIO,
  SCORE_FLAT_MAX_WIDTH_RATIO,
  SCORE_NATURAL_OFFSET_RATIO
} from '../../config'
import type { PixelBox } from '../../types'
import { groupRuns } from '../tab/imageProbes'
import type { ScoreMasks } from './scoreMasks'

export type AccidentalKind = 'sharp' | 'flat' | 'natural'

export type Accidental = {
  kind: AccidentalKind
  /** The row the sign is centred on, which names the line or space it alters. */
  centerY: number
  left: number
  right: number
}

export const ALTERATION_BY_ACCIDENTAL: Record<AccidentalKind, number> = {
  sharp: 1,
  flat: -1,
  natural: 0
}

const columnsOf = (box: PixelBox): number[] =>
  Array.from({ length: box.right - box.left + 1 }, (_, offset) => box.left + offset)

const rowsOf = (box: PixelBox): number[] =>
  Array.from({ length: box.bottom - box.top + 1 }, (_, offset) => box.top + offset)

const longestRunIn = (masks: ScoreMasks, x: number, box: PixelBox): number =>
  Math.max(...rowsOf(box).map((y) => masks.verticalRun[y * masks.width + x]))

const strokeTop = (masks: ScoreMasks, columns: number[], box: PixelBox): number =>
  rowsOf(box).find((y) => columns.some((x) => masks.symbol[y * masks.width + x] === 1)) ?? box.top

/**
 * Which accidental a blob of ink is, from its long vertical strokes: a sharp has two that start
 * level, a natural two offset by about a staff gap, a flat one with a bowl at its foot.
 * @param masks - the score masks
 * @param box - the blob's bounding box
 * @param gap - the staff line gap in pixels
 * @returns the accidental, or null when the blob is something else
 */
export const readAccidental = (
  masks: ScoreMasks,
  box: PixelBox,
  gap: number
): Accidental | null => {
  const height = box.bottom - box.top + 1
  if (
    height < SCORE_ACCIDENTAL_MIN_HEIGHT_RATIO * gap ||
    box.right - box.left + 1 > SCORE_ACCIDENTAL_MAX_WIDTH_RATIO * gap
  ) {
    return null
  }
  const strokes = groupRuns(
    columnsOf(box).filter((x) => longestRunIn(masks, x, box) >= SCORE_ACCIDENTAL_STROKE_RATIO * gap)
  )
  const middle = (box.top + box.bottom) / 2
  const sides = { left: box.left, right: box.right }
  if (strokes.length === 2) {
    const offset = Math.abs(strokeTop(masks, strokes[0], box) - strokeTop(masks, strokes[1], box))
    const kind = offset >= SCORE_NATURAL_OFFSET_RATIO * gap ? 'natural' : 'sharp'
    return { kind, centerY: middle, ...sides }
  }
  return strokes.length === 1 && box.right - box.left + 1 <= SCORE_FLAT_MAX_WIDTH_RATIO * gap
    ? { kind: 'flat', centerY: box.bottom - SCORE_FLAT_BOWL_RATIO * gap, ...sides }
    : null
}
