<script setup lang="ts">
import { onMounted, onUnmounted, ref, shallowRef, toRaw } from 'vue'
import { useRoute } from 'vue-router'
import * as THREE from 'three'
import { cameraFollowPlayer, removeElements } from '@webgamekit/threejs'
import type { CoordinateTuple } from '@webgamekit/animation'
import { createTimelineManager } from '@webgamekit/animation'
import { createGame, type GameState } from '@webgamekit/game'
import { createControls, isMobile } from '@webgamekit/controls'
import TouchControl from '@/components/TouchControl.vue'
import { updateAnimation } from '@webgamekit/animation'
import type { Grid } from '@webgamekit/logic'
import { registerViewConfig, unregisterViewConfig, createReactiveConfig } from '@/stores/viewConfig'
import { useSceneViewStore } from '@/stores/sceneView'

import { createOfficeWalls, createIslandMaze, createOfficeShelves } from './helpers/island'
import {
  createStartElevator,
  createExitElevator,
  openElevator,
  updateElevatorMixer,
  isPlayerNearElevator,
  type ElevatorState
} from './helpers/elevator'
import { createMinimap } from './helpers/minimap'
import { createScorePoster } from './helpers/scorePoster'
import { spawnCoins, updateCoinSpin, checkCoinCollection } from './helpers/coins'
import {
  spawnPaperPlanes,
  updatePaperPlaneChase,
  buildNavigationGrid,
  createInitialPaperPlanePathState,
  NAVIGATION_GRID_CONFIG,
  type PaperPlanePathState
} from './helpers/enemies'
import { createPlayer, updatePlayerMovement } from './helpers/player'
import { getMazeCellCenters } from './helpers/maze'
import { createPathDebug, type PathEntry } from './helpers/pathDebug'
import type { ComplexModel } from '@webgamekit/threejs'
import {
  setupConfig,
  controlBindings,
  configControls,
  CAMERA_OFFSET,
  PAPER_PLANE_COUNT,
  PAPER_PLANE_SPEED,
  PLAYER_SPEED,
  COLLECTION_RADIUS,
  COIN_SPIN_SPEED,
  ISLAND_SIZE,
  MAZE_CELL_SIZE,
  MAZE_EXIT_POSITION,
  PLAYER_START,
  PLAYER_DISTANCE,
  PATH_COLOR_PLAYER,
  PATH_COLORS_PLANES,
  PATH_Y_STEP,
  ELEVATOR_TRIGGER_RADIUS
} from './config'

type ReactiveConfigShape = {
  player: { speed: number }
  autoMode: { enabled: boolean }
  debug: { showPath: boolean; showColliders: boolean; showDesks: boolean }
}

const route = useRoute()
const store = useSceneViewStore()

const reactiveConfig = createReactiveConfig({
  player: { speed: PLAYER_SPEED },
  paperPlane: { speed: PAPER_PLANE_SPEED },
  autoMode: { enabled: true },
  debug: { showPath: false, showColliders: false, showDesks: true }
})

const gameState = shallowRef<GameState>()
createGame({ data: { score: 0, level: 1 } }, gameState, onUnmounted)

const canvas = ref<HTMLCanvasElement | null>(null)
const minimapCanvas = ref<HTMLCanvasElement | null>(null)

const toggleAutoMode = () => {
  const cfg = reactiveConfig.value as unknown as { autoMode: { enabled: boolean } }
  cfg.autoMode.enabled = !cfg.autoMode.enabled
}

const isMobileDevice = isMobile()

const handleAction = (action: string) => {
  if (action === 'toggle-auto') toggleAutoMode()
}

const { destroyControls, currentActions } = createControls({
  ...controlBindings,
  onAction: handleAction
})

const DIRECTIONAL_ACTIONS = ['move-left', 'move-right', 'move-up', 'move-down']

const handleSpacebar = (e: KeyboardEvent) => {
  if (e.code !== 'Space') return
  toggleAutoMode()
}

