import * as THREE from 'three'
import RAPIER from '@dimforge/rapier3d-compat'
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js'
import { buildSweepGeometry, geometryWorldTriangles } from '@/utils/sweptGeometry'
import type { CrossSection, SweepStation } from '@/types/sweptGeometry'
import groundTextureUrl from '@/assets/images/illustrations/ground.webp'
import type { TrackPath, TrackChunk, TrackChunkManager, TrackDimensions, WallConfig } from './types'
import {
  CHUNK_LENGTH,
  CHUNK_STATIONS,
  DECK_COLOR,
  DECK_FRICTION,
  DECK_SEGMENTS_ACROSS,
  DECK_RESTITUTION,
  DECK_THICKNESS,
  GROUND_BUMP_SCALE,
  GROUND_DISPLACEMENT_BIAS,
  GROUND_DISPLACEMENT_SCALE,
  GROUND_TEXTURE_REPEAT_ACROSS,
  GROUND_TEXTURE_REPEAT_ALONG,
  STATION_SPACING,
  TERRAIN_DROP,
  TERRAIN_SEGMENTS_ACROSS,
  TERRAIN_THICKNESS,
  TERRAIN_TINT,
  TERRAIN_WIDTH,
  TRACK_BEHIND,
  TRACK_DISPOSE_BEHIND,
  TRACK_LOOKAHEAD,
  TRACK_CONTACT_SKIN,
  TRACK_WIDTH,
  WALL_FRICTION,
  WALL_INSET,
  WALL_RESTITUTION
} from './config'

const IDENTITY_MATRIX = new THREE.Matrix4()

// The walls start below the deck surface so their face runs past the seam: a
// wall that begins exactly at deck level leaves a concave corner for the rock
// to catch in.
const WALL_BASE = -DECK_THICKNESS

/**
 * Closed outline of a ground slab: a flat surface of `width` sitting on a base
 * of `thickness`, with its surface at `top`. Wound the same way as the marble
 * editor's lane profile so the face normals point up and Rapier's
 * FIX_INTERNAL_EDGES resolves contacts across chunk seams.
 *
 * @param width - Surface width
 * @param thickness - How deep the slab sits below its surface
 * @param top - Height of the surface relative to the station
 * @returns The closed cross-section outline
 */
export const slabCrossSection = (
  width: number,
  thickness: number,
  top = 0,
  segments = 1
): CrossSection => [
  [-width / 2, top - thickness],
  // The top edge is subdivided so the displacement map has vertices to push
  // around: a four-point outline would leave it a no-op and the ground would
  // read as a flat decal.
  ...Array.from({ length: Math.max(1, segments) + 1 }, (_, index) => [
    -width / 2 + (width * index) / Math.max(1, segments),
    top
  ]),
  [width / 2, top - thickness]
]

/**
 * The drivable deck's outline.
 *
 * @param width - Deck width
 * @param thickness - How deep the slab sits below the deck surface
 * @returns The closed cross-section outline
 */
export const deckCrossSection = (width: number, thickness: number): CrossSection =>
  slabCrossSection(width, thickness, 0, DECK_SEGMENTS_ACROSS)

/**
 * Outlines for the two containment walls, one per track edge. They sit just
 * outside the deck so the rock is stopped before its contact patch leaves the
 * ground it is rolling on.
 *
 * @param width - Deck width the walls flank
 * @param wall - Wall height and thickness
 * @returns The left and right wall outlines, in that order
 */
export const wallCrossSections = (width: number, wall: WallConfig): CrossSection[] => {
  const inner = width / 2 + WALL_INSET
  const outer = inner + wall.thickness
  return [
    [
      [-outer, WALL_BASE],
      [-outer, wall.height],
      [-inner, wall.height],
      [-inner, WALL_BASE]
    ],
    [
      [inner, WALL_BASE],
      [inner, wall.height],
      [outer, wall.height],
      [outer, WALL_BASE]
    ]
  ]
}

/**
 * The station index range one chunk spans. Consecutive chunks share their
 * boundary station, so the swept slabs butt up exactly with no seam.
 *
 * @param chunkIndex - Zero-based chunk number
 * @returns The first and last station index of the chunk
 */
