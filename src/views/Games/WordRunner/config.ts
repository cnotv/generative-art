import type { SetupConfig } from '@webgamekit/threejs'
import type { ControlMapping } from '@webgamekit/controls'

export const LANE_COUNT = 3

// Three words is about what a player can hold while also steering; the next chunk only
// arrives once the previous one is being answered without hints.
export const CHUNK_SIZE = 3

// The same lane three times running reads as "stay put" rather than as part of a path.
export const MAX_SAME_LANE_STREAK = 2

// A lap with a mistake is re-run with stronger hints at most this many times in a row,
// so a stubborn word cannot trap the player on one lap forever.
export const MAX_RETRY_ATTEMPTS = 2

export const LANE_WIDTH = 2.6
export const TRACK_WIDTH = 8.4
export const TRACK_LENGTH = 220
// Where the far end of the visible track sits; the runner stays at z = 0 and the world
// scrolls towards the camera.
export const TRACK_CENTER_Z = -100
// One dash of the lane divider, in world units; the track texture repeats on this period.
export const TRACK_DASH_PERIOD = 6

export const RUN_SPEED = 13
export const LANE_SWITCH_RATE = 14
export const STUMBLE_SECONDS = 0.9
export const STUMBLE_SPEED_RATIO = 0.35
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

export const GATE_POST_HEIGHT = 4.4
export const GATE_POST_RADIUS = 0.16
export const GATE_BEAM_HEIGHT = 0.32
export const GATE_BEAM_DEPTH = 0.3
export const SIGN_WIDTH = 2.3
export const SIGN_HEIGHT = 0.95
export const SIGN_Y = 3.55
export const SIGN_CANVAS_WIDTH = 512
export const SIGN_CANVAS_HEIGHT = 212
export const SIGN_FONT_FAMILY = '"Darumadrop One", system-ui, sans-serif'
export const SIGN_FONT_SIZE = 104
export const SIGN_FONT_MIN_SIZE = 56
export const SIGN_CORNER_RADIUS = 36
export const SIGN_BORDER_WIDTH = 10

// Each gate's landmark stands on the side of the track, the same one at the same word on
// every lap: it is the "place" the word is remembered at.
export const LANDMARK_SIDE_OFFSET = 6.4
export const LANDMARK_SEGMENTS = 18
// A tree, a tower, a ball, a ring and a gem: shapes different enough to tell apart at a glance.
export const LANDMARK_CONE = { radius: 1.3, height: 4.2 }
export const LANDMARK_TOWER = { width: 1.6, height: 5.2 }
export const LANDMARK_BALL = { radius: 1.4, lift: 1.6 }
export const LANDMARK_RING = { radius: 1.4, tube: 0.42, lift: 1.9 }
export const LANDMARK_GEM = { radius: 1.6, lift: 1.7 }

export const RUNNER_MODEL_PATH = 'stickboy.glb'
export const RUNNER_HEIGHT = 1.9
export const RUNNER_ANIMATION = 'run'
export const RUNNER_IDLE_ANIMATION = 'idle'
export const RUNNER_ANIMATION_SPEED = 14

export const CAMERA_POSITION: [number, number, number] = [0, 5.2, 8.6]
export const CAMERA_TARGET: [number, number, number] = [0, 1.8, -10]
// How much of the runner's sideways move the camera follows; less than all of it, so the
// lanes visibly shift under the camera when the runner changes lane.
export const CAMERA_FOLLOW_RATIO = 0.45

export const RECAP_SECONDS = 3.4
export const FEEDBACK_SECONDS = 0.7
export const SPEECH_RATE = 0.9

export const BACKGROUND_COLOR = 0xcfe2ee
export const GRASS_COLOR = 0xc9e4cf
export const TRACK_COLOR = '#f1e8d8'
export const TRACK_LINE_COLOR = '#d6c9b1'
export const TRACK_EDGE_COLOR = '#c8b99e'
export const POST_COLOR = 0xb7aed0

export const SIGN_COLORS = {
  idle: { fill: '#fffaf1', ink: '#4a4560', border: '#d8cfbd' },
  hint: { fill: '#8f9ee0', ink: '#ffffff', border: '#6f7fc7' },
  right: { fill: '#94d4b1', ink: '#23443a', border: '#5fae88' },
  wrong: { fill: '#e7a3b0', ink: '#5a2733', border: '#c97586' },
  reveal: { fill: '#94d4b1', ink: '#23443a', border: '#5fae88' }
}

export const LANDMARK_COLORS = [0xe8b4c4, 0xa9c7e8, 0xf2d49b, 0xb8dcc0, 0xc9b8e8, 0xf0b9a0]

export const setupConfig: SetupConfig = {
  ground: { color: GRASS_COLOR, size: 400, position: [0, 0, 0] },
  sky: false,
  scene: { backgroundColor: BACKGROUND_COLOR },
  camera: { position: CAMERA_POSITION, fov: 58 },
  // Flat and soft, so the pastel signs stay readable instead of blowing out on the lit side.
  lights: {
    ambient: { intensity: 2.4 },
    directional: { intensity: 1.2, position: [12, 30, 14] }
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
    speed: { min: 6, max: 24, step: 1, label: 'Run Speed' },
    speech: { boolean: true, label: 'Speak Words' }
  }
}
