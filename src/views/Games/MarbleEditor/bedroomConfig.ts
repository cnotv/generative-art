import type { ToySpot } from './types'

export const ROOM_PADDING = 60
export const ROOM_MIN_WIDTH = 240
export const ROOM_MIN_DEPTH = 240
export const FLOOR_CLEARANCE = 2
export const CEILING_CLEARANCE = 40
export const WALL_MIN_HEIGHT = 90
export const TRACK_HORIZONTAL_MARGIN = 30
export const TRACK_VERTICAL_MARGIN = 12

export const BEDROOM_BACKDROP_COLOR = 0xf6e7d3
export const BEDROOM_FOG_DENSITY = 0.0008

export const FLOOR_PLANK_COLORS = ['#d9a066', '#cf9257', '#e2ac72', '#d49b5e']
export const FLOOR_SEAM_COLOR = '#a86f3d'
export const FLOOR_TEXTURE_SIZE = 256
export const FLOOR_REPEAT_UNITS = 32

export const WALL_STRIPE_COLORS = ['#bfe5ec', '#d6f0f4']
export const WALL_STRIPE_TEXTURE_SIZE = 256
export const WALL_STRIPE_REPEAT_UNITS = 24
export const SKIRTING_COLOR = 0xfaf3e8
export const SKIRTING_HEIGHT = 3
export const SKIRTING_THICKNESS = 0.8
export const CEILING_COLOR = 0xfdf8f0

export const RUG_COLORS = [0xf28c6b, 0xf7b267, 0xfcd5a5]
export const RUG_RADIUS_FRACTION = 0.32
export const RUG_RING_STEP = 0.3
export const RUG_Y_STEP = 0.06

export const WINDOW_WIDTH_FRACTION = 0.28
export const WINDOW_HEIGHT_FRACTION = 0.4
export const WINDOW_SILL_FRACTION = 0.35
export const WINDOW_FRAME_COLOR = 0xffffff
export const WINDOW_FRAME_THICKNESS = 2
export const WINDOW_INSET = 0.4

export const TOY_BLOCK_LETTERS = ['A', 'B', 'C', 'D']
export const TOY_BLOCK_COLORS = ['#e5533c', '#3c7fe5', '#3cb54a', '#f2a516']
export const TOY_CRAYON_COLORS = [0xe5533c, 0x3c7fe5, 0x3cb54a, 0xf2a516]
export const TEDDY_FUR_COLOR = 0xb5773a
export const TEDDY_MUZZLE_COLOR = 0xe0bb8b
export const TEDDY_DARK_COLOR = 0x3a2a1a
export const BEACH_BALL_COLORS = ['#ffffff', '#e5533c', '#f2a516', '#3c7fe5', '#3cb54a', '#ffffff']
export const BOOK_COLORS = [0xa04a8c, 0x3c7fe5, 0xf2a516]
export const TRAIN_BODY_COLOR = 0xe5533c
export const TRAIN_CABIN_COLOR = 0x3c7fe5
export const TRAIN_WHEEL_COLOR = 0x333333

export const TOY_SPOTS: ToySpot[] = [
  { kind: 'teddy-bear', fraction: 0.06, inset: 20, scale: 5, rotationY: 0.3, variant: 0 },
  { kind: 'letter-block', fraction: 0.16, inset: 10, scale: 6, rotationY: 0.2, variant: 0 },
  { kind: 'letter-block', fraction: 0.185, inset: 15, scale: 5, rotationY: 0.9, variant: 1 },
  { kind: 'beach-ball', fraction: 0.3, inset: 13, scale: 4, rotationY: 0, variant: 0 },
  { kind: 'book-stack', fraction: 0.42, inset: 12, scale: 5, rotationY: -0.4, variant: 0 },
  { kind: 'crayon', fraction: 0.55, inset: 10, scale: 4, rotationY: 0.7, variant: 1 },
  { kind: 'crayon', fraction: 0.57, inset: 14, scale: 4, rotationY: 1.9, variant: 2 },
  { kind: 'toy-train', fraction: 0.7, inset: 16, scale: 5, rotationY: -0.5, variant: 0 },
  { kind: 'letter-block', fraction: 0.82, inset: 11, scale: 5, rotationY: -0.7, variant: 2 },
  { kind: 'teddy-bear', fraction: 0.9, inset: 22, scale: 4, rotationY: -0.2, variant: 0 }
]