export const chunkStationRange = (chunkIndex: number): [number, number] => [
  chunkIndex * CHUNK_STATIONS,
  (chunkIndex + 1) * CHUNK_STATIONS
]

/**
 * UVs matching the vertex order `sweepPositions` emits: the texture runs across
 * the deck in U and along the travelled distance in V, so the ground tiles
 * continuously from one chunk into the next.
 *
 * @param stationIndices - Absolute station index of each swept station
 * @param crossSection - Outline being swept
 * @param width - Surface width used to normalise U
 * @param repeatAcross - How many times the texture tiles across the width
 * @returns Flat u, v pairs, one per emitted vertex
 */
export const sweepGroundUvs = (
  stationIndices: number[],
  crossSection: CrossSection,
  width: number,
  repeatAcross: number = GROUND_TEXTURE_REPEAT_ACROSS
): number[] =>
  stationIndices.flatMap((stationIndex) => {
    const v = stationIndex * STATION_SPACING * GROUND_TEXTURE_REPEAT_ALONG
    return crossSection.flatMap((current, pointIndex) => {
      const nextPoint = crossSection[(pointIndex + 1) % crossSection.length]
      return [current, nextPoint].flatMap(([x]) => [((x + width / 2) / width) * repeatAcross, v])
    })
  })

/**
 * Merges coincident vertices and recomputes normals, so a displaced surface
 * cannot split along its own internal seams.
 *
 * @param geometry - Swept geometry to weld in place of the original
 * @returns The welded geometry; the source is disposed
 */
export const weldForDisplacement = (geometry: THREE.BufferGeometry): THREE.BufferGeometry => {
  // mergeVertices compares every attribute, and the sweep has already given
  // coincident vertices differing normals — so the normals must go before the
  // merge, then be recomputed from the welded topology.
  geometry.deleteAttribute('normal')
  const welded = mergeVertices(geometry)
  welded.computeVertexNormals()
  if (welded !== geometry) geometry.dispose()
  return welded
}

