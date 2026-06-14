<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { controls } from '@/utils/control'
import { stats } from '@/utils/stats'
import * as THREE from 'three'

import { getModel, getTools, type ComplexModel } from '@webgamekit/threejs'
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
import { buildCloudObjects } from '@/views/Games/MarbleMadness/marbleEnvironment'
import type { RotationMap } from '@/types/three'
import { useTimelinePanelStore } from '@/stores/timelinePanel'
import { useDebugSceneStore } from '@/stores/debugScene'

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
})

const config = {
  directional: {
    enabled: true,
    helper: false,
    intensity: 1.2
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
const CUBE_STEP_HEIGHT = 0.5
const CUBE_CLUSTER_X_FAR = -2
const WALL_BANG_CUBE_Z_OFFSET = -5
const GOOMBA_SCALE = 0.3
const GOOMBA_1_SPAWN_Z = 22
const GOOMBA_2_SPAWN_X = 68
const COIN_SCALE = 20
const BALL_SPAWN_PAUSE_FRAMES = 50
const CLOUD_CENTER_HEIGHT = 200
const CLOUD_FIELD_SIZE = 600
const CLOUD_BASE_WIDTH = 80
const CLOUD_BASE_THICKNESS = 0.001
const CLOUD_BASE_DEPTH = 40
const CLOUD_WIDTH_VARIATION = 20
const CAMERA_POSITION_X = -184
const CAMERA_POSITION_Y = 84
const CAMERA_POSITION_Z = 48
const SKY_COLOR_TOP = 0xaee9ff
const SKY_COLOR_BOTTOM = 0x6fae6f

const APPROACH_FRAMES = 30
const CROSS_FRAMES = 60
const STEP_CYCLE = 200
const MOVING_BLOCK_JUMP_HEIGHT = 60

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

// Every patrol leg covers exactly one cube side (GRID_UNIT) at character.speed
const ONE_CUBE_FRAMES = GRID_UNIT / character.speed

const GOOMBA_1_PATROL_LEGS: { rotation: number; legCount: number; jumpLegIndices?: number[] }[] = [
  { rotation: rotationMap.forward, legCount: 3, jumpLegIndices: [0, 2] },
  { rotation: rotationMap.right, legCount: 2 },
  { rotation: rotationMap.backward, legCount: 3 },
  { rotation: rotationMap.left, legCount: 2 }
]

/**
 * Walks a rectangular patrol around the cube cluster, turning left between each
 * leg group. Every leg is exactly one cube side long (ONE_CUBE_FRAMES); the first
 * and last legs of the first group hop onto and off the cube cluster, before
 * resetting back to the starting position on a loop.
 */
const makeGoomba1PatrolMoves =
  (cubes: ComplexModel[], getDelta: () => number, jumpHeight: number) =>
  (model: ComplexModel): GoombaMove[] => [
    ...GOOMBA_1_PATROL_LEGS.flatMap(({ rotation, legCount, jumpLegIndices = [] }) =>
      Array.from({ length: legCount }, (_, legIndex) => {
        const isJumpLeg = jumpLegIndices.includes(legIndex)
        return {
          name: `patrol: face ${rotation} leg ${legIndex + 1}${isJumpLeg ? ' (jump)' : ''}`,
          frames: ONE_CUBE_FRAMES,
          ...(legIndex === 0 ? { actionStart: () => setRotation(model, rotation) } : {}),
          action: (frameInMove: number) => {
            controllerForward(cubes, [], createGoombaAnimData(model, getDelta))
            if (isJumpLeg && frameInMove < WALL_BANG_HOP_FRAMES) {
              controllerJump(model, cubes, character.speed, jumpHeight)
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

const JUMP_MOVING_BLOCK_GAP_FRAMES = STEP_CYCLE - (APPROACH_FRAMES * 2 + CROSS_FRAMES * 2 + 1)

/** Hops up and over the moving up/down block, then crosses back the other way */
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
      name: 'walk jump',
      frames: 1,
      action: () => controllerJump(model, [], character.speed, MOVING_BLOCK_JUMP_HEIGHT)
    },
    {
      name: 'walk cross',
      frames: CROSS_FRAMES,
      action: () => controllerForward([], [], createGoombaAnimData(model, getDelta))
    },
    {
      name: 'walk cross back',
      frames: CROSS_FRAMES,
      action: () => controllerForward([], [], createGoombaAnimData(model, getDelta, true))
    },
    {
      name: 'walk return',
      frames: APPROACH_FRAMES,
      action: () => controllerForward([], [], createGoombaAnimData(model, getDelta, true))
    },
    { name: 'idle', frames: JUMP_MOVING_BLOCK_GAP_FRAMES }
  ]

const toSegments = (moves: GoombaMove[]): { name: string; frames: number }[] =>
  moves.map(({ name, frames }) => ({ name, frames }))

/** Builds the per-goomba movement timeline actions for the patrol, wall-bang, and moving-block goombas */
const makeGoombaTimelineActions = (
  cubes: ComplexModel[],
  getDelta: () => number,
  getSimulationFrame: () => number,
  [goombaWallBangA, goombaWallBangB, goombaJumpMovingBlock]: [
    ComplexModel,
    ComplexModel,
    ComplexModel
  ]
): Timeline[] => {
  const goomba1Moves = makeGoomba1PatrolMoves(
    cubes,
    getDelta,
    GOOMBA_1_JUMP_HEIGHT
  )(goombaWallBangA)
  const goomba2Moves = makeWallBangMoves(cubes, getDelta, rotationMap['right'])(goombaWallBangB)
  const goomba4Moves = makeJumpMovingBlockMoves(
    getDelta,
    rotationMap['right']
  )(goombaJumpMovingBlock)

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

const setupStaticObjects = ({ scene, world }: SceneWorld) => {
  const cubes = [
    [0, 0, 0],
    [0, 0, 1],
    [0, 0, 2],
    [0, 1, 2],
    [-1, 0, 2],
    [CUBE_CLUSTER_X_FAR, 0, 0],
    [CUBE_CLUSTER_X_FAR, 0, 1],
    [CUBE_CLUSTER_X_FAR, 0, 2],
    [1, 0, WALL_BANG_CUBE_Z_OFFSET]
  ].map(([x, y, z]) =>
    getCube(scene, world, {
      size: [GRID_UNIT, GRID_UNIT, GRID_UNIT],
      restitution: 0,
      position: [GRID_UNIT * x, GRID_UNIT * y - 1, -GRID_UNIT * z],
      type: 'fixed',
      texture: brickTexture,
      boundary: 0.5,
      color: 0x888888
    })
  )
  const coin = getCoinBlock(scene, world, { position: [0, SPAWN_HEIGHT, -GRID_UNIT * 2] })
  coin.scale.setScalar(COIN_SCALE)
  const ballOptions = { size: 10, showHelper: false, weight: 150 }
  const balls = [
    getBall(scene, world, { ...ballOptions, position: [0, SPAWN_HEIGHT, -GRID_UNIT] }),
    getBall(scene, world, {
      ...ballOptions,
      position: [GRID_UNIT, SPAWN_HEIGHT, GRID_UNIT],
      hasGravity: true,
      type: 'kinematicPositionBased'
    })
  ]
  const movingCube = getCube(scene, world, {
    size: [GRID_UNIT, GRID_UNIT, GRID_UNIT],
    restitution: 0,
    position: [0, -1, GRID_UNIT * 5],
    type: 'kinematicPositionBased',
    texture: brickTexture,
    boundary: 0.5,
    color: 0x888888
  })
  return { coin, cubes, balls, movingCube, ballOptions }
}

const loadGoombas = async ({ scene, world }: SceneWorld) => {
  const getGoomba = (position: CoordinateTuple, hasGravity = true) =>
    getModel(scene, world, 'goomba.glb', {
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
    getGoomba([0, GROUND_HEIGHT, GOOMBA_1_SPAWN_Z]),
    getGoomba([GOOMBA_2_SPAWN_X, GRID_UNIT, 0]),
    getGoomba([GRID_UNIT, GRID_UNIT, GRID_UNIT * 5])
  ])
}

const buildScenery = ({ scene, world }: SceneWorld): void => {
  buildCloudObjects(scene, world, {
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
  buildScenery({ scene, world })
  const { coin, cubes, balls, movingCube, ballOptions } = setupStaticObjects({ scene, world })
  const [goombaWallBangA, goombaWallBangB, goombaJumpMovingBlock] = await loadGoombas({
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
    ...balls,
    goombaWallBangA,
    goombaWallBangB,
    goombaJumpMovingBlock,
    movingCube,
    ...cubes
  ]

  const timelineManager = createTimelineManager()
  timelineManager.addActions([
    ...makeGoombaTimelineActions(cubes, getDelta, getSimulationFrame, [
      goombaWallBangA,
      goombaWallBangB,
      goombaJumpMovingBlock
    ]),
    ...movingCubeTimeline
  ])
  timelineManager.addAction({
    name: 'coin: flip',
    start: 0,
    category: 'visual-effects',
    action: () => (coin.rotation.z += 0.05)
  })
  timelineManager.addAction({
    name: 'ball: spawn',
    interval: [1, BALL_SPAWN_PAUSE_FRAMES] as [number, number],
    category: 'physics',
    action: () =>
      elements.push(
        getBall(scene, world, { ...ballOptions, position: [0, SPAWN_HEIGHT, -GRID_UNIT] })
      )
  })
  timelinePanelStore.register({
    getTimeline: () => timelineManager.getTimeline(),
    getCurrentFrame: getSimulationFrame,
    getFrameRate,
    setActionEnabled: (id, enabled) => timelineManager.updateAction(id, { enabled })
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
    cleanup
  } = await getTools({
    stats,
    route,
    canvas,
    onProgress: handleProgress
  })
  cleanupScene = cleanup
  const { elements } = await setup({
    config: {
      camera: { position: [CAMERA_POSITION_X, CAMERA_POSITION_Y, CAMERA_POSITION_Z] },
      ground: { size: 100000, color: 0x227755 },
      sky: { color: 0x8ecae6, size: 700 },
      lights: {
        directional: {
          intensity: config.directional.intensity,
          shadow: {
            camera: { left: -250, right: 250, top: 250, bottom: -250 }
          }
        },
        hemisphere: { colors: [SKY_COLOR_TOP, SKY_COLOR_BOTTOM] }
      }
    },
    defineSetup: async () =>
      buildTimeline({ scene, world, getDelta, animate, getSimulationFrame, getFrameRate })
  })
  debugSceneStore.registerSceneElements(camera, elements, undefined, renderer)
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
