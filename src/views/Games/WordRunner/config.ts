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
import type { CefrLevel } from './types'

// The language a first visit starts in; after that the start screen remembers the last pick.
export const DEFAULT_LANGUAGE = 'de'

export const CEFR_LEVELS: CefrLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']

export const LANE_COUNT = 3
export const CENTRE_LANE = 1

// The same lane three times running reads as "stay put" rather than as part of a path.
export const MAX_SAME_LANE_STREAK = 2

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
  wide: { ratio: 0.6, seconds: 1.2 },
  miss: { ratio: 0.5, seconds: 1.2 }
}
// How often the bot takes the right word at each level. A player who reads the text beats it;
// one who guesses does not.
export const BOT_ACCURACY = { A1: 0.6, A2: 0.64, B1: 0.68, B2: 0.72, C1: 0.76, C2: 0.8 }
// Below this turn rate, in radians per unit of track, a gate is not on a bend worth cutting.
export const BEND_YAW_RATE_THRESHOLD = 0.009
export const STUMBLE_SHAKE = 0.18
export const STUMBLE_SHAKE_FREQUENCY = 47

// Room for the ball to roll between words: long enough to read the next three and settle
// into a lane, while the next gate still comes into view before the last one is passed.
export const GATE_SPACING = 44
export const LEAD_IN_DISTANCE = 34
export const GATE_SPAWN_DISTANCE = 78
// Gates fade in over this stretch before the spawn distance, instead of popping in.
export const GATE_FADE_DISTANCE = 20
// A passed gate fades within this far, before it can come between the camera and the ball.
export const GATE_BEHIND_DISTANCE = 2.5
export const LATE_HINT_DISTANCE = 18
export const GATE_POOL_SIZE = 6
// The finish line stands this far past the last word, so the last gate is not the line itself.
export const FINISH_RUN_OUT = 36
export const FINISH_LINE = {
  depth: 2.4,
  margin: 1.2,
  lift: 0.06,
  columns: 12,
  rows: 2,
  squarePixels: 32,
  colors: ['#fffaf1', '#4a4560']
}

export const SIGN_WIDTH = 3.2
export const SIGN_HEIGHT = 1.32
// Low enough that the ball rolls through the word rather than under a sign.
export const SIGN_Y = 2
export const SIGN_CANVAS_WIDTH = 512
export const SIGN_CANVAS_HEIGHT = 212
export const SIGN_FONT_FAMILY = '"Darumadrop One", system-ui, sans-serif'
export const SIGN_FONT_SIZE = 104
export const SIGN_FONT_MIN_SIZE = 56
export const SIGN_CORNER_RADIUS = 36
export const SIGN_BORDER_WIDTH = 10

// The route feature lies this far in front of its word, so the ball runs over it on the way in
// and the lane it is judged in is the one the word was taken in.
export const FEATURE_OFFSET = -3
export const RAMP = { width: 2.8, length: 3.4, rise: 0.8, thickness: 0.3, color: 0xe9c46a }
// lift is how much of the radius stands above the deck: the rest is sunk into it.
export const ROCK = { radius: 0.95, detail: 1, color: 0x9a8f82, lift: 0.55 }
export const GRAVEL = { width: 3.2, length: 8, lift: 0.05, color: 0xc9a77a }
// The hop off a ramp: how long the runner is airborne and how high it goes.
export const RAMP_HOP = { seconds: 0.6, height: 1.2 }

// The player and the bot are balls, small enough to sit inside one lane.
export const BALL = { radius: 1.1, segments: 32 }
export const PLAYER_SURFACE = 'red-stone'
export const BOT_SURFACE = 'mossy-stone'
export const BOT_GHOST_OPACITY = 0.45

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
// The camera aims this far above the deck, and eases towards its goal at this rate.
export const CAMERA_TARGET_HEIGHT = 1.8
export const CAMERA_FOLLOW_RATE = 6
export const CAMERA_START_POSITION: [number, number, number] = [0, 7, 10.5]

// The longest frame the run will take as one step. A hitch longer than this slows the run
// for a moment instead of carrying the runner past a gate before the lane could change.
export const MAX_FRAME_SECONDS = 0.1

export const FEEDBACK_SECONDS = 0.7

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

export const MATCHMAKER_ROOM = 'word-runner-matchmaker'
// A room races only once every player has loaded the course, or after this long at most,
// so one slow device cannot hold everyone at the start line for ever.
export const READY_TIMEOUT_MS = 15000
// How often a ball's place on the course is sent to the rest of the room.
export const PROGRESS_INTERVAL_SECONDS = 0.1
// Rivals' balls drawn at once: the bot alone, or this many other players in a room.
export const MAX_RIVALS = 4
// How quickly another player's ball eases towards where the room last reported it.
export const REMOTE_FOLLOW_RATE = 6

// The on-screen lane buttons on a touch screen, one either side, label to action.
export const TOUCH_LEFT_BUTTON: Record<string, string> = { '←': 'left' }
export const TOUCH_RIGHT_BUTTON: Record<string, string> = { '→': 'right' }

export const configControls = {
  run: {
    speed: { min: 6, max: 24, step: 1, label: 'Run Speed' }
  }
}