// ── Level State ──────────────────────────────────────────────────────────────

type LevelState = {
  navGrid: Grid
  coins: ComplexModel[]
  paperPlanePathStates: PaperPlanePathState[]
  playerPathState: PaperPlanePathState
  isResettingLevel: boolean
  startElevatorState: ElevatorState | null
  exitElevatorState: ElevatorState | null
  deskModels: ComplexModel[]
  levelDispose: () => void
  updateMinimap:
    | ((pos: THREE.Vector3, coins: ComplexModel[], planes: ComplexModel[]) => void)
    | null
}

const createLevelState = (): LevelState => ({
  navGrid: buildNavigationGrid([]),
  coins: [],
  paperPlanePathStates: [],
  playerPathState: createInitialPaperPlanePathState(),
  isResettingLevel: false,
  startElevatorState: null,
  exitElevatorState: null,
  deskModels: [],
  levelDispose: () => {},
  updateMinimap: null
})

// ── Build Level ──────────────────────────────────────────────────────────────

const buildGameLevel = async (
  scene: THREE.Scene,
  world: Parameters<typeof removeElements>[0],
  player: ComplexModel,
  paperPlanes: ComplexModel[],
  state: LevelState
): Promise<void> => {
  if (state.isResettingLevel) return
  state.isResettingLevel = true

  state.levelDispose()

  const { walls, segments, mazeGrid, extraBodies, desksGroup } = await createIslandMaze(
    scene,
    world
  )
  const shelves = await createOfficeShelves(scene, world)
  const [startElev, exitElev] = await Promise.all([
    createStartElevator(scene, world),
    createExitElevator(scene, world)
  ])
  state.startElevatorState = startElev
  state.exitElevatorState = exitElev

  state.navGrid = buildNavigationGrid(mazeGrid)
  state.updateMinimap = minimapCanvas.value ? createMinimap(minimapCanvas.value, segments) : null
  state.coins = spawnCoins(scene, world, getMazeCellCenters(ISLAND_SIZE, MAZE_CELL_SIZE, 2))
  state.paperPlanePathStates = paperPlanes.map(() => createInitialPaperPlanePathState())
  state.playerPathState = createInitialPaperPlanePathState()

  state.deskModels = walls.filter((w) => w.name === 'Desk')
  state.deskModels.forEach((desk) => {
    if (desk.userData.helper) desk.userData.helper.visible = false
  })

  state.levelDispose = () => {
    removeElements(world, [...walls, ...shelves, ...state.coins, startElev.model, exitElev.model])
    desksGroup.removeFromParent()
    state.coins[0]?.parent?.removeFromParent()
    state.deskModels = []
    extraBodies.forEach((b) => world.removeRigidBody(b))
    state.coins = []
    state.startElevatorState = null
    state.exitElevatorState = null
  }

  const [sx, sy, sz] = PLAYER_START as [number, number, number]
  ;(
    player.userData.collider as { setTranslation: (v: { x: number; y: number; z: number }) => void }
  ).setTranslation({ x: sx, y: sy, z: sz })
  player.position.set(sx, sy, sz)

  openElevator(startElev)
  state.isResettingLevel = false
}

// ── Timeline Helpers ─────────────────────────────────────────────────────────

// Returns true only when the player is at the open exit with all coins collected.
const isReadyToAdvance = (state: LevelState, player: ComplexModel): boolean => {
  const exit = state.exitElevatorState
  if (!exit || exit.isOpening) return false
  const playerNear = isPlayerNearElevator(player.position, exit, ELEVATOR_TRIGGER_RADIUS)
  if (!exit.isOpen) {
    if (playerNear) openElevator(exit)
    return false
  }
  return playerNear && state.coins.length === 0
}

