import {
  TAB_INSTRUMENT_BY_LINE_COUNT,
  TAB_LINE_COVERAGE_RATIO,
  TAB_LINE_START_RUN_RATIO,
  TAB_SYSTEM_BREAK_GAP_RATIO
} from '../../config'
import type { TabImage, TabSystem } from '../../types'
import { countInRange, groupRuns, isInkAt, meanOf, medianOf } from './imageProbes'

/**
 * Distance between two neighbouring staff lines, the unit every other detector measures in.
 * @param system - one detected staff
 * @returns the gap in pixels
 */
export const lineGapOf = (system: TabSystem): number =>
  (system.lineYs.at(-1)! - system.lineYs[0]) / (system.lineYs.length - 1)

const lineCentres = (image: TabImage): number[] => {
  const coverage = Array.from({ length: image.height }, (_, y) =>
    countInRange(0, image.width, (x) => isInkAt(image, x, y))
  )
  const threshold = TAB_LINE_COVERAGE_RATIO * Math.max(...coverage)
  const rows = coverage.flatMap((rowCoverage, y) => (rowCoverage >= threshold ? [y] : []))
  return groupRuns(rows).map(meanOf)
}

const splitIntoStaves = (lineYs: number[]): number[][] => {
  const gaps = lineYs.slice(1).map((y, index) => y - lineYs[index])
  const breakGap = TAB_SYSTEM_BREAK_GAP_RATIO * medianOf(gaps)
  return lineYs.reduce<number[][]>((staves, y, index) => {
    const startsNewStaff = index === 0 || gaps[index - 1] > breakGap
    return startsNewStaff ? [...staves, [y]] : [...staves.slice(0, -1), [...staves.at(-1)!, y]]
  }, [])
}

const rowHasInkRun = (image: TabImage, row: number, startX: number, runLength: number): boolean =>
  startX + runLength <= image.width &&
  countInRange(startX, startX + runLength, (x) => isInkAt(image, x, row)) === runLength

const lineExtent = (image: TabImage, lineYs: number[]): { startX: number; endX: number } => {
  const row = Math.round(lineYs[0])
  const gap = (lineYs.at(-1)! - lineYs[0]) / (lineYs.length - 1)
  const runLength = Math.round(TAB_LINE_START_RUN_RATIO * gap)
  const columns = Array.from({ length: image.width }, (_, x) => x)
  const startX = columns.find((x) => rowHasInkRun(image, row, x, runLength)) ?? 0
  const endX =
    columns.findLast((x) => rowHasInkRun(image, row, x - runLength + 1, runLength)) ??
    image.width - 1
  return { startX, endX }
}

/**
 * Finds every staff with a given number of long horizontal lines sitting evenly apart. Any other
 * group, such as a rule or a table border, is ignored.
 * @param image - the page image
 * @param isWantedLineCount - which line counts make a staff
 * @returns the staves from top to bottom
 */
export const findStaves = (
  image: TabImage,
  isWantedLineCount: (lineCount: number) => boolean
): TabSystem[] =>
  splitIntoStaves(lineCentres(image))
    .filter((lineYs) => isWantedLineCount(lineYs.length))
    .map((lineYs) => ({ lineYs, ...lineExtent(image, lineYs) }))

/**
 * Finds every tab staff on the page: groups of four (bass) or six (guitar) lines.
 * @param image - the tab image
 * @returns the staves from top to bottom
 */
export const findStaffSystems = (image: TabImage): TabSystem[] =>
  findStaves(image, (lineCount) => lineCount in TAB_INSTRUMENT_BY_LINE_COUNT)
