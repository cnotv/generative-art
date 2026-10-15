import type { SetupConfig } from '@webgamekit/threejs'
import type {
  MapperActionConfig,
  ControlsMapperGameConfig
} from '@/components/ControlsMapper/types'

export const MATCHMAKER_ROOM = 'brick-breaker-matchmaker'
export const CONTROLS_GAME_ID = 'brick-breaker'
export const HIGH_SCORE_KEY = 'brick-breaker-high-score'

export const FIELD_HALF_WIDTH = 6
export const FIELD_TOP_Y = 8
export const FIELD_BOTTOM_Y = -8.5
export const FRAME_THICKNESS = 0.4
export const FRAME_DEPTH = 1

export const BRICK_COLUMN_COUNT = 8
export const BRICK_WIDTH = 1.5
export const BRICK_HEIGHT = 0.6
export const BRICK_DEPTH = 0.8
export const BRICK_VISUAL_GAP = 0.08
export const WALL_TOP_Y = 7.4
export const INITIAL_ROW_COUNT = 6
export const DANGER_ROW = 17
export const TOUGH_BRICK_CHANCE = 0.2
export const TOUGH_BRICK_HIT_POINTS = 2
export const WALL_SEED_STRIDE = 7919
export const GARBAGE_SEED_STRIDE = 104_729

export const PADDLE_Y = -7
export const PADDLE_WIDTH = 2.4
export const PADDLE_HEIGHT = 0.35
export const PADDLE_DEPTH = 0.8
export const PADDLE_SPEED = 13

export const BALL_RADIUS = 0.25
export const BALL_SPEED = 10
export const BALL_SPEED_PER_WALL = 1
export const MAX_BOUNCE_ANGLE_RADIANS = 1.05
export const LAUNCH_ANGLE_RADIANS = 0.35
export const MAX_SUBSTEP_DISTANCE = 0.1
export const SERVE_DELAY_SECONDS = 1

export const STARTING_LIVES = 3
export const NORMAL_BRICK_POINTS = 10
export const TOUGH_BRICK_POINTS = 25
export const GARBAGE_BRICK_POINTS = 5
export const BRICKS_PER_GARBAGE_ROW = 8
export const GARBAGE_GAP_COUNT = 1

export const BRICK_POOL_SIZE = 160
export const MAX_FRAME_SECONDS = 0.05
export const BRICK_ROUGHNESS = 0.85

export const SPRINT_DURATION_MS = 120_000
export const START_COUNTDOWN_MS = 3000
export const SCORE_POPUP_DURATION_MS = 900

export const BACKGROUND_COLOR = 0x2e2a40
export const FRAME_COLOR = 0x4a4560
export const PADDLE_COLOR = 0xfff4e0
export const BALL_COLOR = 0xff9f80
export const TOUGH_BRICK_COLOR = 0x8f7fb8
export const GARBAGE_BRICK_COLOR = 0x8a8597
export const ROW_COLORS = [0xe8a5b5, 0xf3c6a5, 0xf2e2a8, 0xb5e3c8, 0xaab8f0, 0xc9a7e4]

export const CAMERA_FOV = 55
export const CAMERA_TILT_OFFSET = -4.6
export const CAMERA_FIT_MARGIN = 1.12
export const MAX_RESERVED_BOTTOM_FRACTION = 0.4
export const TOUCH_BUTTON_BAND_PX = 148

export const SETUP_CONFIG: SetupConfig = {
  scene: { backgroundColor: BACKGROUND_COLOR },
  camera: { fov: CAMERA_FOV },
  orbit: false,
  ground: false,
  sky: false,
  lights: {
    ambient: { intensity: 1.6 },
    directional: { intensity: 1.2, position: [4, 6, 12], castShadow: false }
  }
}

export const KEYBOARD_MAPPING = {
  keyboard: {
    a: 'left',
    ArrowLeft: 'left',
    d: 'right',
    ArrowRight: 'right'
  },
  gamepad: {
    'axis0-left': 'left',
    'axis0-right': 'right',
    'dpad-left': 'left',
    'dpad-right': 'right'
  },
  'faux-pad': {
    left: 'left',
    right: 'right'
  }
}

export const TOUCH_LEFT_BUTTON: Record<string, string> = { '←': 'left' }
export const TOUCH_RIGHT_BUTTON: Record<string, string> = { '→': 'right' }

export const CONTROLS_ACTIONS: MapperActionConfig[] = [
  { id: 'left', label: 'Move left', directional: true },
  { id: 'right', label: 'Move right', directional: true }
]

export const CONTROLS_CONFIG: ControlsMapperGameConfig = {
  gameId: CONTROLS_GAME_ID,
  actions: CONTROLS_ACTIONS,
  defaultMapping: KEYBOARD_MAPPING
}
