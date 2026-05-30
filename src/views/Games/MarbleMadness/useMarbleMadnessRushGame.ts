import { ref, type Ref } from 'vue'
import * as THREE from 'three'
import {
  getTools,
  getBall,
  getCube,
  removeElements,
  moveDynamic,
  type ComplexModel
} from '@webgamekit/threejs'
import { createControls } from '@webgamekit/controls'
import type { ControlsExtras, ControlsCurrents } from '@webgamekit/controls'
import { createTimelineManager, type CoordinateTuple } from '@webgamekit/animation'
import {
  createCameraFollowAction,
  createDirectionalLightFollowAction,
  createPhysicsSyncAction,
  createFallCheckAction,
  createMeshFollowAction,
  type TimelineAction
} from '@/utils/gameTimelineActions'
import { attachBallStroke, addEdgeLinesToScene } from './marbleVisuals'
import {
  addGroundSphereToScene,
  registerGroundSphereProperties,
  teardownGroundSphere,
  createCloudChunkManager,
  type CloudChunkManager
} from './marbleEnvironment'
import {
  MARBLE_RADIUS,
  MARBLE_WEIGHT,
  MARBLE_RESTITUTION,
  MARBLE_FRICTION,
  MARBLE_LINEAR_DAMPING,
  MARBLE_ANGULAR_DAMPING,
  MOVE_FORCE,
  MAX_LINEAR_SPEED,
  CAMERA_HEIGHT,
  CAMERA_BACK,
  FALL_THRESHOLD_Y,
  KEYBOARD_MAPPING,
  LIGHT_AMBIENT_INTENSITY,
  LIGHT_DIRECTIONAL_INTENSITY,
  LIGHT_DIRECTIONAL_POSITION,
  LIGHT_SHADOW_RADIUS,
  LIGHT_SHADOW_BIAS,
  LIGHT_SHADOW_CAMERA,
  PLATFORM_HALF_HEIGHT,
  RUSH_COUNTDOWN,
  RUSH_TIME_BONUS,
  RUSH_FALL_PENALTY,
  RUSH_LOOKAHEAD_Z,
  RUSH_DISPOSE_BEHIND,
  RUSH_MAX_DIFFICULTY_DISTANCE,
  RUSH_BEST_KEY,
  RUSH_SPAWN,
  RUSH_PLATFORM_COLOR,
  RUSH_BRIDGE_COLOR,
  RUSH_OBSTACLE_COLOR,
  RUSH_PICKUP_COLOR,
  RUSH_PICKUP_RADIUS,
  RUSH_PICKUP_COLLECT_RADIUS,
  RUSH_SKY_COLOR,
  RUSH_FOG_DENSITY,
  RUSH_GAP_MIN,
  RUSH_GAP_MAX,
  RUSH_WIDE_X_DRIFT,
  RUSH_MEDIUM_X_DRIFT,
  RUSH_NARROW_X_DRIFT,
  RUSH_GAP_X_DRIFT,
  RUSH_MAX_X_OFFSET,
  RUSH_SLOPE_ANGLE,
  RUSH_SLOPE_LENGTH,
  RUSH_RAMP_ANGLE,
  RUSH_RAMP_LENGTH,
  RUSH_MIN_Y,
  RUSH_MAX_Y,
  RUSH_OBSTACLE_SIZE,
  RUSH_OBSTACLE_LIFT,
  RUSH_CLOUD_CHUNK_LENGTH,
  RUSH_CLOUD_LOOKAHEAD_Z,
  RUSH_CLOUD_DISPOSE_BEHIND,
  RUSH_CLOUD_COUNT_PER_CHUNK,
  RUSH_GROUND_FOLLOW_OFFSET_Z,
  RUSH_MOVING_PLATFORM_CHANCE,
  RUSH_MOVING_OBSTACLE_CHANCE,
  RUSH_MOVING_PICKUP_CHANCE,
  RUSH_PLATFORM_SWAY_X,
  RUSH_PLATFORM_BOB_Y,
  RUSH_OBSTACLE_SWAY,
  RUSH_PICKUP_SWAY,
  RUSH_PLATFORM_CYCLE_MS,
  RUSH_OBSTACLE_CYCLE_MS,
  RUSH_PICKUP_CYCLE_MS,
  type PlatformDefinition,
  type ObstacleDefinition
} from './config'

type UnwrapPromise<T> = T extends Promise<infer U> ? U : T
type GetToolsResult = UnwrapPromise<ReturnType<typeof getTools>>
type WorldReference = NonNullable<GetToolsResult['world']>

export type RushDeps = {
  canvas: Ref<HTMLCanvasElement | null>
  marble: Ref<string>
  onGameOver: () => void
}

