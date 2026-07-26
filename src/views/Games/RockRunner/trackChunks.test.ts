import { describe, it, expect, vi } from 'vitest'
import * as THREE from 'three'
import RAPIER from '@dimforge/rapier3d-compat'
import {
  deckCrossSection,
  slabCrossSection,
  apronCrossSections,
  wallCrossSections,
  chunkStationRange,
  sweepGroundUvs,
  createTrackChunkManager
} from './trackChunks'
import { createTrackPath } from './trackPath'
import {
  CHUNK_STATIONS,
  CHUNK_LENGTH,
  TRACK_BEHIND,
  CURVE_TERMS,
  MIN_TURN_RADIUS,
  STATION_SPACING,
  TERRAIN_DROP,
  TERRAIN_HALF_WIDTH,
  TRACK_LOOKAHEAD,
  TRACK_DISPOSE_BEHIND,
  TRACK_WIDTH
} from './config'

const WALL = { height: 3, thickness: 1 }

// The world spans from -TRACK_BEHIND to the lookahead, so a full pump covers
// both sides of the origin.
const EXPECTED_CHUNKS = Math.ceil((TRACK_LOOKAHEAD + TRACK_BEHIND) / CHUNK_LENGTH)

const createWorldStub = () => {
  const removeRigidBody = vi.fn()
  const createCollider = vi.fn()
  const bodies: object[] = []
  const world = {
    createRigidBody: vi.fn(() => {
      const body = {}
      bodies.push(body)
      return body
    }),
    createCollider,
    removeRigidBody
  }
  return { world: world as unknown as RAPIER.World, removeRigidBody, createCollider, bodies }
}

describe('slabCrossSection', () => {
  it('is a closed four-point slab when the top is not subdivided', () => {
    expect(slabCrossSection(16, 1.2)).toEqual([
      [-8, -1.2],
      [-8, 0],
      [8, 0],
      [8, -1.2]
    ])
  })

  it.each([2, 4, 12])('subdivides the top edge into %i segments', (segments) => {
    const section = slabCrossSection(16, 1.2, 0, segments)
    const topPoints = section.filter(([, y]) => y === 0)

    expect(topPoints).toHaveLength(segments + 1)
  })

  it('keeps the subdivided top points evenly spaced across the width', () => {
    const topPoints = slabCrossSection(16, 1.2, 0, 4)
      .filter(([, y]) => y === 0)
      .map(([x]) => x)

    expect(topPoints).toEqual([-8, -4, 0, 4, 8])
  })

  it('offsets the whole outline by the requested top height', () => {
    const section = slabCrossSection(10, 2, -0.25)

    expect(Math.max(...section.map(([, y]) => y))).toBeCloseTo(-0.25)
    expect(Math.min(...section.map(([, y]) => y))).toBeCloseTo(-2.25)
  })
})

describe('deckCrossSection', () => {
  // The displacement map needs vertices to move; a four-point outline leaves it
  // a no-op and the ground reads as a flat decal.
  it('subdivides the deck surface so the displacement map has vertices', () => {
    const topPoints = deckCrossSection(16, 1.2).filter(([, y]) => y === 0)

    expect(topPoints.length).toBeGreaterThan(2)
  })

  it.each([
    [10, 1],
    [16, 1.2],
    [24, 2]
  ])('spans exactly the width %f at thickness %f', (width, thickness) => {
    const xs = deckCrossSection(width, thickness).map(([x]) => x)
    const ys = deckCrossSection(width, thickness).map(([, y]) => y)

    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(width)
    expect(Math.min(...ys)).toBeCloseTo(-thickness)
    expect(Math.max(...ys)).toBe(0)
  })
})

describe('apronCrossSections', () => {
  it('starts exactly where the deck ends, so the surfaces cannot z-fight', () => {
    const [left, right] = apronCrossSections(16, 60)

    expect(Math.max(...left.map(([x]) => x))).toBeCloseTo(-8)
    expect(Math.min(...right.map(([x]) => x))).toBeCloseTo(8)
  })

  it('subdivides its surface so the displacement map has vertices', () => {
    const [left] = apronCrossSections(16, 60)

    expect(left.filter(([, y]) => y === -TERRAIN_DROP).length).toBeGreaterThan(2)
  })

  it('reaches out to half the terrain width', () => {
    const [left, right] = apronCrossSections(16, 60)

    expect(Math.min(...left.map(([x]) => x))).toBeCloseTo(-30)
    expect(Math.max(...right.map(([x]) => x))).toBeCloseTo(30)
  })

  it('sits below the deck surface', () => {
    const [left] = apronCrossSections(16, 60)

    expect(Math.max(...left.map(([, y]) => y))).toBeLessThan(0)
  })

  it('collapses rather than inverting when the terrain is narrower than the deck', () => {
    const [left, right] = apronCrossSections(60, 16)

    expect(Math.min(...left.map(([x]) => x))).toBeCloseTo(-30)
    expect(Math.max(...right.map(([x]) => x))).toBeCloseTo(30)
  })
})

