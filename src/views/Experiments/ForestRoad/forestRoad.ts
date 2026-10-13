import type { CoordinateTuple } from '@webgamekit/animation'
import {
  CANOPY_HEIGHT_FACTOR,
  CANOPY_MAX_SIZE,
  CANOPY_MIN_SIZE,
  LEAF_LIFT_ROAD,
  LEAF_LIFT_VERGE,
  LEAF_LITTER_COLORS,
  RANDOM_MIDPOINT,
  ROAD_TOP_Y,
  TRUNK_MAX_DIAMETER,
  TRUNK_MAX_HEIGHT,
  TRUNK_MIN_DIAMETER,
  TRUNK_MIN_HEIGHT,
  VERGE_TOP_Y
} from './config'

export const isOnRoadSurface = (x: number, roadHalfWidth: number): boolean =>
  Math.abs(x) <= roadHalfWidth

export const leafRestHeight = (x: number, roadHalfWidth: number): number =>
  isOnRoadSurface(x, roadHalfWidth) ? ROAD_TOP_Y + LEAF_LIFT_ROAD : VERGE_TOP_Y + LEAF_LIFT_VERGE

export const pickPaletteColor = (palette: readonly number[], index: number): number =>
  palette[index % palette.length]

export const trunkDimensions = (randomValue: number): { diameter: number; height: number } => ({
  diameter: TRUNK_MIN_DIAMETER + randomValue * (TRUNK_MAX_DIAMETER - TRUNK_MIN_DIAMETER),
  height: TRUNK_MIN_HEIGHT + randomValue * (TRUNK_MAX_HEIGHT - TRUNK_MIN_HEIGHT)
})

export const canopySizeFor = (randomValue: number): number =>
  CANOPY_MIN_SIZE + randomValue * (CANOPY_MAX_SIZE - CANOPY_MIN_SIZE)

export const canopyCenterFor = (
  trunkPosition: CoordinateTuple,
  trunkHeight: number,
  canopySize: number
): CoordinateTuple => [
  trunkPosition[0],
  trunkPosition[1] + trunkHeight + canopySize * CANOPY_HEIGHT_FACTOR,
  trunkPosition[2]
]

export const leafColorFor = (index: number): number => pickPaletteColor(LEAF_LITTER_COLORS, index)

export const leafZFor = (distanceRandom: number, startZ: number, endZ: number): number =>
  startZ - distanceRandom * (startZ - endZ)

export const leafXFor = (positionRandom: number, roadHalfWidth: number, spreadX: number): number =>
  (positionRandom - RANDOM_MIDPOINT) * 2 * spreadX

export const isRoadLeaf = (selectorRandom: number, roadShare: number): boolean =>
  selectorRandom < roadShare

export const vergeXFor = (
  sideRandom: number,
  distanceRandom: number,
  roadHalfWidth: number,
  spreadX: number
): number =>
  (sideRandom < RANDOM_MIDPOINT ? -1 : 1) *
  (roadHalfWidth + distanceRandom * (spreadX - roadHalfWidth))
