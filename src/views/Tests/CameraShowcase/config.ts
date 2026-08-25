import type { CoordinateTuple } from '@webgamekit/animation'
import type { ModelOptions, SetupConfig } from '@webgamekit/threejs'
import marbleTexture from '@/assets/images/marbles/01 · Classic Carrara.webp'

/**
 * Every camera behaviour this view can switch between.
 *
 * The Elements panel reaches the same cameras from its own side: the follow modes appear as a
 * rig row whose tabs are bound to these cases, and lens presets sit on the Camera element, where
 * they change projection and framing. Placement stays this view's, written every frame, so a
 * panel edit to position does not survive the next one.
 */
export const CAMERA_CASES = ['third', 'first', 'free', 'path'] as const

export type CameraCase = (typeof CAMERA_CASES)[number]

export const CAMERA_CASE_LABELS: Record<CameraCase, string> = {
  third: 'Third person',
  first: 'First person',
  free: 'Free chase',
  path: 'Cinematic path'
}

/**
 * The target walks a circuit inside the colonnade, on its floor.
 *
 * Outside it there is nothing to see: a follow camera looks along the target's heading, which on
 * a circle around the monument points permanently away from it, so first and third person framed
 * empty grass. Inside, every mode has columns in shot — which is the point of the view.
 *
 * Radius 7 clears the columns: the nearest sit at z +/-9 with a 1.1 radius.
 */
export const TRACK_RADIUS = 7
export const TRACK_SECONDS = 20
export const TARGET_HEIGHT = 3

/**
 * A colonnade: three steps, a ring of square columns, and the beams they carry.
 *
 * Square rather than round because the primitives are cuboids and balls; at this scale a
 * fluted column would read as a box anyway, and the monument is meant to be a landmark for
 * reading camera motion rather than architecture.
 *
 * Every y below is the underside of the piece, not its middle: `getCube` defaults to an origin
 * at the base and adds half the height itself, so courses stack by adding the one below.
 */
const COLUMN_HEIGHT = 16
const COLUMN_THICKNESS = 2.2
const FLOOR_TOP = 3
const HALF_WIDTH = 15
const HALF_DEPTH = 9

const MARBLE: Pick<ModelOptions, 'texture' | 'color' | 'type' | 'castShadow' | 'receiveShadow'> = {
  texture: marbleTexture,
  color: 0xffffff,
  type: 'fixed',
  castShadow: true,
  receiveShadow: true
}

/**
 * Tiles the marble by the size of the piece rather than stretching one copy over it.
 *
 * A single copy spread across a 44-unit step and again across a 2-unit column makes the same
 * stone read at wildly different grains; repeating every few units keeps it one material.
 * @param width - The piece's horizontal extent
 * @param height - The piece's vertical extent
 * @returns The repeat to pass alongside the texture
 */
const marbleRepeat = (width: number, height: number): [number, number] => [
  Math.max(1, Math.round(width / MARBLE_TILE)),
  Math.max(1, Math.round(height / MARBLE_TILE))
]

const MARBLE_TILE = 6

/** The stepped plinth, widest at the bottom. */
export const MONUMENT_STEPS: ModelOptions[] = [
  {
    ...MARBLE,
    name: 'monument-step',
    size: [44, 1, 30],
    position: [0, 0, 0],
    textureRepeat: marbleRepeat(44, 30)
  },
  {
    ...MARBLE,
    name: 'monument-step',
    size: [40, 1, 26],
    position: [0, 1, 0],
    textureRepeat: marbleRepeat(40, 26)
  },
  {
    ...MARBLE,
    name: 'monument-floor',
    size: [36, 1, 22],
    position: [0, 2, 0],
    textureRepeat: marbleRepeat(36, 22)
  }
]

/**
 * Column centres: the four corners, evenly spaced along the long sides, and one mid-side each.
 *
 * The middle bay is twice the others, as a temple entrance is, which also leaves the camera a
 * gap it can pass through rather than one that fills the frame with a column on each side.
 */
const COLUMN_SPAN = [-HALF_WIDTH, -10, -5, 5, 10, HALF_WIDTH]
export const COLUMN_POSITIONS: CoordinateTuple[] = [
  ...COLUMN_SPAN.flatMap((x): CoordinateTuple[] => [
    [x, FLOOR_TOP, -HALF_DEPTH],
    [x, FLOOR_TOP, HALF_DEPTH]
  ]),
  [-HALF_WIDTH, FLOOR_TOP, 0],
  [HALF_WIDTH, FLOOR_TOP, 0]
]

export const COLUMN: ModelOptions = {
  ...MARBLE,
  name: 'column',
  // Read as [diameter, height, diameter] by getCylinder, the same way a cube reads its size.
  size: [COLUMN_THICKNESS, COLUMN_HEIGHT, COLUMN_THICKNESS],
  segments: 24,
  textureRepeat: marbleRepeat(Math.PI * COLUMN_THICKNESS, COLUMN_HEIGHT)
}