// The swept terrain strip folds through itself wherever its half-width exceeds
// the path's turn radius, which showed up as z-fighting bands across the
// ground. Locking the relationship here keeps a later curve retune honest.
describe('terrain width against path curvature', () => {
  it('keeps the terrain half-width inside the tightest turn the path can make', () => {
    expect(TERRAIN_HALF_WIDTH).toBeLessThan(MIN_TURN_RADIUS)
  })

  it('derives the turn radius from the curve terms', () => {
    const expectedRate = CURVE_TERMS.reduce(
      (total, term) => total + (term.amplitude * 2 * Math.PI) / term.wavelength,
      0
    )

    expect(MIN_TURN_RADIUS).toBeCloseTo(1 / expectedRate)
  })

  it('never bends harder than that radius anywhere along a generated path', () => {
    const path = createTrackPath(4242)
    const stations = path.stationsBetween(0, 500)

    const headings = stations.slice(1).map((station, index) => {
      const previous = stations[index].origin
      return Math.atan2(station.origin.x - previous.x, -(station.origin.z - previous.z))
    })
    const rates = headings.slice(1).map((heading, index) => {
      const delta = heading - headings[index]
      return Math.abs(Math.atan2(Math.sin(delta), Math.cos(delta))) / STATION_SPACING
    })

    expect(1 / Math.max(...rates)).toBeGreaterThan(TERRAIN_HALF_WIDTH)
  })
})

describe('wallCrossSections', () => {
  it('places one wall just outside each deck edge', () => {
    const [left, right] = wallCrossSections(16, WALL)

    expect(Math.min(...left.map(([x]) => x))).toBeCloseTo(-9)
    expect(Math.max(...left.map(([x]) => x))).toBeCloseTo(-8)
    expect(Math.min(...right.map(([x]) => x))).toBeCloseTo(8)
    expect(Math.max(...right.map(([x]) => x))).toBeCloseTo(9)
  })

  it('rises from the deck surface to the wall height', () => {
    const [left] = wallCrossSections(16, WALL)
    const ys = left.map(([, y]) => y)

    expect(Math.min(...ys)).toBe(0)
    expect(Math.max(...ys)).toBe(WALL.height)
  })

  it('never overlaps the drivable deck', () => {
    const [left, right] = wallCrossSections(TRACK_WIDTH, WALL)

    expect(Math.max(...left.map(([x]) => x))).toBeLessThanOrEqual(-TRACK_WIDTH / 2)
    expect(Math.min(...right.map(([x]) => x))).toBeGreaterThanOrEqual(TRACK_WIDTH / 2)
  })
})

describe('chunkStationRange', () => {
  it.each([0, 1, 5, 42])('chunk %i spans exactly CHUNK_STATIONS stations', (chunkIndex) => {
    const [from, to] = chunkStationRange(chunkIndex)

    expect(to - from).toBe(CHUNK_STATIONS)
  })

  it('shares the boundary station with the next chunk so sweeps butt up', () => {
    const [, firstEnd] = chunkStationRange(0)
    const [secondStart] = chunkStationRange(1)

    expect(secondStart).toBe(firstEnd)
  })
})

describe('sweepGroundUvs', () => {
  it('emits one uv pair per swept vertex', () => {
    const section = deckCrossSection(16, 1.2)
    const uvs = sweepGroundUvs([0, 1, 2], section, 16)

    expect(uvs).toHaveLength(3 * section.length * 2 * 2)
  })

  it('advances v with the travelled distance so chunks tile continuously', () => {
    const section = deckCrossSection(16, 1.2)
    const perStation = section.length * 2 * 2

    const uvs = sweepGroundUvs([0, 1], section, 16)

    expect(uvs[1]).toBe(0)
    expect(uvs[perStation + 1]).toBeGreaterThan(0)
  })

  it('maps u across the full deck width', () => {
    const section = deckCrossSection(16, 1.2)
    const us = sweepGroundUvs([0], section, 16).filter((_, index) => index % 2 === 0)

    expect(Math.min(...us)).toBeCloseTo(0)
    expect(Math.max(...us)).toBeGreaterThan(0)
  })
})

