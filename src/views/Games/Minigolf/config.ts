import type { CoordinateTuple } from '@webgamekit/animation'
import type { SetupConfig } from '@webgamekit/threejs'

export const BALL_RADIUS = 0.3
export const BALL_COLOR = 0xffffff
export const GROUND_COLOR = 0x4caf50
export const WALL_COLOR = 0xffffff
export const HOLE_COLOR = 0x111111
export const FLAG_COLOR = 0xff3333
export const TOON_OUTLINE = 0x222222

export const BALL_RESTITUTION = 0.5
export const BALL_FRICTION = 0.8
export const BALL_LINEAR_DAMPING = 0.6
export const BALL_ANGULAR_DAMPING = 0.8
export const MAX_SHOT_POWER = 18
export const POWER_SCALE = 0.12

export const WALL_HEIGHT = 0.8
export const WALL_THICKNESS = 0.3
export const GROUND_THICKNESS = 0.4

export const CAMERA_OFFSET_TOPDOWN: CoordinateTuple = [0, 18, 0]
export const CAMERA_OFFSET_THIRD: CoordinateTuple = [0, 4, 8]

export const HOLE_RADIUS = 0.45
export const FLAG_HEIGHT = 2.5
export const MAX_STROKES = 10
export const WIN_DISTANCE = HOLE_RADIUS * 0.9

export const setupConfig: SetupConfig = {
  camera: {
    fov: 60,
    near: 0.1,
    far: 200
  },
  lights: {
    ambient: { intensity: 0.8 },
    directional: { intensity: 1.2, position: [10, 20, 10] }
  }
}

export interface HoleConfig {
  ground: { width: number; depth: number; position: CoordinateTuple }
  walls: { width: number; depth: number; position: CoordinateTuple }[]
  teePosition: CoordinateTuple
  holePosition: CoordinateTuple
  par: number
}

export const HOLES: HoleConfig[] = [
  {
    ground: { width: 6, depth: 12, position: [0, 0, 0] },
    walls: [],
    teePosition: [0, BALL_RADIUS, -5],
    holePosition: [0, 0, 5],
    par: 2
  },
  {
    ground: { width: 6, depth: 16, position: [0, 0, 0] },
    walls: [
      { width: 2, depth: 0.3, position: [-1, 0, 0] },
      { width: 2, depth: 0.3, position: [1, 0, 2] }
    ],
    teePosition: [0, BALL_RADIUS, -7],
    holePosition: [0, 0, 7],
    par: 3
  },
  {
    ground: { width: 8, depth: 16, position: [0, 0, 0] },
    walls: [
      { width: 3, depth: 0.3, position: [-1.5, 0, -2] },
      { width: 3, depth: 0.3, position: [1.5, 0, 2] }
    ],
    teePosition: [-2, BALL_RADIUS, -6],
    holePosition: [2, 0, 6],
    par: 3
  }
]

export const CURRENT_HOLE = 0