const createGroundTexture = (): THREE.Texture => {
  const texture = new THREE.TextureLoader().load(groundTextureUrl)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

type ChunkBuildContext = {
  scene: THREE.Scene
  world: RAPIER.World
  path: TrackPath
  material: THREE.Material
  terrainMaterial: THREE.Material
  wall: WallConfig
  width: number
  terrainWidth: number
}

/**
 * Outlines for the countryside flanking the deck, one strip per side.
 *
 * They start exactly where the deck ends rather than spanning underneath it, so
 * the two surfaces share no depth range and cannot z-fight.
 *
 * @param deckWidth - Width of the drivable deck the strips flank
 * @param terrainWidth - Total span of deck plus both strips
 * @returns The left and right strip outlines, in that order
 */
export const apronCrossSections = (deckWidth: number, terrainWidth: number): CrossSection[] => {
  const inner = deckWidth / 2
  const outer = Math.max(inner, terrainWidth / 2)
  const top = -TERRAIN_DROP
  const bottom = top - TERRAIN_THICKNESS
  const topEdge = (from: number, to: number): CrossSection =>
    Array.from({ length: TERRAIN_SEGMENTS_ACROSS + 1 }, (_, index) => [
      from + ((to - from) * index) / TERRAIN_SEGMENTS_ACROSS,
      top
    ])
  return [
    [[-outer, bottom], ...topEdge(-outer, -inner), [-inner, bottom]],
    [[inner, bottom], ...topEdge(inner, outer), [outer, bottom]]
  ]
}

// The countryside the scatter stands on. It carries no collider, so it can
// never catch the rock, and it is disposed with the chunk that owns it.
const buildTerrainMeshes = (
  context: ChunkBuildContext,
  stations: SweepStation[],
  stationIndices: number[]
): THREE.Mesh[] =>
  apronCrossSections(context.width, context.terrainWidth).map((crossSection, index) => {
    const swept = buildSweepGeometry(stations, crossSection)
    const stripWidth = Math.max(1, (context.terrainWidth - context.width) / 2)
    // UVs must be assigned before welding: they are emitted in the sweep's own
    // vertex order, which welding collapses.
    swept.setAttribute(
      'uv',
      new THREE.Float32BufferAttribute(
        sweepGroundUvs(
          stationIndices,
          crossSection,
          context.terrainWidth,
          (stripWidth / context.width) * GROUND_TEXTURE_REPEAT_ACROSS
        ),
        2
      )
    )
    // Welded before displacement: the sweep gives every profile edge its own
    // vertex pair, so coincident vertices carry different normals. Displacement
    // moves each along its own normal, prising the pairs apart into hairline
    // cracks you can see the sky through. Welding shares one normal per point,
    // so both sides of a seam move together.
    const geometry = weldForDisplacement(swept)
    const mesh = new THREE.Mesh(geometry, context.terrainMaterial)
    mesh.name = `terrain-${index === 0 ? 'left' : 'right'}`
    mesh.receiveShadow = true
    context.scene.add(mesh)
    return mesh
  })

const buildDeckMesh = (context: ChunkBuildContext, stations: SweepStation[]): THREE.Mesh => {
  const crossSection = deckCrossSection(context.width, DECK_THICKNESS)
  // No UVs: the deck is a flat colour, so there is nothing to sample.
  const geometry = buildSweepGeometry(stations, crossSection)
  const mesh = new THREE.Mesh(geometry, context.material)
  mesh.name = 'track-ground'
  mesh.receiveShadow = true
  context.scene.add(mesh)
  return mesh
}

// The walls are built as real meshes kept invisible: the elements panel entry
// can reveal them for debugging without the runner ever seeing a boundary.
const buildWallMeshes = (context: ChunkBuildContext, stations: SweepStation[]): THREE.Mesh[] =>
  wallCrossSections(context.width, context.wall).map((crossSection, index) => {
    const mesh = new THREE.Mesh(
      buildSweepGeometry(stations, crossSection),
      new THREE.MeshBasicMaterial({
        color: 0xff5577,
        transparent: true,
        opacity: 0.35,
        side: THREE.DoubleSide
      })
    )
    mesh.name = `track-wall-${index === 0 ? 'left' : 'right'}`
    mesh.visible = false
    context.scene.add(mesh)
    return mesh
  })

const addTrimeshCollider = (
  world: RAPIER.World,
  body: RAPIER.RigidBody,
  geometry: THREE.BufferGeometry,
  friction: number,
  restitution: number
): void => {
  const vertices = new Float32Array(geometryWorldTriangles(geometry, IDENTITY_MATRIX))
  const indices = Uint32Array.from({ length: vertices.length / 3 }, (_, index) => index)
  world.createCollider(
    RAPIER.ColliderDesc.trimesh(vertices, indices, RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES)
      .setFriction(friction)
      .setRestitution(restitution)
      .setContactSkin(TRACK_CONTACT_SKIN),
    body
  )
}

const buildChunk = (context: ChunkBuildContext, chunkIndex: number): TrackChunk => {
  const [fromIndex, toIndex] = chunkStationRange(chunkIndex)
  const stationIndices = Array.from(
    { length: toIndex - fromIndex + 1 },
    (_, offset) => fromIndex + offset
  )
  const stations = context.path.stationsBetween(fromIndex, toIndex)
  const mesh = buildDeckMesh(context, stations)
  const terrainMeshes = buildTerrainMeshes(context, stations, stationIndices)
  const wallMeshes = buildWallMeshes(context, stations)

  const body = context.world.createRigidBody(RAPIER.RigidBodyDesc.fixed())
  addTrimeshCollider(context.world, body, mesh.geometry, DECK_FRICTION, DECK_RESTITUTION)
  wallMeshes.forEach((wallMesh) =>
    addTrimeshCollider(context.world, body, wallMesh.geometry, WALL_FRICTION, WALL_RESTITUTION)
  )

  return {
    startDistance: fromIndex * STATION_SPACING,
    endDistance: toIndex * STATION_SPACING,
    mesh,
    wallMeshes,
    dispose: () => {
      context.world.removeRigidBody(body)
      ;[mesh, ...terrainMeshes, ...wallMeshes].forEach((chunkMesh) => {
        context.scene.remove(chunkMesh)
        chunkMesh.geometry.dispose()
      })
      wallMeshes.forEach((wallMesh) => {
        if (wallMesh.material instanceof THREE.Material) wallMesh.material.dispose()
      })
    }
  }
}

export type TrackChunkManagerOptions = {
  scene: THREE.Scene
  world: RAPIER.World
  path: TrackPath
  wall: WallConfig
  width?: number
  terrainWidth?: number
}

/**
 * Generates the ground ahead of the rock and disposes it behind, so an endless
 * track never holds more than a bounded number of meshes and collider bodies.
 *
 * @param options - Scene, physics world, path and wall configuration
 * @returns Handles to pump, prune, rebuild and tear down the ground
 */
export const createTrackChunkManager = (options: TrackChunkManagerOptions): TrackChunkManager => {
  const groundTexture = createGroundTexture()
  const material = new THREE.MeshStandardMaterial({ color: DECK_COLOR, roughness: 1 })
  // The surrounding countryside is the same ground, shaded down a little so the
  // drivable deck still reads as a path through it.
  const terrainMaterial = new THREE.MeshStandardMaterial({
    map: groundTexture,
    displacementMap: groundTexture,
    displacementScale: GROUND_DISPLACEMENT_SCALE,
    displacementBias: GROUND_DISPLACEMENT_BIAS,
    bumpMap: groundTexture,
    bumpScale: GROUND_BUMP_SCALE,
    roughness: 1,
    color: TERRAIN_TINT
  })
  const context: ChunkBuildContext = {
    scene: options.scene,
    world: options.world,
    path: options.path,
    material,
    terrainMaterial,
    wall: { ...options.wall },
    width: options.width ?? TRACK_WIDTH,
    terrainWidth: options.terrainWidth ?? TERRAIN_WIDTH
  }

  let chunks: TrackChunk[] = []
  let wallsVisible = false

  const nextChunkIndex = (): number =>
    chunks.length === 0
      ? Math.floor(-TRACK_BEHIND / CHUNK_LENGTH)
      : Math.round(chunks[chunks.length - 1].endDistance / CHUNK_LENGTH)

  const spawnNext = (): void => {
    const chunk = buildChunk(context, nextChunkIndex())
    chunk.wallMeshes.forEach((wallMesh) => {
      wallMesh.visible = wallsVisible
    })
    chunks = [...chunks, chunk]
  }

  // Recursive rather than a loop: one chunk per call until the lookahead is
  // covered, matching how the cloud chunk manager pumps itself.
  const ensureAhead = (distance: number): void => {
    if ((chunks[chunks.length - 1]?.endDistance ?? -TRACK_BEHIND) >= distance + TRACK_LOOKAHEAD)
      return
    spawnNext()
    ensureAhead(distance)
  }

  const prune = (distance: number): void => {
    const cutoff = distance - TRACK_DISPOSE_BEHIND
    chunks.filter((chunk) => chunk.endDistance < cutoff).forEach((chunk) => chunk.dispose())
    chunks = chunks.filter((chunk) => chunk.endDistance >= cutoff)
  }

  const disposeAll = (): void => {
    chunks.forEach((chunk) => chunk.dispose())
    chunks = []
  }

  const rebuild = (distance: number): void => {
    disposeAll()
    ensureAhead(distance)
  }

  const setWall = (wall: WallConfig, distance: number): void => {
    context.wall = { ...wall }
    rebuild(distance)
  }

  const setDimensions = (dimensions: TrackDimensions, distance: number): void => {
    context.width = dimensions.trackWidth
    context.terrainWidth = dimensions.terrainWidth
    rebuild(distance)
  }

  const setWallsVisible = (visible: boolean): void => {
    wallsVisible = visible
    chunks.forEach((chunk) =>
      chunk.wallMeshes.forEach((wallMesh) => {
        wallMesh.visible = visible
      })
    )
  }

  return {
    ensureAhead,
    prune,
    rebuild,
    setWall,
    setDimensions,
    setWallsVisible,
    groundHeightAt: (distance: number) => options.path.sampleAt(distance).position.y,
    teardown: () => {
      disposeAll()
      material.dispose()
      terrainMaterial.dispose()
      groundTexture.dispose()
    }
  }
}
