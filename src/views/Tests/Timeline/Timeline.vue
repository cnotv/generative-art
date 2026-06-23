<script setup lang="ts">
import { ref, reactive, watch, onMounted, onUnmounted, type Ref } from 'vue'
import { useRoute } from 'vue-router'
import { controls } from '@/utils/control'
import { stats } from '@/utils/stats'
import * as THREE from 'three'

import {
  getModel,
  getTools,
  removeElements,
  CameraPreset,
  type ComplexModel
} from '@webgamekit/threejs'
import type { LoadProgress } from '@webgamekit/threejs'
import LoadingOverlay from '@/components/LoadingOverlay.vue'
import {
  bindAnimatedElements,
  createTimelineManager,
  setRotation,
  type Timeline,
  type CoordinateTuple
} from '@webgamekit/animation'
import { getBall, getCube } from '@webgamekit/threejs'
import brickTexture from '@/assets/images/textures/brick.jpg'
import { getCoinBlock } from '@/utils/custom-models'
import { setupCloudAreaAsGroup } from '@/views/Games/MarbleMadness/marbleEnvironment'
import { useTextureGroupsStore } from '@/stores/textureGroups'
import { useTimelinePanelStore } from '@/stores/timelinePanel'
import { useDebugSceneStore } from '@/stores/debugScene'
import { useCameraConfigStore } from '@/stores/cameraConfig'
import { usePanelsStore } from '@/stores/panels'
import { registerLightProperties } from '@/utils/lightProperties'
import { useElementPropertiesStore } from '@/stores/elementProperties'
import type { InstancedGroupHandlers, PathHandlers, PathConfig } from '@/stores/debugScene'
import { usePathInteraction } from '@/composables/usePathInteraction'
import { useSceneElementPicker } from '@/composables/useSceneElementPicker'
import {
  pathCreateVisualization,
  pathCreateSteppedVisualization,
  pathRemoveVisualization,
  pathInterpolateWaypoints,
  pathCreateWaypointNode,
  pathRemoveWaypointNodes,
  pathUpdateWaypointNodePosition
} from '@/utils/pathVisualization'
import { pathAdvanceMesh } from '@/utils/pathMeshFollow'
import { pathGetEasingMultiplier } from '@/utils/pathEasing'
import type { PathFollowState, Waypoint } from '@webgamekit/logic'

const statsElement = ref(null)
const canvas = ref(null)
const canvasReference = ref<HTMLCanvasElement | null>(null)
const route = useRoute()

const loadingVisible = ref(true)
const loadingStage = ref('Loading…')
const loadingDetail = ref<string | undefined>(undefined)
const handleProgress = (progress: LoadProgress): void => {
  loadingVisible.value = !progress.done
  loadingStage.value = progress.stage
  loadingDetail.value = progress.detail
}

const timelinePanelStore = useTimelinePanelStore()
const debugSceneStore = useDebugSceneStore()
const textureGroupsStore = useTextureGroupsStore()

// A path is only shown while its element is the selected one; re-evaluate on change.
watch(
  () => useElementPropertiesStore().selectedElementName,
  () => activePathTicks.forEach((tick) => updateTickVisibility(tick))
)

let initInstance: () => void
let cleanupScene: (() => void) | undefined
let cleanupPaths: (() => void) | undefined
let cleanupPicker: (() => void) | undefined

// Path visuals are scaled to the GRID_UNIT-30 scene; the package defaults
// (radius 0.06, node 0.4) are sized for a ~1-unit reference scene and would be
// invisible from the orthographic camera here.
const PATH_NODE_SIZE = 4
const PATH_TUBE_RADIUS = 1.5
const PATH_NODE_COLOR = 0xf0a000

/** Per-path follow state advanced by its own timeline action each frame. */
interface ActivePathTick {
  id: string
  mesh: THREE.Object3D
  nodeGeo: THREE.BoxGeometry
  nodeMat: THREE.MeshBasicMaterial
  pathLine: THREE.Group | null
  waypointNodes: THREE.Mesh[]
  smoothWaypoints: Waypoint[]
  followState: PathFollowState | null
  /** Current target node index for controller-driven (walking/jumping) followers. */
  targetIndex?: number
  /** Consecutive frames blocked against a same-height wall (wall-bang turn timer). */
  blockedFrames?: number
  /** Traversal direction for ping-pong walking followers (1 forward, -1 back). */
  direction?: number
  /** Whether this path is driven by one timeline action per segment (stepped). */
  stepped?: boolean
  /** Active segment + progress for a stepped follower. */
  stepState?: { current: number; progress: number }
  /** Ids of the per-segment timeline actions of a stepped path, for removal. */
  stepActionIds?: string[]
  /** Id of the timeline action that drives this path, for removal. */
  actionId?: string
}

const activePathTicks: ActivePathTick[] = []

/** Manager + delta accessor captured during buildTimeline so path creation
 *  (preset or user-drawn) can register a driving timeline action. */
let pathTimelineManager: ReturnType<typeof createTimelineManager> | null = null
let pathGetDelta: () => number = () => 0
/** Static brick obstacles a walking follower collides with (set during buildTimeline). */
let pathObstacles: ComplexModel[] = []
/** Current dynamic obstacles (the spawned balls) a walking follower collides with. */
let pathBallProvider: () => ComplexModel[] = () => []

const GOOMBA_WALK_CLIP = 'Take 001'
const PATH_ARRIVE_XZ = 8
const PATH_ARRIVE_Y = 0.5
const PATH_CLIMB_STEP = 3
const PATH_FALL_STEP = 4
/** Extra distance ahead of the next step the collision ray probes for a wall. */
const PATH_COLLISION_LOOKAHEAD = 3
/** Height rise to the next node above which a step is jumped as a parabola. */
const PATH_JUMP_MIN_RISE = 5
/** Minimum apex height of a forward jump above the straight chord between nodes. */
const JUMP_ARC_HEIGHT = 16
/** Apex height as a fraction of the climb, when taller than JUMP_ARC_HEIGHT. */
const JUMP_ARC_RATIO = 0.65

type SegmentType = 'walk' | 'forward-jump' | 'jump'

/** Classifies a path segment by its endpoints: a same-spot node is an in-place
 *  jump, a forward rise is a forward jump, everything else is a walk. */
const segmentType = (a: CoordinateTuple, b: CoordinateTuple): SegmentType => {
  const horizontal = Math.hypot(b[0] - a[0], b[2] - a[2])
  if (horizontal < PATH_ARRIVE_Y) return 'jump'
  return b[1] - a[1] > PATH_JUMP_MIN_RISE ? 'forward-jump' : 'walk'
}

/** Keep a kinematic body in sync with the mesh moved by the path follower. */
const syncKinematicBody = (mesh: THREE.Object3D): void => {
  const body = mesh.userData?.body as
    | { setNextKinematicTranslation?: (t: { x: number; y: number; z: number }) => void }
    | undefined
  body?.setNextKinematicTranslation?.({
    x: mesh.position.x,
    y: mesh.position.y,
    z: mesh.position.z
  })
}

/** True for animated models (goombas) that should walk/jump toward path nodes
 *  rather than be snapped onto the path curve. */
const isWalkingFollower = (mesh: THREE.Object3D): boolean =>
  !!(mesh.userData as { actions?: Record<string, unknown> }).actions

const navRaycaster = new THREE.Raycaster()
const navDirection = new THREE.Vector3()
/** Frames a walking follower stays blocked against a same-height wall before it
 *  gives up and heads to the next node (so a wall-banging goomba turns around). */
