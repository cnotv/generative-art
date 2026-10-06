import {
  SIGN_BORDER_WIDTH,
  SIGN_CANVAS_HEIGHT,
  SIGN_CANVAS_WIDTH,
  SIGN_COLORS,
  SIGN_CORNER_RADIUS,
  SIGN_FONT_FAMILY,
  SIGN_FONT_MIN_SIZE,
  SIGN_FONT_SIZE
} from '../config'
import type { SignState } from '../types'

const TEXT_MARGIN_RATIO = 0.84
const FONT_STEP = 4

export const createSignCanvas = (): HTMLCanvasElement => {
  const canvas = document.createElement('canvas')
  canvas.width = SIGN_CANVAS_WIDTH
  canvas.height = SIGN_CANVAS_HEIGHT
  return canvas
}

/** The largest font size, down to the minimum, at which the word fits across the sign. */
const fittedFontSize = (context: CanvasRenderingContext2D, word: string): number => {
  const maxTextWidth = SIGN_CANVAS_WIDTH * TEXT_MARGIN_RATIO
  const candidateSizes = Array.from(
    { length: Math.floor((SIGN_FONT_SIZE - SIGN_FONT_MIN_SIZE) / FONT_STEP) + 1 },
    (_, step) => SIGN_FONT_SIZE - step * FONT_STEP
  )
  return (
    candidateSizes.find((size) => {
      context.font = `${size}px ${SIGN_FONT_FAMILY}`
      return context.measureText(word).width <= maxTextWidth
    }) ?? SIGN_FONT_MIN_SIZE
  )
}

/** Paints one word sign: a rounded card in the state's colours with the word centred on it. */
export const drawSign = (canvas: HTMLCanvasElement, word: string, state: SignState): void => {
  const context = canvas.getContext('2d')
  if (!context) return
  const colors = SIGN_COLORS[state]
  const inset = SIGN_BORDER_WIDTH / 2

  context.clearRect(0, 0, canvas.width, canvas.height)
  context.beginPath()
  context.roundRect(
    inset,
    inset,
    canvas.width - SIGN_BORDER_WIDTH,
    canvas.height - SIGN_BORDER_WIDTH,
    SIGN_CORNER_RADIUS
  )
  context.fillStyle = colors.fill
  context.fill()
  context.lineWidth = SIGN_BORDER_WIDTH
  context.strokeStyle = colors.border
  context.stroke()

  context.font = `${fittedFontSize(context, word)}px ${SIGN_FONT_FAMILY}`
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillStyle = colors.ink
  context.fillText(word, canvas.width / 2, canvas.height / 2)
}
