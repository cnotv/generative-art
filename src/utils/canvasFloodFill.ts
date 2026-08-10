const RGBA_STRIDE = 4

/**
 * Resolves any CSS colour string to its RGBA channels, by letting a canvas
 * parse it — the browser already knows every notation, so nothing here has
 * to know hex from `rgb()` from a named colour.
 * @param color - Any CSS colour string
 * @returns Its four channels, each 0-255
 */
export const cssColorToRgba = (color: string): number[] => {
  const swatch = document.createElement('canvas')
  swatch.width = 1
  swatch.height = 1
  const swatchContext = swatch.getContext('2d')!
  swatchContext.fillStyle = color
  swatchContext.fillRect(0, 0, 1, 1)
  return [...swatchContext.getImageData(0, 0, 1, 1).data]
}

const neighboursOf = (position: number, width: number, height: number): number[] => {
  const pixelX = position % width
  const pixelY = Math.floor(position / width)
  return [
    pixelX > 0 ? position - 1 : -1,
    pixelX < width - 1 ? position + 1 : -1,
    pixelY > 0 ? position - width : -1,
    pixelY < height - 1 ? position + width : -1
  ].filter((neighbour) => neighbour >= 0)
}

type FloodFillRegion = {
  data: Uint8ClampedArray
  width: number
  height: number
  target: number[]
  replacement: number[]
  visited: Uint8Array
}

/**
 * Recolours one breadth-first ring of matching pixels and recurses onto the
 * next, rather than draining a queue in place.
 *
 * Recursion depth is the number of rings, which tops out at the image's own
 * width plus height — a thousand frames for a 512px map, nowhere near deep
 * enough to matter, and each ring's pixels are still handled in bulk.
 */
const fillRegion = (frontier: number[], region: FloodFillRegion): void => {
  const next = frontier.flatMap((position) => {
    if (region.visited[position]) return []
    region.visited[position] = 1
    const index = position * RGBA_STRIDE
    const matches = region.target.every(
      (channel, offset) => region.data[index + offset] === channel
    )
    if (!matches) return []
    region.replacement.forEach((channel, offset) => {
      region.data[index + offset] = channel
    })
    return neighboursOf(position, region.width, region.height)
  })
  if (next.length > 0) fillRegion(next, region)
}

/**
 * Replaces the contiguous run of same-coloured pixels under a point with a
 * new colour, four-way connected and bounded by any colour that differs.
 *
 * A no-op when the point falls outside the canvas, or when the colour
 * already there is the one being painted — without that guard, filling a
 * region with its own colour would walk the whole area to change nothing.
 *
 * Takes resolved channels rather than a CSS string so the fill itself needs
 * no canvas of its own to parse one with.
 * @param context - The 2D context to read and write back
 * @param startX - Fill origin in canvas pixels
 * @param startY - Fill origin in canvas pixels
 * @param replacement - The colour to paint, as four 0-255 channels
 * @returns Nothing; the context's image data is replaced in place
 */
export const floodFill = (
  context: CanvasRenderingContext2D,
  startX: number,
  startY: number,
  replacement: number[]
): void => {
  const { width, height } = context.canvas
  const originX = Math.round(startX)
  const originY = Math.round(startY)
  if (originX < 0 || originX >= width || originY < 0 || originY >= height) return

  const imageData = context.getImageData(0, 0, width, height)
  const data = imageData.data
  const startIndex = (originY * width + originX) * RGBA_STRIDE
  const target = Array.from({ length: RGBA_STRIDE }, (_, offset) => data[startIndex + offset])
  if (target.every((channel, index) => channel === replacement[index])) return

  fillRegion([originX + originY * width], {
    data,
    width,
    height,
    target,
    replacement,
    visited: new Uint8Array(width * height)
  })
  context.putImageData(imageData, 0, 0)
}
