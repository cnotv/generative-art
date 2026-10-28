import {
  TAB_EQUALS_MAX_HEIGHT_RATIO,
  TAB_EQUALS_MAX_WIDTH_RATIO,
  TAB_EQUALS_MIN_WIDTH_RATIO,
  TAB_GLYPH_MAX_WIDTH_RATIO,
  TAB_GLYPH_MIN_HEIGHT_RATIO,
  TAB_TEMPO_BAND_BOTTOM_RATIO,
  TAB_TEMPO_BAND_TOP_RATIO,
  TAB_TEMPO_DIGIT_GAP_RATIO,
  TAB_TEMPO_MAX_BEATS_PER_MINUTE,
  TAB_TEMPO_MAX_DIGITS,
  TAB_TEMPO_MIN_BEATS_PER_MINUTE
} from '../../config'
import type { TabImage, TabSystem } from '../../types'
import { groupRuns, isTextAt } from './imageProbes'
import { readDigit, type DigitBox } from './readDigit'
import { lineGapOf } from './staffLines'

const textBoxes = (image: TabImage, rows: number[]): DigitBox[] =>
  groupRuns(
    Array.from({ length: image.width }, (_, x) => x).filter((x) =>
      rows.some((y) => isTextAt(image, x, y))
    )
  ).flatMap((run) => {
    const inkRows = rows.filter((y) => run.some((x) => isTextAt(image, x, y)))
    return [{ startX: run[0], endX: run.at(-1)!, top: inkRows[0], bottom: inkRows.at(-1)! }]
  })

export type TempoBand = {
  topRatio: number
  bottomRatio: number
  equalsMaxWidthRatio: number
  equalsMaxHeightRatio: number
  digitMaxWidthRatio: number
}

const TAB_TEMPO_BAND: TempoBand = {
  topRatio: TAB_TEMPO_BAND_TOP_RATIO,
  bottomRatio: TAB_TEMPO_BAND_BOTTOM_RATIO,
  equalsMaxWidthRatio: TAB_EQUALS_MAX_WIDTH_RATIO,
  equalsMaxHeightRatio: TAB_EQUALS_MAX_HEIGHT_RATIO,
  digitMaxWidthRatio: TAB_GLYPH_MAX_WIDTH_RATIO
}

// An equals sign is a short, fairly wide mark made of exactly two separate bars.
const isEqualsSign = (image: TabImage, box: DigitBox, gap: number, band: TempoBand): boolean => {
  const width = box.endX - box.startX + 1
  const height = box.bottom - box.top + 1
  const barRows = Array.from({ length: height }, (_, offset) => box.top + offset).filter((y) =>
    Array.from({ length: width }, (_, offset) => box.startX + offset).some((x) =>
      isTextAt(image, x, y)
    )
  )
  return (
    width >= TAB_EQUALS_MIN_WIDTH_RATIO * gap &&
    width <= band.equalsMaxWidthRatio * gap &&
    height <= band.equalsMaxHeightRatio * gap &&
    groupRuns(barRows).length === 2
  )
}

const isDigitShaped = (box: DigitBox, gap: number, band: TempoBand): boolean =>
  box.bottom - box.top + 1 >= TAB_GLYPH_MIN_HEIGHT_RATIO * gap &&
  box.endX - box.startX + 1 <= band.digitMaxWidthRatio * gap

// The boxes that follow the equals sign and read like one number: close together and digit sized.
const numberBoxes = (following: DigitBox[], gap: number, band: TempoBand): DigitBox[] => {
  const limit = TAB_TEMPO_DIGIT_GAP_RATIO * gap
  const end = following.findIndex(
    (box, index) =>
      !isDigitShaped(box, gap, band) ||
      (index > 0 && box.startX - following[index - 1].endX - 1 > limit)
  )
  return (end === -1 ? following : following.slice(0, end)).slice(0, TAB_TEMPO_MAX_DIGITS)
}

const tempoAfter = (
  image: TabImage,
  following: DigitBox[],
  gap: number,
  band: TempoBand
): number | null => {
  const digits = numberBoxes(following, gap, band).map((box) => readDigit(image, box))
  const firstUnread = digits.indexOf(null)
  const readable = firstUnread === -1 ? digits : digits.slice(0, firstUnread)
  const tempo = readable.length === 0 ? null : Number(readable.join(''))
  return tempo !== null &&
    tempo >= TAB_TEMPO_MIN_BEATS_PER_MINUTE &&
    tempo <= TAB_TEMPO_MAX_BEATS_PER_MINUTE
    ? tempo
    : null
}

/**
 * The tempo printed above the first staff, as in "= 96": looks for an equals sign in the band
 * of labels over the staff and reads the number after it with the fret digit templates.
 * @param image - the tab image
 * @param system - the first detected staff
 * @param band - where above the staff to look, in line gaps, and how large an equals sign may be
 * @returns the tempo in beats per minute, or null when none is printed or it cannot be read
 */
export const readTempo = (
  image: TabImage,
  system: TabSystem,
  band: TempoBand = TAB_TEMPO_BAND
): number | null => {
  const gap = lineGapOf(system)
  const top = system.lineYs[0]
  const first = Math.max(0, Math.round(top - band.topRatio * gap))
  const last = Math.round(top - band.bottomRatio * gap)
  const rows = Array.from({ length: Math.max(0, last - first + 1) }, (_, offset) => first + offset)
  const boxes = textBoxes(image, rows)
  const readings = boxes.flatMap((box, index) =>
    isEqualsSign(image, box, gap, band)
      ? [tempoAfter(image, boxes.slice(index + 1), gap, band)]
      : []
  )
  return readings.find((tempo) => tempo !== null) ?? null
}
