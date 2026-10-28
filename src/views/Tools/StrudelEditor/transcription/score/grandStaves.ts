import {
  SCORE_GRAND_STAFF_MAX_GAP_RATIO,
  SCORE_STAFF_LINE_COUNT,
  TAB_BAR_LINE_COVERAGE_RATIO,
  TAB_BAR_MERGE_GAP_RATIO,
  TAB_BAR_MIN_WIDTH_RATIO
} from '../../config'
import type { GrandStaff, TabBarSpan, TabImage } from '../../types'
import { keepWideBars } from '../tab/barLines'
import { countInRange, groupRuns, isInkAt, meanOf } from '../tab/imageProbes'
import { findStaves, lineGapOf } from '../tab/staffLines'

/**
 * Every grand staff on the page: five line staves taken in pairs, the upper one for the right
 * hand and the lower for the left, as long as the pair sits close enough to be one system.
 * @param image - the score image
 * @returns the grand staves from top to bottom
 */
export const findGrandStaves = (image: TabImage): GrandStaff[] => {
  const staves = findStaves(image, (lineCount) => lineCount === SCORE_STAFF_LINE_COUNT)
  return staves.flatMap((treble, index) => {
    const bass = staves[index + 1]
    return index % 2 === 0 &&
      bass !== undefined &&
      bass.lineYs[0] - treble.lineYs.at(-1)! <= SCORE_GRAND_STAFF_MAX_GAP_RATIO * lineGapOf(treble)
      ? [{ treble, bass }]
      : []
  })
}

/**
 * The bars of a grand staff. A piano bar line runs unbroken from the top line of the treble
 * staff to the bottom line of the bass staff, which no stem or clef does.
 * @param image - the score image
 * @param grandStaff - one system
 * @returns the bars from left to right
 */
export const findGrandStaffBars = (image: TabImage, grandStaff: GrandStaff): TabBarSpan[] => {
  const gap = lineGapOf(grandStaff.treble)
  const top = Math.round(grandStaff.treble.lineYs[0])
  const bottom = Math.round(grandStaff.bass.lineYs.at(-1)!)
  const startX = Math.max(grandStaff.treble.startX, grandStaff.bass.startX)
  const endX = Math.min(grandStaff.treble.endX, grandStaff.bass.endX)
  const needed = TAB_BAR_LINE_COVERAGE_RATIO * (bottom - top + 1)
  const columns = Array.from({ length: endX - startX + 1 }, (_, offset) => startX + offset).filter(
    (x) => countInRange(top, bottom + 1, (y) => isInkAt(image, x, y)) >= needed
  )
  const lines = groupRuns(columns, Math.round(TAB_BAR_MERGE_GAP_RATIO * gap)).map(meanOf)
  const edges = keepWideBars([startX, ...lines, endX], TAB_BAR_MIN_WIDTH_RATIO * gap)
  return edges.slice(1).map((barEndX, index) => ({ startX: edges[index], endX: barEndX }))
}
