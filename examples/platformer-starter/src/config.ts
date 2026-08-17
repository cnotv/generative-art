import type { ModelOptions, SetupConfig } from '@webgamekit/threejs'
import type { CoordinateTuple } from '@webgamekit/animation'

export const MOVE_SPEED = 8
export const JUMP_SPEED = 9

export const SCENE: SetupConfig = {
  camera: { position: [0, 12, 22], lookAt: [0, 0, 0], fov: 60 },
  lights: {
    ambient: { intensity: 0.6 },
    directional: { intensity: 1.4, position: [20, 30, 15], castShadow: true }
  },
  ground: { size: [80, 1, 80], color: 0x3f6d4e },
  sky: { color: 0x87ceeb },
  orbit: false
}

export const PLAYER: ModelOptions = {
  name: 'player',
  size: [1, 2, 1],
  position: [0, 4, 0],
  color: 0xef6461,
  type: 'dynamic',
  castShadow: true,
  // A capsule-ish box that never topples: rotation is the game's job, not the solver's.
  enabledRotations: [false, false, false]
}

const platform = (position: CoordinateTuple, size: CoordinateTuple): ModelOptions => ({
  name: 'platform',
  position,
  size,
  color: 0x8d7b68,
  type: 'fixed',
  receiveShadow: true,
  castShadow: true
})

export const PLATFORMS: ModelOptions[] = [
  platform([6, 2, 0], [6, 1, 6]),
  platform([-7, 4, -4], [6, 1, 6]),
  platform([0, 6, -12], [8, 1, 6])
]

export const CONTROLS = {
  mapping: {
    keyboard: {
      w: 'move-forward',
      s: 'move-back',
      a: 'move-left',
      d: 'move-right',
      ArrowUp: 'move-forward',
      ArrowDown: 'move-back',
      ArrowLeft: 'move-left',
      ArrowRight: 'move-right',
      ' ': 'jump'
    },
    gamepad: {
      'axis0-up': 'move-forward',
      'axis0-down': 'move-back',
      'axis0-left': 'move-left',
      'axis0-right': 'move-right',
      cross: 'jump'
    }
  },
  axisThreshold: 0.5
}

/** Vertical speed below which the player counts as standing on something. */
export const GROUNDED_SPEED = 0.05
