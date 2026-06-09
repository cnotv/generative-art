export const MATCHMAKER_ROOM = 'bubble-shooter-matchmaker'
export const GRID_ROWS = 12
export const GRID_COLS = 9
export const BUBBLE_RADIUS = 0.5
export const BUBBLE_DIAMETER = 1.0
export const HEX_ROW_HEIGHT = Math.sqrt(3) / 2
export const GRID_TOP_Y = 5.5
export const SHOOTER_X = 0
export const SHOOTER_Y = -7.5
export const FIRE_LINE_Y = GRID_TOP_Y - (GRID_ROWS - 2) * HEX_ROW_HEIGHT
export const BUBBLE_SPEED = 20
export const MIN_MATCH_SIZE = 3
export const SHOTS_PER_NEW_ROW = 10
export const ROW_DROP_INTERVAL_MS = 20_000
export const GARBAGE_THRESHOLD = 1
export const WALL_LEFT = -(GRID_COLS / 2) * BUBBLE_DIAMETER
export const WALL_RIGHT = (GRID_COLS / 2) * BUBBLE_DIAMETER
export const INITIAL_FILLED_ROWS = 5

export const BUBBLE_COLORS = ['red', 'blue', 'green', 'yellow', 'purple'] as const
export type BubbleColor = (typeof BUBBLE_COLORS)[number] | 'garbage'
export type BsColorCount = 3 | 4 | 5
export type BsSpeed = 'slow' | 'medium' | 'fast'

export const SPEED_ROW_DROP_MS: Record<BsSpeed, number> = {
  slow: 45_000,
  medium: 22_000,
  fast: 10_000
}

export const COLOR_HEX: Record<BubbleColor, number> = {
  red: 0xe53935,
  blue: 0x1e88e5,
  green: 0x43a047,
  yellow: 0xfdd835,
  purple: 0x8e24aa,
  garbage: 0x9e9e9e
}
