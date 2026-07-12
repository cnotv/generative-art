import type {
  MapperActionConfig,
  ControlsMapperGameConfig
} from '@/components/ControlsMapper/types'

export const LANE_WIDTH = 8
export const DECK_THICKNESS = 1
export const WALL_HEIGHT = 1.8
export const WALL_THICKNESS = 0.5

export const MARBLE_WEIGHT = 7

export const START_LENGTH = 12
export const FINISH_LENGTH = 16
export const STRAIGHT_SHORT_LENGTH = 12
export const STRAIGHT_LONG_LENGTH = 24
export const CURVE_RADIUS = 10
export const RAMP_LENGTH = 20
export const RAMP_ANGLE = 0.25
export const FUNNEL_DROP_HEIGHT = 8
export const FUNNEL_EXIT_LENGTH = 14
export const LOOP_EXIT_LENGTH = 22
export const GAP_JUMP_LENGTH = 26
export const GAP_JUMP_DROP = 1
export const BOOST_PAD_LENGTH = 10
export const BUMPER_FIELD_LENGTH = 16

export const CURVE_SEGMENTS = 12
export const CURVE_CHORD_OVERLAP = 1.06
export const BANK_ANGLE = 0.3

export const FUNNEL_TONGUE_LENGTH = 2
export const FUNNEL_RIM_RADIUS = 6
export const FUNNEL_BOWL_DEPTH = 4
export const FUNNEL_HOLE_RADIUS = 1.6

export const LOOP_RADIUS = 3
export const LOOP_BOTTOM_Z = -11
export const LOOP_SEGMENTS = 26
export const LOOP_GAP_ANGLE = 0.25
export const LOOP_X_SHIFT = 5
export const LOOP_LANE_WIDTH = 6
export const LOOP_WALL_HEIGHT = 0.8
export const LOOP_RING_SINK = 0.2
export const LOOP_RING_FRICTION = 0.2
export const LOOP_CHORD_OVERLAP = 1.03

export const GAP_RAMP_LENGTH = 8
export const GAP_RAMP_ANGLE = 0.15
export const GAP_LANDING_START = -14

export const BOOST_PAD_INSET = 1
export const BUMPER_SIZE_XZ = 1.2
export const BUMPER_HEIGHT = 1.4
export const BUMPER_RESTITUTION = 0.8

export const DECK_FRICTION = 0.9
export const DECK_RESTITUTION = 0.2

export const FINISH_CHECK_RADIUS = 5
export const SPAWN_HEIGHT = 1.5
export const SPAWN_Z_INSET = -2
export const SPAWN_LANE_MARGIN = 1.2

export const CONTROLS_GAME_ID = 'marble-editor'
export const MATCHMAKER_ROOM = 'marble-editor-matchmaker'

export const CONTROLS_ACTIONS: MapperActionConfig[] = [
  { id: 'forward', label: 'Forward', directional: true },
  { id: 'backward', label: 'Backward', directional: true },
  { id: 'left', label: 'Left', directional: true },
  { id: 'right', label: 'Right', directional: true },
  { id: 'camera', label: 'Camera mode' }
]

export const KEYBOARD_MAPPING = {
  keyboard: {
    w: 'forward',
    ArrowUp: 'forward',
    s: 'backward',
    ArrowDown: 'backward',
    a: 'left',
    ArrowLeft: 'left',
    d: 'right',
    ArrowRight: 'right',
    c: 'camera'
  },
  gamepad: {
    'axis1-up': 'forward',
    'axis1-down': 'backward',
    'axis0-left': 'left',
    'axis0-right': 'right',
    'dpad-up': 'forward',
    'dpad-down': 'backward',
    'dpad-left': 'left',
    'dpad-right': 'right'
  }
}

export const CONTROLS_CONFIG: ControlsMapperGameConfig = {
  gameId: CONTROLS_GAME_ID,
  actions: CONTROLS_ACTIONS,
  defaultMapping: KEYBOARD_MAPPING
}

export const COUNTDOWN_MS = 3000

export const FIRST_PERSON_HEIGHT = 1.4
export const FIRST_PERSON_LOOK_AHEAD = 8
export const FIRST_PERSON_DIRECTION_LERP = 0.12
export const FIRST_PERSON_MIN_SPEED = 1
export const CHECKPOINT_RADIUS = 9
export const BOOST_ZONE_MAX_HEIGHT = 3
export const BOOST_MAX_SPEED = 30
export const BOOST_IMPULSE = 3
export const FALL_MARGIN = 15
export const TIME_PENALTY_FALL = 5

export const SKY_COLOR = 0xb0d8f0
export const FOG_DENSITY = 0.0015
export const EDITOR_CAMERA_POSITION: [number, number, number] = [26, 28, 34]
export const EDITOR_ORBIT_TARGET: [number, number, number] = [0, 0, -30]
export const SELECTION_EMISSIVE = 0x445544

export const LIGHT_AMBIENT_INTENSITY = 1.2
export const LIGHT_DIRECTIONAL_INTENSITY = 2.5
export const LIGHT_DIRECTIONAL_POSITION: [number, number, number] = [10, 20, 10]

export const COLOR_START = 0x4caf50
export const COLOR_FINISH = 0xffd700
export const COLOR_STRAIGHT = 0x9e9e9e
export const COLOR_CURVE = 0x1565c0
export const COLOR_BANKED = 0x0097a7
export const COLOR_RAMP = 0xef6c00
export const COLOR_FUNNEL = 0x7b1fa2
export const COLOR_LOOP = 0x00897b
export const COLOR_GAP_JUMP = 0x5d4037
export const COLOR_BOOST = 0xffc107
export const COLOR_BUMPER = 0xd32f2f
