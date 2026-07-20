import type { PieceTransform, TrackBounds, RoomLayout, ToyPlacement, ToySpot } from './types'
import {
  ROOM_PADDING,
  ROOM_MIN_WIDTH,
  ROOM_MIN_DEPTH,
  FLOOR_CLEARANCE,
  CEILING_CLEARANCE,
  WALL_MIN_HEIGHT,
  TRACK_HORIZONTAL_MARGIN,
  TRACK_VERTICAL_MARGIN,
  TOY_SPOTS
} from './bedroomConfig'

/**
 * Axis-aligned bounds of a track chain, extended by fixed margins so piece
 * geometry hanging off its origin (curves, loops, funnels) stays inside.
 */
export const computeTrackBounds = (transforms: PieceTransform[]): TrackBounds => {
  const positions = transforms.map((transform) => transform.position)
  const axisValues = (axis: number): number[] => positions.map((position) => position[axis])
  const low = (axis: number): number => Math.min(0, ...axisValues(axis))
  const high = (axis: number): number => Math.max(0, ...axisValues(axis))
  return {
    min: [
      low(0) - TRACK_HORIZONTAL_MARGIN,
      low(1) - TRACK_VERTICAL_MARGIN,
      low(2) - TRACK_HORIZONTAL_MARGIN
    ],
    max: [
      high(0) + TRACK_HORIZONTAL_MARGIN,
      high(1) + TRACK_VERTICAL_MARGIN,
      high(2) + TRACK_HORIZONTAL_MARGIN
    ]
  }
}

/**
 * Bedroom shell dimensions wrapping the given track bounds: padded on every
 * side, never smaller than the minimum room, floor just below the track.
 */
export const computeRoomLayout = (bounds: TrackBounds): RoomLayout => {
  const floorY = bounds.min[1] - FLOOR_CLEARANCE
  return {
    centerX: (bounds.min[0] + bounds.max[0]) / 2,
    centerZ: (bounds.min[2] + bounds.max[2]) / 2,
    width: Math.max(bounds.max[0] - bounds.min[0] + 2 * ROOM_PADDING, ROOM_MIN_WIDTH),
    depth: Math.max(bounds.max[2] - bounds.min[2] + 2 * ROOM_PADDING, ROOM_MIN_DEPTH),
    floorY,
    wallHeight: Math.max(bounds.max[1] + CEILING_CLEARANCE - floorY, WALL_MIN_HEIGHT)
  }
}

type PerimeterSegment = {
  length: number
  pointAt: (distance: number) => [number, number]
}

// Clockwise walk along the inset rectangle, starting at its north-west corner.
const perimeterSegments = (halfWidth: number, halfDepth: number): PerimeterSegment[] => [
  { length: 2 * halfWidth, pointAt: (d) => [-halfWidth + d, -halfDepth] },
  { length: 2 * halfDepth, pointAt: (d) => [halfWidth, -halfDepth + d] },
  { length: 2 * halfWidth, pointAt: (d) => [halfWidth - d, halfDepth] },
  { length: 2 * halfDepth, pointAt: (d) => [-halfWidth, halfDepth - d] }
]

const perimeterPosition = (
  fraction: number,
  halfWidth: number,
  halfDepth: number
): [number, number] => {
  const segments = perimeterSegments(halfWidth, halfDepth)
  const total = segments.reduce((sum, segment) => sum + segment.length, 0)
  const targetDistance = (((fraction % 1) + 1) % 1) * total
  const located = segments.reduce(
    (state, segment) => {
      if (state.point) return state
      if (state.remaining < segment.length)
        return { remaining: 0, point: segment.pointAt(state.remaining) }
      return { remaining: state.remaining - segment.length, point: null }
    },
    { remaining: targetDistance, point: null as [number, number] | null }
  )
  return located.point ?? [-halfWidth, -halfDepth]
}

const placeSpot = (layout: RoomLayout, spot: ToySpot): ToyPlacement => {
  const [localX, localZ] = perimeterPosition(
    spot.fraction,
    layout.width / 2 - spot.inset,
    layout.depth / 2 - spot.inset
  )
  const faceCenterYaw = Math.atan2(-localX, -localZ)
  return {
    kind: spot.kind,
    position: [layout.centerX + localX, layout.floorY, layout.centerZ + localZ],
    rotationY: faceCenterYaw + spot.rotationY,
    scale: spot.scale,
    variant: spot.variant
  }
}

/**
 * Deterministic toy placements along the room perimeter: each configured spot
 * is mapped onto the wall-inset rectangle, resting on the floor and roughly
 * facing the room center.
 */
export const computeToyPlacements = (layout: RoomLayout): ToyPlacement[] =>
  TOY_SPOTS.map((spot) => placeSpot(layout, spot))

/**
 * Whether two room layouts describe the same room, so an unchanged bedroom
 * is not rebuilt on every track edit.
 */
export const roomLayoutsEqual = (first: RoomLayout, second: RoomLayout): boolean =>
  first.centerX === second.centerX &&
  first.centerZ === second.centerZ &&
  first.width === second.width &&
  first.depth === second.depth &&
  first.floorY === second.floorY &&
  first.wallHeight === second.wallHeight
