import {
  SCORE_CLEF_ZONE_RATIO,
  SCORE_COMMON_TIME_BEATS,
  SCORE_KEY_STEP_RATIO,
  SCORE_METRE_MIN_HEIGHT_RATIO,
  SCORE_METRE_MIN_WIDTH_RATIO,
  SCORE_METRE_PIECE_GAP_RATIO,
  SCORE_PRELUDE_MIN_WIDTH_RATIO,
  SCORE_PRELUDE_SPECK_RATIO,
  SCORE_METRE_REACH_RATIO,
  SCORE_PRELUDE_SEARCH_RATIO,
  SCORE_TREBLE_CLEF_REACH_RATIO
} from '../../config'
import type { Clef, PixelBox, StaffPrelude, TabImage, TabSystem } from '../../types'
import { lineGapOf } from '../tab/staffLines'
import { readDigit } from '../tab/readDigit'
import { readAccidental, type Accidental } from './accidentals'
import { findComponents, type InkComponent } from './components'
import { isSymbolAt, type ScoreMasks } from './scoreMasks'

// A treble clef curls well above the staff; a bass clef stays inside it.
const clefOf = (masks: ScoreMasks, staff: TabSystem, gap: number): Clef => {
  const top = staff.lineYs[0]
  const reach = Math.round(SCORE_TREBLE_CLEF_REACH_RATIO * gap)
  const columns = Math.round(SCORE_CLEF_ZONE_RATIO * gap)
  const inkAbove = Array.from({ length: reach }, (_, offset) =>
    Math.round(top - gap / 2 - offset)
  ).filter((y) =>
    Array.from(
      { length: columns },
      (_, offset) => Math.round(staff.startX + gap / 2) + offset
    ).some((x) => isSymbolAt(masks, x, y))
  )
  return inkAbove.length >= reach / 2 ? 'treble' : 'bass'
}

// The key is the run of sharps, or of flats, straight after the clef.
const keySigns = (
  blobs: InkComponent[],
  previousEnd: number,
  context: { masks: ScoreMasks; gap: number },
  signs: Accidental[] = []
): Accidental[] => {
  const [next, ...rest] = blobs
  if (next === undefined || next.left - previousEnd > SCORE_KEY_STEP_RATIO * context.gap) {
    return signs
  }
  if (next.bottom - next.top + 1 < SCORE_PRELUDE_SPECK_RATIO * context.gap) {
    return keySigns(rest, previousEnd, context, signs)
  }
  const sign = readAccidental(context.masks, next, context.gap)
  if (
    sign === null ||
    sign.kind === 'natural' ||
    (signs.length > 0 && sign.kind !== signs[0].kind)
  ) {
    return signs
  }
  return keySigns(rest, next.right, context, [...signs, sign])
}

const unionOf = (boxes: PixelBox[]): PixelBox => ({
  left: Math.min(...boxes.map((box) => box.left)),
  right: Math.max(...boxes.map((box) => box.right)),
  top: Math.min(...boxes.map((box) => box.top)),
  bottom: Math.max(...boxes.map((box) => box.bottom))
})

const isMetreShaped = (box: PixelBox, staff: TabSystem, gap: number): boolean =>
  box.right - box.left + 1 >= SCORE_METRE_MIN_WIDTH_RATIO * gap &&
  box.bottom - box.top + 1 >= SCORE_METRE_MIN_HEIGHT_RATIO * gap &&
  box.top >= staff.lineYs[0] - gap / 2 &&
  box.bottom <= staff.lineYs.at(-1)! + gap / 2

// The metre straight after the key, as one box: thin strokes of a bold sign that touch a staff
// line are lost with the line, so its pieces are gathered back by the columns they share.
const metreBox = (
  blobs: InkComponent[],
  keyEnd: number,
  staff: TabSystem,
  gap: number
): PixelBox | null => {
  const first = blobs.find(
    (blob) => blob.left > keyEnd && blob.left - keyEnd <= SCORE_METRE_REACH_RATIO * gap
  )
  if (first === undefined) {
    return null
  }
  const box = blobs
    .filter((blob) => blob.left >= first.left)
    .reduce(
      (union, blob) =>
        blob.left <= union.right + SCORE_METRE_PIECE_GAP_RATIO * gap
          ? unionOf([union, blob])
          : union,
      unionOf([first])
    )
  return isMetreShaped(box, staff, gap) ? box : null
}

const digitIn = (image: TabImage, box: PixelBox): number | null =>
  readDigit(image, { startX: box.left, endX: box.right, top: box.top, bottom: box.bottom })

// Two digits stacked in the staff are a metre such as 3/4; a sign that fills the middle on its
// own is common time, which is 4/4.
const beatsFromMetre = (
  image: TabImage,
  blobs: InkComponent[],
  box: PixelBox,
  staff: TabSystem
): number | null => {
  const middle = staff.lineYs[2]
  const inside = blobs.filter((blob) => blob.left <= box.right && blob.right >= box.left)
  const upper = inside.filter((blob) => blob.bottom < middle)
  const lower = inside.filter((blob) => blob.top > middle)
  if (upper.length === 0 || lower.length === 0) {
    return SCORE_COMMON_TIME_BEATS
  }
  const beats = digitIn(image, unionOf(upper))
  const unit = digitIn(image, unionOf(lower))
  return beats === null || unit === null || unit === 0 ? null : (beats * 4) / unit
}

/**
 * What a staff starts with: the clef, the sharps or flats of the key, and the metre when one is
 * printed. Everything up to the end of these is left out of the note search.
 * @param image - the score image
 * @param masks - the score masks
 * @param staff - one five line staff
 * @param readsMetre - whether to look for a metre, which is printed on the first system only
 * @returns the clef, key, beats per bar (null when none is printed) and where the music starts
 */
export const readPrelude = (
  image: TabImage,
  masks: ScoreMasks,
  staff: TabSystem,
  readsMetre: boolean
): StaffPrelude => {
  const gap = lineGapOf(staff)
  const blobs = findComponents((x, y) => isSymbolAt(masks, x, y), {
    left: staff.startX,
    right: Math.min(masks.width - 1, Math.round(staff.startX + SCORE_PRELUDE_SEARCH_RATIO * gap)),
    top: Math.max(0, Math.round(staff.lineYs[0] - 2 * gap)),
    bottom: Math.min(masks.height - 1, Math.round(staff.lineYs.at(-1)! + 2 * gap))
  })
    .filter((blob) => blob.right - blob.left + 1 >= SCORE_PRELUDE_MIN_WIDTH_RATIO * gap)
    .toSorted((first, second) => first.left - second.left)
  const clefLimit = staff.startX + SCORE_CLEF_ZONE_RATIO * gap
  const clefEnd = Math.max(
    staff.startX,
    ...blobs.filter((blob) => blob.left < clefLimit).map((blob) => blob.right)
  )
  const key = keySigns(
    blobs.filter((blob) => blob.left > clefEnd),
    clefEnd,
    { masks, gap }
  )
  const keyEnd = key.at(-1)?.right ?? clefEnd
  const metre = readsMetre ? metreBox(blobs, keyEnd, staff, gap) : null
  const sign = key[0]?.kind === 'flat' ? -1 : 1
  return {
    clef: clefOf(masks, staff, gap),
    keyAccidentals: sign * key.length,
    beatsPerBar: metre === null ? null : beatsFromMetre(image, blobs, metre, staff),
    endX: metre?.right ?? keyEnd
  }
}
