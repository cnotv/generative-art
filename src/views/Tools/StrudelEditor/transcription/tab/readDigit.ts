import {
  TAB_DIGIT_GRID_HEIGHT,
  TAB_DIGIT_CONTRAST,
  TAB_DIGIT_GRID_WIDTH,
  TAB_DIGIT_MAX_DISTANCE,
  TAB_DIGIT_TEMPLATE_SETS
} from '../../config'
import type { TabImage } from '../../types'
import { meanOf } from './imageProbes'

export type DigitBox = {
  startX: number
  endX: number
  top: number
  bottom: number
}

const INK_BY_CHARACTER: Record<string, number> = { ' ': 0, '.': 0.3, '+': 0.65, '#': 1 }

const TEMPLATES = TAB_DIGIT_TEMPLATE_SETS.flatMap((set) =>
  set.map((rows, digit) => ({
    digit,
    grid: rows.flatMap((row) => Array.from(row, (cell) => INK_BY_CHARACTER[cell] ?? 0))
  }))
)

const overlap = (pixel: number, start: number, end: number): number =>
  Math.max(0, Math.min(pixel + 1, end) - Math.max(pixel, start))

const pixelsCovering = (start: number, end: number): number[] =>
  Array.from(
    { length: Math.ceil(end) - Math.floor(start) },
    (_, offset) => Math.floor(start) + offset
  )

// Cells are as wide as they are tall and centred on the glyph, so a narrow 1 is not stretched.
// Each cell averages the pixels it covers, weighted by how much of each pixel it covers.
const cellCoverage = (
  image: TabImage,
  box: DigitBox,
  column: number,
  row: number,
  shift: number
): number => {
  const pitch = (box.bottom - box.top + 1) / TAB_DIGIT_GRID_HEIGHT
  const origin =
    (box.startX + box.endX + 1) / 2 - (pitch * TAB_DIGIT_GRID_WIDTH) / 2 + shift * pitch
  const left = origin + column * pitch
  const above = box.top + row * pitch
  const weighted = pixelsCovering(above, above + pitch).flatMap((y) =>
    pixelsCovering(left, left + pitch).map((x) => {
      const weight = overlap(x, left, left + pitch) * overlap(y, above, above + pitch)
      return weight * ((image.deviation[y * image.width + x] ?? 0) / 255)
    })
  )
  return weighted.reduce((total, value) => total + value, 0) / (pitch * pitch)
}

/**
 * The glyph squeezed onto the same small grid the digit templates use, each cell holding how
 * much of it is ink.
 * @param image - the tab image
 * @param box - the glyph's bounding box
 * @param shift - how far to slide the grid sideways, in cells
 * @returns one coverage value per cell, row by row
 */
const sampleGrid = (image: TabImage, box: DigitBox, shift = 0): number[] => {
  const cells = Array.from({ length: TAB_DIGIT_GRID_WIDTH * TAB_DIGIT_GRID_HEIGHT }, (_, cell) =>
    cellCoverage(
      image,
      box,
      cell % TAB_DIGIT_GRID_WIDTH,
      Math.floor(cell / TAB_DIGIT_GRID_WIDTH),
      shift
    )
  )
  const strongest = Math.max(...cells, Number.EPSILON)
  return cells.map((cell) => Math.min(1, (TAB_DIGIT_CONTRAST * cell) / strongest))
}

const distanceBetween = (grid: number[], template: number[]): number =>
  meanOf(grid.map((cell, index) => (cell - template[index]) ** 2))

const SHIFTS_IN_CELLS = [-1, -0.5, 0, 0.5, 1]

/**
 * The digit a glyph most resembles and how far off it is. The grid is tried a little to either
 * side, since a 1 carries its flag on the left and so sits off the centre of its box.
 * @param image - the tab image
 * @param box - the glyph's bounding box
 * @returns the digit and its distance from that digit's template
 */
const closestDigit = (image: TabImage, box: DigitBox): { digit: number; distance: number } => {
  const candidates = SHIFTS_IN_CELLS.flatMap((shift) => {
    const grid = sampleGrid(image, box, shift)
    return TEMPLATES.map((template) => ({
      digit: template.digit,
      distance: distanceBetween(grid, template.grid)
    }))
  })
  return candidates.reduce((best, candidate) =>
    candidate.distance < best.distance ? candidate : best
  )
}

/**
 * Which digit a glyph is, by comparing it with a template of each digit.
 * @param image - the tab image
 * @param box - the glyph's bounding box
 * @returns the digit 0 to 9, or null when nothing is close enough
 */
export const readDigit = (image: TabImage, box: DigitBox): number | null => {
  const { digit, distance } = closestDigit(image, box)
  return distance <= TAB_DIGIT_MAX_DISTANCE ? digit : null
}
