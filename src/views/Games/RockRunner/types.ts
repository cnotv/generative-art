import type * as THREE from 'three'
import type { SweepStation } from '@/types/sweptGeometry'

/** One term of the sine sum that shapes the track's heading or height. */
export type PathTerm = {
  amplitude: number
  wavelength: number
}

/** The path evaluated at one distance: where it is and how it is oriented. */
export type TrackSample = {
  position: THREE.Vector3
  forward: THREE.Vector3
  right: THREE.Vector3
  yaw: number
}

/** A seeded centerline, sampled by distance travelled along it. */
export type TrackPath = {
  seed: number
  spacing: number
  stationAt: (index: number) => SweepStation
  stationsBetween: (fromIndex: number, toIndex: number) => SweepStation[]
  sampleAt: (distance: number) => TrackSample
  indexAt: (distance: number) => number
}

/** Width of the drivable deck and of the countryside strip flanking it. */
export type TrackDimensions = {
  trackWidth: number
  terrainWidth: number
  /** Base thickness of the drawn edge, before its own variation. */
  strokeWidth: number
  /** Multiplier on how far that edge wanders; zero rules it straight. */
  strokeWander: number
}

/** Uniforms shared by every material that fades sideways into the fog. */
export type LateralFogUniforms = {
  lateralFogColor: { value: THREE.Color }
  lateralFogNear: { value: number }
  lateralFogFar: { value: number }
}

/** Distance-fade settings for the scene, shared with the sky colour. */
export type FogConfig = {
  color: number
  near: number
  far: number
  sideNear: number
  sideFar: number
}

/** One term of a sine sum, used for the drawn edge's wander and thickness. */
export type StrokeTerm = {
  amplitude: number
  wavelength: number
}

export type StrokeTerms = StrokeTerm[]

/** Where one edge stroke's inner and outer sides sit at a station. */
export type StrokeShape = {
  inner: number
  outer: number
}

/** Height and thickness of the invisible containment walls flanking the deck. */
export type WallConfig = {
  height: number
  thickness: number
}

/** One generated stretch of ground: its meshes, its physics and where it sits on the path. */
export type TrackChunk = {
  startDistance: number
  endDistance: number
  mesh: THREE.Mesh
  wallMeshes: THREE.Mesh[]
  dispose: () => void
}

/** Spawns ground ahead of the rock and disposes it behind. */
export type TrackChunkManager = {
  ensureAhead: (distance: number) => void
  prune: (distance: number) => void
  rebuild: (distance: number) => void
  setWall: (wall: WallConfig, distance: number) => void
  setDimensions: (dimensions: TrackDimensions, distance: number) => void
  setTerrainTint: (color: number) => void
  setWallsVisible: (visible: boolean) => void
  groundHeightAt: (distance: number) => number
  /** The deck width currently built, which the panel can change mid-run. */
  deckWidth: () => number
  teardown: () => void
}

/**
 * Where an area scatters relative to the track: beside it, on its surface, or
 * across both.
 */
export type ScatterPlacement = 'sides' | 'track' | 'everywhere'

/** One illustration family dressed onto the world through a texture area. */
export type ScatterAreaDefinition = {
  name: string
  label: string
  textures: ScatterTexture[]
  placement: ScatterPlacement
  frequency: number
  distanceMin: number
  distanceMax: number
  heightOffset: number
  baseSize: [number, number, number]
  variation: [number, number, number]
  /**
   * Illustrations to draw from as the run goes on, one entry per stage of
   * SCATTER_STAGE_LENGTH. The last is held once the rock is past it. Areas
   * without stages keep `textures` throughout.
   */
  textureStages?: ScatterTexture[][]
  /** Fraction of the base size, defaulting to SCATTER_SIZE_VARIATION. */
  sizeVariation?: number
  /** Degrees off the local heading, defaulting to SCATTER_ROTATION_VARIATION. */
  rotationVariation?: number
  seed: number
}

