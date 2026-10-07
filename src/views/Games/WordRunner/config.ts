import type { SetupConfig } from '@webgamekit/threejs'
import type { ControlMapping } from '@webgamekit/controls'
import {
  LIGHT_AMBIENT_INTENSITY,
  LIGHT_DIRECTIONAL_INTENSITY,
  LIGHT_DIRECTIONAL_POSITION,
  SKY_COLOR
} from '@/views/Games/RockRunner/config'
import {
  LIGHT_SHADOW_BIAS,
  LIGHT_SHADOW_CAMERA,
  LIGHT_SHADOW_RADIUS
} from '@/views/Games/MarbleMadness/config'

// The language a first visit starts in; after that the start screen remembers the last pick.
export const DEFAULT_LANGUAGE = 'de'

export const LANE_COUNT = 3

// Three words is about what a player can hold while also steering; the next chunk only
// arrives once the previous one is being answered without hints.
export const CHUNK_SIZE = 3

// The same lane three times running reads as "stay put" rather than as part of a path.
export const MAX_SAME_LANE_STREAK = 2

// A lap with a mistake is re-run with stronger hints at most this many times in a row,
// so a stubborn word cannot trap the player on one lap forever.
export const MAX_RETRY_ATTEMPTS = 2

// Rock Runner's deck is 16 wide; three lanes of this width leave a margin inside its edges.
export const LANE_WIDTH = 3.6
// Scattered illustrations keep at least this far from the centreline, clear of the lanes.
export const SCATTER_LANE_CLEARANCE = 8.5

export const RUN_SPEED = 13
export const LANE_SWITCH_RATE = 14
// What each lane does to the runner's speed: the ratio it drops or jumps to, recovering to
// full speed over the given seconds. The right word's lane is always the better route.
export const ROUTE_EFFECTS = {
  boost: { ratio: 1.7, seconds: 1.6 },
  stumble: { ratio: 0.3, seconds: 1.1 },
  wide: { ratio: 0.6, seconds: 1.2 }
}
// Below this turn rate, in radians per unit of track, a gate is not on a bend worth cutting.
export const BEND_YAW_RATE_THRESHOLD = 0.009
export const STUMBLE_SHAKE = 0.18
export const STUMBLE_SHAKE_FREQUENCY = 47

// Long enough to read three words and choose; short enough that the next gate is already
// in view before the last one is passed, so the run reads as a path, not a quiz.
export const GATE_SPACING = 20
export const LEAD_IN_DISTANCE = 34
export const GATE_SPAWN_DISTANCE = 78
// Gates fade in over this stretch before the spawn distance, instead of popping in.
export const GATE_FADE_DISTANCE = 20
export const GATE_BEHIND_DISTANCE = 8
export const LATE_HINT_DISTANCE = 18
export const GATE_POOL_SIZE = 6

export const GATE_POST_HEIGHT = 5.2
export const GATE_POST_RADIUS = 0.2
export const GATE_BEAM_HEIGHT = 0.36
export const GATE_BEAM_DEPTH = 0.34
export const SIGN_WIDTH = 3.2
export const SIGN_HEIGHT = 1.32
export const SIGN_Y = 4.2
export const SIGN_CANVAS_WIDTH = 512
export const SIGN_CANVAS_HEIGHT = 212
export const SIGN_FONT_FAMILY = '"Darumadrop One", system-ui, sans-serif'
export const SIGN_FONT_SIZE = 104
export const SIGN_FONT_MIN_SIZE = 56
export const SIGN_CORNER_RADIUS = 36
export const SIGN_BORDER_WIDTH = 10

// The route feature stands this far past its gate, so it reads as what the lane leads to.
export const FEATURE_OFFSET = 6
export const RAMP = { width: 2.8, length: 3.4, rise: 0.8, thickness: 0.3, color: 0xe9c46a }
// lift is how much of the radius stands above the deck: the rest is sunk into it.
export const ROCK = { radius: 0.95, detail: 1, color: 0x9a8f82, lift: 0.55 }
export const GRAVEL = { width: 3.2, length: 8, lift: 0.05, color: 0xc9a77a }
// The hop off a ramp: how long the runner is airborne and how high it goes.
export const RAMP_HOP = { seconds: 0.6, height: 1.2 }

export const RUNNER_MODEL_PATH = 'stickboy.glb'
export const RUNNER_HEIGHT = 1.9
export const RUNNER_ANIMATION = 'run'
export const RUNNER_IDLE_ANIMATION = 'idle'
export const RUNNER_ANIMATION_SPEED = 14

// A chase camera like Rock Runner's, lower so the word signs fill more of the view.
export const CHASE_CAMERA = {
  thirdPersonHeight: 4.6,
  thirdPersonBack: 10.5,
  firstPersonHeight: 3.3,
  firstPersonForward: 2.8,
  firstPersonLookAhead: 20,
  freeCamHeight: 40,
  freeCamBack: 50,
  transitionSeconds: 0.6,
  followRotation: true
}
// The camera aims this far above the runner's feet, and eases towards its goal at this rate.
export const CAMERA_TARGET_HEIGHT = 2.4
export const CAMERA_FOLLOW_RATE = 6
export const CAMERA_START_POSITION: [number, number, number] = [0, 7, 10.5]

// The longest frame the run will take as one step. A hitch longer than this slows the run
// for a moment instead of carrying the runner past a gate before the lane could change.
export const MAX_FRAME_SECONDS = 0.1

export const RECAP_SECONDS = 3.4
export const FEEDBACK_SECONDS = 0.7

export const POST_COLOR = 0xb7aed0

export const SIGN_COLORS = {
  idle: { fill: '#fffaf1', ink: '#4a4560', border: '#d8cfbd' },
  hint: { fill: '#8f9ee0', ink: '#ffffff', border: '#6f7fc7' },
  right: { fill: '#94d4b1', ink: '#23443a', border: '#5fae88' },
  wrong: { fill: '#e7a3b0', ink: '#5a2733', border: '#c97586' },
  reveal: { fill: '#94d4b1', ink: '#23443a', border: '#5fae88' }
}

export const setupConfig: SetupConfig = {
  // No orbit controls at all: even disabled, they keep turning the camera back to their own
  // target, which the chase camera would then fight every frame.
  orbit: false,
  ground: false,
  sky: false,
  scene: { backgroundColor: SKY_COLOR },
  camera: { position: CAMERA_START_POSITION, fov: 58 },
  lights: {
    ambient: { intensity: LIGHT_AMBIENT_INTENSITY },
    directional: {
      intensity: LIGHT_DIRECTIONAL_INTENSITY,
      position: LIGHT_DIRECTIONAL_POSITION,
      shadow: { radius: LIGHT_SHADOW_RADIUS, bias: LIGHT_SHADOW_BIAS, camera: LIGHT_SHADOW_CAMERA }
    }
  }
}

export const CONTROL_MAPPING: ControlMapping = {
  keyboard: {
    ArrowLeft: 'left',
    KeyA: 'left',
    ArrowRight: 'right',
    KeyD: 'right'
  },
  gamepad: {
    'axis0-left': 'left',
    'axis0-right': 'right',
    'dpad-left': 'left',
    'dpad-right': 'right'
  },
  pointer: {
    'swipe-left': 'left',
    'tap-left': 'left',
    'swipe-right': 'right',
    'tap-right': 'right'
  }
}

export const configControls = {
  run: {
    speed: { min: 6, max: 24, step: 1, label: 'Run Speed' }
  }
}
