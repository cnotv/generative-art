import {
  SCORE_HEAD_CORE_HEIGHT_RATIO,
  SCORE_HEAD_CORE_MIN_RATIO,
  SCORE_HEAD_CORE_WIDTH_RATIO,
  SCORE_HEAD_HALF_HEIGHT_RATIO,
  SCORE_HEAD_HALF_WIDTH_RATIO,
  SCORE_HOLE_MAX_HEIGHT_RATIO,
  SCORE_HOLE_MAX_WIDTH_RATIO,
  SCORE_HOLE_MIN_WIDTH_RATIO,
  SCORE_HOLE_REACH_RATIO,
  SCORE_HOLLOW_CLEARANCE_RATIO,
  SCORE_HOLLOW_MIN_WIDTH_RATIO,
  SCORE_RING_INSET_RATIO,
  SCORE_ACCIDENTAL_STROKE_RATIO
} from '../../config'
import type { NoteHead, PixelBox } from '../../types'
import { countInRange } from '../tab/imageProbes'
import { findComponents } from './components'
import { isBrightInkAt, isSymbolAt, type ScoreMasks } from './scoreMasks'

const headAround = (
  centerX: number,
  centerY: number,
  gap: number,
  isHollow: boolean
): NoteHead => ({
  centerX,
  centerY,
  isHollow,
  left: Math.round(centerX - SCORE_HEAD_HALF_WIDTH_RATIO * gap),
  right: Math.round(centerX + SCORE_HEAD_HALF_WIDTH_RATIO * gap),
  top: Math.round(centerY - SCORE_HEAD_HALF_HEIGHT_RATIO * gap),
  bottom: Math.round(centerY + SCORE_HEAD_HALF_HEIGHT_RATIO * gap)
})

// A filled head is the only mark both wide and tall at once: a beam is wide but thin, a stem or
// a sharp's stroke tall but narrow. Where both runs through a pixel are long, it is a head.
const isHeadCore = (masks: ScoreMasks, x: number, y: number, gap: number): boolean => {
  const index = y * masks.width + x
  return (
    masks.symbol[index] === 1 &&
    masks.horizontalRun[index] >= SCORE_HEAD_CORE_WIDTH_RATIO * gap &&
    masks.verticalRun[index] >= SCORE_HEAD_CORE_HEIGHT_RATIO * gap
  )
}

const filledHeads = (masks: ScoreMasks, zone: PixelBox, gap: number): NoteHead[] =>
  findComponents((x, y) => isHeadCore(masks, x, y, gap), zone)
    .filter(
      (core) =>
        core.right - core.left + 1 >= SCORE_HEAD_CORE_MIN_RATIO * gap &&
        core.bottom - core.top + 1 >= SCORE_HEAD_CORE_MIN_RATIO * gap
    )
    .map((core) =>
      headAround((core.left + core.right) / 2, (core.top + core.bottom) / 2, gap, false)
    )

const inkWithin = (reach: number, isInk: (step: number) => boolean): boolean =>
  countInRange(1, reach + 1, isInk) > 0

// Background closed in on all four sides within a short reach: the inside of a hollow head, or
// of a sharp, a letter or a clef loop.
const isEnclosed = (masks: ScoreMasks, x: number, y: number, reach: number): boolean =>
  !isBrightInkAt(masks, x, y) &&
  inkWithin(reach, (step) => isBrightInkAt(masks, x - step, y)) &&
  inkWithin(reach, (step) => isBrightInkAt(masks, x + step, y)) &&
  inkWithin(reach, (step) => isBrightInkAt(masks, x, y - step)) &&
  inkWithin(reach, (step) => isBrightInkAt(masks, x, y + step))

// The ring's outer edges on the hole's middle row: past the sliver of background a wide hole
// leaves inside the ring, across the ink, to the first background beyond it. Ink that runs on
// for a whole gap is a beam or a line, not a ring, and gives no edge.
const ringSides = (
  masks: ScoreMasks,
  hole: PixelBox,
  gap: number
): { left: number; right: number } => {
  const row = Math.round((hole.top + hole.bottom) / 2)
  const outerEdge = (start: number, direction: number): number => {
    const columns = Array.from({ length: Math.round(gap) }, (_, step) => start + direction * step)
    const firstInk = columns.findIndex((x) => isBrightInkAt(masks, x, row))
    if (firstInk === -1 || firstInk > SCORE_RING_INSET_RATIO * gap) {
      return start
    }
    const pastInk = columns.slice(firstInk).findIndex((x) => !isBrightInkAt(masks, x, row))
    return pastInk === -1 ? start : columns[firstInk + pastInk] - direction
  }
  return { left: outerEdge(hole.left - 1, -1), right: outerEdge(hole.right + 1, 1) }
}

const isStrokeColumn = (masks: ScoreMasks, x: number, hole: PixelBox, gap: number): boolean =>
  countInRange(
    hole.top,
    hole.bottom + 1,
    (y) =>
      isSymbolAt(masks, x, y) &&
      masks.verticalRun[y * masks.width + x] >= SCORE_ACCIDENTAL_STROKE_RATIO * gap
  ) > 0

// A sharp or a natural encloses its middle between two long strokes; a head has at most a stem.
const isBetweenStrokes = (masks: ScoreMasks, hole: PixelBox, gap: number): boolean =>
  [hole.left - 1, hole.left - 2].some((x) => isStrokeColumn(masks, x, hole, gap)) &&
  [hole.right + 1, hole.right + 2].some((x) => isStrokeColumn(masks, x, hole, gap))

const hollowHeads = (masks: ScoreMasks, zone: PixelBox, gap: number): NoteHead[] => {
  const reach = Math.max(2, Math.round(SCORE_HOLE_REACH_RATIO * gap))
  return findComponents((x, y) => isEnclosed(masks, x, y, reach), zone)
    .filter((hole) => {
      const width = hole.right - hole.left + 1
      return (
        width >= SCORE_HOLE_MIN_WIDTH_RATIO * gap &&
        width <= SCORE_HOLE_MAX_WIDTH_RATIO * gap &&
        hole.bottom - hole.top + 1 <= SCORE_HOLE_MAX_HEIGHT_RATIO * gap &&
        ringSides(masks, hole, gap).right - ringSides(masks, hole, gap).left + 1 >=
          SCORE_HOLLOW_MIN_WIDTH_RATIO * gap &&
        !isBetweenStrokes(masks, hole, gap)
      )
    })
    .map((hole) => ({
      ...headAround((hole.left + hole.right) / 2, (hole.top + hole.bottom) / 2, gap, true),
      ...ringSides(masks, hole, gap)
    }))
}

/**
 * Every note head in a zone: filled ones by their solid core, hollow ones (half and whole notes)
 * by the small hole they enclose. A gap closed in between a filled head and its dot or a grace
 * note is not a head.
 * @param masks - the score masks
 * @param zone - the part of the page that belongs to one staff, after its clef and key
 * @param gap - the staff line gap in pixels
 * @returns the heads in no particular order
 */
export const findNoteHeads = (masks: ScoreMasks, zone: PixelBox, gap: number): NoteHead[] => {
  const filled = filledHeads(masks, zone, gap)
  const isBesideFilled = (hollow: NoteHead): boolean =>
    filled.some(
      (head) =>
        Math.abs(head.centerX - hollow.centerX) < SCORE_HOLLOW_CLEARANCE_RATIO * gap &&
        Math.abs(head.centerY - hollow.centerY) < gap
    )
  return [...filled, ...hollowHeads(masks, zone, gap).filter((head) => !isBesideFilled(head))]
}
