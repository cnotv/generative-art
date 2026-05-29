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
  createFallCheckAction
} from '@/utils/gameTimelineActions'
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
  RUSH_PICKUP_COLOR,
  RUSH_PICKUP_RADIUS,
  RUSH_PICKUP_COLLECT_RADIUS,
  RUSH_SKY_COLOR,
  RUSH_FOG_DENSITY,
  type PlatformDefinition
} from './config'

type UnwrapPromise<T> = T extends Promise<infer U> ? U : T
type GetToolsResult = UnwrapPromise<ReturnType<typeof getTools>>
type WorldReference = NonNullable<GetToolsResult['world']>

export type RushDeps = {
  canvas: Ref<HTMLCanvasElement | null>
  marble: Ref<string>
  onGameOver: () => void
}

type ChunkCursor = { z: number; x: number }

type RushChunk = {
  id: number
  startZ: number
  endZ: number
  meshes: ComplexModel[]
  pickupMesh: THREE.Mesh | null
  pickupBaseY: number
  pickupCollected: boolean
}

type ChunkBuildResult = {
  platforms: PlatformDefinition[]
  chunkLength: number
  pickupCenterZ: number | null
}

type RushReactives = {
  countdown: Ref<number>
  distance: Ref<number>
  bestDistance: Ref<number>
  isNewBest: Ref<boolean>
  finished: Ref<boolean>
  penaltyCount: Ref<number>
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

const buildWide = (cursor: ChunkCursor): ChunkBuildResult => {
  const length = 24
  return {
    platforms: [
      {
        size: [14, 1, length],
        position: [cursor.x, 0, cursor.z - length / 2],
        color: RUSH_PLATFORM_COLOR
      }
    ],
    chunkLength: length,
    pickupCenterZ: Math.random() < 0.6 ? cursor.z - length / 2 : null
  }
}

const buildMedium = (cursor: ChunkCursor): ChunkBuildResult => {
  const length = 20
  return {
    platforms: [
      {
        size: [10, 1, length],
        position: [cursor.x, 0, cursor.z - length / 2],
        color: RUSH_PLATFORM_COLOR
      }
    ],
    chunkLength: length,
    pickupCenterZ: Math.random() < 0.5 ? cursor.z - length / 2 : null
  }
}

const buildNarrow = (cursor: ChunkCursor, difficulty: number): ChunkBuildResult => {
  const width = Math.max(3, Math.round(7 - difficulty * 4))
  const length = 20
  return {
    platforms: [
      {
        size: [width, 1, length],
        position: [cursor.x, 0, cursor.z - length / 2],
        color: RUSH_BRIDGE_COLOR
      }
    ],
    chunkLength: length,
    pickupCenterZ: Math.random() < 0.35 ? cursor.z - length / 2 : null
  }
}

const buildGap = (cursor: ChunkCursor, difficulty: number): ChunkBuildResult => {
  const gapSize = 1.5 + difficulty * 2.5
  const landingLength = 10
  const width = Math.max(6, Math.round(12 - difficulty * 6))
  const landingCenterZ = cursor.z - gapSize - landingLength / 2
  return {
    platforms: [
      {
        size: [width, 1, landingLength],
        position: [cursor.x, 0, landingCenterZ],
        color: RUSH_PLATFORM_COLOR
      }
    ],
    chunkLength: gapSize + landingLength,
    pickupCenterZ: landingCenterZ
  }
}

const selectChunkType = (difficulty: number): string => {
  const r = Math.random()
  if (difficulty < 0.25) return r < 0.65 ? 'wide' : 'medium'
  if (difficulty < 0.5) return r < 0.3 ? 'wide' : r < 0.65 ? 'medium' : r < 0.85 ? 'narrow' : 'gap'
  if (difficulty < 0.75) return r < 0.15 ? 'medium' : r < 0.55 ? 'narrow' : 'gap'
  return r < 0.3 ? 'narrow' : 'gap'
}

const buildChunkResult = (cursor: ChunkCursor, difficulty: number): ChunkBuildResult => {
  const type = selectChunkType(difficulty)
  if (type === 'wide') return buildWide(cursor)
  if (type === 'medium') return buildMedium(cursor)
  if (type === 'narrow') return buildNarrow(cursor, difficulty)
  return buildGap(cursor, difficulty)
}

const spawnChunkMeshes = (
  scene: THREE.Scene,
  world: WorldReference,
  platforms: PlatformDefinition[]
): ComplexModel[] =>
  platforms.map(({ size, position, rotation, color }) =>
    getCube(scene, world, {
      size: size as CoordinateTuple,
      position: position as CoordinateTuple,
      rotation: rotation as CoordinateTuple | undefined,
      type: 'fixed',
      color,
      friction: MARBLE_FRICTION,
      restitution: MARBLE_RESTITUTION
    })
  )

const spawnPickupMesh = (scene: THREE.Scene, x: number, y: number, centerZ: number): THREE.Mesh => {
  const mesh = new THREE.Mesh(pickupGeometry, pickupMaterial)
  mesh.position.set(x, y + 1.5, centerZ)
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
  const meshes = spawnChunkMeshes(scene, world, result.platforms)
  const endZ = state.cursor.z - result.chunkLength
  const pickupMesh =
    result.pickupCenterZ !== null
      ? spawnPickupMesh(scene, state.cursor.x, 0, result.pickupCenterZ)
      : null
  state.chunks.push({
    id: state.chunkId,
    startZ: state.cursor.z,
    endZ,
    meshes,
    pickupMesh,
    pickupBaseY: pickupMesh?.position.y ?? 0,
    pickupCollected: pickupMesh === null
  })
  state.cursor = { z: endZ, x: state.cursor.x }
  state.chunkId += 1
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
    if (chunk.pickupMesh && !chunk.pickupCollected) {
      chunk.pickupMesh.position.y = chunk.pickupBaseY + Math.sin(time / 400) * 0.3
      chunk.pickupMesh.rotation.y = time / 600
    }
  })
}

