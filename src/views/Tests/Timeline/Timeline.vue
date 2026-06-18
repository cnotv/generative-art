<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { controls } from '@/utils/control'
import { stats } from '@/utils/stats'
import * as THREE from 'three'

import { getModel, getTools, removeElements, type ComplexModel } from '@webgamekit/threejs'
import type { LoadProgress } from '@webgamekit/threejs'
import LoadingOverlay from '@/components/LoadingOverlay.vue'
import {
  controllerForward,
  resetAnimation,
  bindAnimatedElements,
  controllerJump,
  setRotation,
  createTimelineManager,
  type Timeline,
  type CoordinateTuple,
  type AnimationData
} from '@webgamekit/animation'
import { getBall, getCube } from '@webgamekit/threejs'
import brickTexture from '@/assets/images/textures/brick.jpg'
import { getCoinBlock } from '@/utils/custom-models'
import { setupCloudAreaAsGroup } from '@/views/Games/MarbleMadness/marbleEnvironment'
import { useTextureGroupsStore } from '@/stores/textureGroups'
import type { RotationMap } from '@/types/three'
import { useTimelinePanelStore } from '@/stores/timelinePanel'
import { useDebugSceneStore } from '@/stores/debugScene'
import { registerLightProperties } from '@/utils/lightProperties'
import { useElementPropertiesStore } from '@/stores/elementProperties'
import type { InstancedGroupHandlers } from '@/stores/debugScene'

const statsElement = ref(null)
const canvas = ref(null)
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

