import type { HoleConfig } from '../config'

export type HoleSvgData = {
  ground: string
  walls: string[]
  tee: string
  pin: string
}

const TEE_CIRCLE_RADIUS = 4
const PIN_CIRCLE_RADIUS = 5
const PADDING = 8

const computeScale = (
  hole: HoleConfig,
  size: number
): { scale: number; offsetX: number; offsetZ: number } => {
  const { width, depth, position } = hole.ground
  const hw = width / 2
  const hd = depth / 2
  const px = position[0]
  const pz = position[2]

  const allX = [
    px - hw,
    px + hw,
    hole.teePosition[0],
    hole.holePosition[0],
    ...hole.walls.flatMap((w) => [w.position[0] - w.width / 2, w.position[0] + w.width / 2])
  ]
  const allZ = [
    pz - hd,
    pz + hd,
    hole.teePosition[2],
    hole.holePosition[2],
    ...hole.walls.flatMap((w) => [w.position[2] - w.depth / 2, w.position[2] + w.depth / 2])
  ]

  const minX = Math.min(...allX)
  const maxX = Math.max(...allX)
  const minZ = Math.min(...allZ)
  const maxZ = Math.max(...allZ)

  const rangeX = maxX - minX || 1
  const rangeZ = maxZ - minZ || 1
  const usable = size - PADDING * 2
  const scale = Math.min(usable / rangeX, usable / rangeZ)

  const offsetX = PADDING + (usable - rangeX * scale) / 2 - minX * scale
  const offsetZ = PADDING + (usable - rangeZ * scale) / 2 - minZ * scale

  return { scale, offsetX, offsetZ }
}

const worldToSvgX = (worldX: number, offsetX: number, scale: number): number =>
  offsetX + worldX * scale

const worldToSvgY = (worldZ: number, offsetZ: number, scale: number): number =>
  offsetZ + worldZ * scale

type RectPathOptions = {
  cx: number
  cz: number
  w: number
  d: number
  offsetX: number
  offsetZ: number
  scale: number
}

const rectPath = ({ cx, cz, w, d, offsetX, offsetZ, scale }: RectPathOptions): string => {
  const x = worldToSvgX(cx - w / 2, offsetX, scale)
  const y = worldToSvgY(cz - d / 2, offsetZ, scale)
  const sw = w * scale
  const sh = d * scale
  return `M${x},${y} h${sw} v${sh} h${-sw} Z`
}

/**
 * Convert a HoleConfig into SVG path strings for rendering a miniature hole preview.
 * @param hole - The hole configuration to convert.
 * @param size - The pixel width/height of the square SVG viewport.
 * @returns SVG path data for ground, walls, tee, and pin.
 */
export const holeToSvgPaths = (hole: HoleConfig, size: number): HoleSvgData => {
  const { scale, offsetX, offsetZ } = computeScale(hole, size)
  const { width, depth, position } = hole.ground

  const ground = rectPath({
    cx: position[0],
    cz: position[2],
    w: width,
    d: depth,
    offsetX,
    offsetZ,
    scale
  })

  const walls = hole.walls.map((w) =>
    rectPath({
      cx: w.position[0],
      cz: w.position[2],
      w: w.width,
      d: w.depth,
      offsetX,
      offsetZ,
      scale
    })
  )

  const teeX = worldToSvgX(hole.teePosition[0], offsetX, scale)
  const teeY = worldToSvgY(hole.teePosition[2], offsetZ, scale)
  const tee = `M${teeX},${teeY} m-${TEE_CIRCLE_RADIUS},0 a${TEE_CIRCLE_RADIUS},${TEE_CIRCLE_RADIUS} 0 1,0 ${TEE_CIRCLE_RADIUS * 2},0 a${TEE_CIRCLE_RADIUS},${TEE_CIRCLE_RADIUS} 0 1,0 -${TEE_CIRCLE_RADIUS * 2},0`

  const pinX = worldToSvgX(hole.holePosition[0], offsetX, scale)
  const pinY = worldToSvgY(hole.holePosition[2], offsetZ, scale)
  const pin = `M${pinX},${pinY} m-${PIN_CIRCLE_RADIUS},0 a${PIN_CIRCLE_RADIUS},${PIN_CIRCLE_RADIUS} 0 1,0 ${PIN_CIRCLE_RADIUS * 2},0 a${PIN_CIRCLE_RADIUS},${PIN_CIRCLE_RADIUS} 0 1,0 -${PIN_CIRCLE_RADIUS * 2},0`

  return { ground, walls, tee, pin }
}
