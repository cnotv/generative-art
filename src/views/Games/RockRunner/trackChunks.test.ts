import { describe, it, expect, vi } from 'vitest'
import * as THREE from 'three'
import RAPIER from '@dimforge/rapier3d-compat'
import {
  deckCrossSection,
  deckWithWallsCrossSection,
  slabCrossSection,
  apronCrossSections,
  wallCrossSections,
  chunkStationRange,
  sweepGroundUvs,
  createTrackChunkManager
} from './trackChunks'
import { createTrackPath } from './trackPath'
import { createLateralFogUniforms } from './lateralFog'
import {
  CHUNK_STATIONS,
  CHUNK_LENGTH,
  COLLIDER_OVERLAP_STATIONS,
  TRACK_BEHIND,
  CURVE_TERMS,
  MIN_TURN_RADIUS,
  STATION_SPACING,
  TERRAIN_DROP,
  ROCK_RADIUS,
  TERRAIN_HALF_WIDTH,
  TRACK_LOOKAHEAD,
  TRACK_DISPOSE_BEHIND,
  TRACK_WIDTH,
  WALL_INSET
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
  // The deck is a flat colour with no displacement, so it needs no extra
  // vertices across its width.
  it('stays at the minimum outline', () => {
    const topPoints = deckCrossSection(16, 1.2).filter(([, y]) => y === 0)

    expect(topPoints).toHaveLength(2)
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

describe('deckWithWallsCrossSection', () => {
  it('is one closed outline spanning both walls and the deck between them', () => {
    const section = deckWithWallsCrossSection(16, WALL, 1.2)
    const inner = 8 + WALL_INSET

    expect(Math.min(...section.map(([x]) => x))).toBeCloseTo(-inner - WALL.thickness)
    expect(Math.max(...section.map(([x]) => x))).toBeCloseTo(inner + WALL.thickness)
  })

  it('keeps the deck surface flat between the two walls', () => {
    const section = deckWithWallsCrossSection(16, WALL, 1.2)
    const deckPoints = section.filter(([, y]) => y === 0)

    expect(deckPoints).toHaveLength(2)
    expect(deckPoints[0][0]).toBeCloseTo(-(8 + WALL_INSET))
    expect(deckPoints[1][0]).toBeCloseTo(8 + WALL_INSET)
  })

  it('rises to the wall height at both edges and drops to the slab underneath', () => {
    const section = deckWithWallsCrossSection(16, WALL, 1.2)

    expect(Math.max(...section.map(([, y]) => y))).toBe(WALL.height)
    expect(Math.min(...section.map(([, y]) => y))).toBeCloseTo(-1.2)
  })

  // Room to steer around something rather than only along the middle: the rock
  // has to fit across the lane several times over.
  it('leaves a drivable span at least three rock widths across', () => {
    const section = deckWithWallsCrossSection(TRACK_WIDTH, WALL, 1.2)
    const drivable = section.filter(([, y]) => y === 0)

    expect(drivable[1][0] - drivable[0][0]).toBeGreaterThan(ROCK_RADIUS * 2 * 3)
  })
})

describe('wallCrossSections', () => {
  it('places one wall along each deck edge, thickness outward', () => {
    const [left, right] = wallCrossSections(16, WALL)
    const inner = 8 + WALL_INSET

    expect(Math.max(...left.map(([x]) => x))).toBeCloseTo(-inner)
    expect(Math.min(...left.map(([x]) => x))).toBeCloseTo(-inner - WALL.thickness)
    expect(Math.min(...right.map(([x]) => x))).toBeCloseTo(inner)
    expect(Math.max(...right.map(([x]) => x))).toBeCloseTo(inner + WALL.thickness)
  })

  // A wall starting exactly at deck level leaves a concave corner the rolling
  // rock catches in and stops dead against. Starting below the deck surface
  // gives it a flat face to slide along instead.
  it('starts below the deck surface so no concave corner is left at the seam', () => {
    const [left] = wallCrossSections(16, WALL)

    expect(Math.min(...left.map(([, y]) => y))).toBeLessThan(0)
  })

  it('rises to the full wall height', () => {
    const [left] = wallCrossSections(16, WALL)

    expect(Math.max(...left.map(([, y]) => y))).toBe(WALL.height)
  })

  it('intrudes onto the deck by far less than the rock could notice', () => {
    const [, right] = wallCrossSections(TRACK_WIDTH, WALL)
    const intrusion = TRACK_WIDTH / 2 - Math.min(...right.map(([x]) => x))

    expect(intrusion).toBeGreaterThanOrEqual(0)
    expect(intrusion).toBeLessThan(ROCK_RADIUS)
  })

  it('leaves the rock a drivable width at least three rock widths across', () => {
    const [, right] = wallCrossSections(TRACK_WIDTH, WALL)
    const drivable = Math.min(...right.map(([x]) => x)) * 2

    expect(drivable).toBeGreaterThan(ROCK_RADIUS * 2 * 3)
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
    const manager = createTrackChunkManager({
      scene,
      world,
      path,
      wall: WALL,
      lateralFog: createLateralFogUniforms(0xffffff, 20, 40)
    })
    return { scene, world, manager, removeRigidBody, createCollider }
  }

  it('spawns enough chunks to cover the lookahead', () => {
    const { manager, scene } = createManager()

    manager.ensureAhead(0)

    const decks = scene.children.filter((child) => child.name === 'track-ground')
    expect(decks).toHaveLength(EXPECTED_CHUNKS)
  })

  // Deck and walls are one swept collider, not three that meet: Rapier only
  // corrects contact normals across a mesh's own internal edges, so a junction
  // between separate colliders is where a ball catches or is punted through.
  it('gives each chunk a single collider covering deck and walls together', () => {
    const { manager, createCollider } = createManager()

    manager.ensureAhead(0)

    expect(createCollider).toHaveBeenCalledTimes(EXPECTED_CHUNKS)
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

  // A single pump only ever builds one chunk, so a frame that has fallen
  // behind (a slow device, a big hitch) never has to pay for several trimesh
  // colliders at once — it catches up one chunk per subsequent call instead.
  it('pump builds at most one chunk per call, however far behind it is', () => {
    const { manager, scene } = createManager()

    manager.pump(0)

    const decks = scene.children.filter((child) => child.name === 'track-ground')
    expect(decks).toHaveLength(1)
  })

  it('pump reaches full lookahead coverage after enough calls', () => {
    const { manager, scene } = createManager()

    Array.from({ length: EXPECTED_CHUNKS }).forEach(() => manager.pump(0))

    const decks = scene.children.filter((child) => child.name === 'track-ground')
    expect(decks).toHaveLength(EXPECTED_CHUNKS)
  })

  it('pump does nothing once the lookahead is already covered', () => {
    const { manager, scene } = createManager()
    Array.from({ length: EXPECTED_CHUNKS }).forEach(() => manager.pump(0))
    const afterFull = scene.children.length

    manager.pump(0)

    expect(scene.children.length).toBe(afterFull)
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

  it('rebuilds at the new widths when the track dimensions change', () => {
    const { manager, scene, removeRigidBody } = createManager()
    manager.ensureAhead(0)
    const before = scene.children.find((child) => child.name === 'track-ground') as THREE.Mesh
    before.geometry.computeBoundingBox()
    const beforeWidth = before.geometry.boundingBox!.max.x - before.geometry.boundingBox!.min.x

    manager.setDimensions({ trackWidth: 30, terrainWidth: 80 }, 0)

    const after = scene.children.find((child) => child.name === 'track-ground') as THREE.Mesh
    after.geometry.computeBoundingBox()
    const afterWidth = after.geometry.boundingBox!.max.x - after.geometry.boundingBox!.min.x
    expect(afterWidth).toBeGreaterThan(beforeWidth)
    expect(removeRigidBody).toHaveBeenCalled()
  })

  it('widens the side ground independently of the path', () => {
    const { manager, scene } = createManager()
    manager.ensureAhead(0)

    manager.setDimensions({ trackWidth: TRACK_WIDTH, terrainWidth: 90 }, 0)

    const terrain = scene.children.find((child) => child.name === 'terrain-right') as THREE.Mesh
    terrain.geometry.computeBoundingBox()
    expect(terrain.geometry.boundingBox!.max.x).toBeGreaterThan(40)
  })

  it('bakes the distance from the centreline onto the terrain for the side fog', () => {
    const { manager, scene } = createManager()

    manager.ensureAhead(0)

    const terrain = scene.children.find((child) => child.name === 'terrain-left') as THREE.Mesh
    const offsets = terrain.geometry.getAttribute('lateralOffset')
    expect(offsets).toBeDefined()
    expect(offsets.count).toBe(terrain.geometry.getAttribute('position').count)
  })

  // Chunks are separate colliders and Rapier only smooths normals inside one
  // mesh, so butting them exactly leaves a junction the rock catches on.
  it('reaches each collider past its chunk so neighbours overlap', () => {
    const { manager, world } = createManager()
    const path = createTrackPath(2024)

    manager.ensureAhead(0)

    const [from, to] = chunkStationRange(0)
    const spanned = path.stationsBetween(
      from - COLLIDER_OVERLAP_STATIONS,
      to + COLLIDER_OVERLAP_STATIONS
    )
    const plain = path.stationsBetween(from, to)
    expect(spanned.length).toBeGreaterThan(plain.length)
    expect(world.createCollider).toHaveBeenCalled()
  })

  it('keeps the visible deck butting exactly, so surfaces cannot z-fight', () => {
    const { manager, scene } = createManager()
    manager.ensureAhead(0)

    const decks = scene.children
      .filter((child) => child.name === 'track-ground')
      .map((deck) => {
        deck.geometry.computeBoundingBox()
        return deck.geometry.boundingBox!
      })

    // Every deck spans exactly one chunk length along the path, no more.
    decks.forEach((box) => {
      const span = Math.hypot(box.max.x - box.min.x, box.max.z - box.min.z)
      expect(span).toBeLessThan(CHUNK_LENGTH + TRACK_WIDTH * 2)
    })
  })

  it('tints every live chunk of side ground at once', () => {
    const { manager, scene } = createManager()
    manager.ensureAhead(0)

    manager.setTerrainTint(0xd39a92)

    const strips = scene.children.filter((child) =>
      child.name.startsWith('terrain-')
    ) as THREE.Mesh[]
    expect(strips.length).toBeGreaterThan(1)
    strips.forEach((strip) =>
      expect((strip.material as THREE.MeshStandardMaterial).color.getHex()).toBe(0xd39a92)
    )
  })

  it('tints chunks spawned after the change too', () => {
    const { manager, scene } = createManager()
    manager.setTerrainTint(0xd9c096)

    manager.ensureAhead(0)

    const strip = scene.children.find((child) => child.name === 'terrain-left') as THREE.Mesh
    expect((strip.material as THREE.MeshStandardMaterial).color.getHex()).toBe(0xd9c096)
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
