import { TAB_BRIGHT_DEVIATION, TAB_FAINT_DEVIATION, TAB_TEXT_DEVIATION } from '../../config'
import type { TabImage } from '../../types'

/**
 * How many positions in a half-open range pass a test.
 * @param start - first position
 * @param end - one past the last position
 * @param test - the check for one position
 * @returns the number that passed
 */
export const countInRange = (
  start: number,
  end: number,
  test: (position: number) => boolean
): number =>
  Array.from({ length: Math.max(0, end - start) }, (_, offset) => start + offset).filter(test)
    .length

const deviationAt = (image: TabImage, x: number, y: number): number =>
  x < 0 || y < 0 || x >= image.width || y >= image.height ? 0 : image.deviation[y * image.width + x]

/**
 * Whether a pixel is faint ink or brighter: a staff line, a bar line, anything drawn.
 * @param image - the tab image
 * @param x - column
 * @param y - row
 * @returns true when the pixel differs from the page
 */
export const isInkAt = (image: TabImage, x: number, y: number): boolean =>
  deviationAt(image, x, y) >= TAB_FAINT_DEVIATION

/**
 * Whether a pixel is dim text or brighter: printed labels such as the tempo.
 * @param image - the tab image
 * @param x - column
 * @param y - row
 * @returns true when the pixel is at least text level ink
 */
export const isTextAt = (image: TabImage, x: number, y: number): boolean =>
  deviationAt(image, x, y) >= TAB_TEXT_DEVIATION

/**
 * Whether a pixel is bright ink: a fret digit, a stem or a beam.
 * @param image - the tab image
 * @param x - column
 * @param y - row
 * @returns true when the pixel stands well clear of the page
 */
export const isBrightAt = (image: TabImage, x: number, y: number): boolean =>
  deviationAt(image, x, y) >= TAB_BRIGHT_DEVIATION

/**
 * Splits ascending positions into runs of neighbours that are at most maxGap apart.
 * @param positions - ascending integers
 * @param maxGap - the largest step that still belongs to the same run
 * @returns the runs, in order
 */
export const groupRuns = (positions: number[], maxGap = 1): number[][] =>
  positions.reduce<number[][]>((runs, position) => {
    const lastRun = runs.at(-1)
    return lastRun !== undefined && position - (lastRun.at(-1) ?? position) <= maxGap
      ? [...runs.slice(0, -1), [...lastRun, position]]
      : [...runs, [position]]
  }, [])

/**
 * Mean of a list of numbers.
 * @param values - the numbers
 * @returns their average
 */
export const meanOf = (values: number[]): number =>
  values.reduce((total, value) => total + value, 0) / values.length

/**
 * Middle value of a list of numbers.
 * @param values - the numbers
 * @returns the median
 */
export const medianOf = (values: number[]): number =>
  values.toSorted((first, second) => first - second)[Math.floor(values.length / 2)]
