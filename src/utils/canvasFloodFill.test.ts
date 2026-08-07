import { describe, it, expect } from 'vitest'
import { floodFill } from './canvasFloodFill'

const RGBA_STRIDE = 4
const WHITE = [255, 255, 255, 255]
const BLACK = [0, 0, 0, 255]
const RED = [255, 0, 0, 255]

/**
 * jsdom has no 2D canvas backend, so the fill is driven against a plain
 * object exposing only the three members it actually touches.
 */
const createContext = (width: number, height: number, pixels: number[][]) => {
  const data = Uint8ClampedArray.from(pixels.flat())
  const imageData = { data, width, height } as ImageData
  return {
    canvas: { width, height },
    getImageData: () => imageData,
    putImageData: () => undefined,
    pixelAt: (x: number, y: number): number[] => {
      const index = (y * width + x) * RGBA_STRIDE
      return Array.from({ length: RGBA_STRIDE }, (_, offset) => data[index + offset])
    }
  } as unknown as CanvasRenderingContext2D & { pixelAt: (x: number, y: number) => number[] }
}

/** A 3x3 grid whose middle column is black, splitting it into two white halves. */
const splitGrid = (): number[][] =>
  Array.from({ length: 9 }, (_, index) => (index % 3 === 1 ? BLACK : WHITE))

describe('floodFill', () => {
  it('recolours every pixel connected to the origin', () => {
    const context = createContext(2, 2, [WHITE, WHITE, WHITE, WHITE])
    floodFill(context, 0, 0, RED)
    expect(context.pixelAt(0, 0)).toEqual(RED)
    expect(context.pixelAt(1, 1)).toEqual(RED)
  })

  it('stops at a differently coloured boundary instead of crossing it', () => {
    const context = createContext(3, 3, splitGrid())
    floodFill(context, 0, 0, RED)

    expect(context.pixelAt(0, 0)).toEqual(RED)
    expect(context.pixelAt(0, 2)).toEqual(RED)
    expect(context.pixelAt(1, 1)).toEqual(BLACK)
    expect(context.pixelAt(2, 0)).toEqual(WHITE)
  })

  it('fills four-way connected, never through a diagonal-only gap', () => {
    const context = createContext(2, 2, [WHITE, BLACK, BLACK, WHITE])
    floodFill(context, 0, 0, RED)

    expect(context.pixelAt(0, 0)).toEqual(RED)
    expect(context.pixelAt(1, 1)).toEqual(WHITE)
  })

  it('leaves the canvas alone when the origin already holds the fill colour', () => {
    const context = createContext(2, 2, [RED, WHITE, WHITE, WHITE])
    floodFill(context, 0, 0, RED)
    expect(context.pixelAt(1, 0)).toEqual(WHITE)
  })

  it('ignores an origin outside the canvas rather than throwing', () => {
    const context = createContext(2, 2, [WHITE, WHITE, WHITE, WHITE])
    expect(() => floodFill(context, 5, 5, RED)).not.toThrow()
    expect(() => floodFill(context, -1, 0, RED)).not.toThrow()
    expect(context.pixelAt(0, 0)).toEqual(WHITE)
  })

  it('walks a region far wider than one recursion ring', () => {
    const size = 64
    const context = createContext(
      size,
      size,
      Array.from({ length: size * size }, () => WHITE)
    )
    floodFill(context, 0, 0, RED)
    expect(context.pixelAt(size - 1, size - 1)).toEqual(RED)
  })
})