/** A single billboard the scatter maths decided to place. */
export type ScatterInstance = {
  distance: number
  /** Signed offset from the track centreline, used by the lateral fog. */
  lateral: number
  position: THREE.Vector3
  yaw: number
  width: number
  height: number
  textureIndex: number
}

/** One texture an area can draw from, matching the Textures panel's shape. */
export type ScatterTexture = {
  id: string
  name: string
  filename: string
  url: string
}

/** One generated stretch of an area's billboards, one instanced mesh per texture. */
export type ScatterChunk = {
  startDistance: number
  endDistance: number
  meshes: THREE.InstancedMesh[]
}

/** Live scatter for one area, advancing with the rock. */
export type ScatterAreaManager = {
  name: string
  ensureAhead: (distance: number) => void
  prune: (distance: number) => void
  rebuild: (distance: number) => void
  setHidden: (hidden: boolean) => void
  instanceCount: () => number
  teardown: () => void
}

/**
 * Tunable values the elements panel edits for a scatter area.
 *
 * `center` and `variation` are the standard texture-area `area.center` and
 * `area.size` controls: an offset applied to every instance, and a per-axis
 * random spread. X is lateral, Y is vertical and Z runs along the track.
 */
export type ScatterAreaConfig = {
  center: [number, number, number]
  variation: [number, number, number]
  baseSize: [number, number, number]
  sizeVariation: number
  rotationVariation: number
  frequency: number
  distanceMin: number
  distanceMax: number
  heightOffset: number
  seed: number
  opacity: number
}

/** One pooled debris chip thrown up behind the rock. */
export type DebrisParticle = {
  position: THREE.Vector3
  velocity: THREE.Vector3
  life: number
  maxLife: number
  size: number
  angle: number
  spin: number
  colorIndex: number
}

/** Timers deciding whether a press becomes a jump this frame. */
export type JumpGate = {
  /** Seconds a press stays remembered while the rock is still airborne. */
  buffer: number
  /** Seconds the rock still counts as grounded after leaving the deck. */
  coyote: number
  cooldown: number
}

/** Every tunable the rock is driven and simulated with, editable from the panel. */
export type RockConfig = {
  forwardImpulse: number
  baseMaxSpeed: number
  maxSpeedCeiling: number
  speedRampDistance: number
  steerImpulse: number
  maxLateralSpeed: number
  jumpImpulse: number
  jumpCooldown: number
  radius: number
  gravityScale: number
  mass: number
  strokeWidth: number
  strokeWobble: number
  friction: number
  restitution: number
  linearDamping: number
  angularDamping: number
  tint: number
}

export type DebrisEmitOptions = {
  origin: THREE.Vector3
  forward: THREE.Vector3
  right: THREE.Vector3
  /** Three values in [0, 1) driving spread, size, spin and colour. */
  samples: [number, number, number]
  /** Seconds the chip lives, which is what sets how far the trail reaches back. */
  lifetime: number
}

/** A pooled trail of debris drawn as two instanced meshes, fill and stroke. */
export type DebrisField = {
  emit: (options: DebrisEmitOptions) => void
  update: (delta: number) => void
  shouldEmit: (delta: number, interval: number) => boolean
  liveCount: () => number
  teardown: () => void
}

export type CameraMode = 'first' | 'third' | 'free'

export type RrPhase = 'lobby' | 'run' | 'summary'

export type RrPlayer = {
  id: string
  name: string
  color: string
  distance: number
}

export type RockPosPayload = {
  x: number
  y: number
  z: number
  rx: number
  ry: number
  rz: number
  rw: number
  d: number
}

export type RrAvatarPayload = {
  name: string
  color: string
}

export type RrStartPayload = {
  timestamp: number
  seed: number
}

export type RrDistancePayload = {
  playerId: string
  distance: number
}

export type UseRockRunnerSessionOptions = {
  name: string
  color: string
  roomId: string
}

export type RrSessionCallbacks = {
  onRockPos: (peerId: string, pos: RockPosPayload) => void
  onSeedReceived: (seed: number) => void
}
