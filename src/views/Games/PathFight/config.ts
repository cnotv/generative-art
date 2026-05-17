import type { SetupConfig } from '@webgamekit/threejs'
import { GOOMBA_COUNT } from './constants'

export const STAGE_WIDTH = 22
export const STAGE_DEPTH = 32
export const STAGE_HALF_W = STAGE_WIDTH / 2
export const STAGE_HALF_D = STAGE_DEPTH / 2

/** Z coordinate where items exit toward player-1 side → player 1 scores */
export const EXIT_Z_NEAR = -STAGE_HALF_D + 2
/** Z coordinate where items exit toward player-2 side → player 2 scores */
export const EXIT_Z_FAR = STAGE_HALF_D - 2
/** Side exits (X) give no score but remove the item */
export const EXIT_X = STAGE_HALF_W - 1

export const GOOMBA_GROUND_Y = 0.5
export const GOOMBA_SCALE = 1

/** X positions for a row of GOOMBA_COUNT goombas, centered */
const goombaXPositions = (): number[] => {
  const half = (GOOMBA_COUNT - 1) / 2
  return Array.from({ length: GOOMBA_COUNT }, (_, i) => (i - half) * 1.8)
}

export const GOOMBA_POSITIONS_P1: [number, number, number][] = goombaXPositions().map((x) => [
  x,
  GOOMBA_GROUND_Y,
  -(STAGE_HALF_D - 3)
])

export const GOOMBA_POSITIONS_P2: [number, number, number][] = goombaXPositions().map((x) => [
  x,
  GOOMBA_GROUND_Y,
  STAGE_HALF_D - 3
])

export const ITEM_COUNT = 15
export const ITEM_SIZE: [number, number, number] = [1.2, 1.2, 1.2]
export const ITEM_GROUND_Y = GOOMBA_GROUND_Y

export const GOOMBA_PUSH_RANGE = 1.8
export const GOOMBA_PUSH_IMPULSE = 8
export const GOOMBA_FOLLOW_SPEED = 6

export const MIN_WAYPOINT_DISTANCE = 1.5

export const GOOMBA_COLOR_LOCAL = 0x3498db
export const GOOMBA_COLOR_REMOTE = 0xe74c3c
export const ITEM_COLOR = 0xf39c12
export const STAGE_COLOR = 0x2c3e50
export const PATH_COLOR_LOCAL = 0x5dade2
export const PATH_COLOR_REMOTE = 0xec7063
export const SELECTED_GOOMBA_COLOR = 0xf1c40f
export const STAGE_EDGE_COLOR = 0xffffff

export const sceneSetupConfig: SetupConfig = {
  scene: { backgroundColor: 0x1a1a2e },
  lights: {
    ambient: { color: 0xffffff, intensity: 1.2 },
    directional: {
      color: 0xffffff,
      intensity: 2,
      position: [10, 25, 10],
      castShadow: true,
      shadow: {
        camera: { left: -20, right: 20, top: 20, bottom: -20 },
        mapSize: { width: 2048, height: 2048 },
        bias: -0.001
      }
    }
  },
  ground: { color: STAGE_COLOR, size: 60 },
  sky: false,
  orbit: false,
  camera: { position: [0, 28, 0], fov: 60 }
}
