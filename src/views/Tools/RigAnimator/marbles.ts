import * as THREE from 'three'
import { seededRandomValues } from '@webgamekit/threejs'
import type { CoordinateTuple } from '@webgamekit/threejs'
import {
  MARBLE_DROP_HEIGHT_FRACTION,
  MARBLE_PALETTE,
  MARBLE_RADIUS_FRACTION_RANGE,
  MARBLE_SPREAD_FRACTION,
  MARBLE_STACK_HEIGHT_FRACTION,
  MARBLE_SWIRL_COUNT,
  MARBLE_SWIRL_WIDTH_FRACTION_RANGE,
  MARBLE_TEXTURE_SIZE
} from './config'

export interface MarbleSpawn {
  position: CoordinateTuple
  radius: number
  baseColor: number
  swirlColor: number
  swirlSeed: number
}

export interface MarbleSpawnPlanOptions {
  count: number
  seed: number
  /** Where the rig stands, which the drop column is centred over. */
  center: CoordinateTuple
  /** The rig's own spread, which every distance below is a fraction of. */
  rigDiagonal: number
}

/** Two horizontal offsets, a vertical offset, a radius and a palette pick, per marble. */
const VALUES_PER_MARBLE = 5

const pickFromRange = (value: number, [minimum, maximum]: [number, number]): number =>
  minimum + value * (maximum - minimum)

/**
 * Decide where each marble starts, how big it is and what it is painted in.
 *
 * Seeded rather than `Math.random`, so raising the count only adds marbles to the ones already
 * falling instead of reshuffling the whole heap, and so a scene looks the same on every
 * reload. Every distance is a fraction of the rig's spread, so the marbles stay in proportion
 * to whichever model is loaded.
 *
 * @param options The count, the seed, the rig's position and the rig's spread
 * @returns One spawn description per marble
 */
export const buildMarbleSpawnPlan = ({
  count,
  seed,
  center,
  rigDiagonal
}: MarbleSpawnPlanOptions): MarbleSpawn[] => {
  if (count <= 0) return []

  const spread = rigDiagonal * MARBLE_SPREAD_FRACTION
  const dropHeight = rigDiagonal * MARBLE_DROP_HEIGHT_FRACTION
  const stackHeight = rigDiagonal * MARBLE_STACK_HEIGHT_FRACTION
  const values = seededRandomValues(seed, count * VALUES_PER_MARBLE)

  return Array.from({ length: count }, (_, index) => {
    const [offsetX, offsetZ, offsetY, size, tint] = values.slice(
      index * VALUES_PER_MARBLE,
      (index + 1) * VALUES_PER_MARBLE
    )
    const paletteIndex = Math.min(
      Math.floor(tint * MARBLE_PALETTE.length),
      MARBLE_PALETTE.length - 1
    )
    const palette = MARBLE_PALETTE[paletteIndex]

    return {
      position: [
        center[0] + (offsetX * 2 - 1) * spread,
        center[1] + dropHeight + offsetY * stackHeight,
        center[2] + (offsetZ * 2 - 1) * spread
      ] as CoordinateTuple,
      radius: pickFromRange(size, [
        rigDiagonal * MARBLE_RADIUS_FRACTION_RANGE[0],
        rigDiagonal * MARBLE_RADIUS_FRACTION_RANGE[1]
      ]),
      baseColor: palette.base,
      swirlColor: palette.swirl,
      swirlSeed: seed + index
    }
  })
}

const toCssColor = (color: number): string => `#${color.toString(16).padStart(6, '0')}`

/** Curve control points, start and end, per swirl band. */
const VALUES_PER_SWIRL = 5

/**
 * Paint one marble's swirl pattern onto a canvas texture.
 *
 * Procedural rather than a loaded image because every marble wants a different pattern, and
 * a few hundred small canvases cost nothing next to a few hundred texture requests.
 *
 * @param spawn The marble to paint, whose swirl seed decides the pattern
 * @returns The texture to hand to the marble's material
 */
export const createMarbleTexture = (spawn: MarbleSpawn): THREE.CanvasTexture => {
  const canvas = document.createElement('canvas')
  canvas.width = MARBLE_TEXTURE_SIZE
  canvas.height = MARBLE_TEXTURE_SIZE
  const context = canvas.getContext('2d')!

  context.fillStyle = toCssColor(spawn.baseColor)
  context.fillRect(0, 0, MARBLE_TEXTURE_SIZE, MARBLE_TEXTURE_SIZE)

  context.strokeStyle = toCssColor(spawn.swirlColor)
  context.lineCap = 'round'
  const values = seededRandomValues(spawn.swirlSeed, MARBLE_SWIRL_COUNT * VALUES_PER_SWIRL)

  Array.from({ length: MARBLE_SWIRL_COUNT }, (_, index) => {
    const [startY, controlX, controlY, endY, width] = values.slice(
      index * VALUES_PER_SWIRL,
      (index + 1) * VALUES_PER_SWIRL
    )
    context.lineWidth =
      MARBLE_TEXTURE_SIZE * pickFromRange(width, MARBLE_SWIRL_WIDTH_FRACTION_RANGE)
    context.beginPath()
    context.moveTo(0, startY * MARBLE_TEXTURE_SIZE)
    context.quadraticCurveTo(
      controlX * MARBLE_TEXTURE_SIZE,
      controlY * MARBLE_TEXTURE_SIZE,
      MARBLE_TEXTURE_SIZE,
      endY * MARBLE_TEXTURE_SIZE
    )
    context.stroke()
  })

  return new THREE.CanvasTexture(canvas)
}