let initInstance: () => void
let cleanupScene: (() => void) | undefined
onMounted(() => {
  initInstance = () => {
    init(canvas.value as unknown as HTMLCanvasElement, statsElement.value as unknown as HTMLElement)
  }

  initInstance()
  window.addEventListener('resize', initInstance)
})
onUnmounted(() => {
  window.removeEventListener('resize', initInstance)
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

const rotationMap: RotationMap = {
  forward: 0,
  left: 90,
  backward: 180,
  right: 270
}

const character = {
  speed: 0.5,
  jump: 2.8
}

const GRID_UNIT = 30
const SPAWN_HEIGHT = GRID_UNIT * 3
const GROUND_HEIGHT = 0
const GROUND_SIZE = 2000
const CUBE_STEP_HEIGHT = 0.5
const CUBE_CLUSTER_X_FAR = -2
const WALL_BANG_CUBE_Z_OFFSET = 5

const BRICK_GRID_POSITIONS: [number, number, number][] = [
  [0, 0, 0],
  [0, 0, 1],
  [0, 0, 2],
  [0, 1, 2],
  [-1, 0, 2],
  [CUBE_CLUSTER_X_FAR, 0, 0],
  [CUBE_CLUSTER_X_FAR, 0, 1],
  [CUBE_CLUSTER_X_FAR, 0, 2],
  [1, 0, WALL_BANG_CUBE_Z_OFFSET]
]

const gridToScene = ([x, y, z]: [number, number, number]): CoordinateTuple => [
  GRID_UNIT * x,
  GRID_UNIT * y - 1,
  -GRID_UNIT * z
]
const GOOMBA_SCALE = 0.3
const GOOMBA_1_SPAWN_Z = 22
const GOOMBA_2_SPAWN_X = 68
const GOOMBA_4_SPAWN_X = -GRID_UNIT * 2
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
const CAMERA_ORBIT_TARGET_X = -44.66
const CAMERA_ORBIT_TARGET_Y = 77.17
const CAMERA_ORBIT_TARGET_Z = -27.78
const SKY_COLOR_TOP = 0xaee9ff
const SKY_COLOR_BOTTOM = 0x6fae6f

const APPROACH_FRAMES = 30
const CROSS_FRAMES = 60
const JUMP_RISE_FRAMES = 20
const STEP_CYCLE = 200
const MOVING_BLOCK_JUMP_HEIGHT = 60
// bindAnimatedElements applies ~1.163 gravity/frame at 60fps (-9.8*delta - 1)
const GRAVITY_PER_FRAME_ESTIMATE = 1.2
// Net rise per frame = JUMP_HEIGHT_PER_FRAME - gravity, so total ≈ MOVING_BLOCK_JUMP_HEIGHT
const JUMP_HEIGHT_PER_FRAME =
  MOVING_BLOCK_JUMP_HEIGHT / JUMP_RISE_FRAMES + GRAVITY_PER_FRAME_ESTIMATE

/** Helper to create AnimationData for goomba models */
const createGoombaAnimData = (
  model: ComplexModel,
  getDelta: () => number,
  backward = false
): AnimationData => ({
  player: model,
  actionName: 'Take 001',
  delta: getDelta(),
  distance: character.speed,
  backward
})

type TimelineTools = Awaited<ReturnType<typeof getTools>>

interface GoombaMove {
  name: string
  frames: number
  actionStart?: () => void
  action?: (frameInMove: number) => void
}

/**
 * Builds a single action that steps through a fixed-length sequence of moves,
 * executing whichever move's frame range contains the current cycle position.
 * `actionStart` fires once when a move becomes active; `action` fires every
 * frame the move is active, receiving the 0-based frame index within the move.
 */
const playMoveSequence = (moves: GoombaMove[], getSimulationFrame: () => number): (() => void) => {
  const ranges = moves.reduce<{ move: GoombaMove; start: number; end: number }[]>(
    (accumulated, move) => {
      const start = accumulated.length > 0 ? accumulated[accumulated.length - 1].end : 0
      return [...accumulated, { move, start, end: start + move.frames }]
    },
    []
  )
  const totalFrames = ranges.reduce((sum, { move }) => sum + move.frames, 0)

  return () => {
    const frameInCycle = getSimulationFrame() % totalFrames
    const range = ranges.find(({ start, end }) => frameInCycle >= start && frameInCycle < end)
    if (!range) return
    if (frameInCycle === range.start) range.move.actionStart?.()
    range.move.action?.(frameInCycle - range.start)
  }
}

const WALL_BANG_APPROACH_FRAMES = 100
const WALL_BANG_HOP_FRAMES = 20
const WALL_BANG_RESET_FRAMES = 1
const GOOMBA_1_JUMP_HEIGHT = 3.2
const GOOMBA_1_GRAVITY_SCALE = 2
const GOOMBA_1_HOP_FRAMES = 40

/** Walks forward into the cube wall, hops, then resets back to the starting position on a loop */
const makeWallBangMoves =
  (cubes: ComplexModel[], getDelta: () => number, facing: number, jumpHeight = character.jump) =>
  (model: ComplexModel): GoombaMove[] => [
    {
      name: 'walk approach',
      frames: WALL_BANG_APPROACH_FRAMES,
      actionStart: () => setRotation(model, facing),
      action: () => controllerForward(cubes, [], createGoombaAnimData(model, getDelta))
    },
    {
      name: 'walk hop',
      frames: WALL_BANG_HOP_FRAMES,
      action: () => controllerJump(model, cubes, character.speed, jumpHeight)
    },
    {
      name: 'walk reset',
      frames: WALL_BANG_RESET_FRAMES,
      action: () => resetAnimation([model])
    }
  ]

// Every patrol step covers exactly one cube side (GRID_UNIT) at character.speed
const ONE_CUBE_FRAMES = GRID_UNIT / character.speed

type GoombaPatrolJump = { stepIndex: number; startFrame: number; frames: number; height: number }

const GOOMBA_1_PATROL_STEPS: { rotation: number; stepCount: number; jumps?: GoombaPatrolJump[] }[] =
  [
    {
      rotation: rotationMap.forward,
      stepCount: 3,
      jumps: [0, 2].map((stepIndex) => ({
        stepIndex,
        startFrame: 0,
        frames: GOOMBA_1_HOP_FRAMES,
        height: GOOMBA_1_JUMP_HEIGHT
      }))
    },
    { rotation: rotationMap.right, stepCount: 2 },
    { rotation: rotationMap.backward, stepCount: 3 },
    { rotation: rotationMap.left, stepCount: 2 }
  ]

/**
 * Walks a rectangular patrol around the cube cluster, turning left between each
 * step group. Every step is exactly one cube side long (ONE_CUBE_FRAMES); the first
 * and last steps of the first group hop onto and off the cube cluster, before
 * resetting back to the starting position on a loop.
 */
const makeGoomba1PatrolMoves =
  (cubes: ComplexModel[], getDelta: () => number) =>
  (model: ComplexModel): GoombaMove[] => [
    ...GOOMBA_1_PATROL_STEPS.flatMap(({ rotation, stepCount, jumps = [] }) =>
      Array.from({ length: stepCount }, (_, stepIndex) => {
        const jump = jumps.find((candidate) => candidate.stepIndex === stepIndex)
        return {
          name: `patrol: face ${rotation} step ${stepIndex + 1}${jump ? ' (jump)' : ''}`,
          frames: ONE_CUBE_FRAMES,
          ...(stepIndex === 0 ? { actionStart: () => setRotation(model, rotation) } : {}),
          action: (frameInMove: number) => {
            const isJumping =
              !!jump &&
              frameInMove >= jump.startFrame &&
              frameInMove < jump.startFrame + jump.frames
            const isAboveCluster = model.position.y > GRID_UNIT / 2 - 1
            controllerForward(
              isJumping && isAboveCluster ? [] : cubes,
              [],
              createGoombaAnimData(model, getDelta)
            )
            if (isJumping) {
              controllerJump(model, cubes, character.speed, jump.height)
            }
          }
        }
      })
    ),
    {
      name: 'patrol: reset',
      frames: 1,
      action: () => resetAnimation([model])
    }
  ]

/** Jumps over the moving block using physics: upward push during rise, gravity handles the fall */
const makeJumpMovingBlockMoves =
  (getDelta: () => number, facing: number) =>
  (model: ComplexModel): GoombaMove[] => [
    {
      name: 'walk approach',
      frames: APPROACH_FRAMES,
      actionStart: () => setRotation(model, facing),
      action: () => controllerForward([], [], createGoombaAnimData(model, getDelta))
    },
    {
      name: 'rise',
      frames: JUMP_RISE_FRAMES,
      action: () => {
        controllerJump(model, [], 0, JUMP_HEIGHT_PER_FRAME)
        controllerForward([], [], createGoombaAnimData(model, getDelta))
      }
    },
    {
      name: 'cross',
      frames: CROSS_FRAMES,
      action: () => controllerForward([], [], createGoombaAnimData(model, getDelta))
    },
    {
      name: 'cross back',
      frames: CROSS_FRAMES,
      action: () => controllerForward([], [], createGoombaAnimData(model, getDelta, true))
    },
    {
      name: 'walk return',
      frames: APPROACH_FRAMES,
      action: () => controllerForward([], [], createGoombaAnimData(model, getDelta, true))
    }
  ]

const toSegments = (moves: GoombaMove[]): { name: string; frames: number }[] =>
  moves.map(({ name, frames }) => ({ name, frames }))

/** Builds the per-goomba movement timeline actions for the patrol, wall-bang, and moving-block goombas */
const makeGoombaTimelineActions = (
  cubes: ComplexModel[],
  getDelta: () => number,
  getSimulationFrame: () => number,
  [goombaWallBangA, goombaWallBangB, goombaJumpMovingBlock2]: [
    ComplexModel,
    ComplexModel,
    ComplexModel
  ]
): Timeline[] => {
  const goomba1Moves = makeGoomba1PatrolMoves(cubes, getDelta)(goombaWallBangA)
  const goomba2Moves = makeWallBangMoves(cubes, getDelta, rotationMap['right'])(goombaWallBangB)
  const goomba4Moves = makeJumpMovingBlockMoves(
    getDelta,
    rotationMap['left']
  )(goombaJumpMovingBlock2)

  return [
    {
      name: 'Goomba 1: Move',
      segments: toSegments(goomba1Moves),
      action: playMoveSequence(goomba1Moves, getSimulationFrame)
    },
    {
      name: 'Goomba 2: Move',
      segments: toSegments(goomba2Moves),
      action: playMoveSequence(goomba2Moves, getSimulationFrame)
    },
    {
      name: 'Goomba 4: Move',
      segments: toSegments(goomba4Moves),
      action: playMoveSequence(goomba4Moves, getSimulationFrame)
    }
  ]
}

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

const isGroupedPanelElement = (element: { name?: string }) =>
  (element.name?.startsWith('brick-') || element.name?.startsWith('ball')) ?? false

const registerBricksGroup = ({
  scene,
  world,
  cubes,
  brickPositions,
  elements
}: BricksGroupContext): void => {
  const sync = () =>
    useDebugSceneStore().addInstancedGroup({
      id: 'bricks',
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
      brick.userData.body.setTranslation({ x: position[0], y: position[1], z: position[2] }, true)
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
  const getGoomba = (
    name: string,
    position: CoordinateTuple,
    hasGravity = true,
    gravityScale = 1
  ) =>
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
      gravityScale,
      castShadow: true
    })
  return Promise.all([
    getGoomba('goomba-1', [0, GROUND_HEIGHT, GOOMBA_1_SPAWN_Z], true, GOOMBA_1_GRAVITY_SCALE),
    getGoomba('goomba-2', [GOOMBA_2_SPAWN_X, GRID_UNIT, 0]),
    getGoomba('goomba-4', [GOOMBA_4_SPAWN_X, GRID_UNIT, GRID_UNIT * -5])
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
  const [goombaWallBangA, goombaWallBangB, goombaJumpMovingBlock2] = await loadGoombas({
    scene,
    world
  })

  const cubeUp = new THREE.Vector3(0, CUBE_STEP_HEIGHT, 0)
  const cubeDown = new THREE.Vector3(0, -CUBE_STEP_HEIGHT, 0)
  const movingCubeTimeline: Timeline[] = [
    {
      name: 'cube: move',
      segments: [
        { name: 'rise', frames: STEP_CYCLE / 2 },
        { name: 'fall', frames: STEP_CYCLE / 2 }
      ],
      action: () => {
        const isRising = getSimulationFrame() % STEP_CYCLE < STEP_CYCLE / 2
        movingCube.userData.body.setTranslation(
          movingCube.position.add(isRising ? cubeUp : cubeDown),
          true
        )
      }
    }
  ]

  const elements: ComplexModel[] = [
    ...(balls as unknown as ComplexModel[]),
    goombaWallBangA,
    goombaWallBangB,
    goombaJumpMovingBlock2,
    movingCube,
    ...cubes
  ]

  const timelineManager = createTimelineManager()
  timelineManager.addActions([
    ...makeGoombaTimelineActions(cubes, getDelta, getSimulationFrame, [
      goombaWallBangA,
      goombaWallBangB,
      goombaJumpMovingBlock2
    ]),
    ...movingCubeTimeline
  ])
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

  animate({
    beforeTimeline: () => bindAnimatedElements(elements, world, getDelta()),
    timeline: timelineManager,
    isPaused: () => timelinePanelStore.isPaused
  })
}

const createScene = async (canvas: HTMLCanvasElement): Promise<void> => {
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
          shadow: {
            camera: { left: -400, right: 400, top: 400, bottom: -400 }
          }
        },
        hemisphere: { colors: [SKY_COLOR_TOP, SKY_COLOR_BOTTOM], intensity: 0 }
      }
    },
    defineSetup: async () =>
      buildTimeline({ scene, world, getDelta, animate, getSimulationFrame, getFrameRate })
  })
  const panelElements = elements.filter((e) => !isGroupedPanelElement(e as { name?: string }))
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
    { renderer, orbit, setCamera: setActiveCamera }
  )
  buildScenery({ scene, world })
  debugSceneStore.moveElementAfter('clouds', 'sky')
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
  if (hemisphereLight) {
    const hemisphereSchema = {
      skyColor: { color: true, label: 'Sky Color' },
      groundColor: { color: true, label: 'Ground Color' },
      intensity: { min: 0, max: 10, step: 0.1, label: 'Intensity' }
    }
    const hemisphereState = {
      skyColor: hemisphereLight.color.getHex(),
      groundColor: hemisphereLight.groundColor.getHex(),
      intensity: hemisphereLight.intensity
    }
    useElementPropertiesStore().registerElementProperties('hemisphere-light', {
      title: 'Hemisphere Light',
      schema: hemisphereSchema,
      getValue: (path: string) => (hemisphereState as Record<string, unknown>)[path],
      updateValue: (path: string, value: unknown) => {
        ;(hemisphereState as Record<string, unknown>)[path] = value
        if (path === 'skyColor') hemisphereLight.color.set(value as number)
        else if (path === 'groundColor') hemisphereLight.groundColor.set(value as number)
        else hemisphereLight.intensity = value as number
      }
    })
  }
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
