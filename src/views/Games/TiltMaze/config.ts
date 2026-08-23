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

/**
 * The light hovering over the goal. Movement is what makes the hole findable, not colour, so it
 * breathes in place rather than sitting still — slowly, so it reads as a marker and not an alarm.
 */
export const GOAL_BEACON_PULSE_SECONDS = 3.2
/**
 * A ring, not a disc: the goal is a real hole and covering its mouth would fill in the one thing
 * the player is aiming at. Hugs the marker ring so the light and the ring read as one mark.
 */
export const GOAL_BEACON_INNER_RATIO = 0.78
export const GOAL_BEACON_OUTER_RATIO = 1.18
export const GOAL_BEACON_SEGMENTS = 32
export const GOAL_BEACON_Y = 0.06
export const GOAL_BEACON_MIN_OPACITY = 0.15
export const GOAL_BEACON_MAX_OPACITY = 0.75
/** How far it swells at the top of the breath. */
export const GOAL_BEACON_SWELL = 0.35
/** Lifts the ring just clear of the board so it does not z-fight with the slab surface. */
/**
 * Decal heights. Each surface laid on the floor gets its own, because two at the same height are
 * coplanar and the depth buffer picks between them per fragment, which flickers as the camera
 * moves. Ordered by what has to win: markers over the poster, poster over the floor.
 */
export const HOLE_MARKER_Y = 0.05
/** Markers draw after the poster, so the one the player must see wins any overlap. */
export const HOLE_MARKER_RENDER_ORDER = 2
export const LEVEL_POSTER_RENDER_ORDER = 1
/** Keeps holes out of orthogonally adjacent cells, so no corridor is a guaranteed loss. */
export const HOLE_SPACING_IN_CELLS = 1.2

/** Below this Y the ball has left the board through a hole and the round is decided. */
export const FALL_THRESHOLD_Y = -6

/** Chevrons in the stack that sweeps the way the level moved. */
/** Delay between one chevron lighting and the next, so the stack reads as travel. */
/** The circular wipe that washes the board in the outcome colour as the level changes. */
export const LEVEL_WIPE_DURATION_SECONDS = 0.75
/** The second disc, which the verdict is read against. Constant, so only the first says up or down. */
export const LEVEL_WIPE_STAGE_COLOR = 0xf7e9a0
/** How far into the first disc the second one starts, as a fraction of the wipe. */
export const LEVEL_WIPE_STAGE_DELAY_RATIO = 0.35
/** Dark enough to read on the pastel yellow the verdict lands on. */
export const LEVEL_VERDICT_INK = 0x5c5470
export const MILLISECONDS_PER_SECOND = 1000
/**
 * The lean that starts a round. Above sensor noise and above an idle hand, so a phone resting on
 * a desk does not start the game by itself.
 */
export const START_TILT_DEGREES = 6
/**
 * How long the board stays covered before the next one is swapped in behind the discs. The
 * second disc starts late, so a full cover is the wipe plus that delay.
 */
export const LEVEL_COVER_SECONDS = LEVEL_WIPE_DURATION_SECONDS * (1 + LEVEL_WIPE_STAGE_DELAY_RATIO)

export const LEVEL_VERDICT_STAGGER_SECONDS = 0.045
/** How long one chevron takes to arrive. The whole sweep finishes inside the hole burst. */
export const LEVEL_VERDICT_DURATION_SECONDS = 0.55
/** Chevron size and weight. Heavy enough to read over a board of pastel walls. */

/** How long a granted sensor may stay silent before the diagnostics open themselves. */
export const SILENT_SENSOR_TIMEOUT_MS = 2500

export const MAX_TILT_DEGREES = 38
export const GRAVITY_STRENGTH = 72
/**
 * Per-frame lerp factor smoothing raw sensor noise out of the gravity vector. Higher reaches
 * the lean sooner, at the cost of passing more of the sensor's jitter through to the ball.
 */
export const TILT_SMOOTHING = 0.32
export const KEYBOARD_TILT_DEGREES = 26

export const DEGREES_TO_RADIANS = Math.PI / 180

export const CAMERA_FOV = 55
/**
 * A sliver of tolerance on the interior fit. Exactly edge to edge clips a hole sitting in the
 * outermost cell — its marker is tangent to the interior edge — and the goal being half off
 * screen is worse than a few pixels of wall showing.
 */
export const CAMERA_EDGE_SAFETY = 1.05

/**
 * Headroom on the fitted camera height while the view is leaning. A lean swings the far edge
 * outward, so an exact fit would crop the corner; with no lean the fit is edge to edge and this
 * is not applied at all.
 */
export const CAMERA_LEAN_MARGIN = 1.07
/** Nudges the camera off the exact vertical so looking straight down stays a defined rotation. */
export const CAMERA_AXIS_NUDGE = 0.001
/**
 * World units the camera slides per degree of tilt, on **keyboard only**.
 *
 * Holding an arrow key is an abstract request to lean, so the view leans to show it — enough to
 * read as a response, not so much that the board swings into a steep perspective. A phone
 * already leans in the player's hands: moving the camera as well would double the motion, so a
 * live sensor pins the view still and only the ball moves. Gravity leans in both cases — the
 * board and its colliders never rotate either way.
 */
export const CAMERA_LEAN_PER_DEGREE = 0.22

/**
 * A pastel set. The background sits darker than the board on purpose: the holes are real gaps,
 * so whatever is behind the board is what a pit looks like, and a light background would turn
 * every trap into a bright disc rather than a hole.
 */
/** The level poster printed on the board floor, mirroring the office posters in MazeGame. */
export const LEVEL_POSTER_CANVAS_SIZE = 512
export const LEVEL_POSTER_WIDTH_RATIO = 0.42
export const LEVEL_POSTER_HEIGHT_RATIO = 1
/** Below the hole markers, above the floor — see HOLE_MARKER_Y for why they cannot share. */
export const LEVEL_POSTER_LIFT = 0.02
/** Faint enough to stay scenery rather than compete with the ball and the holes. */
export const LEVEL_POSTER_OPACITY = 0.35

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
  diagnostics: {
    showSensor: { boolean: true, label: 'Sensor Readout' }
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