const PATH_BLOCKED_GIVEUP = 40

/** Plays the model's walk clip and advances its mixer by delta. */
const playWalkClip = (mesh: THREE.Object3D, delta: number): void => {
  const userData = mesh.userData as {
    mixer?: THREE.AnimationMixer
    actions?: Record<string, THREE.AnimationAction>
  }
  if (!userData.mixer) return
  const action = userData.actions?.[GOOMBA_WALK_CLIP] ?? Object.values(userData.actions ?? {})[0]
  if (action && !action.isRunning()) action.play()
  userData.mixer.update(delta)
}

/** Steps the model horizontally toward the target unless a brick/ball blocks the
 *  ray ahead. Returns whether the way forward was blocked. */
const stepFollowerHorizontal = (
  model: ComplexModel,
  dx: number,
  dz: number,
  distanceXZ: number,
  step: number
): boolean => {
  if (distanceXZ <= Number.EPSILON) return false
  navDirection.set(dx / distanceXZ, 0, dz / distanceXZ)
  navRaycaster.set(model.position, navDirection)
  navRaycaster.far = step + PATH_COLLISION_LOOKAHEAD
  const blocked =
    navRaycaster.intersectObjects([...pathObstacles, ...pathBallProvider()], true).length > 0
  if (!blocked) {
    const advance = Math.min(step, distanceXZ)
    model.position.x += navDirection.x * advance
    model.position.z += navDirection.z * advance
  }
  return blocked
}

/** Lowers the follower toward a lower node (walking off a ledge). */
const applyFollowerDrop = (model: ComplexModel, dy: number): void => {
  if (dy < -PATH_ARRIVE_Y) model.position.y -= Math.min(PATH_FALL_STEP, -dy)
}

/**
 * Walks a non-stepped follower toward its current node, colliding with bricks/balls
 * via a forward ray (so a wall-banger stops and turns) and descending toward lower
 * nodes. Climbing is the stepped follower's job, not this one's.
 */
const navigateWalkingFollower = (tick: ActivePathTick, getDelta: () => number): void => {
  const entry = useDebugSceneStore().paths.find((p) => p.id === tick.id)
  if (!entry || !entry.config.playing || entry.waypoints.length < 2) return
  const model = tick.mesh as unknown as ComplexModel
  const delta = getDelta()
  const index = (tick.targetIndex ?? 0) % entry.waypoints.length
  const [targetX, targetY, targetZ] = entry.waypoints[index]
  const dx = targetX - model.position.x
  const dz = targetZ - model.position.z
  const distanceXZ = Math.hypot(dx, dz)
  setRotation(model, THREE.MathUtils.radToDeg(Math.atan2(dx, -dz)))

  const blocked = stepFollowerHorizontal(model, dx, dz, distanceXZ, entry.config.speed * delta)
  const dy = targetY - model.position.y
  applyFollowerDrop(model, dy)
  advanceTargetIndex(tick, entry.waypoints.length, entry.config, { index, distanceXZ, dy, blocked })
  playWalkClip(model, delta)
  syncKinematicBody(model)
}

/** Position the follower a fraction `t` along the segment a→b according to its
 *  type: a walk is a straight line; a forward jump arcs up and over onto the
 *  ledge; an in-place jump hops straight up and back down at the same spot. */
const positionAlongSegment = (
  model: ComplexModel,
  a: CoordinateTuple,
  b: CoordinateTuple,
  t: number,
  type: SegmentType
): void => {
  const arc = 4 * t * (1 - t)
  if (type === 'jump') {
    model.position.set(a[0], a[1] + JUMP_IN_PLACE_HEIGHT * arc, a[2])
    return
  }
  const horizontal = type === 'forward-jump' ? t * t * t * (t * (t * 6 - 15) + 10) : t
  model.position.x = THREE.MathUtils.lerp(a[0], b[0], horizontal)
  model.position.z = THREE.MathUtils.lerp(a[2], b[2], horizontal)
  const chord = THREE.MathUtils.lerp(a[1], b[1], t)
  const apex =
    type === 'forward-jump' ? Math.max(JUMP_ARC_HEIGHT, (b[1] - a[1]) * JUMP_ARC_RATIO) : 0
  model.position.y = chord + apex * arc
}

/** Picks the next active segment after one completes: wrap when looping, else stop
 *  (sentinel -1) at the final segment. Ping-pong on stepped paths falls back to loop. */
const nextStepIndex = (segmentIndex: number, nodeCount: number, config: PathConfig): number => {
  if (config.loop || config.pingPong) return (segmentIndex + 1) % nodeCount
  return segmentIndex >= nodeCount - 1 ? -1 : segmentIndex + 1
}

/** Advances the follower along one stepped-path segment; only the current step
 *  moves it. On completion it hands the active step to the next segment. */
const advanceStep = (tick: ActivePathTick, segmentIndex: number, getDelta: () => number): void => {
  const entry = useDebugSceneStore().paths.find((p) => p.id === tick.id)
  if (!entry || !entry.config.playing || entry.waypoints.length < 2) return
  const state = tick.stepState ?? (tick.stepState = { current: 0, progress: 0 })
  if (state.current !== segmentIndex) return
  const model = tick.mesh as unknown as ComplexModel
  const delta = getDelta()
  const nodeCount = entry.waypoints.length
  const a = entry.waypoints[segmentIndex]
  const b = entry.waypoints[(segmentIndex + 1) % nodeCount]
  const type = segmentType(a, b)
  // An in-place jump has no horizontal length, so pace it over its vertical travel.
  const length =
    type === 'jump'
      ? JUMP_IN_PLACE_HEIGHT * 2
      : Math.max(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]), Number.EPSILON)
  state.progress = Math.min(1, state.progress + (entry.config.speed * delta) / length)
  if (type !== 'jump')
    setRotation(model, THREE.MathUtils.radToDeg(Math.atan2(b[0] - a[0], -(b[2] - a[2]))))
  positionAlongSegment(model, a, b, state.progress, type)
  playWalkClip(model, delta)
  syncKinematicBody(model)
  if (state.progress >= 1) {
    state.current = nextStepIndex(segmentIndex, nodeCount, entry.config)
    state.progress = 0
  }
}

interface NavStepResult {
  index: number
  distanceXZ: number
  dy: number
  blocked: boolean
}

/** Next node for a walking follower: bounce for ping-pong, wrap for loop, else stop. */
const nextWalkIndex = (
  tick: ActivePathTick,
  index: number,
  nodeCount: number,
  config: PathConfig
): number => {
  if (config.pingPong) {
    const direction = tick.direction ?? 1
    const bounced = index + direction >= nodeCount || index + direction < 0 ? -direction : direction
    tick.direction = bounced
    return index + bounced
  }
  if (config.loop) return (index + 1) % nodeCount
  return Math.min(index + 1, nodeCount - 1)
}

/** Advances a walking follower to its next node when it arrives, or when it has
 *  been banging a same-height wall long enough to "turn around". */
const advanceTargetIndex = (
  tick: ActivePathTick,
  nodeCount: number,
  config: PathConfig,
  { index, distanceXZ, dy, blocked }: NavStepResult
): void => {
  const arrived = distanceXZ < PATH_ARRIVE_XZ && Math.abs(dy) < PATH_CLIMB_STEP
  const banging = blocked && dy <= PATH_ARRIVE_Y
  tick.blockedFrames = banging ? (tick.blockedFrames ?? 0) + 1 : 0
  if (arrived || tick.blockedFrames > PATH_BLOCKED_GIVEUP) {
    tick.targetIndex = nextWalkIndex(tick, index, nodeCount, config)
    tick.blockedFrames = 0
  }
}