type ChunkCursor = { z: number; x: number; y: number }

type MotionAxis = 'x' | 'y' | 'z'

type MotionSpec = {
  axis: MotionAxis
  amplitude: number
  cycleMs: number
  phaseOffset: number
}

type MotionState = MotionSpec & {
  base: { x: number; y: number; z: number }
}

type KinematicBody = {
  setNextKinematicTranslation: (pos: { x: number; y: number; z: number }) => void
}

type ChunkMotion = {
  body: KinematicBody | null
  mesh: THREE.Object3D
  state: MotionState
}

type RushPlatform = PlatformDefinition & { motion?: MotionSpec }
type RushObstacle = ObstacleDefinition & { motion?: MotionSpec }

type RushChunk = {
  id: number
  startZ: number
  endZ: number
  meshes: ComplexModel[]
  motions: ChunkMotion[]
  pickupMesh: THREE.Mesh | null
  pickupBaseY: number
  pickupBaseX: number
  pickupMotion: MotionState | null
  pickupCollected: boolean
}

type ChunkBuildResult = {
  platforms: RushPlatform[]
  obstacles?: RushObstacle[]
  chunkLength: number
  pickupCenterZ: number | null
  pickupY?: number
  pickupMotion?: MotionSpec
  maxXDrift: number
  nextY?: number
}

type RushReactives = {
  countdown: Ref<number>
  distance: Ref<number>
  bestDistance: Ref<number>
  isNewBest: Ref<boolean>
  finished: Ref<boolean>
  penaltyCount: Ref<number>
  pickupCount: Ref<number>
  currentActions: Ref<ControlsCurrents>
}

type RushGameState = {
  cleanup: (() => void) | null
  marble: ComplexModel | null
  light: THREE.DirectionalLight | null
  controls: ControlsExtras | null
  chunks: RushChunk[]
  cursor: ChunkCursor
  chunkId: number
  lastSafe: { x: number; y: number; z: number }
  groundSphereMesh: THREE.Mesh | null
  cloudManager: CloudChunkManager | null
}

const CAMERA_OFFSET: CoordinateTuple = [0, CAMERA_HEIGHT, CAMERA_BACK]
const INITIAL_CHUNK_Z_START = 4
const INITIAL_CHUNK_LENGTH = 28
const SAFE_Y_MIN = FALL_THRESHOLD_Y + 4
const SAFE_VEL_Y_MAX = 2

const pickupGeometry = new THREE.SphereGeometry(RUSH_PICKUP_RADIUS, 8, 8)
const pickupMaterial = new THREE.MeshStandardMaterial({
  color: RUSH_PICKUP_COLOR,
  emissive: RUSH_PICKUP_COLOR,
  emissiveIntensity: 0.5,
  roughness: 0.3,
  metalness: 0
})

const TWO_PI = Math.PI * 2

const randomPhase = (): number => Math.random() * TWO_PI

const rollPlatformMotion = (): MotionSpec | undefined => {
  if (Math.random() >= RUSH_MOVING_PLATFORM_CHANCE) return undefined
  const axis: MotionAxis = Math.random() < 0.7 ? 'x' : 'y'
  return {
    axis,
    amplitude: axis === 'x' ? RUSH_PLATFORM_SWAY_X : RUSH_PLATFORM_BOB_Y,
    cycleMs: RUSH_PLATFORM_CYCLE_MS,
    phaseOffset: randomPhase()
  }
}

const rollObstacleMotion = (): MotionSpec | undefined => {
  if (Math.random() >= RUSH_MOVING_OBSTACLE_CHANCE) return undefined
  return {
    axis: 'x',
    amplitude: RUSH_OBSTACLE_SWAY,
    cycleMs: RUSH_OBSTACLE_CYCLE_MS,
    phaseOffset: randomPhase()
  }
}

const rollPickupMotion = (): MotionSpec | undefined => {
  if (Math.random() >= RUSH_MOVING_PICKUP_CHANCE) return undefined
  return {
    axis: Math.random() < 0.5 ? 'x' : 'z',
    amplitude: RUSH_PICKUP_SWAY,
    cycleMs: RUSH_PICKUP_CYCLE_MS,
    phaseOffset: randomPhase()
  }
}

const computeMotionOffset = (state: MotionState, time: number): number =>
  state.amplitude * Math.sin((time / state.cycleMs) * TWO_PI + state.phaseOffset)