const checkPickupCollection = (
  chunks: RushChunk[],
  marblePos: THREE.Vector3,
  countdown: Ref<number>
): void => {
  chunks.forEach((chunk) => {
    if (chunk.pickupCollected || !chunk.pickupMesh) return
    if (marblePos.distanceTo(chunk.pickupMesh.position) < RUSH_PICKUP_COLLECT_RADIUS) {
      chunk.pickupMesh.removeFromParent()
      chunk.pickupMesh = null
      chunk.pickupCollected = true
      countdown.value = Math.min(countdown.value + RUSH_TIME_BONUS, RUSH_COUNTDOWN * 2)
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
  camera: { position: [0, CAMERA_HEIGHT, CAMERA_BACK] as CoordinateTuple, fov: 60 },
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
  state.controls.onAction((action, actionState) => {
    if (actionState === 'start')
      reactives.currentActions.value = { ...reactives.currentActions.value, [action]: true }
    else {
      const next = { ...reactives.currentActions.value }
      delete next[action]
      reactives.currentActions.value = next
    }
  })

  const initialMeshes = spawnChunkMeshes(scene, world, [
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
    meshes: initialMeshes,
    pickupMesh: null,
    pickupBaseY: 0,
    pickupCollected: true
  })
  state.cursor = { z: INITIAL_CHUNK_Z_START - INITIAL_CHUNK_LENGTH, x: 0 }
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

  const timeline = createTimelineManager()
  timeline.addAction(createPhysicsSyncAction(() => state.marble, PLATFORM_HALF_HEIGHT))
  timeline.addAction(createCameraFollowAction(camera, () => state.marble, CAMERA_OFFSET))
  timeline.addAction(
    createDirectionalLightFollowAction(
      () => state.light,
      () => state.marble,
      LIGHT_DIRECTIONAL_POSITION
    )
  )
  timeline.addAction(
    createFallCheckAction(
      () => state.marble,
      FALL_THRESHOLD_Y,
      () => {
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
        checkPickupCollection(state.chunks, pos, reactives.countdown)
        const difficulty = Math.min(1, reactives.distance.value / RUSH_MAX_DIFFICULTY_DISTANCE)
        pruneOldChunks(world, state, pos.z)
        ensureChunksAhead(scene, world, state, pos.z, difficulty)
        animatePickups(state.chunks, Date.now())
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
  cursor: { z: INITIAL_CHUNK_Z_START - INITIAL_CHUNK_LENGTH, x: 0 },
  chunkId: 0,
  lastSafe: { x: RUSH_SPAWN[0], y: RUSH_SPAWN[1], z: RUSH_SPAWN[2] }
})

export const useMarbleMadnessRushGame = (deps: RushDeps) => {
  const countdown = ref(RUSH_COUNTDOWN)
  const distance = ref(0)
  const bestDistance = ref<number>(parseInt(localStorage.getItem(RUSH_BEST_KEY) ?? '0', 10))
  const isNewBest = ref(false)
  const finished = ref(false)
  const penaltyCount = ref(0)
  const currentActions = ref<ControlsCurrents>({})

  const reactives: RushReactives = {
    countdown,
    distance,
    bestDistance,
    isNewBest,
    finished,
    penaltyCount,
    currentActions
  }
  let state = makeInitialState()

  const init = (): void => {
    if (deps.canvas.value) initRushScene(deps.canvas.value, deps, state, reactives)
  }

  const destroy = (): void => {
    state.controls?.destroyControls()
    if (state.cleanup) state.cleanup()
    state = makeInitialState()
    countdown.value = RUSH_COUNTDOWN
    distance.value = 0
    isNewBest.value = false
    finished.value = false
    penaltyCount.value = 0
    currentActions.value = {}
  }

  return {
    countdown,
    distance,
    bestDistance,
    isNewBest,
    finished,
    penaltyCount,
    currentActions,
    init,
    destroy
  }
}