/** Advances one path follower a frame: animated models walk/jump toward nodes,
 *  everything else (e.g. the moving cube) is lerped along the smoothed curve. */
const advancePathTick = (tick: ActivePathTick, getDelta: () => number): void => {
  if (isWalkingFollower(tick.mesh)) {
    navigateWalkingFollower(tick, getDelta)
    return
  }
  const entry = useDebugSceneStore().paths.find((p) => p.id === tick.id)
  if (!entry || !entry.config.playing || !tick.followState) return
  const { currentIndex, progress, waypoints } = tick.followState
  const t = (currentIndex + progress) / Math.max(1, waypoints.length - 1)
  const easingMultiplier = pathGetEasingMultiplier(
    t,
    entry.config.easing as Parameters<typeof pathGetEasingMultiplier>[1],
    entry.config.easingIntensity
  )
  const result = pathAdvanceMesh(
    tick.mesh,
    tick.followState,
    entry.config.speed * easingMultiplier,
    getDelta()
  )
  tick.followState = result.state
  syncKinematicBody(tick.mesh)
  if (!result.isComplete) return
  if (entry.config.pingPong && tick.smoothWaypoints.length >= 2) {
    tick.smoothWaypoints = [...tick.smoothWaypoints].reverse()
    tick.followState = { waypoints: tick.smoothWaypoints, currentIndex: 0, progress: 0 }
  } else if (entry.config.loop && tick.smoothWaypoints.length >= 2) {
    tick.followState = { waypoints: tick.smoothWaypoints, currentIndex: 0, progress: 0 }
  } else {
    tick.followState = null
  }
}
onMounted(() => {
  initInstance = () => {
    init(canvas.value as unknown as HTMLCanvasElement, statsElement.value as unknown as HTMLElement)
  }

  initInstance()
  window.addEventListener('resize', initInstance)
})
onUnmounted(() => {
  window.removeEventListener('resize', initInstance)
  cleanupPicker?.()
  cleanupPaths?.()
  cleanupScene?.()
  timelinePanelStore.unregister()
  debugSceneStore.clearSceneElements()
  textureGroupsStore.clear()
})

const config = {
  directional: {
    enabled: true,
    helper: false,
    intensity: 1.5
  }
}

const GRID_UNIT = 30
const SPAWN_HEIGHT = GRID_UNIT * 3
const GROUND_HEIGHT = 0
const GROUND_SIZE = 2000
const CUBE_CLUSTER_X_FAR = -2
const WALL_BANG_CUBE_Z_OFFSET = 5
/** Lone brick (part of the brick group) that goomba-5 stands on. */
const PEDESTAL_GRID_X = 3

const BRICK_GRID_POSITIONS: [number, number, number][] = [
  [0, 0, 0],
  [0, 0, 1],
  [0, 0, 2],
  [0, 1, 2],
  [-1, 0, 2],
  [CUBE_CLUSTER_X_FAR, 0, 0],
  [CUBE_CLUSTER_X_FAR, 0, 1],
  [CUBE_CLUSTER_X_FAR, 0, 2],
  [1, 0, WALL_BANG_CUBE_Z_OFFSET],
  [PEDESTAL_GRID_X, 0, 0]
]

const gridToScene = ([x, y, z]: [number, number, number]): CoordinateTuple => [
  GRID_UNIT * x,
  GRID_UNIT * y - 1,
  -GRID_UNIT * z
]
const GOOMBA_SCALE = 0.3
// goomba-1 spawns on its first path node so the stepped follower starts cleanly.
const GOOMBA_1_SPAWN_Z = GRID_UNIT
const GOOMBA_4_SPAWN_X = -GRID_UNIT * 2
// goomba-2 patrols in front of the lone wall-bang cube (grid x 1, z 5) and bangs it.
const GOOMBA_2_WALL_X = GRID_UNIT
const GOOMBA_2_WALL_Z = -GRID_UNIT * 3
const GOOMBA_2_WALL_FAR_Z = -GRID_UNIT * WALL_BANG_CUBE_Z_OFFSET
// goomba-5 spawns above the pedestal brick and falls to stand on top of it.
const GOOMBA_5_X = GRID_UNIT * PEDESTAL_GRID_X
const GOOMBA_5_Z = 0
const GOOMBA_5_SPAWN_Y = GRID_UNIT * 2
const COIN_SCALE = 20
const BALL_SPAWN_PAUSE_FRAMES = 100
const CLOUD_CENTER_HEIGHT = 200
const CLOUD_FIELD_SIZE = 600
const CLOUD_BASE_WIDTH = 80
const CLOUD_BASE_THICKNESS = 0.001
const CLOUD_BASE_DEPTH = 40
const CLOUD_WIDTH_VARIATION = 20
const CAMERA_POSITION_X = -167.87
const CAMERA_POSITION_Y = 225.02
const CAMERA_POSITION_Z = 95.43
const ORTHO_DEFAULT_ROTATION_DEGREES = 45
const CAMERA_ORBIT_TARGET_X = -44.66
const CAMERA_ORBIT_TARGET_Y = 77.17
const CAMERA_ORBIT_TARGET_Z = -27.78
const SKY_COLOR_TOP = 0xaee9ff
const SKY_COLOR_BOTTOM = 0x6fae6f

type TimelineTools = Awaited<ReturnType<typeof getTools>>

type SceneWorld = Pick<TimelineTools, 'scene' | 'world'>

const BALL_NOISE_TEXTURE_SIZE = 64
const BALL_NOISE_REPEAT_X = 8
const BALL_NOISE_REPEAT_Y = 8
const BALL_NOISE_DOT_THRESHOLD = 0.82
const BALL_COLOR = 0xffffff
const BALL_ROUGHNESS = 1
const BALL_METALNESS = 1
const BALL_CLEARCOAT = 0.8
const BALL_CLEARCOAT_ROUGHNESS = 0.08
const BALL_FRICTION = 0.8
const BALL_ANGULAR_DAMPING = 0.05
const BALL_RESTITUTION = 0.8
const BALL_ENV_MAP_INTENSITY = 2.5
const BALL_BUMP_SCALE = 0.06
const COLOR_BYTE_MAX = 255
const BALL_NOISE_DARK = 40
const BALL_NOISE_LIGHT = 105
const BALL_NOISE_TINT_R = -4
const BALL_NOISE_TINT_B = 7
const COLOR_WHITE = 0xffffff

/**
 * Generates a stipple dot texture: each pixel is independently random,
 * lit only when it clears BALL_NOISE_DOT_THRESHOLD, giving isolated dots
 * instead of the connected blobs produced by interpolated value noise.
 */