const advanceToNextLevel = (
  state: LevelState,
  player: ComplexModel,
  updatePoster: (score: number, level: number) => void,
  buildLevel: () => Promise<void>
): void => {
  const newLevel = (gameState.value?.data.level ?? 1) + 1
  gameState.value?.setData('level', newLevel)
  updatePoster(gameState.value?.data.score ?? 0, newLevel)
  player.visible = false
  buildLevel().then(() => {
    player.visible = true
    if (state.startElevatorState) openElevator(state.startElevatorState)
  })
}

const handleLevelExit = (
  state: LevelState,
  player: ComplexModel,
  updatePoster: (score: number, level: number) => void,
  buildLevel: () => Promise<void>
): void => {
  if (state.isResettingLevel || !isReadyToAdvance(state, player)) return
  advanceToNextLevel(state, player, updatePoster, buildLevel)
}

// ── Timeline ─────────────────────────────────────────────────────────────────

type OrbitReference = Parameters<typeof cameraFollowPlayer>[3]

type TimelineAssets = {
  player: ComplexModel
  paperPlanes: ComplexModel[]
  camera: THREE.Camera
  scene: THREE.Scene
  world: Parameters<typeof removeElements>[0]
  getDelta: () => number
  cameraOffset: CoordinateTuple
  exitPosition: THREE.Vector3
  updatePoster: (score: number, level: number) => void
  updatePaths: (entries: PathEntry[], show: boolean) => void
  playerFilter: (col: object) => boolean
  planeFilter: (col: object) => boolean
  buildLevel: () => Promise<void>
  getOrbitReference: () => OrbitReference | null
  setOrbitReference: (ref: OrbitReference) => void
}

const applyAutoMovement = (
  state: LevelState,
  assets: Pick<TimelineAssets, 'player' | 'getDelta' | 'exitPosition' | 'playerFilter'>
): void => {
  const { player, getDelta, exitPosition, playerFilter } = assets
  const cfg = reactiveConfig.value as unknown as ReactiveConfigShape
  const delta = getDelta()
  const autoTarget =
    state.coins.length > 0
      ? state.coins.reduce((nearest, coin) => {
          const dnx = nearest.x - player.position.x
          const dnz = nearest.z - player.position.z
          const dcx = coin.position.x - player.position.x
          const dcz = coin.position.z - player.position.z
          return dcx * dcx + dcz * dcz < dnx * dnx + dnz * dnz ? coin.position : nearest
        }, state.coins[0].position)
      : exitPosition
  state.playerPathState = updatePaperPlaneChase({
    plane: player,
    playerPosition: autoTarget,
    speed: cfg.player.speed,
    delta,
    navGrid: state.navGrid,
    pathState: state.playerPathState,
    filterPredicate: playerFilter
  })
  updateAnimation({
    actionName: state.playerPathState.path ? 'walk' : 'idle',
    player,
    delta: delta * 2,
    speed: cfg.player.speed,
    distance: PLAYER_DISTANCE
  })
}

const addPlayerMovementAction = (
  timelineManager: ReturnType<typeof createTimelineManager>,
  state: LevelState,
  assets: TimelineAssets
): void => {
  const {
    player,
    paperPlanes,
    camera,
    getDelta,
    cameraOffset,
    exitPosition,
    updatePaths,
    playerFilter,
    getOrbitReference,
    setOrbitReference
  } = assets
  timelineManager.addAction({
    name: 'player-movement',
    category: 'user-input',
    action: () => {
      if (state.isResettingLevel) return
      const cfg = reactiveConfig.value as unknown as ReactiveConfigShape
      const isMovingManually = DIRECTIONAL_ACTIONS.some((key) => currentActions[key])
      if (cfg.autoMode.enabled && isMovingManually) cfg.autoMode.enabled = false
      if (cfg.autoMode.enabled && !isMovingManually) {
        applyAutoMovement(state, { player, getDelta, exitPosition, playerFilter })
      } else {
        updatePlayerMovement(player, currentActions, getDelta, cfg.player.speed, playerFilter)
      }
      updatePaths(
        [
          { path: state.playerPathState.path, color: PATH_COLOR_PLAYER },
          ...state.paperPlanePathStates.map((s, i) => ({
            path: s.path,
            color: PATH_COLORS_PLANES[i % PATH_COLORS_PLANES.length],
            yOffset: PATH_Y_STEP * (i + 1)
          }))
        ],
        cfg.debug.showPath
      )
      const resolvedOrbitReference =
        getOrbitReference() ?? (toRaw(store.orbitReference) as OrbitReference)
      if (!getOrbitReference()) setOrbitReference(resolvedOrbitReference)
      cameraFollowPlayer(camera, player, cameraOffset, resolvedOrbitReference, ['x', 'z'])
      state.updateMinimap?.(player.position, state.coins, paperPlanes)
    }
  })
}

