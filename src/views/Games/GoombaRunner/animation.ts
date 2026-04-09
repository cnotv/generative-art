import * as THREE from 'three'
import type { Ref } from 'vue'
import RAPIER from '@dimforge/rapier3d-compat'
import { createTimelineManager } from '@webgamekit/animation'
import { config } from './config'
import {
  populateInitialBackgrounds,
  updateFallingBackgrounds,
  createBackgrounds,
  moveBackgrounds,
  resetBackgrounds,
  createTextureAreaBackgroundLayer,
  moveAndRecycleTextureAreaBackgrounds,
  resetTextureAreaBackgrounds,
  type BackgroundElement,
  type TextureAreaElement,
  type TextureAreaLayerConfig
} from './helpers/background'
import { moveBlocks, resetObstacles, createCubes, createObstaclesGroup } from './helpers/block'
import { moveGround, resetGround, getGround } from './helpers/ground'
import {
  ensurePlayerAboveGround,
  movePlayer,
  handleJump,
  handleArcMovement,
  checkCollisions,
  updateExplosionParticles,
  updatePlayerAnimation,
  resetPlayer,
  type PlayerMovement
} from './helpers/player'

import { getSpeed, initPhysics, type RapierPhysicsObject } from './helpers/setup'
import { createPlayer } from './helpers/player'
import { incrementGameScore, isGamePlaying, isGameStart, gameScore } from './helpers/setup'
import type { useUiStore } from '@/stores/ui'

const addHorizonLine = (scene: THREE.Scene) => {
  const horizonGeometry = new THREE.BoxGeometry(4000, 3, 2)
  const horizonMaterial = new THREE.MeshBasicMaterial({
    color: 0x333333,
    transparent: true,
    opacity: 0.8
  })

  const horizonLine = new THREE.Mesh(horizonGeometry, horizonMaterial)
  horizonLine.name = 'Horizon'
  horizonLine.position.set(0, 11, -200)
  horizonLine.receiveShadow = false
  horizonLine.castShadow = false

  scene.add(horizonLine)
  return horizonLine
}

export interface CreateTimelineOptions {
  scene: THREE.Scene
  getDelta: () => number
  world: RAPIER.World
  shouldClearObstacles: Ref<boolean>
  camera: THREE.PerspectiveCamera
  uiStore: ReturnType<typeof useUiStore>
  endGame: () => void
  onReset?: () => void
}

interface TimelineState {
  scene: THREE.Scene
  getDelta: () => number
  world: RAPIER.World
  shouldClearObstacles: Ref<boolean>
  camera: THREE.PerspectiveCamera
  uiStore: ReturnType<typeof useUiStore>
  endGame: () => void
  onReset?: () => void
  physics: RapierPhysicsObject
  physicsHelper: { update: () => void } | null
  player: THREE.Object3D
  playerController: RAPIER.KinematicCharacterController
  model: THREE.Group | null
  obstacles: THREE.Object3D[]
  backgrounds: BackgroundElement[]
  groundTexture: ReturnType<typeof getGround>
  playerMovement: PlayerMovement
  backgroundTimers: number[]
  loggedCollisions: Set<string>
  horizonLine: THREE.Mesh
  backgroundsPopulated: boolean
  textureAreaBackgrounds: TextureAreaElement[]
}

const buildGameLogicActions = (state: TimelineState) => [
  {
    name: 'Cleanup and reset',
    category: 'game-logic',
    action: () => {
      if (state.physicsHelper) state.physicsHelper.update()
      updateExplosionParticles(state.scene, state.getDelta())
    }
  },
  {
    name: 'Reset background',
    category: 'game-logic',
    action: () => {
      if (isGameStart && !state.backgroundsPopulated) {
        populateInitialBackgrounds(state.scene, state.world, state.backgrounds)
        state.backgroundsPopulated = true
      }
      updateFallingBackgrounds(state.getDelta(), state.backgrounds, state.scene)
      updateFallingBackgrounds(state.getDelta(), state.textureAreaBackgrounds, state.scene)
      if (state.shouldClearObstacles.value) {
        resetObstacles(state.obstacles, state.scene, state.physics)
        resetBackgrounds(state.scene, state.world, state.backgrounds)
        state.textureAreaBackgrounds = resetTextureAreaBackgrounds(
          state.scene,
          state.world,
          state.textureAreaBackgrounds
        )
        state.backgroundsPopulated = true
        resetPlayer(state.player, state.scene)
        resetGround(state.groundTexture)
        state.loggedCollisions.clear()
        state.shouldClearObstacles.value = false
        state.onReset?.()
      }
    }
  },
  {
    name: 'Generate cubes',
    category: 'game-logic',
    frequency: config.blocks.spacing,
    action: async () => {
      if (!isGamePlaying.value) return
      await createCubes(state.scene, state.world, state.physics, state.obstacles)
    }
  },
  {
    name: 'Move ground',
    category: 'game-logic',
    action: () => {
      moveGround(state.groundTexture, isGamePlaying.value, gameScore.value)
    }
  }
]

