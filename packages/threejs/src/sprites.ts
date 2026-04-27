import * as THREE from 'three'

export interface TextSpriteOptions {
  text: string
  fontSize?: number
  scaleX?: number
  scaleY?: number
  color?: string
  fontStyle?: string
  fontFamily?: string
  align?: CanvasTextAlign
  centerBlock?: boolean
  autoAspect?: boolean
  canvasWidth?: number
  canvasHeight?: number
  valueColor?: string
  lineColors?: (string | undefined)[]
}

const TEXT_LEFT_MARGIN_RATIO = 0.05

const resolveXPosition = (
  align: CanvasTextAlign,
  canvasWidth: number,
  centerBlock: boolean,
  context: CanvasRenderingContext2D,
  lines: string[]
): number => {
  if (align === 'center') return canvasWidth / 2
  if (centerBlock) {
    const maxLineWidth = Math.max(...lines.map((line) => context.measureText(line).width))
    return (canvasWidth - maxLineWidth) / 2
  }
  return canvasWidth * TEXT_LEFT_MARGIN_RATIO
}

interface LineRenderOptions {
  color: string
  fontSize: number
  fontFamily: string
  fontStyle: string
  valueColor: string | undefined
}

const drawTextLine = (
  context: CanvasRenderingContext2D,
  line: string,
  xPosition: number,
  yPosition: number,
  renderOptions: LineRenderOptions
): void => {
  const { color, fontSize, fontFamily, fontStyle, valueColor } = renderOptions
  const normalFont = `${fontStyle} ${fontSize}px ${fontFamily}`

  if (valueColor && line.includes(': ')) {
    const colonPos = line.indexOf(': ')
    const keyPart = line.substring(0, colonPos + 2)
    const valuePart = line.substring(colonPos + 2)
    context.font = normalFont
    context.fillStyle = color
    context.fillText(keyPart, xPosition, yPosition)
    const keyWidth = context.measureText(keyPart).width
    context.font = `bold ${fontSize}px ${fontFamily}`
    context.fillStyle = valueColor
    context.fillText(valuePart, xPosition + keyWidth, yPosition)
    context.font = normalFont
  } else {
    context.fillStyle = color
    context.fillText(line, xPosition, yPosition)
  }
}

/**
 * Creates a Three.js Sprite with multiline text rendered onto a canvas texture.
 * @param options Configuration for the text sprite appearance and layout.
 * @returns A Three.js Sprite scaled to the line count.
 */
export const createTextSprite = (options: TextSpriteOptions): THREE.Sprite => {
  const {
    text,
    fontSize = 48,
    scaleX = 4,
    scaleY = 0.5,
    color = '#ffffff',
    fontStyle = 'normal',
    fontFamily = 'Arial, sans-serif',
    align = 'center',
    centerBlock = false,
    autoAspect = false,
    canvasWidth = 1024,
    canvasHeight = 80,
    valueColor,
    lineColors
  } = options

  const lines = text.split('\n')
  const canvas = document.createElement('canvas')
  canvas.width = canvasWidth
  canvas.height = canvasHeight * lines.length
  const context = canvas.getContext('2d')!
  context.clearRect(0, 0, canvas.width, canvas.height)
  context.font = `${fontStyle} ${fontSize}px ${fontFamily}`
  context.fillStyle = color
  context.textAlign = align
  context.textBaseline = 'middle'
  const lineHeight = canvas.height / lines.length
  const xPosition = resolveXPosition(align, canvasWidth, centerBlock, context, lines)
  const lineRenderOptions: LineRenderOptions = {
    color,
    fontSize,
    fontFamily,
    fontStyle,
    valueColor
  }

  Array.from(lines, (line, i) => {
    const overrideColor = lineColors?.[i]
    if (overrideColor !== undefined) {
      context.font = `${fontStyle} ${fontSize}px ${fontFamily}`
      context.fillStyle = overrideColor
      context.fillText(line, xPosition, lineHeight * i + lineHeight / 2)
    } else {
      drawTextLine(context, line, xPosition, lineHeight * i + lineHeight / 2, lineRenderOptions)
    }
    return null
  })

  const texture = new THREE.CanvasTexture(canvas)
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true })
  const sprite = new THREE.Sprite(material)
  const finalScaleX = autoAspect ? (canvasWidth / canvasHeight) * scaleY : scaleX
  sprite.scale.set(finalScaleX, scaleY * lines.length, 1)
  return sprite
}
