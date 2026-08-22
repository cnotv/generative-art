import type { SetupConfig } from '@webgamekit/threejs'
import type { ControlMapping } from '@webgamekit/controls'

/**
 * World size of the board's shorter side. Held constant across levels: the board already fills
 * the screen, so a harder level divides the same space more finely rather than growing.
 */
export const BOARD_SHORT_EXTENT = 40

/** Cells across the screen's shorter side at level one; the longer side follows the aspect. */
export const BASE_SHORT_AXIS_CELLS = 5
export const MAX_SHORT_AXIS_CELLS = 9
export const MIN_CELLS_LONG_AXIS = 5
export const MAX_CELLS_LONG_AXIS = 16

export const BASE_TRAP_COUNT = 6
export const TRAPS_PER_LEVEL = 3
export const MAX_TRAP_COUNT = 28

/** Ball diameter stays well inside a corridor, so a finer maze is still passable. */
export const BALL_TO_CELL_RATIO = 0.16
/** A hole must clear the ball, or a level becomes unwinnable at the goal. */
export const HOLE_TO_BALL_RATIO = 1.25
export const HOLE_TO_CELL_RATIO = 0.25

/** Generators cycled per level so difficulty is not the only thing that changes. */
export const LEVEL_ALGORITHMS = [
  'recursive-backtracker',
  'prims',
  'hunt-and-kill',
  'kruskals',
  'sidewinder',
  'wilsons',
  'ellers',
  'recursive-division'
] as const

export const WALL_HEIGHT = 7
export const WALL_THICKNESS = 1
export const FLOOR_THICKNESS = 0.6

export const MAX_BALL_RADIUS = 1.3

/** Inner edge of the ring drawn around a hole mouth, as a fraction of the hole radius. */
export const HOLE_RING_INNER_RATIO = 0.8
/** Lifts the ring just clear of the board so it does not z-fight with the slab surface. */
export const HOLE_MARKER_Y = 0.02
/** Keeps holes out of orthogonally adjacent cells, so no corridor is a guaranteed loss. */
export const HOLE_SPACING_IN_CELLS = 1.2

/** Below this Y the ball has left the board through a hole and the round is decided. */
export const FALL_THRESHOLD_Y = -6

/** Chevrons in the stack that sweeps the way the level moved. */
export const LEVEL_ARROW_COUNT = 3
/** Delay between one chevron lighting and the next, so the stack reads as travel. */
export const LEVEL_ARROW_STAGGER_SECONDS = 0.12
/** How long one chevron takes to arrive. The whole sweep finishes inside the hole burst. */
export const LEVEL_ARROW_DURATION_SECONDS = 0.7
/** Chevron size and weight. Heavy enough to read over a board of pastel walls. */
export const LEVEL_ARROW_SIZE = 72
export const LEVEL_ARROW_STROKE_WIDTH = 3

/** How long a granted sensor may stay silent before the diagnostics open themselves. */
export const SILENT_SENSOR_TIMEOUT_MS = 2500

export const MAX_TILT_DEGREES = 38
export const GRAVITY_STRENGTH = 44
/**
 * Per-frame lerp factor smoothing raw sensor noise out of the gravity vector. Higher reaches
 * the lean sooner, at the cost of passing more of the sensor's jitter through to the ball.
 */
export const TILT_SMOOTHING = 0.32
export const KEYBOARD_TILT_DEGREES = 26

export const DEGREES_TO_RADIANS = Math.PI / 180

export const CAMERA_FOV = 55
/**
 * Breathing room around the board once it has been fitted to the viewport. It also absorbs the
 * camera's lean: sliding the camera sideways while it keeps looking at the centre swings the
 * far edge outward, and without headroom a full diagonal lean crops the corner off screen.
 */
export const CAMERA_MARGIN = 1.2
/** Nudges the camera off the exact vertical so looking straight down stays a defined rotation. */
export const CAMERA_AXIS_NUDGE = 0.001
/** World units the camera slides per degree of tilt, selling the lean without losing the board. */
export const CAMERA_LEAN_PER_DEGREE = 0.6

/**
 * A pastel set. The background sits darker than the board on purpose: the holes are real gaps,
 * so whatever is behind the board is what a pit looks like, and a light background would turn
 * every trap into a bright disc rather than a hole.
 */
export const BACKGROUND_COLOR = 0x5c5470
export const BOARD_COLOR = 0xf6ece4
export const WALL_COLOR = 0xbcc6f2
export const BALL_COLOR = 0xf4795b
export const TRAP_COLOR = 0xe5989b
export const GOAL_COLOR = 0x9fd8b4

/** Rings that bloom out of the goal on a win. */
export const VICTORY_RING_COUNT = 4
export const VICTORY_RING_DURATION_SECONDS = 1.1
export const VICTORY_RING_STAGGER_SECONDS = 0.13
export const VICTORY_RING_MAX_RADIUS = 16
export const VICTORY_RING_Y = 1.2

export const setupConfig: SetupConfig = {
  orbit: false,
  ground: false,
  sky: false,
  scene: { backgroundColor: BACKGROUND_COLOR },
  camera: { position: [0, 60, 0.001], fov: CAMERA_FOV },
  // Flatter and softer than a contrasty key light, so the pastels stay pastel rather than
  // blowing out to white on the lit faces.
  lights: {
    ambient: { intensity: 2.2 },
    directional: { intensity: 1.5, position: [30, 60, 20] }
  }
}

export const CONTROL_MAPPING: ControlMapping = {
  keyboard: {
    ArrowLeft: 'tilt-left',
    ArrowRight: 'tilt-right',
    ArrowUp: 'tilt-up',
    ArrowDown: 'tilt-down',
    KeyA: 'tilt-left',
    KeyD: 'tilt-right',
    KeyW: 'tilt-up',
    KeyS: 'tilt-down'
  },
  gamepad: {
    'axis0-left': 'tilt-left',
    'axis0-right': 'tilt-right',
    'axis1-up': 'tilt-up',
    'axis1-down': 'tilt-down'
  },
  motion: {
    'tilt-left': 'tilt-left',
    'tilt-right': 'tilt-right',
    'tilt-up': 'tilt-up',
    'tilt-down': 'tilt-down'
  }
}

export const configControls = {
  tilt: {
    maxDegrees: { min: 5, max: 45, step: 1, label: 'Max Tilt (deg)' },
    smoothing: { min: 0.02, max: 1, step: 0.02, label: 'Tilt Smoothing' },
    gravityStrength: { min: 5, max: 80, step: 1, label: 'Gravity Strength' },
    inverted: { boolean: true, label: 'Invert Tilt' }
  },
  camera: {
    leanPerDegree: { min: 0, max: 2, step: 0.05, label: 'Camera Lean' }
  }
}

/**
 * A scene colour as CSS, so an overlay drawn in the same colour as something in the scene
 * cannot drift away from it.
 * @param color The colour as a Three.js hex number
 * @returns The same colour as a CSS hex string
 */
export const toCssColor = (color: number): string => `#${color.toString(16).padStart(6, '0')}`