describe('createTrackChunkManager', () => {
  const createManager = () => {
    const scene = new THREE.Scene()
    const { world, removeRigidBody, createCollider } = createWorldStub()
    const path = createTrackPath(2024)
    const manager = createTrackChunkManager({ scene, world, path, wall: WALL })
    return { scene, world, manager, removeRigidBody, createCollider }
  }

  it('spawns enough chunks to cover the lookahead', () => {
    const { manager, scene } = createManager()

    manager.ensureAhead(0)

    const decks = scene.children.filter((child) => child.name === 'track-ground')
    expect(decks).toHaveLength(EXPECTED_CHUNKS)
  })

  it('adds a deck collider and two wall colliders per chunk', () => {
    const { manager, createCollider } = createManager()

    manager.ensureAhead(0)

    expect(createCollider).toHaveBeenCalledTimes(EXPECTED_CHUNKS * 3)
  })

  it('does not respawn chunks that already cover the lookahead', () => {
    const { manager, scene } = createManager()

    manager.ensureAhead(0)
    const afterFirst = scene.children.length
    manager.ensureAhead(0)

    expect(scene.children.length).toBe(afterFirst)
  })

  it('extends the track as the rock advances', () => {
    const { manager, scene } = createManager()

    manager.ensureAhead(0)
    const before = scene.children.filter((child) => child.name === 'track-ground').length
    manager.ensureAhead(CHUNK_LENGTH * 4)

    const after = scene.children.filter((child) => child.name === 'track-ground').length
    expect(after).toBeGreaterThan(before)
  })

  it('disposes chunks that fall behind the keep-alive window', () => {
    const { manager, scene, removeRigidBody } = createManager()
    manager.ensureAhead(0)
    const before = scene.children.filter((child) => child.name === 'track-ground').length

    manager.prune(TRACK_DISPOSE_BEHIND + CHUNK_LENGTH * 3)

    const after = scene.children.filter((child) => child.name === 'track-ground').length
    expect(after).toBeLessThan(before)
    expect(removeRigidBody).toHaveBeenCalled()
  })

  it('keeps chunks still inside the keep-alive window', () => {
    const { manager, scene } = createManager()
    manager.ensureAhead(0)
    const before = scene.children.length

    manager.prune(0)

    expect(scene.children.length).toBe(before)
  })

  it('hides the walls until the elements panel reveals them', () => {
    const { manager, scene } = createManager()
    manager.ensureAhead(0)
    const walls = scene.children.filter((child) => child.name.startsWith('track-wall'))

    expect(walls.every((wall) => !wall.visible)).toBe(true)

    manager.setWallsVisible(true)

    expect(walls.every((wall) => wall.visible)).toBe(true)
  })

  it('applies newly revealed visibility to chunks spawned later', () => {
    const { manager, scene } = createManager()
    manager.setWallsVisible(true)

    manager.ensureAhead(0)

    const walls = scene.children.filter((child) => child.name.startsWith('track-wall'))
    expect(walls.every((wall) => wall.visible)).toBe(true)
  })

  it('rebuilds every chunk when the wall shape changes', () => {
    const { manager, scene, removeRigidBody } = createManager()
    manager.ensureAhead(0)

    manager.setWall({ height: 8, thickness: 2 }, 0)

    expect(removeRigidBody).toHaveBeenCalled()
    expect(scene.children.filter((child) => child.name === 'track-ground').length).toBe(
      EXPECTED_CHUNKS
    )
  })

  // The rock spawns at distance 0. With no ground behind it, half the ball
  // overhangs the very first edge and it rolls backwards into the void before
  // the countdown even ends.
  it('generates ground behind the origin so the rock cannot roll off the start', () => {
    const { manager, scene } = createManager()

    manager.ensureAhead(0)

    const decks = scene.children.filter((child) => child.name === 'track-ground')
    const bounds = decks.map((deck) => {
      deck.geometry.computeBoundingBox()
      return deck.geometry.boundingBox!
    })
    const path = createTrackPath(2024)
    const behind = path.sampleAt(-TRACK_BEHIND / 2).position

    expect(
      bounds.some((box) => box.min.z <= behind.z && box.max.z >= behind.z && box.min.x <= behind.x)
    ).toBe(true)
  })

  it('keeps the behind-track alive while the rock is still near the start', () => {
    const { manager, scene } = createManager()
    manager.ensureAhead(0)
    const before = scene.children.filter((child) => child.name === 'track-ground').length

    manager.prune(0)

    expect(scene.children.filter((child) => child.name === 'track-ground').length).toBe(before)
  })

  it('reports the ground height from the path', () => {
    const { manager } = createManager()
    const path = createTrackPath(2024)

    expect(manager.groundHeightAt(STATION_SPACING * 7)).toBeCloseTo(
      path.sampleAt(STATION_SPACING * 7).position.y
    )
  })

  it('clears the scene and the physics bodies on teardown', () => {
    const { manager, scene, removeRigidBody } = createManager()
    manager.ensureAhead(0)

    manager.teardown()

    expect(scene.children).toHaveLength(0)
    expect(removeRigidBody).toHaveBeenCalled()
  })
})
