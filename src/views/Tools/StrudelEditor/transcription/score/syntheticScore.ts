import type { TabImage } from '../../types'
import { buildTabImage } from '../tab/buildTabImage'

/**
 * Test support: draws a two bar grand staff in G major (one sharp) with plain pixel rectangles,
 * at a larger zoom than the sample, so the score detectors are checked on geometry they were not
 * tuned on. The music, top staff then bottom staff:
 * bar 1: C5 E5 G5 F5 quarters | G2 whole note;
 * bar 2: A4 half, B4 C5 beamed eighths, quarter rest | A2, C3 with a sharp, D3, F3 quarters.
 */

const GAP = 16
const TREBLE_TOP = 120
const BASS_TOP = TREBLE_TOP + 10 * GAP
const LEFT = 20
const RIGHT = 580
const BAR_LINE_X = 330
const WIDTH = 600
const HEIGHT = BASS_TOP + 4 * GAP + 120
const LINE_GRAY = 100
const HEAD_HALF_WIDTH = 10
const HEAD_HALF_HEIGHT = 6
const STEM_LENGTH = 3.5 * GAP

type Rectangle = { left: number; top: number; right: number; bottom: number; gray: number }

const box = (left: number, top: number, right: number, bottom: number): Rectangle => ({
  left: Math.round(left),
  top: Math.round(top),
  right: Math.round(right),
  bottom: Math.round(bottom),
  gray: 0
})

// A letter step above the bottom line, as the reader counts them: two steps to a gap.
const stepY = (staffTop: number, step: number): number => staffTop + 4 * GAP - (step * GAP) / 2

const staffLines = (staffTop: number): Rectangle[] =>
  Array.from({ length: 5 }, (_, index) => ({
    ...box(LEFT, staffTop + index * GAP - 1, RIGHT, staffTop + index * GAP + 1),
    gray: LINE_GRAY
  }))

const filledHead = (x: number, y: number): Rectangle =>
  box(x - HEAD_HALF_WIDTH, y - HEAD_HALF_HEIGHT, x + HEAD_HALF_WIDTH, y + HEAD_HALF_HEIGHT)

const hollowHead = (x: number, y: number, halfWidth: number, sideWidth: number): Rectangle[] => [
  box(x - halfWidth, y - HEAD_HALF_HEIGHT, x + halfWidth, y - HEAD_HALF_HEIGHT + 3),
  box(x - halfWidth, y + HEAD_HALF_HEIGHT - 3, x + halfWidth, y + HEAD_HALF_HEIGHT),
  box(x - halfWidth, y - HEAD_HALF_HEIGHT, x - halfWidth + sideWidth, y + HEAD_HALF_HEIGHT),
  box(x + halfWidth - sideWidth, y - HEAD_HALF_HEIGHT, x + halfWidth, y + HEAD_HALF_HEIGHT)
]

const stemUp = (x: number, y: number): Rectangle =>
  box(x + HEAD_HALF_WIDTH - 2, y - STEM_LENGTH, x + HEAD_HALF_WIDTH, y)

const quarter = (x: number, y: number): Rectangle[] => [filledHead(x, y), stemUp(x, y)]

const sharp = (x: number, y: number): Rectangle[] => [
  box(x + 3, y - 1.5 * GAP, x + 5, y + 1.5 * GAP),
  box(x + 11, y - 1.5 * GAP, x + 13, y + 1.5 * GAP),
  box(x, y - 0.6 * GAP, x + 16, y - 0.25 * GAP),
  box(x, y + 0.25 * GAP, x + 16, y + 0.6 * GAP)
]

const prelude = (staffTop: number, isTreble: boolean, sharpStep: number): Rectangle[] => [
  isTreble
    ? box(LEFT + GAP, staffTop - 2 * GAP, LEFT + 3 * GAP, staffTop + 5.5 * GAP)
    : box(LEFT + GAP, staffTop + 0.2 * GAP, LEFT + 3 * GAP, staffTop + 3 * GAP),
  ...sharp(LEFT + 4.2 * GAP, stepY(staffTop, sharpStep))
]

const trebleMusic = (): Rectangle[] => {
  const beamTop = stepY(TREBLE_TOP, 5) - STEM_LENGTH
  return [
    ...[5, 7, 9, 8].flatMap((step, index) => quarter(150 + index * 45, stepY(TREBLE_TOP, step))),
    ...hollowHead(370, stepY(TREBLE_TOP, 3), HEAD_HALF_WIDTH, 5),
    stemUp(370, stepY(TREBLE_TOP, 3)),
    filledHead(430, stepY(TREBLE_TOP, 4)),
    box(430 + HEAD_HALF_WIDTH - 2, beamTop, 430 + HEAD_HALF_WIDTH, stepY(TREBLE_TOP, 4)),
    filledHead(470, stepY(TREBLE_TOP, 5)),
    box(470 + HEAD_HALF_WIDTH - 2, beamTop, 470 + HEAD_HALF_WIDTH, stepY(TREBLE_TOP, 5)),
    box(430 + HEAD_HALF_WIDTH - 2, beamTop, 470 + HEAD_HALF_WIDTH, beamTop + 8),
    box(525, TREBLE_TOP + 0.6 * GAP, 535, TREBLE_TOP + 3.4 * GAP)
  ]
}

const bassMusic = (): Rectangle[] => [
  ...hollowHead(200, stepY(BASS_TOP, 0), 13, 9),
  ...[1, 3, 4, 6].flatMap((step, index) => quarter(380 + index * 50, stepY(BASS_TOP, step))),
  ...sharp(430 - HEAD_HALF_WIDTH - 22, stepY(BASS_TOP, 3))
]

/**
 * The two bar grand staff described above, on a light page.
 * @returns the image as the detectors see it
 */
export const drawGrandStaffScore = (): TabImage => {
  const rectangles = [
    ...staffLines(TREBLE_TOP),
    ...staffLines(BASS_TOP),
    box(BAR_LINE_X, TREBLE_TOP - 1, BAR_LINE_X + 2, BASS_TOP + 4 * GAP + 1),
    ...prelude(TREBLE_TOP, true, 8),
    ...prelude(BASS_TOP, false, 6),
    ...trebleMusic(),
    ...bassMusic()
  ]
  const pixels = Uint8ClampedArray.from({ length: WIDTH * HEIGHT * 4 }, (_, offset) => {
    const pixelIndex = Math.floor(offset / 4)
    const x = pixelIndex % WIDTH
    const y = Math.floor(pixelIndex / WIDTH)
    const covering = rectangles.findLast(
      (rectangle) =>
        x >= rectangle.left && x < rectangle.right && y >= rectangle.top && y < rectangle.bottom
    )
    return offset % 4 === 3 ? 255 : (covering?.gray ?? 255)
  })
  return buildTabImage(WIDTH, HEIGHT, pixels)
}
