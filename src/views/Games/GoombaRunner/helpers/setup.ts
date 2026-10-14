import * as THREE from 'three'
import { RapierPhysics, type RapierPhysicsObject } from 'three/addons/physics/RapierPhysics.js'
import { RapierHelper } from 'three/addons/helpers/RapierHelper.js'
import { config } from '../config'
import { createGame, type GameState, type GameStatus } from '@webgamekit/game'
import { onUnmounted, shallowRef, computed, type ShallowRef } from 'vue'
import type { ComplexModel } from '@webgamekit/threejs'

export type { RapierPhysicsObject }

// Facade for game state management
const gameState: ShallowRef<GameState | undefined> = shallowRef(undefined)
createGame({ score: 0, highestScore: 0, isNewHighScore: false }, gameState, onUnmounted)
const isGameStart = computed(() => gameState.value?.status === 'idle')
const isGamePlaying = computed(() => gameState.value?.status === 'playing')
const isGameOver = computed(() => gameState.value?.status === 'game-over')
const isNewHighScore = computed(() => gameState.value?.data.isNewHighScore as boolean | undefined)
const gameScore = computed(() => (gameState.value?.data.score as number | undefined) ?? 0)
const gameStatus = computed(() => gameState.value?.status)
/**
 * Sets the game's status.
 * @param status The new status.
 */
const setStatus = (status: GameStatus): void => {
  gameState.value?.setStatus(status)
}
/**
 * Sets the game's score.
 * @param score The new score.
 */
const setScore = (score: number): void => {
  gameState.value.setData('score', score)
}
const highestScore = computed(() => gameState.value.data.highestScore)

/**
 * Load high score from localStorage
 * @param highScoreKey The storage key.
 * @returns The stored high score, 0 when there is none.
 */
const loadHighScore = (highScoreKey = 'goomba-runner-high-score'): number => {
  const saved = localStorage.getItem(highScoreKey)
  const parsed = saved ? parseInt(saved, 10) : 0
  const highScore = isNaN(parsed) ? 0 : parsed
  gameState.value.data.highestScore = highScore
  return highScore
}

/**
 * Check if current score is a new high score and save it
 * @param highScoreKey The storage key.
 * @returns True when the score beat the high score.
 */
const checkHighScore = (highScoreKey = 'goomba-runner-high-score'): boolean => {
  const currentScore = gameState.value.data.score
  const highestScore = gameState.value.data.highestScore
  const isNewHighScore = currentScore > highestScore

  gameState.value.data.isNewHighScore = isNewHighScore
  if (isNewHighScore) {
    localStorage.setItem(highScoreKey, currentScore.toString())
    gameState.value.data.highestScore = currentScore
  }
  return isNewHighScore
}

/**
 * Increment the game score by specified points
 * @param points Points to add.
 */
const incrementGameScore = (points: number): void => {
  if (!isNaN(points)) {
    setScore(gameScore.value + points)
  }
}

/**
 * Starts Rapier physics and, when the config asks, a helper that draws the colliders.
 * @param scene The scene to add the helper to.
 * @returns The physics object and the helper.
 */
const initPhysics = async (scene: THREE.Scene) => {
  //Initialize physics engine using the script in the jsm/physics folder
  const physics = await RapierPhysics()

  //Optionally display collider outlines
  const physicsHelper = new RapierHelper(physics.world)
  if (config.game.helper) {
    scene.add(physicsHelper) // Enable helper to show colliders
  }

  physics.addScene(scene)

  return { physics, physicsHelper }
}

interface GlitchOptions {
  opacity: number
  zPosition: number
}

/**
 * Gives a semi-transparent element a render order by depth, so overlapping layers do not flicker as
 * the camera turns.
 * @param result The element.
 * @param options Its opacity and depth.
 */
const preventGlitches = (result: ComplexModel, options: GlitchOptions) => {
  // Fix texture opacity glitches during camera rotation
  if (result.mesh && options.opacity < 1) {
    // Set render order based on depth - farther elements render first
    result.mesh.renderOrder = Math.abs(options.zPosition) / 10

    // Adjust material properties to prevent Z-fighting
    if (result.mesh.material instanceof THREE.MeshBasicMaterial) {
      result.mesh.material.depthTest = true
      result.mesh.material.depthWrite = options.opacity >= 0.9 // Only write to depth if mostly opaque
      result.mesh.material.alphaTest = 0.01 // Discard very transparent pixels
    }
  }
}

/**
 * Increase speed based on score (0.1 speed increase per 10 points)
 * @param base The base speed.
 * @param score The score.
 * @returns The speed for that score.
 */
const getSpeed = (base: number, score: number): number => {
  const speedMultiplier = 1 + score * 0.001
  const speed = base * speedMultiplier
  return speed
}

/**
 * Stops the browser from zooming, selecting text or opening menus on touch, which would interrupt
 * play.
 */
const prevents = () => {
  // Prevent iOS zoom and selection behaviors
  const preventZoomAndSelection = (e: Event) => {
    e.preventDefault()
    e.stopPropagation()
  }

  // Additional iOS-specific prevention
  ;['gesturestart', 'gesturechange', 'gestureend', 'selectstart', 'contextmenu'].forEach(
    (event) => {
      document.addEventListener(event, preventZoomAndSelection, {
        passive: false
      })
    }
  )

  // Prevent double-tap zoom
  const touchState = { lastTouchEnd: 0 }
  document.addEventListener(
    'touchend',
    (event) => {
      const now = new Date().getTime()
      if (now - touchState.lastTouchEnd <= 300) {
        event.preventDefault()
      }
      touchState.lastTouchEnd = now
    },
    { passive: false }
  )
}

export {
  gameState,
  isGameStart,
  isGamePlaying,
  isGameOver,
  isNewHighScore,
  gameScore,
  highestScore,
  gameStatus,
  setStatus,
  setScore,
  loadHighScore,
  checkHighScore,
  incrementGameScore,
  initPhysics,
  preventGlitches,
  getSpeed,
  prevents
}
