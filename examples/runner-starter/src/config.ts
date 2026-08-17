import type { ModelOptions, SetupConfig } from '@webgamekit/threejs'

export const LANE_X = [-4, 0, 4]
export const LANE_CHANGE_SPEED = 12
export const TRACK_SPEED = 24
export const SPAWN_EVERY_FRAMES = 45
export const DESPAWN_Z = 12
export const SPAWN_Z = -140
export const HIT_RADIUS = 1.6

export const SCENE: SetupConfig = {
  camera: { position: [0, 7, 14], lookAt: [0, 2, -20], fov: 70 },
  lights: {
    ambient: { intensity: 0.7 },
    directional: { intensity: 1.2, position: [10, 30, 10], castShadow: true }
  },
  ground: { size: [16, 1, 400], color: 0x4a4e69 },
  sky: { color: 0x22223b },
  orbit: false
}

export const PLAYER: ModelOptions = {
  name: 'player',
  size: [1.4, 1.4, 1.4],
  position: [0, 1, 4],
  color: 0xf2e9e4,
  type: 'fixed',
  castShadow: true
}

export const OBSTACLE: ModelOptions = {
  name: 'obstacle',
  size: [2.4, 2.4, 2.4],
  color: 0xc9184a,
  type: 'fixed',
  castShadow: true
}

export const CONTROLS = {
  mapping: {
    keyboard: {
      a: 'lane-left',
      d: 'lane-right',
      ArrowLeft: 'lane-left',
      ArrowRight: 'lane-right'
    },
    gamepad: {
      'dpad-left': 'lane-left',
      'dpad-right': 'lane-right',
      'axis0-left': 'lane-left',
      'axis0-right': 'lane-right'
    }
  },
  axisThreshold: 0.5
}

/** Height an obstacle sits at, so its box rests on the track rather than in it. */
export const OBSTACLE_HEIGHT = 1.2
