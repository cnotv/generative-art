import {
  TAB_BAR_LINE_COVERAGE_RATIO,
  TAB_BAR_MERGE_GAP_RATIO,
  TAB_BAR_MIN_WIDTH_RATIO
} from '../../config'
import type { TabBarSpan, TabImage, TabSystem } from '../../types'
import { countInRange, groupRuns, isInkAt, meanOf } from './imageProbes'
import { lineGapOf } from './staffLines'

const barLineColumns = (image: TabImage, system: TabSystem): number[] => {
  const top = Math.round(system.lineYs[0])
  const bottom = Math.round(system.lineYs.at(-1)!)
  const needed = TAB_BAR_LINE_COVERAGE_RATIO * (bottom - top + 1)
  return Array.from(
    { length: system.endX - system.startX + 1 },
    (_, offset) => system.startX + offset
  ).filter((x) => countInRange(top, bottom + 1, (y) => isInkAt(image, x, y)) >= needed)
}

/**
 * Drops edges too close to their neighbours to enclose a bar, keeping the first and last.
 * @param edges - ascending x positions, the staff ends included
 * @param minWidth - the narrowest bar in pixels
 * @returns the edges that still bound a bar
 */
export const keepWideBars = (edges: number[], minWidth: number): number[] =>
  edges.reduce<number[]>(
    (kept, edge, index) =>
      index === 0 ||
      (edge - kept.at(-1)! >= minWidth &&
        (index === edges.length - 1 || edges.at(-1)! - edge >= minWidth))
        ? [...kept, edge]
        : kept,
    []
  )

/**
 * The bars of one staff, as the spans between bar lines. A double bar counts as one line, the
 * staff's own ends close the first and last bar, and strokes too close together to enclose a
 * bar (the time signature, a playback cursor) are ignored.
 * @param image - the tab image
 * @param system - one detected staff
 * @returns the bars from left to right
 */
export const findBarSpans = (image: TabImage, system: TabSystem): TabBarSpan[] => {
  const gap = lineGapOf(system)
  const lines = groupRuns(
    barLineColumns(image, system),
    Math.round(TAB_BAR_MERGE_GAP_RATIO * gap)
  ).map(meanOf)
  const edges = keepWideBars([system.startX, ...lines, system.endX], TAB_BAR_MIN_WIDTH_RATIO * gap)
  return edges.slice(1).map((endX, index) => ({ startX: edges[index], endX }))
}
