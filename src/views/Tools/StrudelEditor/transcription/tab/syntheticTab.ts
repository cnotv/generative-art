import { TAB_DIGIT_TEMPLATE_SETS } from '../../config'
import type { TabImage } from '../../types'
import { buildTabImage } from './buildTabImage'

/**
 * Test support: draws a light-theme tab of quarter notes with plain pixel rectangles, so the
 * detectors can be checked at a different zoom, theme and string count than the screenshot.
 */

const CELL = 2
const LINE_GAP = 20
const TOP = 30
const LEFT = 20
const NOTE_SPACING = 60
const STEM_TOP = 22
const STEM_BOTTOM = 52
const INK_BY_CHARACTER: Record<string, number> = { ' ': 0, '.': 0.3, '+': 0.65, '#': 1 }
const LINE_GRAY = 190

type Rectangle = { left: number; top: number; right: number; bottom: number; gray: number }

type SyntheticNote = { lineIndex: number; fret: number }

const glyphRectangles = (digit: number, centreX: number, centreY: number): Rectangle[] =>
  TAB_DIGIT_TEMPLATE_SETS[0][digit].flatMap((row, rowIndex) =>
    [...row].flatMap((character, columnIndex) => {
      const ink = INK_BY_CHARACTER[character] ?? 0
      const left = centreX - (5 * CELL) / 2 + columnIndex * CELL
      const top = centreY - (7 * CELL) / 2 + rowIndex * CELL
      return ink === 0
        ? []
        : [{ left, top, right: left + CELL, bottom: top + CELL, gray: Math.round(255 * (1 - ink)) }]
    })
  )

const noteRectangles = (
  notes: SyntheticNote[],
  centreX: number,
  lineCount: number
): Rectangle[] => {
  const bottomLine = TOP + (lineCount - 1) * LINE_GAP
  const stem = {
    left: centreX,
    top: bottomLine + STEM_TOP,
    right: centreX + 2,
    bottom: bottomLine + STEM_BOTTOM,
    gray: 0
  }
  const glyphs = notes.flatMap((note) =>
    [...String(note.fret)].flatMap((digit, digitIndex) =>
      glyphRectangles(
        Number(digit),
        centreX + digitIndex * 5 * CELL,
        TOP + note.lineIndex * LINE_GAP
      )
    )
  )
  return [stem, ...glyphs]
}

/**
 * One bar of quarter notes on a light page.
 * @param lineCount - four for a bass, six for a guitar
 * @param chords - the notes struck on each quarter
 * @returns the image as the detectors see it
 */
export const drawQuarterNoteTab = (lineCount: number, chords: SyntheticNote[][]): TabImage => {
  const width = LEFT + (chords.length + 1) * NOTE_SPACING
  const height = TOP + (lineCount - 1) * LINE_GAP + STEM_BOTTOM + TOP
  const lines = Array.from({ length: lineCount }, (_, index) => ({
    left: LEFT,
    top: TOP + index * LINE_GAP,
    right: width - LEFT,
    bottom: TOP + index * LINE_GAP + 2,
    gray: LINE_GRAY
  }))
  const notes = chords.flatMap((chord, index) =>
    noteRectangles(chord, LEFT + NOTE_SPACING * (index + 1), lineCount)
  )
  const rectangles = [...lines, ...notes]
  const pixels = Uint8ClampedArray.from({ length: width * height * 4 }, (_, offset) => {
    const pixelIndex = Math.floor(offset / 4)
    const x = pixelIndex % width
    const y = Math.floor(pixelIndex / width)
    const covering = rectangles.findLast(
      (rectangle) =>
        x >= rectangle.left && x < rectangle.right && y >= rectangle.top && y < rectangle.bottom
    )
    return offset % 4 === 3 ? 255 : (covering?.gray ?? 255)
  })
  return buildTabImage(width, height, pixels)
}