/** The beams the columns carry, closing the ring at the top. */
const ARCHITRAVE_Y = FLOOR_TOP + COLUMN_HEIGHT
export const MONUMENT_BEAMS: ModelOptions[] = [
  {
    ...MARBLE,
    name: 'architrave',
    size: [34, 2, 3],
    position: [0, ARCHITRAVE_Y, -HALF_DEPTH],
    textureRepeat: marbleRepeat(34, 2)
  },
  {
    ...MARBLE,
    name: 'architrave',
    size: [34, 2, 3],
    position: [0, ARCHITRAVE_Y, HALF_DEPTH],
    textureRepeat: marbleRepeat(34, 2)
  },
  {
    ...MARBLE,
    name: 'architrave',
    size: [3, 2, 18],
    position: [-HALF_WIDTH, ARCHITRAVE_Y, 0],
    textureRepeat: marbleRepeat(18, 2)
  },
  {
    ...MARBLE,
    name: 'architrave',
    size: [3, 2, 18],
    position: [HALF_WIDTH, ARCHITRAVE_Y, 0],
    textureRepeat: marbleRepeat(18, 2)
  }
]

/** What the follow cameras hold, walking a circuit around the monument. */
export const TARGET: ModelOptions = {
  name: 'player',
  size: [2, 2, 4],
  color: 0xef6461,
  type: 'fixed',
  castShadow: true
}

/**
 * Approach, enter, climb, leave by a side, then circle: a sequence that only reads as one shot
 * because the route is continuous, which is the thing a declared path buys over a cut.
 */
export const INTRO_PATH: CoordinateTuple[] = [
  [0, 6, 52],
  [0, 6, 24],
  [0, 7, 4],
  [0, 13, -3],
  [3, 25, -7],
  [27, 27, -11],
  [48, 20, 7],
  [31, 16, 42],
  [-11, 14, 52]
]

/**
 * What the sweep holds in frame throughout: the middle of the colonnade.
 *
 * One aim for the whole route rather than one per waypoint, because the route is editable and
 * the editor deals in positions — a per-point aim would be authored here and then silently
 * dropped the first time anyone moved a node.
 */
export const PATH_LOOK_AT: CoordinateTuple = [0, 11, 0]

export const setupConfig: SetupConfig = {
  camera: { position: [0, 16, 62], lookAt: [0, 11, 0], fov: 65, near: 0.1, far: 2000 },
  lights: {
    environment: { intensity: 0.35 },
    ambient: { intensity: 0.65 },
    directional: { intensity: 1.3, position: [30, 50, 20], castShadow: true }
  },
  ground: { size: [140, 1, 140], position: [0, 0, 0], color: 0x3f6d4e },
  sky: { color: 0x87ceeb },
  // Kept, not removed: the scene store expects an OrbitControls instance to exist. Disabled so
  // it takes no input, and every case below steers `orbit.target` — because orbit.update() runs
  // after the timeline each frame and re-aims the camera at that target regardless.
  orbit: { disabled: true }
}

/**
 * Switching cameras is the whole point of this view, so it is bound to input as well as the
 * panel: number keys pick a case directly, shoulder buttons cycle through them.
 */
export const CONTROLS = {
  mapping: {
    keyboard: {
      '1': 'case-third',
      '2': 'case-first',
      '3': 'case-free',
      '4': 'case-path',
      q: 'case-previous',
      e: 'case-next'
    },
    gamepad: {
      l1: 'case-previous',
      r1: 'case-next',
      cross: 'case-next'
    }
  }
}

/** Which case each direct-select action selects. */
export const CASE_BY_ACTION: Record<string, CameraCase> = {
  'case-third': 'third',
  'case-first': 'first',
  'case-free': 'free',
  'case-path': 'path'
}

/** The keys shown in the on-screen hint, in the order the cases are listed. */
export const CASE_KEYS: Record<CameraCase, string> = {
  third: '1',
  first: '2',
  free: '3',
  path: '4'
}

/**
 * The views offered on the Camera element, which is where every camera control lives.
 *
 * The cinematic path sits among the follow modes because picking it is the same kind of act:
 * choosing who drives the camera. It works in either projection, so it is never filtered out.
 */
export const CAMERA_VIEWS = CAMERA_CASES.map((value) => ({
  value,
  label: CAMERA_CASE_LABELS[value]
}))

/**
 * How the declared sweep is drawn — the same orange box nodes and tube every other path in the
 * app uses, so a route reads the same wherever it is being edited.
 */
export const PATH_LINE_COLOR = 0xf0a000
// Timeline's own numbers are 1.5 and 4, tuned for a scene a fraction of this arena's 140 units.
// The ratio between them is what makes a route read as a line with nodes on it, so that is what
// is kept rather than the absolute sizes.
export const PATH_LINE_RADIUS = 0.25
export const PATH_NODE_SIZE = 1.8

/** The editable path's starting settings, matching the sweep declared above. */
export const PATH_DEFAULT_CONFIG = {
  // Slower than the panel's usual 20: this route's drama is in the middle, and at 20 the whole
  // interior-and-climb passage goes by in under a second.
  speed: 12,
  obstacleImpulse: 0,
  curved: true,
  easing: 'ease-in-out',
  easingIntensity: 1,
  playing: true,
  loop: true,
  pingPong: false,
  // The view opens on the sweep, and the route runs along the camera's own line: shown, it is
  // a wall in front of the lens. Ticking either while inside is still how you inspect the route.
  showPath: false,
  showNodes: false
}