const addAiAndPhysicsActions = (
  timelineManager: ReturnType<typeof createTimelineManager>,
  state: LevelState,
  assets: TimelineAssets
): void => {
  const { player, paperPlanes, world, getDelta, updatePoster, planeFilter, buildLevel } = assets

  timelineManager.addAction({
    name: 'coin-spin',
    category: 'visual',
    action: () => {
      updateCoinSpin(state.coins, getDelta(), COIN_SPIN_SPEED)
    }
  })

  timelineManager.addAction({
    frequency: 2,
    name: 'paper-plane-chase',
    category: 'ai',
    action: () => {
      const cfg = reactiveConfig.value as unknown as ReactiveConfigShape & {
        paperPlane: { speed: number }
      }
      const delta = getDelta()
      state.paperPlanePathStates = paperPlanes.map((plane, i) =>
        updatePaperPlaneChase({
          plane,
          playerPosition: player.position,
          speed: cfg.paperPlane.speed,
          delta,
          navGrid: state.navGrid,
          pathState: state.paperPlanePathStates[i],
          filterPredicate: planeFilter
        })
      )
    }
  })

  timelineManager.addAction({
    frequency: 4,
    name: 'coin-collection',
    category: 'physics',
    action: () => {
      if (state.coins.length === 0) return
      const collected = checkCoinCollection(player.position, state.coins, COLLECTION_RADIUS)
      if (collected.length === 0) return
      ;[...collected].reverse().forEach((index) => {
        removeElements(world, [state.coins[index]])
        state.coins = [...state.coins.slice(0, index), ...state.coins.slice(index + 1)]
      })
      const newScore = (gameState.value?.data.score ?? 0) + collected.length
      gameState.value?.setData('score', newScore)
      updatePoster(newScore, gameState.value?.data.level ?? 1)
    }
  })

  timelineManager.addAction({
    frequency: 4,
    name: 'level-exit',
    category: 'physics',
    action: () => handleLevelExit(state, player, updatePoster, buildLevel)
  })
}

const addDebugAndElevatorActions = (
  timelineManager: ReturnType<typeof createTimelineManager>,
  state: LevelState,
  assets: TimelineAssets
): void => {
  const { player, paperPlanes, getDelta } = assets

  timelineManager.addAction({
    name: 'debug-helpers',
    category: 'visual',
    action: () => {
      const cfg = reactiveConfig.value as unknown as ReactiveConfigShape
      const showColliders = cfg.debug.showColliders
      const applyHelper = (model: ComplexModel) => {
        const helper = model.userData.helper as THREE.BoxHelper | undefined
        if (!helper) return
        helper.visible = showColliders
        if (showColliders) helper.update()
      }
      applyHelper(player)
      paperPlanes.forEach(applyHelper)
      state.deskModels.forEach(applyHelper)
      if (state.startElevatorState) applyHelper(state.startElevatorState.model)
      if (state.exitElevatorState) applyHelper(state.exitElevatorState.model)
      state.deskModels.forEach((desk) => {
        desk.visible = cfg.debug.showDesks
      })
    }
  })

  timelineManager.addAction({
    name: 'elevator-update',
    category: 'visual',
    action: () => {
      const delta = getDelta()
      if (state.startElevatorState) updateElevatorMixer(state.startElevatorState, delta)
      if (state.exitElevatorState) updateElevatorMixer(state.exitElevatorState, delta)
    }
  })
}