const buildWide = (cursor: ChunkCursor): ChunkBuildResult => {
  const length = 24
  return {
    platforms: [
      {
        size: [14, 1, length],
        position: [cursor.x, cursor.y, cursor.z - length / 2],
        color: RUSH_PLATFORM_COLOR,
        motion: rollPlatformMotion()
      }
    ],
    chunkLength: length,
    pickupCenterZ: Math.random() < 0.06 ? cursor.z - length / 2 : null,
    pickupY: cursor.y + 1.5,
    pickupMotion: rollPickupMotion(),
    maxXDrift: RUSH_WIDE_X_DRIFT
  }
}

const buildMedium = (cursor: ChunkCursor): ChunkBuildResult => {
  const length = 20
  return {
    platforms: [
      {
        size: [10, 1, length],
        position: [cursor.x, cursor.y, cursor.z - length / 2],
        color: RUSH_PLATFORM_COLOR,
        motion: rollPlatformMotion()
      }
    ],
    chunkLength: length,
    pickupCenterZ: Math.random() < 0.05 ? cursor.z - length / 2 : null,
    pickupY: cursor.y + 1.5,
    pickupMotion: rollPickupMotion(),
    maxXDrift: RUSH_MEDIUM_X_DRIFT
  }
}

const buildNarrow = (cursor: ChunkCursor, difficulty: number): ChunkBuildResult => {
  const width = Math.max(3, Math.round(7 - difficulty * 4))
  const length = 20
  return {
    platforms: [
      {
        size: [width, 1, length],
        position: [cursor.x, cursor.y, cursor.z - length / 2],
        color: RUSH_BRIDGE_COLOR,
        motion: rollPlatformMotion()
      }
    ],
    chunkLength: length,
    pickupCenterZ: Math.random() < 0.035 ? cursor.z - length / 2 : null,
    pickupY: cursor.y + 1.5,
    pickupMotion: rollPickupMotion(),
    maxXDrift: RUSH_NARROW_X_DRIFT
  }
}

const buildGap = (cursor: ChunkCursor, difficulty: number): ChunkBuildResult => {
  const gapSize = RUSH_GAP_MIN + difficulty * (RUSH_GAP_MAX - RUSH_GAP_MIN)
  const landingLength = 10
  const width = Math.max(6, Math.round(12 - difficulty * 6))
  const landingCenterZ = cursor.z - gapSize - landingLength / 2
  return {
    platforms: [
      {
        size: [width, 1, landingLength],
        position: [cursor.x, cursor.y, landingCenterZ],
        color: RUSH_PLATFORM_COLOR,
        motion: rollPlatformMotion()
      }
    ],
    chunkLength: gapSize + landingLength,
    pickupCenterZ: Math.random() < 0.1 ? landingCenterZ : null,
    pickupY: cursor.y + 1.5,
    pickupMotion: rollPickupMotion(),
    maxXDrift: RUSH_GAP_X_DRIFT
  }
}

const buildSlopeDown = (cursor: ChunkCursor): ChunkBuildResult => {
  const length = RUSH_SLOPE_LENGTH
  const angle = RUSH_SLOPE_ANGLE
  const drop = length * Math.sin(angle)
  const centerY = cursor.y - (length / 2) * Math.sin(angle)
  const centerZ = cursor.z - length / 2
  return {
    platforms: [
      {
        size: [7, 1, length],
        position: [cursor.x, centerY, centerZ],
        color: RUSH_BRIDGE_COLOR,
        rotation: [-angle, 0, 0]
      }
    ],
    chunkLength: length,
    pickupCenterZ: Math.random() < 0.04 ? centerZ : null,
    pickupY: centerY + 1.5,
    pickupMotion: rollPickupMotion(),
    nextY: Math.max(RUSH_MIN_Y, cursor.y - drop),
    maxXDrift: RUSH_NARROW_X_DRIFT
  }
}

const buildSlopeUp = (cursor: ChunkCursor): ChunkBuildResult => {
  const length = RUSH_SLOPE_LENGTH
  const angle = RUSH_SLOPE_ANGLE
  const rise = length * Math.sin(angle)
  const centerY = cursor.y + (length / 2) * Math.sin(angle)
  const centerZ = cursor.z - length / 2
  return {
    platforms: [
      {
        size: [7, 1, length],
        position: [cursor.x, centerY, centerZ],
        color: RUSH_BRIDGE_COLOR,
        rotation: [angle, 0, 0]
      }
    ],
    chunkLength: length,
    pickupCenterZ: Math.random() < 0.04 ? centerZ : null,
    pickupY: centerY + 1.5,
    pickupMotion: rollPickupMotion(),
    nextY: Math.min(RUSH_MAX_Y, cursor.y + rise),
    maxXDrift: RUSH_NARROW_X_DRIFT
  }
}

