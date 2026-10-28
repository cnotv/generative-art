import {
  TAB_GLYPH_MAX_WIDTH_RATIO,
  TAB_GLYPH_MERGE_GAP_RATIO,
  TAB_GLYPH_MIN_HEIGHT_RATIO,
  TAB_GLYPH_MIN_WIDTH_RATIO,
  TAB_GLYPH_WINDOW_RATIO
} from '../../config'
import type { TabGlyph, TabImage, TabSystem } from '../../types'
import { groupRuns, isBrightAt } from './imageProbes'
import { readDigit, type DigitBox } from './readDigit'
import { lineGapOf } from './staffLines'

const rowsAround = (lineY: number, reach: number): number[] =>
  Array.from({ length: 2 * reach + 1 }, (_, offset) => Math.round(lineY) - reach + offset)

const inkedColumns = (image: TabImage, system: TabSystem, rows: number[]): number[] =>
  Array.from(
    { length: system.endX - system.startX },
    (_, offset) => system.startX + 1 + offset
  ).filter((x) => rows.some((y) => isBrightAt(image, x, y)))

const boxOfRun = (image: TabImage, run: number[], rows: number[]): DigitBox | null => {
  const inkRows = rows.filter((y) => run.some((x) => isBrightAt(image, x, y)))
  return inkRows.length === 0
    ? null
    : { startX: run[0], endX: run.at(-1)!, top: inkRows[0], bottom: inkRows.at(-1)! }
}

const isDigitShaped = (box: DigitBox, gap: number): boolean =>
  box.bottom - box.top + 1 >= TAB_GLYPH_MIN_HEIGHT_RATIO * gap &&
  box.endX - box.startX + 1 >= TAB_GLYPH_MIN_WIDTH_RATIO * gap &&
  box.endX - box.startX + 1 <= TAB_GLYPH_MAX_WIDTH_RATIO * gap

// A trailing mark such as a slide or vibrato sign is not a digit, so it is dropped from a fret.
const readableDigits = (digits: (number | null)[]): (number | null)[] =>
  digits.length > 1 && digits.at(-1) === null ? digits.slice(0, -1) : digits

const glyphFromBoxes = (image: TabImage, boxes: DigitBox[], lineIndex: number): TabGlyph => {
  const digits = readableDigits(boxes.map((box) => readDigit(image, box)))
  return {
    centerX: (boxes[0].startX + boxes.at(-1)!.endX) / 2,
    lineIndex,
    fret: digits.includes(null) ? null : Number(digits.join(''))
  }
}

const glyphsOnLine = (image: TabImage, system: TabSystem, lineIndex: number): TabGlyph[] => {
  const gap = lineGapOf(system)
  const rows = rowsAround(system.lineYs[lineIndex], Math.round(TAB_GLYPH_WINDOW_RATIO * gap))
  const boxes = groupRuns(inkedColumns(image, system, rows))
    .map((run) => boxOfRun(image, run, rows))
    .filter((box): box is DigitBox => box !== null && isDigitShaped(box, gap))
  const mergeGap = Math.round(TAB_GLYPH_MERGE_GAP_RATIO * gap)
  return boxes
    .reduce<
      DigitBox[][]
    >((glyphs, box) => (glyphs.length > 0 && box.startX - glyphs.at(-1)!.at(-1)!.endX - 1 <= mergeGap ? [...glyphs.slice(0, -1), [...glyphs.at(-1)!, box]] : [...glyphs, [box]]), [])
    .map((glyphBoxes) => glyphFromBoxes(image, glyphBoxes, lineIndex))
}

/**
 * Every fret number printed on one staff: for each string, the bright digit-sized marks that sit
 * on its line, with neighbouring digits joined into one two-digit fret.
 * @param image - the tab image
 * @param system - one detected staff
 * @returns the glyphs with their column and string; a fret is null when a digit could not be read
 */
export const findFretGlyphs = (image: TabImage, system: TabSystem): TabGlyph[] =>
  system.lineYs.flatMap((_, lineIndex) => glyphsOnLine(image, system, lineIndex))