const registerGameTimeline = (
  timelineManager: ReturnType<typeof createTimelineManager>,
  state: LevelState,
  assets: TimelineAssets
): void => {
  addPlayerMovementAction(timelineManager, state, assets)
  addAiAndPhysicsActions(timelineManager, state, assets)
  addDebugAndElevatorActions(timelineManager, state, assets)
}

// ── Mount ────────────────────────────────────────────────────────────────────

onMounted(async () => {
  if (!canvas.value) return
  registerViewConfig(route.name as string, reactiveConfig, configControls)
  window.addEventListener('keydown', handleSpacebar)

  await store.init(canvas.value, setupConfig, {
    viewPanels: { showConfig: false, showElements: false },
    playMode: true,
    defineSetup: async ({ scene, camera, world, getDelta, animate }) => {
      const cameraOffset = CAMERA_OFFSET as CoordinateTuple
      createOfficeWalls(scene, world)
      const player = await createPlayer(scene, world)
      const updatePoster = createScorePoster(scene)
      const paperPlanes = await spawnPaperPlanes(scene, world, PAPER_PLANE_COUNT)
      const updatePaths = createPathDebug(scene, NAVIGATION_GRID_CONFIG)
      const planeColliders = new Set<object>(paperPlanes.map((p) => p.userData.collider as object))
      const playerCollider = player.userData.collider as object
      if (player.userData.helper) (player.userData.helper as THREE.BoxHelper).visible = false
      paperPlanes.forEach((plane) => {
        if (plane.userData.helper) (plane.userData.helper as THREE.BoxHelper).visible = false
      })

      const state = createLevelState()
      const playerFilter = (col: object): boolean =>
        !planeColliders.has(col) &&
        !state.coins.some((c) => (c.userData.collider as object) === col) &&
        col !== (state.startElevatorState?.model.userData.collider as object | undefined)
      const planeFilter = (col: object): boolean =>
        col !== playerCollider && !state.coins.some((c) => (c.userData.collider as object) === col)

      const buildLevel = async () => {
        updatePaths([], false)
        await buildGameLevel(scene, world, player, paperPlanes, state)
        store.refreshElements()
      }
      await buildLevel()

      const exitPosition = new THREE.Vector3(...(MAZE_EXIT_POSITION as [number, number, number]))
      let orbitReference: OrbitReference | null = null
      const timelineManager = createTimelineManager()

      registerGameTimeline(timelineManager, state, {
        player,
        paperPlanes,
        camera,
        scene,
        world,
        getDelta,
        cameraOffset,
        exitPosition,
        updatePoster,
        updatePaths,
        playerFilter,
        planeFilter,
        buildLevel,
        getOrbitReference: () => orbitReference,
        setOrbitReference: (ref) => {
          orbitReference = ref
        }
      })

      animate({ beforeTimeline: () => {}, timeline: timelineManager })
    }
  })
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleSpacebar)
  store.cleanup()
  destroyControls()
  unregisterViewConfig(route.name as string)
})
</script>

<template>
  <canvas ref="canvas" />
  <canvas ref="minimapCanvas" class="maze__minimap" width="160" height="160" />
  <TouchControl
    v-if="isMobileDevice"
    style="left: 25px; bottom: 25px"
    :mapping="{
      left: 'move-left',
      right: 'move-right',
      up: 'move-down',
      down: 'move-up'
    }"
    :options="{ deadzone: 0.15, enableEightWay: true }"
    :current-actions="currentActions"
    :on-action="handleAction"
  />
</template>

<style scoped>
.maze__minimap {
  position: fixed;
  bottom: var(--minimap-margin);
  right: var(--minimap-margin);
  width: var(--minimap-size);
  height: var(--minimap-size);
  border-radius: var(--minimap-border-radius);
  opacity: var(--minimap-opacity);
  pointer-events: none;
}
</style>