const buildRamp = (cursor: ChunkCursor): ChunkBuildResult => {
  const length = RUSH_RAMP_LENGTH
  const angle = RUSH_RAMP_ANGLE
  const rise = length * Math.sin(angle)
  const centerY = cursor.y + (length / 2) * Math.sin(angle)
  const centerZ = cursor.z - length / 2
  return {
    platforms: [
      {
        size: [8, 1, length],
        position: [cursor.x, centerY, centerZ],
        color: RUSH_BRIDGE_COLOR,
        rotation: [angle, 0, 0]
      }
    ],
    chunkLength: length,
    pickupCenterZ: Math.random() < 0.1 ? centerZ : null,
    pickupY: centerY + 1.5,
    pickupMotion: rollPickupMotion(),
    nextY: Math.min(RUSH_MAX_Y, cursor.y + rise),
    maxXDrift: RUSH_WIDE_X_DRIFT
  }
}

const buildObstacleCorridor = (cursor: ChunkCursor, difficulty: number): ChunkBuildResult => {
  const length = 22
  const obstacleCount = 2 + Math.floor(difficulty * 2)
  const spacing = length / (obstacleCount + 1)
  const obstacles: RushObstacle[] = Array.from({ length: obstacleCount }, (_, i) => {
    const offsetZ = -(spacing * (i + 1))
    const offsetX = (i % 2 === 0 ? -1 : 1) * (1.5 + Math.random())
    return {
      size: RUSH_OBSTACLE_SIZE,
      position: [cursor.x + offsetX, cursor.y + RUSH_OBSTACLE_LIFT, cursor.z + offsetZ],
      motion: rollObstacleMotion()
    }
  })
  return {
    platforms: [
      {
        size: [11, 1, length],
        position: [cursor.x, cursor.y, cursor.z - length / 2],
        color: RUSH_PLATFORM_COLOR,
        motion: rollPlatformMotion()
      }
    ],
    obstacles,
    chunkLength: length,
    pickupCenterZ: Math.random() < 0.1 ? cursor.z - length / 2 : null,
    pickupY: cursor.y + 1.5,
    pickupMotion: rollPickupMotion(),
    maxXDrift: RUSH_MEDIUM_X_DRIFT
  }
}

const computeNextX = (currentX: number, maxDrift: number): number => {
  const drift = (Math.random() * 2 - 1) * maxDrift
  const next = currentX + drift
  if (next > RUSH_MAX_X_OFFSET) return RUSH_MAX_X_OFFSET * 2 - next
  if (next < -RUSH_MAX_X_OFFSET) return -RUSH_MAX_X_OFFSET * 2 - next
  return next
}

type ChunkWeight = { threshold: number; type: string }

const TIER_EASY: ChunkWeight[] = [
  { threshold: 0.45, type: 'wide' },
  { threshold: 0.75, type: 'medium' },
  { threshold: 0.9, type: 'slope-down' },
  { threshold: 1, type: 'obstacle' }
]

const TIER_MEDIUM: ChunkWeight[] = [
  { threshold: 0.2, type: 'wide' },
  { threshold: 0.4, type: 'medium' },
  { threshold: 0.55, type: 'narrow' },
  { threshold: 0.65, type: 'gap' },
  { threshold: 0.8, type: 'slope-down' },
  { threshold: 0.9, type: 'ramp' },
  { threshold: 1, type: 'obstacle' }
]

const TIER_HARD: ChunkWeight[] = [
  { threshold: 0.12, type: 'medium' },
  { threshold: 0.32, type: 'narrow' },
  { threshold: 0.5, type: 'gap' },
  { threshold: 0.65, type: 'slope-down' },
  { threshold: 0.8, type: 'ramp' },
  { threshold: 0.95, type: 'slope-up' },
  { threshold: 1, type: 'obstacle' }
]

const TIER_EXPERT: ChunkWeight[] = [
  { threshold: 0.22, type: 'narrow' },
  { threshold: 0.45, type: 'gap' },
  { threshold: 0.65, type: 'ramp' },
  { threshold: 0.8, type: 'slope-down' },
  { threshold: 0.92, type: 'slope-up' },
  { threshold: 1, type: 'obstacle' }
]

const pickTier = (difficulty: number): ChunkWeight[] => {
  if (difficulty < 0.25) return TIER_EASY
  if (difficulty < 0.5) return TIER_MEDIUM
  if (difficulty < 0.75) return TIER_HARD
  return TIER_EXPERT
}

