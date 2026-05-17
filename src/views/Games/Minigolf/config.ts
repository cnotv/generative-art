import type { CoordinateTuple } from '@webgamekit/animation'

export const BALL_RADIUS = 0.35
export const BALL_COLOR = 0xffffff
export const GROUND_COLOR = 0x4caf50
export const WALL_COLOR = 0xeeeeee
export const HOLE_COLOR = 0x111111
export const FLAG_COLOR = 0xff3333

export const BALL_RESTITUTION = 0.5
export const BALL_FRICTION = 1.5
export const GROUND_FRICTION = 1.5
export const BALL_LINEAR_DAMPING = 0.8
export const BALL_ANGULAR_DAMPING = 1.2
export const MAX_SHOT_POWER = 20
export const POWER_SCALE = 0.12

export const WALL_HEIGHT = 0.9
export const WALL_THICKNESS = 0.35
export const GROUND_THICKNESS = 0.4

export const CAMERA_HEIGHT = 20
export const CAMERA_OFFSET_TOPDOWN: CoordinateTuple = [0, CAMERA_HEIGHT, 0]

export const HOLE_RADIUS = 0.5
export const CUP_DEPTH = 1.2
export const FLAG_HEIGHT = 2.5
export const MAX_STROKES = 10
export const WIN_DISTANCE = HOLE_RADIUS * 0.9
export const HOLE_ENTRY_MAX_SPEED = 5
export const SPIRAL_DURATION = 0.7
export const CONFETTI_COUNT = 12
export const CONFETTI_LIFETIME = 2.0
export const CONFETTI_COLORS = [0xff6bcb, 0xffd93d, 0x4ecdc4, 0xff8c42, 0x6bcf7f, 0xa06cd5]

export const AIM_LINE_COLOR = 0xffdd00
export const AIM_LINE_MAX_LENGTH = 5

export interface HoleConfig {
  ground: { width: number; depth: number; position: CoordinateTuple }
  walls: { width: number; depth: number; position: CoordinateTuple }[]
  teePosition: CoordinateTuple
  holePosition: CoordinateTuple
  par: number
}

const R = BALL_RADIUS

export const HOLES: HoleConfig[] = [
  // 1 — Straight short
  {
    ground: { width: 5, depth: 12, position: [0, 0, 0] },
    walls: [],
    teePosition: [0, R, -4.5],
    holePosition: [0, 0, 4.5],
    par: 2
  },
  // 2 — Single baffle
  {
    ground: { width: 5, depth: 16, position: [0, 0, 0] },
    walls: [{ width: 3, depth: 0.35, position: [1, 0, 0] }],
    teePosition: [0, R, -6.5],
    holePosition: [0, 0, 6.5],
    par: 3
  },
  // 3 — Double stagger
  {
    ground: { width: 5, depth: 18, position: [0, 0, 0] },
    walls: [
      { width: 3, depth: 0.35, position: [-1, 0, -2] },
      { width: 3, depth: 0.35, position: [1, 0, 2] }
    ],
    teePosition: [0, R, -8],
    holePosition: [0, 0, 8],
    par: 3
  },
  // 4 — Narrow corridor
  {
    ground: { width: 3, depth: 20, position: [0, 0, 0] },
    walls: [{ width: 1, depth: 0.35, position: [0, 0, 0] }],
    teePosition: [0, R, -9],
    holePosition: [0, 0, 9],
    par: 3
  },
  // 5 — Wide with centre island
  {
    ground: { width: 9, depth: 14, position: [0, 0, 0] },
    walls: [
      { width: 2, depth: 2, position: [0, 0, 0] },
      { width: 2, depth: 0.35, position: [3, 0, -3] }
    ],
    teePosition: [-3, R, -5.5],
    holePosition: [3, 0, 5.5],
    par: 4
  },
  // 6 — Dogleg: single wall forces ball to go right before heading up
  {
    ground: { width: 10, depth: 18, position: [0, 0, 0] },
    walls: [{ width: 8, depth: 0.35, position: [-1, 0, 0] }],
    teePosition: [-3, R, -7],
    holePosition: [3, 0, 7],
    par: 4
  },
  // 7 — Triple baffles
  {
    ground: { width: 5, depth: 22, position: [0, 0, 0] },
    walls: [
      { width: 3, depth: 0.35, position: [-1, 0, -5] },
      { width: 3, depth: 0.35, position: [1, 0, 0] },
      { width: 3, depth: 0.35, position: [-1, 0, 5] }
    ],
    teePosition: [0, R, -10],
    holePosition: [0, 0, 10],
    par: 4
  },
  // 8 — Wide open long
  {
    ground: { width: 8, depth: 24, position: [0, 0, 0] },
    walls: [{ width: 4, depth: 0.35, position: [2, 0, 3] }],
    teePosition: [-2, R, -10.5],
    holePosition: [2, 0, 10.5],
    par: 5
  },
  // 9 — Pinball bumpers (3 block obstacles)
  {
    ground: { width: 9, depth: 16, position: [0, 0, 0] },
    walls: [
      { width: 1.5, depth: 1.5, position: [-2.5, 0, -2] },
      { width: 1.5, depth: 1.5, position: [2.5, 0, 0] },
      { width: 1.5, depth: 1.5, position: [-2.5, 0, 3] }
    ],
    teePosition: [0, R, -6.5],
    holePosition: [0, 0, 6.5],
    par: 4
  },
  // 10 — Gauntlet: narrow with alternating close baffles
  {
    ground: { width: 4, depth: 26, position: [0, 0, 0] },
    walls: [
      { width: 2.5, depth: 0.35, position: [0.75, 0, -8] },
      { width: 2.5, depth: 0.35, position: [-0.75, 0, -4] },
      { width: 2.5, depth: 0.35, position: [0.75, 0, 0] },
      { width: 2.5, depth: 0.35, position: [-0.75, 0, 4] },
      { width: 2.5, depth: 0.35, position: [0.75, 0, 8] }
    ],
    teePosition: [0, R, -12],
    holePosition: [0, 0, 12],
    par: 5
  }
]