const createBallGrainTexture = (): THREE.CanvasTexture => {
  const pixelCount = BALL_NOISE_TEXTURE_SIZE * BALL_NOISE_TEXTURE_SIZE
  const dots = Array.from({ length: pixelCount }, () => Math.random() > BALL_NOISE_DOT_THRESHOLD)

  const canvas = document.createElement('canvas')
  canvas.width = BALL_NOISE_TEXTURE_SIZE
  canvas.height = BALL_NOISE_TEXTURE_SIZE
  const context = canvas.getContext('2d')
  if (context) {
    const imageData = context.createImageData(BALL_NOISE_TEXTURE_SIZE, BALL_NOISE_TEXTURE_SIZE)
    imageData.data.set(
      Uint8ClampedArray.from({ length: imageData.data.length }, (_, index) => {
        const pixel = Math.floor(index / 4)
        const channel = index % 4
        if (channel === 3) return COLOR_BYTE_MAX
        const base = dots[pixel] ? BALL_NOISE_LIGHT : BALL_NOISE_DARK
        if (channel === 0) return Math.max(0, base + BALL_NOISE_TINT_R)
        if (channel === 2) return Math.min(COLOR_BYTE_MAX, base + BALL_NOISE_TINT_B)
        return base
      })
    )
    context.putImageData(imageData, 0, 0)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(BALL_NOISE_REPEAT_X, BALL_NOISE_REPEAT_Y)
  return texture
}

const BALL_GRAIN_TEXTURE = createBallGrainTexture()

/** Applies the gritty noise as a visible color map, bump, and roughness variation */
const applyBallGrain = (mesh: THREE.Mesh): THREE.Mesh => {
  const material = mesh.material as THREE.MeshPhysicalMaterial
  material.map = BALL_GRAIN_TEXTURE
  material.color.set(COLOR_WHITE)
  material.roughnessMap = BALL_GRAIN_TEXTURE
  material.bumpMap = BALL_GRAIN_TEXTURE
  material.bumpScale = BALL_BUMP_SCALE
  material.needsUpdate = true
  return mesh
}

const makeBrick = (
  scene: SceneWorld['scene'],
  world: SceneWorld['world'],
  position: CoordinateTuple,
  index: number
) =>
  getCube(scene, world, {
    name: `brick-${index + 1}`,
    size: [GRID_UNIT, GRID_UNIT, GRID_UNIT],
    restitution: 0,
    position,
    type: 'fixed',
    texture: brickTexture,
    boundary: 0.5,
    color: 0x888888
  })

interface BricksGroupContext {
  scene: SceneWorld['scene']
  world: SceneWorld['world']
  cubes: ReturnType<typeof makeBrick>[]
  brickPositions: CoordinateTuple[]
  elements: ComplexModel[]
}

const BRICK_GROUP_ID = 'bricks'

/** Elements that should not appear as their own row in the panel: instanced/spawn
 *  group members (bricks, balls) and path visualization objects (line + nodes). */
const isGroupedPanelElement = (element: { name?: string; userData?: { isPathVisual?: boolean } }) =>
  element.userData?.isPathVisual === true ||
  element.name?.startsWith('brick-') === true ||
  element.name?.startsWith('ball') === true

const registerBricksGroup = ({
  scene,
  world,
  cubes,
  brickPositions,
  elements
}: BricksGroupContext): void => {
  const sync = () =>
    useDebugSceneStore().addInstancedGroup({
      id: BRICK_GROUP_ID,
      label: 'Bricks',
      positions: [...brickPositions],
      handlers
    })

  const handlers: InstancedGroupHandlers = {
    onAdd: (position) => {
      const newBrick = makeBrick(scene, world, position, cubes.length)
      cubes.push(newBrick)
      brickPositions.push(position)
      elements.push(newBrick as unknown as ComplexModel)
      sync()
    },
    onDelete: (index) => {
      const [removed] = cubes.splice(index, 1)
      brickPositions.splice(index, 1)
      const elementIndex = elements.indexOf(removed as unknown as ComplexModel)
      if (elementIndex !== -1) elements.splice(elementIndex, 1)
      removeElements(world, [removed] as unknown as ComplexModel[])
      sync()
    },
    onUpdate: (index, position) => {
      const brick = cubes[index]
      brick.position.set(position[0], position[1], position[2])
      brick.userData.body?.setTranslation({ x: position[0], y: position[1], z: position[2] }, true)
      brickPositions[index] = position
    },
    onToggleVisibility: (hidden) => {
      cubes.forEach((brick) => {
        brick.visible = !hidden
      })
    },
    onRemove: () => {
      removeElements(world, cubes as unknown as ComplexModel[])
      cubes.forEach((brick) => {
        const elementIndex = elements.indexOf(brick as unknown as ComplexModel)
        if (elementIndex !== -1) elements.splice(elementIndex, 1)
      })
      cubes.length = 0
      brickPositions.length = 0
    }
  }

  sync()
}

const setupStaticObjects = ({ scene, world }: SceneWorld) => {
  const brickPositions = BRICK_GRID_POSITIONS.map(gridToScene)
  const cubes = brickPositions.map((position, index) => makeBrick(scene, world, position, index))
  const coin = getCoinBlock(scene, world, { position: [0, SPAWN_HEIGHT, -GRID_UNIT * 2] })
  coin.name = 'coin-block'
  coin.scale.setScalar(COIN_SCALE)
  const ballOptions = {
    size: 8,
    showHelper: false,
    weight: 150,
    restitution: BALL_RESTITUTION,
    color: BALL_COLOR,
    roughness: BALL_ROUGHNESS,
    metalness: BALL_METALNESS,
    clearcoat: BALL_CLEARCOAT,
    clearcoatRoughness: BALL_CLEARCOAT_ROUGHNESS,
    envMapIntensity: BALL_ENV_MAP_INTENSITY,
    friction: BALL_FRICTION,
    angular: BALL_ANGULAR_DAMPING
  }
  const balls = [
    applyBallGrain(
      getBall(scene, world, {
        ...ballOptions,
        name: 'ball-1',
        position: [0, SPAWN_HEIGHT, -GRID_UNIT]
      })
    ),
    applyBallGrain(
      getBall(scene, world, {
        ...ballOptions,
        name: 'ball-2',
        position: [GRID_UNIT, SPAWN_HEIGHT, GRID_UNIT]
      })
    )
  ]
  const movingCube = getCube(scene, world, {
    name: 'moving-cube',
    size: [GRID_UNIT, GRID_UNIT, GRID_UNIT],
    restitution: 0,
    position: [0, 0, GRID_UNIT * -5],
    type: 'kinematicPositionBased',
    texture: brickTexture,
    boundary: 0.5,
    color: 0x888888
  })
  return { coin, cubes, brickPositions, balls, movingCube, ballOptions }
}

type BallOptions = ReturnType<typeof setupStaticObjects>['ballOptions']

interface BallSpawnContext {
  scene: SceneWorld['scene']
  world: SceneWorld['world']
  ballOptions: BallOptions
  elements: ComplexModel[]
  onCountChange: (count: number) => void
}

const isBall = (element: ComplexModel) => element.name?.startsWith('ball') ?? false

const isBallOutOfBounds = (element: ComplexModel) =>
  isBall(element) &&
  (Math.abs(element.position.x) > GROUND_SIZE || Math.abs(element.position.y) > GROUND_SIZE)

/** Spawns a new ball each interval and removes any balls that have left the ground bounds */
const makeBallSpawnAction = ({
  scene,
  world,
  ballOptions,
  elements,
  onCountChange
}: BallSpawnContext): Timeline => {
  let ballSpawnCounter = 0
  return {
    name: 'ball: spawn',
    interval: [1, BALL_SPAWN_PAUSE_FRAMES] as [number, number],
    category: 'physics',
    action: () => {
      ballSpawnCounter += 1
      elements.push(
        applyBallGrain(
          getBall(scene, world, {
            ...ballOptions,
            name: `ball-spawn-${ballSpawnCounter}`,
            position: [0, SPAWN_HEIGHT, -GRID_UNIT]
          })
        ) as unknown as ComplexModel
      )
      const outOfBounds = elements.filter(isBallOutOfBounds)
      if (outOfBounds.length > 0) {
        removeElements(world, outOfBounds)
        outOfBounds.forEach((ball) => {
          const index = elements.indexOf(ball)
          if (index !== -1) elements.splice(index, 1)
        })
      }
      onCountChange(elements.filter(isBall).length)
    }
  }
}

interface BallSpawnGroupContext {
  world: SceneWorld['world']
  elements: ComplexModel[]
  ballOptions: BallOptions
  timelineManager: ReturnType<typeof createTimelineManager>
  spawnActionId: string
}

const BALL_SPAWN_GROUP_ID = 'balls'

const BALL_SPAWN_SCHEMA = {
  spawnInterval: { min: 1, max: 200, step: 1, label: 'Spawn interval (frames)' },
  size: { min: 1, max: 30, step: 1, label: 'Size' },
  color: { color: true, label: 'Color' },
  roughness: { min: 0, max: 1, step: 0.01, label: 'Roughness' },
  metalness: { min: 0, max: 1, step: 0.01, label: 'Metalness' }
}

/** Registers the balls spawn group: a single panel entry exposing the spawn timer
 * and shared mesh material, applying edits to every live ball and future spawns. */
const registerBallSpawnGroup = ({
  world,
  elements,
  ballOptions,
  timelineManager,
  spawnActionId
}: BallSpawnGroupContext): void => {
  const debugSceneStore = useDebugSceneStore()
  const config = reactive<Record<string, number>>({
    spawnInterval: BALL_SPAWN_PAUSE_FRAMES,
    size: ballOptions.size,
    color: ballOptions.color,
    roughness: ballOptions.roughness,
    metalness: ballOptions.metalness
  })

  const forEachBallMaterial = (apply: (material: THREE.MeshPhysicalMaterial) => void) =>
    elements
      .filter(isBall)
      .forEach((ball) =>
        apply((ball as unknown as THREE.Mesh).material as THREE.MeshPhysicalMaterial)
      )

  const updateValue = (path: string, value: unknown) => {
    config[path] = value as number
    if (path === 'spawnInterval') {
      timelineManager.updateAction(spawnActionId, { interval: [1, value as number] })
      return
    }
    ;(ballOptions as unknown as Record<string, number>)[path] = value as number
    if (path === 'color') forEachBallMaterial((m) => m.color.set(value as number))
    else if (path === 'roughness') forEachBallMaterial((m) => (m.roughness = value as number))
    else if (path === 'metalness') forEachBallMaterial((m) => (m.metalness = value as number))
  }

  useElementPropertiesStore().registerElementProperties(BALL_SPAWN_GROUP_ID, {
    title: 'Balls',
    schema: BALL_SPAWN_SCHEMA,
    getValue: (path: string) => config[path],
    updateValue
  })

  debugSceneStore.addSpawnGroup({
    id: BALL_SPAWN_GROUP_ID,
    label: 'Balls',
    count: elements.filter(isBall).length,
    handlers: {
      onToggleVisibility: (hidden) =>
        elements.filter(isBall).forEach((ball) => {
          ball.visible = !hidden
        }),
      onRemove: () => {
        const balls = elements.filter(isBall)
        removeElements(world, balls)
        balls.forEach((ball) => {
          const index = elements.indexOf(ball)
          if (index !== -1) elements.splice(index, 1)
        })
        timelineManager.removeAction(spawnActionId)
      }
    }
  })
}

const loadGoombas = async ({ scene, world }: SceneWorld) => {
  // Goombas are fully path-driven: their height comes from path nodes, not gravity.
  // Leaving gravity on made bindAnimatedElements pull them down each frame, which
  // fought the climb so they could never get over a brick top.
  const getGoomba = (name: string, position: CoordinateTuple, hasGravity = false) =>
    getModel(scene, world, 'goomba.glb', {
      name,
      position,
      scale: [GOOMBA_SCALE, GOOMBA_SCALE, GOOMBA_SCALE],
      size: 3,
      restitution: -10,
      boundary: 0.5,
      type: 'kinematicPositionBased',
      weight: 250,
      angular: 10,
      showHelper: false,
      enabledRotations: [false, true, false],
      hasGravity,
      castShadow: true
    })
  return Promise.all([
    getGoomba('goomba-1', [0, GROUND_HEIGHT, GOOMBA_1_SPAWN_Z]),
    getGoomba('goomba-2', [GOOMBA_2_WALL_X, GROUND_HEIGHT, GOOMBA_2_WALL_Z]),
    getGoomba('goomba-4', [GOOMBA_4_SPAWN_X, GRID_UNIT, GRID_UNIT * -5]),
    // goomba-5 has no path: gravity lets it drop and settle on the pedestal brick.
    getGoomba('goomba-5', [GOOMBA_5_X, GOOMBA_5_SPAWN_Y, GOOMBA_5_Z], true)
  ])
}

const buildScenery = ({ scene, world }: SceneWorld): void => {
  setupCloudAreaAsGroup(scene, world, {
    center: [0, CLOUD_CENTER_HEIGHT, 0],
    size: [CLOUD_FIELD_SIZE, 0, CLOUD_FIELD_SIZE],
    baseSize: [CLOUD_BASE_WIDTH, CLOUD_BASE_THICKNESS, CLOUD_BASE_DEPTH],
    rotation: [Math.PI / 2, 0, 0],
    sizeVariation: [CLOUD_WIDTH_VARIATION, 0, 10],
    rotationVariation: [0, 0, 0],
    pattern: 'grid-jitter',
    count: 12,
    seed: 42,
    opacity: 0.9
  })
}

const buildTimeline = async ({
  scene,
  world,
  getDelta,
  animate,
  getSimulationFrame,
  getFrameRate
}: Pick<
  TimelineTools,
  'scene' | 'world' | 'getDelta' | 'animate' | 'getSimulationFrame' | 'getFrameRate'
>): Promise<void> => {
  const { coin, cubes, brickPositions, balls, movingCube, ballOptions } = setupStaticObjects({
    scene,
    world
  })
  const [goombaWallBangA, goombaWallBangB, goombaJumpMovingBlock2, goombaPedestal] =
    await loadGoombas({
      scene,
      world
    })

  const elements: ComplexModel[] = [
    ...(balls as unknown as ComplexModel[]),
    goombaWallBangA,
    goombaWallBangB,
    goombaJumpMovingBlock2,
    goombaPedestal,
    movingCube,
    ...cubes
  ]

  const timelineManager = createTimelineManager()
  pathTimelineManager = timelineManager
  pathGetDelta = getDelta
  pathObstacles = cubes
  pathBallProvider = () => elements.filter((e) => isBall(e))
  timelineManager.addAction({
    name: 'coin: flip',
    start: 0,
    category: 'visual-effects',
    action: () => (coin.rotation.z += 0.05)
  })
  const ballSpawnActionId = timelineManager.addAction(
    makeBallSpawnAction({
      scene,
      world,
      ballOptions,
      elements,
      onCountChange: (count) => debugSceneStore.setSpawnGroupCount(BALL_SPAWN_GROUP_ID, count)
    })
  )
  timelinePanelStore.register({
    getTimeline: () => timelineManager.getTimeline(),
    getCurrentFrame: getSimulationFrame,
    getFrameRate,
    setActionEnabled: (id, enabled) => timelineManager.updateAction(id, { enabled })
  })

  registerBricksGroup({ scene, world, cubes, brickPositions, elements })
  registerBallSpawnGroup({
    world,
    elements,
    ballOptions,
    timelineManager,
    spawnActionId: ballSpawnActionId
  })
  createPresetMovementPaths({
    scene,
    goombaWallBangA,
    goombaWallBangB,
    goombaJumpMovingBlock2,
    movingCube
  })

  animate({
    beforeTimeline: () => bindAnimatedElements(elements, world, getDelta()),
    timeline: timelineManager,
    isPaused: () => timelinePanelStore.isPaused
  })
}

/** Path line + nodes are shown only when the path's element is the selected one
 *  (and its own showPath/showNodes config + visibility allow it). */
const updateTickVisibility = (tick: ActivePathTick): void => {
  const entry = useDebugSceneStore().paths.find((p) => p.id === tick.id)
  if (!entry) return
  const selected = useElementPropertiesStore().selectedElementName === entry.elementName
  const baseVisible = selected && !entry.hidden
  if (tick.pathLine) tick.pathLine.visible = baseVisible && entry.config.showPath
  tick.waypointNodes.forEach((node) => {
    node.visible = baseVisible && entry.config.showNodes
  })
}

const refreshPathLine = (
  scene: THREE.Scene,
  tick: ActivePathTick,
  waypoints: CoordinateTuple[]
): void => {
  if (tick.pathLine) {
    pathRemoveVisualization(scene, tick.pathLine)
    tick.pathLine = null
  }
  if (waypoints.length < 2) return
  // Looping paths close the tube back to the start so the whole loop is visible.
  const closed = useDebugSceneStore().paths.find((p) => p.id === tick.id)?.config.loop ?? false
  const points = waypoints.map(([x, y, z]) => ({ x, y, z }))
  if (tick.stepped) {
    tick.smoothWaypoints = points
    tick.pathLine = pathCreateSteppedVisualization(
      scene,
      points,
      PATH_NODE_COLOR,
      PATH_TUBE_RADIUS,
      closed
    )
  } else {
    tick.smoothWaypoints = pathInterpolateWaypoints(points)
    tick.pathLine = pathCreateVisualization(
      scene,
      tick.smoothWaypoints,
      PATH_NODE_COLOR,
      PATH_TUBE_RADIUS,
      closed
    )
  }
  tick.followState = { waypoints: tick.smoothWaypoints, currentIndex: 0, progress: 0 }
  updateTickVisibility(tick)
}

const makePathHandlers = (
  scene: THREE.Scene,
  tick: ActivePathTick,
  pathId: string,
  unmount: () => void
): PathHandlers => {
  const store = useDebugSceneStore()
  const findEntry = () => store.paths.find((p) => p.id === pathId)
  return {
    onAddWaypoint: (position) => {
      const entry = findEntry()
      if (!entry) return
      refreshPathLine(scene, tick, entry.waypoints)
      if (entry.config.showNodes) {
        const [x, y, z] = position
        tick.waypointNodes = [
          ...tick.waypointNodes,
          pathCreateWaypointNode(scene, { x, y, z }, tick.nodeGeo, tick.nodeMat)
        ]
        updateTickVisibility(tick)
      }
    },
    onRemoveWaypoint: (index) => {
      pathRemoveWaypointNodes(scene, [tick.waypointNodes[index]])
      tick.waypointNodes = tick.waypointNodes.filter((_, i) => i !== index)
      const entry = findEntry()
      if (entry) refreshPathLine(scene, tick, entry.waypoints)
    },
    onUpdateWaypoint: (index, [x, y, z]) => {
      if (tick.waypointNodes[index])
        pathUpdateWaypointNodePosition(tick.waypointNodes[index], { x, y, z })
      const entry = findEntry()
      if (entry) refreshPathLine(scene, tick, entry.waypoints)
    },
    onReset: () => {
      if (tick.pathLine) {
        pathRemoveVisualization(scene, tick.pathLine)
        tick.pathLine = null
      }
      pathRemoveWaypointNodes(scene, tick.waypointNodes)
      tick.waypointNodes = []
      tick.smoothWaypoints = []
      tick.followState = null
    },
    onToggleVisibility: () => updateTickVisibility(tick),
    onRemove: () => {
      if (tick.pathLine) pathRemoveVisualization(scene, tick.pathLine)
      pathRemoveWaypointNodes(scene, tick.waypointNodes)
      tick.nodeGeo.dispose()
      tick.nodeMat.dispose()
      if (tick.actionId) pathTimelineManager?.removeAction(tick.actionId)
      tick.stepActionIds?.forEach((id) => pathTimelineManager?.removeAction(id))
      unmount()
      const index = activePathTicks.indexOf(tick)
      if (index !== -1) activePathTicks.splice(index, 1)
    },
    onConfigChange: (key) => {
      if (key === 'showNodes') {
        pathRemoveWaypointNodes(scene, tick.waypointNodes)
        tick.waypointNodes = findEntry()?.config.showNodes
          ? (findEntry()?.waypoints ?? []).map(([x, y, z]) =>
              pathCreateWaypointNode(scene, { x, y, z }, tick.nodeGeo, tick.nodeMat)
            )
          : []
      }
      updateTickVisibility(tick)
    }
  }
}

const PATH_DEFAULT_SPEED = 20

const makeDefaultPathConfig = (overrides: Partial<PathConfig> = {}): PathConfig => ({
  speed: PATH_DEFAULT_SPEED,
  obstacleImpulse: 0,
  easing: 'linear',
  easingIntensity: 1,
  playing: true,
  loop: false,
  pingPong: false,
  showPath: true,
  showNodes: false,
  ...overrides
})

const makePathTick = (elementName: string, mesh: THREE.Object3D): ActivePathTick => {
  const tick: ActivePathTick = {
    id: `path-${elementName}`,
    mesh,
    nodeGeo: new THREE.BoxGeometry(PATH_NODE_SIZE, PATH_NODE_SIZE, PATH_NODE_SIZE),
    nodeMat: new THREE.MeshBasicMaterial({ color: PATH_NODE_COLOR }),
    pathLine: null,
    waypointNodes: [],
    smoothWaypoints: [],
    followState: null
  }
  activePathTicks.push(tick)
  return tick
}

/** Register a timeline action that drives this path's follower each frame. */
const registerPathAction = (tick: ActivePathTick, elementName: string): void => {
  if (!pathTimelineManager) return
  tick.actionId = pathTimelineManager.addAction({
    name: `${elementName}: path`,
    category: 'movement',
    action: () => advancePathTick(tick, pathGetDelta)
  })
}

/** Register one timeline action per path segment, each named by its movement type
 *  (walk / forward-jump / jump), so every step is its own row in the timeline. */
const registerStepActions = (
  tick: ActivePathTick,
  elementName: string,
  waypoints: CoordinateTuple[]
): void => {
  if (!pathTimelineManager) return
  const manager = pathTimelineManager
  tick.stepActionIds = waypoints.map((a, segmentIndex) => {
    const b = waypoints[(segmentIndex + 1) % waypoints.length]
    return manager.addAction({
      name: `${elementName}: ${segmentType(a, b)}`,
      category: 'movement',
      action: () => advanceStep(tick, segmentIndex, pathGetDelta)
    })
  })
}

const enablePathForMesh = (
  elementName: string,
  mesh: THREE.Object3D,
  scene: THREE.Scene,
  canvasReference: Ref<HTMLCanvasElement | null>,
  getCamera: () => THREE.Camera
): void => {
  const store = useDebugSceneStore()
  const pathId = `path-${elementName}`
  const tick = makePathTick(elementName, mesh)

  const interaction = usePathInteraction({
    canvas: canvasReference,
    getCamera,
    groundY: mesh.position.y,
    onDrawStart: () => store.paths.find((p) => p.id === pathId)?.handlers.onReset(),
    onAddWaypoint: (position) => store.addPathWaypoint(pathId, position),
    onUpdateWaypoint: (index, position) => store.updatePathWaypoint(pathId, index, position),
    onDrawEnd: () => {
      const entry = store.paths.find((p) => p.id === pathId)
      if (entry && entry.waypoints.length >= 2) refreshPathLine(scene, tick, entry.waypoints)
    },
    getNodes: () => tick.waypointNodes
  })
  interaction.mount()

  store.addPath({
    id: pathId,
    elementName,
    label: `${elementName} path`,
    waypoints: [],
    config: makeDefaultPathConfig(),
    handlers: makePathHandlers(scene, tick, pathId, interaction.unmount)
  })
  registerPathAction(tick, elementName)
  // Selecting the element makes its (about to be drawn) path visible.
  useElementPropertiesStore().requestElementSelection(elementName)
}

/** Create a path with predefined nodes (no canvas drawing) and start it looping. */
const createPresetPath = (
  elementName: string,
  mesh: THREE.Object3D,
  scene: THREE.Scene,
  waypoints: CoordinateTuple[],
  configOverrides: Partial<PathConfig> = {}
): void => {
  const store = useDebugSceneStore()
  const pathId = `path-${elementName}`
  const tick = makePathTick(elementName, mesh)
  store.addPath({
    id: pathId,
    elementName,
    label: `${elementName} path`,
    waypoints: [],
    config: makeDefaultPathConfig({ loop: true, ...configOverrides }),
    handlers: makePathHandlers(scene, tick, pathId, () => {})
  })
  registerPathAction(tick, elementName)
  waypoints.forEach((wp) => store.addPathWaypoint(pathId, wp))
}

/** Like createPresetPath, but the path is split into one timeline action per
 *  segment (a "step"), each segment coloured distinctly, and the follower walks
 *  straight along flat/downward steps and jumps a parabola up taller ones. */
const createSteppedPresetPath = (
  elementName: string,
  mesh: THREE.Object3D,
  scene: THREE.Scene,
  waypoints: CoordinateTuple[]
): void => {
  const store = useDebugSceneStore()
  const pathId = `path-${elementName}`
  const tick = makePathTick(elementName, mesh)
  tick.stepped = true
  tick.stepState = { current: 0, progress: 0 }
  store.addPath({
    id: pathId,
    elementName,
    label: `${elementName} path`,
    waypoints: [],
    config: makeDefaultPathConfig({ loop: true }),
    handlers: makePathHandlers(scene, tick, pathId, () => {})
  })
  registerStepActions(tick, elementName, waypoints)
  waypoints.forEach((wp) => store.addPathWaypoint(pathId, wp))
}

const PATH_LOOP_SPAN = GRID_UNIT * 2
const PATH_CUBE_RISE = GRID_UNIT * 2

// Goomba feet heights: on the ground, on a single brick top, and on the stacked
// double-height brick. getCube shifts a cube up by half its size, so a brick placed
// at grid y=0 spans y -1..29 (top at GRID_UNIT-1); feet sit GRID_UNIT above ground
// so the collision ray clears the brick top when walking across it.
const GOOMBA_GROUND_Y = 0
const GOOMBA_BRICK_TOP_Y = GRID_UNIT
const GOOMBA_STACK_TOP_Y = GRID_UNIT * 2
// In-place jump apex: from the stack top (GRID_UNIT*2) reaches the coin (GRID_UNIT*3).
const JUMP_IN_PLACE_HEIGHT = GRID_UNIT

/** Goomba 1 forward-jumps up the central brick column onto the stacked cube,
 *  jumps in place to bump the coin block above it, then walks down the far column
 *  back to the ground and loops. The duplicated stack node is the in-place jump;
 *  segment types (walk / forward-jump / jump) are derived from the node geometry. */
const GOOMBA_1_CLIMB_PATH: CoordinateTuple[] = [
  [0, GOOMBA_GROUND_Y, GRID_UNIT],
  [0, GOOMBA_BRICK_TOP_Y, 0],
  [0, GOOMBA_BRICK_TOP_Y, -GRID_UNIT],
  [0, GOOMBA_STACK_TOP_Y, -GRID_UNIT * 2],
  [0, GOOMBA_STACK_TOP_Y, -GRID_UNIT * 2],
  [-GRID_UNIT, GOOMBA_BRICK_TOP_Y, -GRID_UNIT * 2],
  [-GRID_UNIT * 2, GOOMBA_BRICK_TOP_Y, -GRID_UNIT * 2],
  [-GRID_UNIT * 2, GOOMBA_BRICK_TOP_Y, 0],
  [-GRID_UNIT * 2, GOOMBA_GROUND_Y, GRID_UNIT]
]

/** Goomba 2 walks straight into the lone wall-bang cube, bangs it, turns around,
 *  retreats, and repeats — the far node sits inside the cube so it stays blocked. */
const GOOMBA_2_WALL_BANG_PATH: CoordinateTuple[] = [
  [GOOMBA_2_WALL_X, GOOMBA_GROUND_Y, GOOMBA_2_WALL_Z],
  [GOOMBA_2_WALL_X, GOOMBA_GROUND_Y, GOOMBA_2_WALL_FAR_Z]
]

/** A rectangular loop of nodes at ground level, starting at the mesh's XZ.
 *  Goombas spawn at brick height; a ground loop makes them walk down and patrol. */
const loopWaypoints = (mesh: THREE.Object3D, span: number): CoordinateTuple[] => {
  const { x, z } = mesh.position
  const y = GOOMBA_GROUND_Y
  return [
    [x, y, z],
    [x + span, y, z],
    [x + span, y, z - span],
    [x, y, z - span]
  ]
}

interface PresetPathContext {
  scene: THREE.Scene
  goombaWallBangA: ComplexModel
  goombaWallBangB: ComplexModel
  goombaJumpMovingBlock2: ComplexModel
  movingCube: ComplexModel
}

/** Replaces the previous hardcoded movement: the three goombas patrol a node
 *  loop and the moving cube bobs vertically between two nodes, each driven by
 *  its own timeline action. */
const createPresetMovementPaths = ({
  scene,
  goombaWallBangA,
  goombaWallBangB,
  goombaJumpMovingBlock2,
  movingCube
}: PresetPathContext): void => {
  const g1 = goombaWallBangA as unknown as THREE.Object3D
  const g2 = goombaWallBangB as unknown as THREE.Object3D
  const g4 = goombaJumpMovingBlock2 as unknown as THREE.Object3D
  const cube = movingCube as unknown as THREE.Object3D
  createSteppedPresetPath('goomba-1', g1, scene, GOOMBA_1_CLIMB_PATH)
  createPresetPath('goomba-2', g2, scene, GOOMBA_2_WALL_BANG_PATH)
  createPresetPath('goomba-4', g4, scene, loopWaypoints(g4, PATH_LOOP_SPAN))
  const { x, y, z } = cube.position
  createPresetPath(
    'moving-cube',
    cube,
    scene,
    [
      [x, y, z],
      [x, y + PATH_CUBE_RISE, z]
    ],
    { pingPong: true, loop: false }
  )
}

const registerTimelinePaths = (
  scene: THREE.Scene,
  elements: ComplexModel[],
  canvasReference: Ref<HTMLCanvasElement | null>,
  getCamera: () => THREE.Camera
): (() => void) => {
  const store = useDebugSceneStore()
  store.registerPathContext({
    onEnablePath: (elementName) => {
      if (store.paths.some((p) => p.elementName === elementName)) return
      const mesh = elements.find((e) => (e as ComplexModel).name === elementName)
      if (mesh)
        enablePathForMesh(
          elementName,
          mesh as unknown as THREE.Object3D,
          scene,
          canvasReference,
          getCamera
        )
    }
  })
  return () => {
    ;[...store.paths].forEach((p) => store.removePath(p.id))
    store.unregisterPathContext()
    activePathTicks.length = 0
  }
}

/** Click-to-select: maps a viewport click to its panel element/group while the
 *  Elements panel is open. Bricks resolve to the Bricks group, balls to the Balls
 *  group, and texture-area meshes (clouds) to their group via userData. */
const registerScenePicker = (scene: THREE.Scene, getCamera: () => THREE.Camera): (() => void) => {
  const panelsStore = usePanelsStore()
  const store = useDebugSceneStore()
  const picker = useSceneElementPicker({
    canvas: canvasReference,
    getCamera,
    getObjects: () => scene.children,
    matchObject: (object) => {
      const name = object.name
      if (name && store.sceneElements.some((e) => e.name === name)) return name
      if (name?.startsWith('brick-')) return BRICK_GROUP_ID
      if (name?.startsWith('ball')) return BALL_SPAWN_GROUP_ID
      const groupId = (object.userData as { textureGroupId?: string } | undefined)?.textureGroupId
      return typeof groupId === 'string' ? groupId : null
    },
    isEnabled: () => panelsStore.isElementsOpen,
    onPick: (name) => useElementPropertiesStore().requestElementSelection(name)
  })
  picker.mount()
  return picker.unmount
}

const createScene = async (canvas: HTMLCanvasElement): Promise<void> => {
  canvasReference.value = canvas
  cleanupScene?.()
  const {
    animate,
    setup,
    scene,
    world,
    camera,
    renderer,
    getDelta,
    getSimulationFrame,
    getFrameRate,
    cleanup,
    setActiveCamera
  } = await getTools({
    stats,
    route,
    canvas,
    onProgress: handleProgress
  })
  cleanupScene = cleanup
  let activeCamera: THREE.Camera = camera
  const trackedSetActiveCamera = (newCamera: THREE.Camera) => {
    activeCamera = newCamera
    return setActiveCamera(newCamera)
  }
  const { elements, orbit } = await setup({
    config: {
      camera: { position: [CAMERA_POSITION_X, CAMERA_POSITION_Y, CAMERA_POSITION_Z] },
      orbit: {
        target: new THREE.Vector3(
          CAMERA_ORBIT_TARGET_X,
          CAMERA_ORBIT_TARGET_Y,
          CAMERA_ORBIT_TARGET_Z
        )
      },
      ground: { size: GROUND_SIZE, color: 0x227755 },
      sky: { color: 0x8ecae6, size: 1000 },
      lights: {
        ambient: { intensity: 2 },
        directional: {
          intensity: config.directional.intensity,
          // Same light direction as the default [20, 30, 20], pushed out so the
          // shadow camera sits beyond the scene and its frustum covers the whole view.
          position: [400, 600, 400],
          shadow: {
            camera: { left: -1000, right: 1000, top: 1000, bottom: -1000, near: 0.5, far: 2000 },
            mapSize: { width: 4096, height: 4096 }
          }
        },
        hemisphere: { colors: [SKY_COLOR_TOP, SKY_COLOR_BOTTOM], intensity: 0 }
      }
    },
    defineSetup: async () =>
      buildTimeline({ scene, world, getDelta, animate, getSimulationFrame, getFrameRate })
  })
  const panelElements = elements.filter(
    (e) => !isGroupedPanelElement(e as { name?: string; userData?: { isPathVisual?: boolean } })
  )
  debugSceneStore.registerSceneElements(
    camera,
    panelElements,
    {
      onRemove: (name) => {
        const sceneObject = elements.find((e) => (e as ComplexModel).name === name) as
          | ComplexModel
          | undefined
        if (sceneObject) removeElements(world, [sceneObject])
      }
    },
    { renderer, orbit, setCamera: trackedSetActiveCamera }
  )
  const cameraConfigStore = useCameraConfigStore()
  cameraConfigStore.applyPresetToActiveSlot(CameraPreset.Orthographic)
  cameraConfigStore.rotateActiveSlot(-ORTHO_DEFAULT_ROTATION_DEGREES)
  cameraConfigStore.rotateActiveSlot(-ORTHO_DEFAULT_ROTATION_DEGREES)
  buildScenery({ scene, world })
  debugSceneStore.moveElementAfter('clouds', 'sky')
  registerSceneLights(scene)
  cleanupPaths = registerTimelinePaths(
    scene,
    elements as ComplexModel[],
    canvasReference,
    () => activeCamera
  )

  cleanupPicker = registerScenePicker(scene, () => activeCamera)
}

const registerSceneLights = (scene: THREE.Scene): void => {
  const ambientLight = scene.getObjectByName('ambient-light') as THREE.Light | undefined
  const directionalLight = scene.getObjectByName('directional-light') as THREE.Light | undefined
  if (ambientLight)
    registerLightProperties({ light: ambientLight, name: 'ambient-light', title: 'Ambient Light' })
  if (directionalLight)
    registerLightProperties({
      light: directionalLight,
      name: 'directional-light',
      title: 'Directional Light'
    })
  const hemisphereLight = scene.getObjectByName('hemisphere-light') as
    | THREE.HemisphereLight
    | undefined
  if (!hemisphereLight) return
  const hemisphereState = {
    skyColor: hemisphereLight.color.getHex(),
    groundColor: hemisphereLight.groundColor.getHex(),
    intensity: hemisphereLight.intensity
  }
  useElementPropertiesStore().registerElementProperties('hemisphere-light', {
    title: 'Hemisphere Light',
    schema: {
      skyColor: { color: true, label: 'Sky Color' },
      groundColor: { color: true, label: 'Ground Color' },
      intensity: { min: 0, max: 10, step: 0.1, label: 'Intensity' }
    },
    getValue: (path: string) => (hemisphereState as Record<string, unknown>)[path],
    updateValue: (path: string, value: unknown) => {
      ;(hemisphereState as Record<string, unknown>)[path] = value
      if (path === 'skyColor') hemisphereLight.color.set(value as number)
      else if (path === 'groundColor') hemisphereLight.groundColor.set(value as number)
      else hemisphereLight.intensity = value as number
    }
  })
}

const init = async (canvasElement: HTMLCanvasElement, statsElement: HTMLElement): Promise<void> => {
  stats.init(route, statsElement)
  controls.create(config, route, {}, () => createScene(canvasElement))
  createScene(canvasElement)
}
</script>

<template>
  <div ref="statsElement"></div>
  <canvas ref="canvas"></canvas>
  <LoadingOverlay :visible="loadingVisible" :stage="loadingStage" :detail="loadingDetail" />
</template>