const selectChunkType = (difficulty: number, cursor: ChunkCursor): string => {
  if (cursor.y <= RUSH_MIN_Y + 0.5) return Math.random() < 0.5 ? 'ramp' : 'slope-up'
  const r = Math.random()
  const tier = pickTier(difficulty)
  return tier.find((entry) => r < entry.threshold)?.type ?? tier[tier.length - 1].type
}

const buildChunkResult = (cursor: ChunkCursor, difficulty: number): ChunkBuildResult => {
  const type = selectChunkType(difficulty, cursor)
  if (type === 'wide') return buildWide(cursor)
  if (type === 'medium') return buildMedium(cursor)
  if (type === 'narrow') return buildNarrow(cursor, difficulty)
  if (type === 'slope-down') return buildSlopeDown(cursor)
  if (type === 'slope-up') return buildSlopeUp(cursor)
  if (type === 'ramp') return buildRamp(cursor)
  if (type === 'obstacle') return buildObstacleCorridor(cursor, difficulty)
  return buildGap(cursor, difficulty)
}

type SpawnedChunkParts = { meshes: ComplexModel[]; motions: ChunkMotion[] }

const toMotionState = (motion: MotionSpec, position: CoordinateTuple): MotionState => ({
  ...motion,
  base: { x: position[0], y: position[1], z: position[2] }
})

const spawnPlatform = (
  scene: THREE.Scene,
  world: WorldReference,
  platform: RushPlatform
): { mesh: ComplexModel; motion: ChunkMotion | null } => {
  const { size, position, rotation, color, motion } = platform
  const mesh = getCube(scene, world, {
    size: size as CoordinateTuple,
    position: position as CoordinateTuple,
    rotation: rotation as CoordinateTuple | undefined,
    type: motion ? 'kinematicPositionBased' : 'fixed',
    color,
    friction: MARBLE_FRICTION,
    restitution: MARBLE_RESTITUTION
  })
  const motionEntry = motion
    ? { body: mesh.userData.body as KinematicBody, mesh, state: toMotionState(motion, position) }
    : null
  return { mesh, motion: motionEntry }
}

const spawnObstacle = (
  scene: THREE.Scene,
  world: WorldReference,
  obstacle: RushObstacle
): { mesh: ComplexModel; motion: ChunkMotion | null } => {
  const { size, position, motion } = obstacle
  const mesh = getCube(scene, world, {
    size: size as CoordinateTuple,
    position: position as CoordinateTuple,
    type: motion ? 'kinematicPositionBased' : 'fixed',
    color: RUSH_OBSTACLE_COLOR,
    friction: 0.5,
    restitution: 0.1
  })
  const motionEntry = motion
    ? { body: mesh.userData.body as KinematicBody, mesh, state: toMotionState(motion, position) }
    : null
  return { mesh, motion: motionEntry }
}

const spawnChunkParts = (
  scene: THREE.Scene,
  world: WorldReference,
  platforms: RushPlatform[],
  obstacles: RushObstacle[] = []
): SpawnedChunkParts => {
  const spawned = [
    ...platforms.map((p) => spawnPlatform(scene, world, p)),
    ...obstacles.map((o) => spawnObstacle(scene, world, o))
  ]
  return {
    meshes: spawned.map((s) => s.mesh),
    motions: spawned.flatMap((s) => (s.motion ? [s.motion] : []))
  }
}

const spawnPickupMesh = (scene: THREE.Scene, x: number, y: number, centerZ: number): THREE.Mesh => {
  const mesh = new THREE.Mesh(pickupGeometry, pickupMaterial)
  mesh.position.set(x, y, centerZ)
  mesh.castShadow = true
  scene.add(mesh)
  return mesh
}

const spawnNextChunk = (
  scene: THREE.Scene,
  world: WorldReference,
  state: RushGameState,
  difficulty: number
): void => {
  const result = buildChunkResult(state.cursor, difficulty)
  const { meshes, motions } = spawnChunkParts(scene, world, result.platforms, result.obstacles)
  const endZ = state.cursor.z - result.chunkLength
  const pickupY = result.pickupY ?? state.cursor.y + 1.5
  const pickupMesh =
    result.pickupCenterZ !== null
      ? spawnPickupMesh(scene, state.cursor.x, pickupY, result.pickupCenterZ)
      : null
  const pickupMotion =
    pickupMesh && result.pickupMotion
      ? toMotionState(result.pickupMotion, [
          state.cursor.x,
          pickupY,
          result.pickupCenterZ as number
        ])
      : null
  state.chunks.push({
    id: state.chunkId,
    startZ: state.cursor.z,
    endZ,
    meshes,
    motions,
    pickupMesh,
    pickupBaseY: pickupMesh?.position.y ?? 0,
    pickupBaseX: pickupMesh?.position.x ?? 0,
    pickupMotion,
    pickupCollected: pickupMesh === null
  })
  state.cursor = {
    z: endZ,
    x: computeNextX(state.cursor.x, result.maxXDrift),
    y: result.nextY ?? state.cursor.y
  }
  state.chunkId += 1
  addEdgeLinesToScene(scene)
}