const buildVisualAndInputActions = (state: TimelineState) => [
  {
    name: 'Move background',
    category: 'visual-effects',
    action: () => {
      if (isGamePlaying.value) {
        createBackgrounds(
          state.scene,
          state.world,
          state.backgrounds,
          state.backgroundTimers,
          gameScore.value
        )
        moveBackgrounds(state.scene, state.camera, state.backgrounds, gameScore.value)
        moveAndRecycleTextureAreaBackgrounds(state.textureAreaBackgrounds, gameScore.value)
      }
    }
  },
  {
    name: 'Make Goomba run',
    category: 'user-input',
    action: () => {
      ensurePlayerAboveGround(state.player)
      movePlayer({
        player: state.player,
        playerController: state.playerController,
        physics: state.physics,
        playerMovement: state.playerMovement,
        isPlaying: isGamePlaying.value,
        config
      })
      handleJump({
        player: state.player,
        isPlaying: isGamePlaying.value,
        uiStore: state.uiStore,
        camera: state.camera,
        horizonLine: state.horizonLine,
        config
      })
      handleArcMovement(state.player)
      checkCollisions({
        player: state.player,
        obstacles: state.obstacles,
        backgrounds: state.backgrounds,
        textureAreaBackgrounds: state.textureAreaBackgrounds,
        scene: state.scene,
        endGameCallback: state.endGame,
        loggedCollisions: state.loggedCollisions,
        config
      })
      updatePlayerAnimation({
        model: state.model,
        isPlaying: isGamePlaying.value,
        gameScore: gameScore.value,
        getDelta: state.getDelta,
        getSpeed,
        config
      })
    }
  },
  {
    name: 'Move obstacles',
    category: 'game-logic',
    action: () => {
      if (!isGamePlaying.value) return
      moveBlocks({
        obstacles: state.obstacles,
        physics: state.physics,
        gameScore: gameScore.value,
        player: state.player,
        onScore: (points) => incrementGameScore(points)
      })
    }
  }
]

const createRegenerateTextureArea =
  (state: TimelineState) => (areaName: string, layerConfigs: TextureAreaLayerConfig[]) => {
    const removed = state.textureAreaBackgrounds.filter((element) => element.mesh.name === areaName)
    removed.forEach((element) => state.scene.remove(element.mesh))

    const remaining = state.textureAreaBackgrounds.filter(
      (element) => element.mesh.name !== areaName
    )
    const newElements = layerConfigs.flatMap((lc) =>
      createTextureAreaBackgroundLayer(state.scene, state.world, lc)
    )

    state.textureAreaBackgrounds = [...remaining, ...newElements]
  }

const createTimeline = async ({
  scene,
  getDelta,
  world,
  shouldClearObstacles,
  camera,
  uiStore,
  endGame,
  onReset
}: CreateTimelineOptions) => {
  const { physics, physicsHelper } = await initPhysics(scene)
  const { player, playerController, model } = await createPlayer(scene, physics, world)

  createObstaclesGroup(scene)

  const state: TimelineState = {
    scene,
    getDelta,
    world,
    shouldClearObstacles,
    camera,
    uiStore,
    endGame,
    onReset,
    physics,
    physicsHelper,
    player,
    playerController,
    model,
    obstacles: [],
    backgrounds: [],
    groundTexture: getGround(scene, physics),
    playerMovement: { forward: 0, right: 0, up: 0 },
    backgroundTimers: config.backgrounds.layers.map(() => 0),
    loggedCollisions: new Set<string>(),
    horizonLine: addHorizonLine(scene),
    backgroundsPopulated: false,
    textureAreaBackgrounds: config.backgrounds.textureAreaLayers.flatMap((layerConfig) =>
      createTextureAreaBackgroundLayer(scene, world, layerConfig)
    )
  }

  const timelineManager = createTimelineManager()
  timelineManager.addActions([
    ...buildGameLogicActions(state),
    ...buildVisualAndInputActions(state)
  ])

  return { timelineManager, regenerateTextureArea: createRegenerateTextureArea(state) }
}

export { createTimeline }
