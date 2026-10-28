import {
  TAB_BEAM_FAR_RATIO,
  TAB_BEAM_NEAR_RATIO,
  TAB_BRACKET_BOTTOM_RATIO,
  TAB_BRACKET_JOIN_GAP_RATIO,
  TAB_BRACKET_MIN_SEGMENT_RATIO,
  TAB_BRACKET_TOP_RATIO,
  TAB_MAX_BEAMS,
  TAB_STEM_BOTTOM_RATIO,
  TAB_STEM_COVERAGE_RATIO,
  TAB_STEM_TOP_RATIO
} from '../../config'
import type { TabImage, TabStem, TabSystem } from '../../types'
import { countInRange, groupRuns, isInkAt, meanOf } from './imageProbes'
import { lineGapOf } from './staffLines'

const BRACKET_END_REACH_PIXELS = 3

const rowRange = (from: number, to: number): number[] =>
  Array.from(
    { length: Math.round(to) - Math.round(from) + 1 },
    (_, offset) => Math.round(from) + offset
  )

const staffColumns = (system: TabSystem): number[] =>
  Array.from({ length: system.endX - system.startX + 1 }, (_, offset) => system.startX + offset)

const countBeams = (image: TabImage, stemX: number, rows: number[], gap: number): number => {
  const near = Math.round(TAB_BEAM_NEAR_RATIO * gap)
  const far = Math.round(TAB_BEAM_FAR_RATIO * gap)
  const centre = Math.round(stemX)
  const sides = Array.from({ length: far - near + 1 }, (_, offset) => near + offset).flatMap(
    (reach) => [centre - reach, centre + reach]
  )
  const beamRows = rows.filter((y) => sides.some((x) => isInkAt(image, x, y)))
  return Math.min(groupRuns(beamRows).length, TAB_MAX_BEAMS)
}

const bracketSegments = (image: TabImage, system: TabSystem, gap: number): [number, number][] => {
  const bottom = system.lineYs.at(-1)!
  const rowCounts = rowRange(
    bottom + TAB_BRACKET_TOP_RATIO * gap,
    bottom + TAB_BRACKET_BOTTOM_RATIO * gap
  ).map((y) => ({
    y,
    count: countInRange(system.startX, system.endX + 1, (x) => isInkAt(image, x, y))
  }))
  const bestRow = rowCounts.reduce((best, row) => (row.count > best.count ? row : best))
  const minimumLength = TAB_BRACKET_MIN_SEGMENT_RATIO * gap
  return groupRuns(staffColumns(system).filter((x) => isInkAt(image, x, bestRow.y)))
    .filter((run) => run.length >= minimumLength)
    .map((run): [number, number] => [run[0], run.at(-1)!])
}

// The spans a tuplet bracket covers. A bracket is a line with a number in its middle, so two
// segments separated by only that number join into one span.
const tripletSpans = (image: TabImage, system: TabSystem, gap: number): [number, number][] =>
  bracketSegments(image, system, gap).reduce<[number, number][]>(
    (spans, [start, end]) =>
      spans.length > 0 && start - spans.at(-1)![1] <= TAB_BRACKET_JOIN_GAP_RATIO * gap
        ? [...spans.slice(0, -1), [spans.at(-1)![0], end]]
        : [...spans, [start, end]],
    []
  )

/**
 * The note stems printed under one staff, left to right, with how many beams or flags each
 * carries and whether it sits under a triplet bracket.
 * @param image - the tab image
 * @param system - one detected staff
 * @returns the stems in order
 */
export const findStems = (image: TabImage, system: TabSystem): TabStem[] => {
  const gap = lineGapOf(system)
  const bottom = system.lineYs.at(-1)!
  const rows = rowRange(bottom + TAB_STEM_TOP_RATIO * gap, bottom + TAB_STEM_BOTTOM_RATIO * gap)
  const needed = TAB_STEM_COVERAGE_RATIO * rows.length
  const stemColumns = staffColumns(system).filter(
    (x) => countInRange(rows[0], rows.at(-1)! + 1, (y) => isInkAt(image, x, y)) >= needed
  )
  const spans = tripletSpans(image, system, gap)
  return groupRuns(stemColumns)
    .map(meanOf)
    .map((x) => ({
      x,
      beams: countBeams(image, x, rows, gap),
      isTriplet: spans.some(
        ([start, end]) =>
          x >= start - BRACKET_END_REACH_PIXELS && x <= end + BRACKET_END_REACH_PIXELS
      )
    }))
}