const disposeChunk = (world: WorldReference, chunk: RushChunk): void => {
  removeElements(world, chunk.meshes)
  if (chunk.pickupMesh) chunk.pickupMesh.removeFromParent()
}

const pruneOldChunks = (world: WorldReference, state: RushGameState, marbleZ: number): void => {
  const toDispose = state.chunks.filter((c) => marbleZ < c.endZ - RUSH_DISPOSE_BEHIND)
  toDispose.forEach((c) => disposeChunk(world, c))
  state.chunks = state.chunks.filter((c) => marbleZ >= c.endZ - RUSH_DISPOSE_BEHIND)
}

const ensureChunksAhead = (
  scene: THREE.Scene,
  world: WorldReference,
  state: RushGameState,
  marbleZ: number,
  difficulty: number
): void => {
  if (state.cursor.z <= marbleZ - RUSH_LOOKAHEAD_Z) return
  spawnNextChunk(scene, world, state, difficulty)
  ensureChunksAhead(scene, world, state, marbleZ, difficulty)
}

const animatePickups = (chunks: RushChunk[], time: number): void => {
  chunks.forEach((chunk) => {
    if (!chunk.pickupMesh || chunk.pickupCollected) return
    chunk.pickupMesh.position.y = chunk.pickupBaseY + Math.sin(time / 400) * 0.3
    chunk.pickupMesh.rotation.y = time / 600
    if (chunk.pickupMotion) {
      const offset = computeMotionOffset(chunk.pickupMotion, time)
      if (chunk.pickupMotion.axis === 'x') {
        chunk.pickupMesh.position.x = chunk.pickupBaseX + offset
      } else if (chunk.pickupMotion.axis === 'z') {
        chunk.pickupMesh.position.z = chunk.pickupMotion.base.z + offset
      }
    }
  })
}

const applyChunkMotions = (chunks: RushChunk[], time: number): void => {
  chunks.forEach((chunk) => {
    chunk.motions.forEach((entry) => {
      const offset = computeMotionOffset(entry.state, time)
      const pos = { x: entry.state.base.x, y: entry.state.base.y, z: entry.state.base.z }
      pos[entry.state.axis] += offset
      entry.body?.setNextKinematicTranslation(pos)
      entry.mesh.position.set(pos.x, pos.y, pos.z)
    })
  })
}

const createChunkMotionAction = (getChunks: () => RushChunk[]): TimelineAction => ({
  name: 'chunk-motion',
  category: 'physics',
  start: 0,
  action: () => applyChunkMotions(getChunks(), Date.now())
})

const createPickupAnimationAction = (getChunks: () => RushChunk[]): TimelineAction => ({
  name: 'pickup-animation',
  category: 'visual',
  start: 0,
  action: () => animatePickups(getChunks(), Date.now())
})

const checkPickupCollection = (
  chunks: RushChunk[],
  marblePos: THREE.Vector3,
  countdown: Ref<number>,
  pickupCount: Ref<number>
): void => {
  chunks.forEach((chunk) => {
    if (chunk.pickupCollected || !chunk.pickupMesh) return
    if (marblePos.distanceTo(chunk.pickupMesh.position) < RUSH_PICKUP_COLLECT_RADIUS) {
      chunk.pickupMesh.removeFromParent()
      chunk.pickupMesh = null
      chunk.pickupCollected = true
      countdown.value = Math.min(countdown.value + RUSH_TIME_BONUS, RUSH_COUNTDOWN * 2)
      pickupCount.value += 1
    }
  })
}

const updateLastSafePosition = (
  state: RushGameState,
  marblePos: THREE.Vector3,
  velY: number
): void => {
  if (marblePos.y > SAFE_Y_MIN && Math.abs(velY) < SAFE_VEL_Y_MAX) {
    state.lastSafe = { x: marblePos.x, y: marblePos.y, z: marblePos.z }
  }
}

const respawnAtLastSafe = (
  marble: ComplexModel,
  lastSafe: { x: number; y: number; z: number }
): void => {
  const body = marble.userData.body
  body.setTranslation({ x: lastSafe.x, y: lastSafe.y + 1, z: lastSafe.z }, true)
  body.setLinvel({ x: 0, y: 0, z: 0 }, true)
  body.setAngvel({ x: 0, y: 0, z: 0 }, true)
}

