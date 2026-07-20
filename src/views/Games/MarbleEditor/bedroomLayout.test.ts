import { describe, it, expect } from 'vitest'
import {
  computeTrackBounds,
  computeRoomLayout,
  computeToyPlacements,
  roomLayoutsEqual
} from './bedroomLayout'
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
import type { PieceTransform, TrackBounds } from './types'

const transformAt = (x: number, y: number, z: number): PieceTransform => ({
  position: [x, y, z],
  yaw: 0
})

describe('computeTrackBounds', () => {
  it('wraps the origin with margins when there are no transforms', () => {
    const bounds = computeTrackBounds([])
    expect(bounds.min).toEqual([
      -TRACK_HORIZONTAL_MARGIN,
      -TRACK_VERTICAL_MARGIN,
      -TRACK_HORIZONTAL_MARGIN
    ])
    expect(bounds.max).toEqual([
      TRACK_HORIZONTAL_MARGIN,
      TRACK_VERTICAL_MARGIN,
      TRACK_HORIZONTAL_MARGIN
    ])
  })

  it.each([
    {
      label: 'single origin piece',
      transforms: [transformAt(0, 0, 0)],
      expectedMinX: -TRACK_HORIZONTAL_MARGIN,
      expectedMaxZ: TRACK_HORIZONTAL_MARGIN
    },
    {
      label: 'descending chain',
      transforms: [transformAt(0, 0, 0), transformAt(40, -20, -80)],
      expectedMinX: -TRACK_HORIZONTAL_MARGIN,
      expectedMaxZ: TRACK_HORIZONTAL_MARGIN
    }
  ])('extends $label by the horizontal margin', ({ transforms, expectedMinX, expectedMaxZ }) => {
    const bounds = computeTrackBounds(transforms)
    expect(bounds.min[0]).toBe(expectedMinX)
    expect(bounds.max[2]).toBe(expectedMaxZ)
  })

  it('includes every transform extreme plus margins', () => {
    const bounds = computeTrackBounds([
      transformAt(-10, 0, 0),
      transformAt(50, -25, -120),
      transformAt(20, 5, -60)
    ])
    expect(bounds.min).toEqual([
      -10 - TRACK_HORIZONTAL_MARGIN,
      -25 - TRACK_VERTICAL_MARGIN,
      -120 - TRACK_HORIZONTAL_MARGIN
    ])
    expect(bounds.max).toEqual([
      50 + TRACK_HORIZONTAL_MARGIN,
      5 + TRACK_VERTICAL_MARGIN,
      TRACK_HORIZONTAL_MARGIN
    ])
  })
})

describe('computeRoomLayout', () => {
  const smallBounds: TrackBounds = { min: [-30, -12, -30], max: [30, 12, 30] }
  const wideBounds: TrackBounds = { min: [-100, -40, -200], max: [100, 20, 30] }

  it('enforces the minimum room size for small tracks', () => {
    const layout = computeRoomLayout(smallBounds)
    expect(layout.width).toBe(ROOM_MIN_WIDTH)
    expect(layout.depth).toBe(ROOM_MIN_DEPTH)
  })

  it('pads large tracks on every side', () => {
    const layout = computeRoomLayout(wideBounds)
    expect(layout.width).toBe(200 + 2 * ROOM_PADDING)
    expect(layout.depth).toBe(230 + 2 * ROOM_PADDING)
  })

  it('centers the room on the track footprint', () => {
    const layout = computeRoomLayout(wideBounds)
    expect(layout.centerX).toBeCloseTo(0)
    expect(layout.centerZ).toBeCloseTo(-85)
  })

  it('places the floor just below the lowest track point', () => {
    const layout = computeRoomLayout(wideBounds)
    expect(layout.floorY).toBe(-40 - FLOOR_CLEARANCE)
  })

  it.each([
    {
      label: 'small track keeps the minimum wall height',
      bounds: smallBounds,
      expected: WALL_MIN_HEIGHT
    },
    {
      label: 'tall track raises the walls above its top',
      bounds: { min: [-30, -12, -30], max: [30, 80, 30] } as TrackBounds,
      expected: 80 + CEILING_CLEARANCE - (-12 - FLOOR_CLEARANCE)
    }
  ])('$label', ({ bounds, expected }) => {
    expect(computeRoomLayout(bounds).wallHeight).toBe(expected)
  })
})

describe('computeToyPlacements', () => {
  const layout = computeRoomLayout({ min: [-100, -40, -200], max: [100, 20, 30] })
  const placements = computeToyPlacements(layout)

  it('creates one placement per configured toy spot', () => {
    expect(placements).toHaveLength(TOY_SPOTS.length)
    expect(placements.map((placement) => placement.kind)).toEqual(
      TOY_SPOTS.map((spot) => spot.kind)
    )
  })

  it('rests every toy on the floor', () => {
    placements.forEach((placement) => {
      expect(placement.position[1]).toBe(layout.floorY)
    })
  })

  it('keeps every toy inside the room at its configured wall inset', () => {
    placements.forEach((placement, index) => {
      const inset = TOY_SPOTS[index].inset
      const offsetX = Math.abs(placement.position[0] - layout.centerX)
      const offsetZ = Math.abs(placement.position[2] - layout.centerZ)
      expect(offsetX).toBeLessThanOrEqual(layout.width / 2 - inset + 1e-9)
      expect(offsetZ).toBeLessThanOrEqual(layout.depth / 2 - inset + 1e-9)
      const chebyshev = Math.max(
        offsetX / (layout.width / 2 - inset),
        offsetZ / (layout.depth / 2 - inset)
      )
      expect(chebyshev).toBeCloseTo(1)
    })
  })

  it('is deterministic for the same layout', () => {
    expect(computeToyPlacements(layout)).toEqual(placements)
  })
})

describe('roomLayoutsEqual', () => {
  const layout = computeRoomLayout({ min: [-30, -12, -30], max: [30, 12, 30] })

  it.each([
    { label: 'identical layouts', other: { ...layout }, expected: true },
    {
      label: 'different floor height',
      other: { ...layout, floorY: layout.floorY - 1 },
      expected: false
    },
    { label: 'different width', other: { ...layout, width: layout.width + 10 }, expected: false }
  ])('detects $label', ({ other, expected }) => {
    expect(roomLayoutsEqual(layout, other)).toBe(expected)
  })
})
