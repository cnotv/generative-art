import { SCORE_THIN_LINE_RATIO, TAB_BRIGHT_DEVIATION } from '../../config'
import type { TabImage } from '../../types'

/** Ink in the score at two levels of detail, with the length of the run through each pixel. */
export type ScoreMasks = {
  width: number
  height: number
  /** Every bright pixel: staff lines, ledger lines, ties and symbols. */
  bright: Uint8Array
  /** Bright pixels with thin horizontal strokes (staff, ledger lines, ties) taken out. */
  symbol: Uint8Array
  verticalRun: Uint16Array
  horizontalRun: Uint16Array
}

const indexRange = (length: number): number[] => Array.from({ length }, (_, index) => index)

/**
 * The runs of set positions along one line of pixels.
 * @param length - how many positions the line has
 * @param isSet - whether one position is ink
 * @returns each run as its first and last position
 */
export const runsAlong = (length: number, isSet: (index: number) => boolean): [number, number][] =>
  indexRange(length).reduce<[number, number][]>((runs, index) => {
    if (!isSet(index)) {
      return runs
    }
    const last = runs.at(-1)
    if (last !== undefined && last[1] === index - 1) {
      last[1] = index
    } else {
      runs.push([index, index])
    }
    return runs
  }, [])

const verticalRunLengths = (mask: Uint8Array, width: number, height: number): Uint16Array => {
  const lengths = new Uint16Array(width * height)
  indexRange(width).forEach((x) =>
    runsAlong(height, (y) => mask[y * width + x] === 1).forEach(([first, last]) =>
      indexRange(last - first + 1).forEach((offset) => {
        lengths[(first + offset) * width + x] = last - first + 1
      })
    )
  )
  return lengths
}

const horizontalRunLengths = (mask: Uint8Array, width: number, height: number): Uint16Array => {
  const lengths = new Uint16Array(width * height)
  indexRange(height).forEach((y) =>
    runsAlong(width, (x) => mask[y * width + x] === 1).forEach(([first, last]) =>
      lengths.fill(last - first + 1, y * width + first, y * width + last + 1)
    )
  )
  return lengths
}

/**
 * Splits the page into the ink that carries symbols and the thin horizontal strokes that only
 * connect them. Removing a stroke only when its whole vertical run is thin keeps beams, note
 * heads and the bars of a sharp, and drops staff lines, ledger lines, ties and slurs.
 * @param image - the score image
 * @param gap - the staff line gap in pixels
 * @returns the masks and run lengths every score detector reads
 */
export const buildScoreMasks = (image: TabImage, gap: number): ScoreMasks => {
  const { width, height } = image
  const bright = Uint8Array.from(image.deviation, (value) =>
    value >= TAB_BRIGHT_DEVIATION ? 1 : 0
  )
  const brightRuns = verticalRunLengths(bright, width, height)
  const thinLimit = Math.max(2, Math.round(SCORE_THIN_LINE_RATIO * gap))
  const symbol = Uint8Array.from(brightRuns, (length) => (length > thinLimit ? 1 : 0))
  return {
    width,
    height,
    bright,
    symbol,
    verticalRun: Uint16Array.from(brightRuns, (length) => (length > thinLimit ? length : 0)),
    horizontalRun: horizontalRunLengths(symbol, width, height)
  }
}

/**
 * Whether a pixel is symbol ink, false outside the page.
 * @param masks - the score masks
 * @param x - column
 * @param y - row
 * @returns true for ink left after the thin strokes are removed
 */
export const isSymbolAt = (masks: ScoreMasks, x: number, y: number): boolean =>
  x >= 0 && y >= 0 && x < masks.width && y < masks.height && masks.symbol[y * masks.width + x] === 1

/**
 * Whether a pixel is any bright ink, false outside the page.
 * @param masks - the score masks
 * @param x - column
 * @param y - row
 * @returns true for ink, staff lines included
 */
export const isBrightInkAt = (masks: ScoreMasks, x: number, y: number): boolean =>
  x >= 0 && y >= 0 && x < masks.width && y < masks.height && masks.bright[y * masks.width + x] === 1
