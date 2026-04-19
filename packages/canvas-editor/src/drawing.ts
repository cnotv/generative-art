export type DrawingTool = 'brush' | 'eraser' | 'fill'

export interface DrawingOptions {
  tool: DrawingTool
  color: string
  size: number
}

export interface DrawingPoint {
  x: number
  y: number
}

export interface StrokeEvent {
  from: DrawingPoint
  to: DrawingPoint
  options: DrawingOptions
}

/**
 * Draw a stroke segment between two points on the canvas.
 * @param ctx - 2D rendering context
 * @param from - Start point
 * @param to - End point
 * @param options - Drawing tool options
 */
export const drawingStroke = (
  ctx: CanvasRenderingContext2D,
  from: DrawingPoint,
  to: DrawingPoint,
  options: DrawingOptions
): void => {
  ctx.globalCompositeOperation = options.tool === 'eraser' ? 'destination-out' : 'source-over'
  ctx.strokeStyle = options.color
  ctx.lineWidth = options.size
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(from.x, from.y)
  ctx.lineTo(to.x, to.y)
  ctx.stroke()
  ctx.globalCompositeOperation = 'source-over'
}

/**
 * Draw a single dot at a point (used for click without drag).
 * @param ctx - 2D rendering context
 * @param point - Position to draw at
 * @param options - Drawing tool options
 */
export const drawingDot = (
  ctx: CanvasRenderingContext2D,
  point: DrawingPoint,
  options: DrawingOptions
): void => {
  ctx.globalCompositeOperation = options.tool === 'eraser' ? 'destination-out' : 'source-over'
  ctx.fillStyle = options.color
  ctx.beginPath()
  ctx.arc(point.x, point.y, options.size / 2, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalCompositeOperation = 'source-over'
}

/**
 * Flood-fill the canvas starting from a point with the given color.
 * Uses a non-recursive scanline algorithm.
 * @param ctx - 2D rendering context
 * @param point - Seed point for the fill
 * @param fillColor - CSS color string to fill with
 * @param tolerance - Color match tolerance (0–255)
 */
export const drawingFill = (
  ctx: CanvasRenderingContext2D,
  point: DrawingPoint,
  fillColor: string,
  tolerance = 32
): void => {
  const { width, height } = ctx.canvas
  const imageData = ctx.getImageData(0, 0, width, height)
  const data = imageData.data

  const px = Math.round(point.x)
  const py = Math.round(point.y)
  const targetIndex = (py * width + px) * 4

  const targetR = data[targetIndex]
  const targetG = data[targetIndex + 1]
  const targetB = data[targetIndex + 2]
  const targetA = data[targetIndex + 3]

  const fillRgb = hexToRgb(fillColor)
  if (!fillRgb) return
  const [fillR, fillG, fillB] = fillRgb

  if (
    Math.abs(targetR - fillR) < tolerance &&
    Math.abs(targetG - fillG) < tolerance &&
    Math.abs(targetB - fillB) < tolerance &&
    targetA > 0
  ) {
    return
  }

  const matches = (index: number): boolean =>
    Math.abs(data[index] - targetR) <= tolerance &&
    Math.abs(data[index + 1] - targetG) <= tolerance &&
    Math.abs(data[index + 2] - targetB) <= tolerance &&
    Math.abs(data[index + 3] - targetA) <= tolerance

  const stack = [px + py * width]
  const visited = new Uint8Array(width * height)

  while (stack.length > 0) {
    const pos = stack.pop()!
    if (visited[pos]) continue
    visited[pos] = 1

    const x = pos % width
    const y = Math.floor(pos / width)
    const index = pos * 4

    if (!matches(index)) continue

    data[index] = fillR
    data[index + 1] = fillG
    data[index + 2] = fillB
    data[index + 3] = 255

    if (x > 0) stack.push(pos - 1)
    if (x < width - 1) stack.push(pos + 1)
    if (y > 0) stack.push(pos - width)
    if (y < height - 1) stack.push(pos + width)
  }

  ctx.putImageData(imageData, 0, 0)
}

/**
 * Clear the entire canvas to transparent.
 * @param ctx - 2D rendering context
 */
export const drawingClear = (ctx: CanvasRenderingContext2D): void => {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
}

/**
 * Restore canvas content from a data URL snapshot.
 * @param ctx - 2D rendering context
 * @param dataUrl - Previously exported data URL
 * @returns Promise that resolves when the image is drawn
 */
export const drawingRestore = (ctx: CanvasRenderingContext2D, dataUrl: string): Promise<void> => {
  const img = new Image()
  return new Promise((resolve) => {
    img.onload = () => {
      const cw = ctx.canvas.width
      const ch = ctx.canvas.height
      const scale = Math.max(cw / img.width, ch / img.height)
      const drawWidth = img.width * scale
      const drawHeight = img.height * scale
      const offsetX = (cw - drawWidth) / 2
      const offsetY = (ch - drawHeight) / 2
      ctx.clearRect(0, 0, cw, ch)
      ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight)
      resolve()
    }
    img.onerror = () => resolve()
    img.src = dataUrl
  })
}

const hexToRgb = (color: string): [number, number, number] | null => {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 1
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = color
  ctx.fillRect(0, 0, 1, 1)
  const d = ctx.getImageData(0, 0, 1, 1).data
  return [d[0], d[1], d[2]]
}