const computeImpulse = (actions: ControlsCurrents) => ({
  x: ('left' in actions ? -MOVE_FORCE : 0) + ('right' in actions ? MOVE_FORCE : 0),
  y: 0,
  z: ('forward' in actions ? -MOVE_FORCE : 0) + ('backward' in actions ? MOVE_FORCE : 0)
})

const getRushSceneConfig = () => ({
  camera: {
    position: [
      RUSH_SPAWN[0],
      RUSH_SPAWN[1] + CAMERA_HEIGHT,
      RUSH_SPAWN[2] + CAMERA_BACK
    ] as CoordinateTuple
  },
  lights: {
    ambient: { color: 0xffffff, intensity: LIGHT_AMBIENT_INTENSITY },
    directional: {
      color: 0xffffff,
      intensity: LIGHT_DIRECTIONAL_INTENSITY,
      position: LIGHT_DIRECTIONAL_POSITION,
      castShadow: true,
      shadow: {
        mapSize: { width: 2048, height: 2048 },
        camera: LIGHT_SHADOW_CAMERA,
        bias: LIGHT_SHADOW_BIAS,
        radius: LIGHT_SHADOW_RADIUS
      }
    }
  },
  ground: false as const,
  sky: false as const,
  orbit: false as const
})

const initRushScene = async (
  canvas: HTMLCanvasElement,
  deps: RushDeps,
  state: RushGameState,
  reactives: RushReactives
): Promise<void> => {
  const tools = await getTools({ canvas })
  state.cleanup = tools.cleanup
  const { scene, world, camera, getDelta, animate } = tools
  await tools.setup({ config: getRushSceneConfig() })

  scene.background = new THREE.Color(RUSH_SKY_COLOR)
  scene.fog = new THREE.FogExp2(RUSH_SKY_COLOR, RUSH_FOG_DENSITY)
  state.light = scene.children.find(
    (c) => c instanceof THREE.DirectionalLight
  ) as THREE.DirectionalLight | null

  state.controls = createControls({ mapping: KEYBOARD_MAPPING })
  reactives.currentActions.value = state.controls.currentActions as unknown as ControlsCurrents

  const initial = spawnChunkParts(scene, world, [
    {
      size: [14, 1, INITIAL_CHUNK_LENGTH],
      position: [0, 0, INITIAL_CHUNK_Z_START - INITIAL_CHUNK_LENGTH / 2],
      color: RUSH_PLATFORM_COLOR
    }
  ])
  state.chunks.push({
    id: 0,
    startZ: INITIAL_CHUNK_Z_START,
    endZ: INITIAL_CHUNK_Z_START - INITIAL_CHUNK_LENGTH,
    meshes: initial.meshes,
    motions: initial.motions,
    pickupMesh: null,
    pickupBaseY: 0,
    pickupBaseX: 0,
    pickupMotion: null,
    pickupCollected: true
  })
  state.cursor = { z: INITIAL_CHUNK_Z_START - INITIAL_CHUNK_LENGTH, x: 0, y: 0 }
  state.chunkId = 1

  state.marble = getBall(scene, world, {
    size: MARBLE_RADIUS,
    position: RUSH_SPAWN,
    restitution: MARBLE_RESTITUTION,
    friction: MARBLE_FRICTION,
    weight: MARBLE_WEIGHT,
    texture: deps.marble.value,
    roughness: 0.08,
    metalness: 0.2,
    segments: 48,
    type: 'dynamic'
  }) as unknown as ComplexModel
  state.marble.userData.body.setLinearDamping(MARBLE_LINEAR_DAMPING)
  state.marble.userData.body.setAngularDamping(MARBLE_ANGULAR_DAMPING)
  attachBallStroke(state.marble as unknown as THREE.Mesh)
  addEdgeLinesToScene(scene)

  state.cloudManager = createCloudChunkManager(scene, world, {
    chunkLength: RUSH_CLOUD_CHUNK_LENGTH,
    countPerChunk: RUSH_CLOUD_COUNT_PER_CHUNK,
    lookaheadZ: RUSH_CLOUD_LOOKAHEAD_Z,
    disposeBehindZ: RUSH_CLOUD_DISPOSE_BEHIND
  })
  state.cloudManager.ensureAhead(RUSH_SPAWN[2])
  state.groundSphereMesh = addGroundSphereToScene(scene)
  registerGroundSphereProperties(state.groundSphereMesh)

  const timeline = createTimelineManager()
  timeline.addAction(createChunkMotionAction(() => state.chunks))
  timeline.addAction(createPhysicsSyncAction(() => state.marble, PLATFORM_HALF_HEIGHT))
  timeline.addAction(createCameraFollowAction(camera, () => state.marble, CAMERA_OFFSET))
  timeline.addAction(
    createDirectionalLightFollowAction(
      () => state.light,
      () => state.marble,
      LIGHT_DIRECTIONAL_POSITION
    )
  )
  timeline.addAction(createPickupAnimationAction(() => state.chunks))
  timeline.addAction(
    createMeshFollowAction(
      () => state.groundSphereMesh,
      () => state.marble,
      RUSH_GROUND_FOLLOW_OFFSET_Z
    )
  )
  timeline.addAction(
    createFallCheckAction(
      () => state.marble,
      FALL_THRESHOLD_Y,
      () => {
        if (reactives.finished.value) return
        reactives.countdown.value = Math.max(0, reactives.countdown.value - RUSH_FALL_PENALTY)
        reactives.penaltyCount.value += 1
        if (state.marble) respawnAtLastSafe(state.marble, state.lastSafe)
      }
    )
  )

  const spawnZ = RUSH_SPAWN[2]
  animate({
    beforeTimeline: () => {
      if (reactives.finished.value) return
      const delta = getDelta()
      reactives.countdown.value = Math.max(0, reactives.countdown.value - delta)
      if (reactives.countdown.value <= 0) {
        reactives.finished.value = true
        const finalDistance = reactives.distance.value
        if (finalDistance > reactives.bestDistance.value) {
          reactives.isNewBest.value = true
          reactives.bestDistance.value = finalDistance
          localStorage.setItem(RUSH_BEST_KEY, String(finalDistance))
        }
        deps.onGameOver()
        return
      }
      if (state.marble) {
        const pos = state.marble.position
        reactives.distance.value = Math.max(reactives.distance.value, Math.max(0, spawnZ - pos.z))
        const velY = state.marble.userData.body?.linvel?.()?.y ?? 0
        updateLastSafePosition(state, pos, velY)
        checkPickupCollection(state.chunks, pos, reactives.countdown, reactives.pickupCount)
        const difficulty = Math.min(1, reactives.distance.value / RUSH_MAX_DIFFICULTY_DISTANCE)
        pruneOldChunks(world, state, pos.z)
        ensureChunksAhead(scene, world, state, pos.z, difficulty)
        if (state.cloudManager) {
          state.cloudManager.ensureAhead(pos.z)
          state.cloudManager.prune(pos.z)
        }
      }
      if (state.controls && state.marble) {
        const impulse = computeImpulse(state.controls.currentActions)
        if (impulse.x !== 0 || impulse.z !== 0) moveDynamic(state.marble, impulse, MAX_LINEAR_SPEED)
      }
    },
    timeline
  })
}

const makeInitialState = (): RushGameState => ({
  cleanup: null,
  marble: null,
  light: null,
  controls: null,
  chunks: [],
  cursor: { z: INITIAL_CHUNK_Z_START - INITIAL_CHUNK_LENGTH, x: 0, y: 0 },
  chunkId: 0,
  lastSafe: { x: RUSH_SPAWN[0], y: RUSH_SPAWN[1], z: RUSH_SPAWN[2] },
  groundSphereMesh: null,
  cloudManager: null
})

export const useMarbleMadnessRushGame = (deps: RushDeps) => {
  const countdown = ref(RUSH_COUNTDOWN)
  const distance = ref(0)
  const bestDistance = ref<number>(parseInt(localStorage.getItem(RUSH_BEST_KEY) ?? '0', 10))
  const isNewBest = ref(false)
  const finished = ref(false)
  const penaltyCount = ref(0)
  const pickupCount = ref(0)
  const currentActions = ref<ControlsCurrents>({})

  const reactives: RushReactives = {
    countdown,
    distance,
    bestDistance,
    isNewBest,
    finished,
    penaltyCount,
    pickupCount,
    currentActions
  }
  let state = makeInitialState()

  const init = (): void => {
    if (deps.canvas.value)
      initRushScene(deps.canvas.value, deps, state, reactives).catch(console.error)
  }

  const destroy = (): void => {
    state.controls?.destroyControls()
    if (state.cleanup) {
      state.cloudManager?.teardown()
      teardownGroundSphere()
      state.cleanup()
    }
    state = makeInitialState()
    countdown.value = RUSH_COUNTDOWN
    distance.value = 0
    isNewBest.value = false
    finished.value = false
    penaltyCount.value = 0
    pickupCount.value = 0
    currentActions.value = {}
  }

  return {
    countdown,
    distance,
    bestDistance,
    isNewBest,
    finished,
    penaltyCount,
    pickupCount,
    currentActions,
    init,
    destroy
  }
}
