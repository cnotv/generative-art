import type {
  MapperActionConfig,
  ControlsMapperGameConfig
} from '@/components/ControlsMapper/types'

export const LANE_WIDTH = 8
export const DECK_THICKNESS = 1
export const WALL_HEIGHT = 1.8
export const WALL_THICKNESS = 0.5

export const MARBLE_WEIGHT = 14
export const MARBLE_MOVE_FORCE = 20
// Very low marble friction so it slides freely through banks and along walls
// instead of catching. Much lower than MarbleMadness (2.5).
export const MARBLE_FRICTION = 0.15

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
export const BANK_BLEND_ANGLE = 0.35
export const RAMP_LIP_LENGTH = 1.5

export const FUNNEL_TONGUE_LENGTH = 2
export const FUNNEL_RIM_RADIUS = 6
export const FUNNEL_BOWL_DEPTH = 4
export const FUNNEL_HOLE_RADIUS = 1.6

export const LOOP_RADIUS = 4
export const LOOP_BOTTOM_Z = -11
export const LOOP_SEGMENTS = 26
export const LOOP_GAP_ANGLE = 0.25
export const LOOP_X_SHIFT = -LANE_WIDTH
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
export const BUMPER_LATERAL_OFFSET = 1.4
export const BUMPER_SPACING_Z = 4
export const BUMPER_CLEARANCE_MARGIN = 0.3

export const DECK_FRICTION = 0.9
export const DECK_RESTITUTION = 0.004
export const MARBLE_RESTITUTION = 0.002
export const WALL_FRICTION = 0.05
export const WALL_DECK_OVERLAP = 0.25

// Defence-in-depth for flush piece junctions. The real fix for the edge
// artifact is removing the geometric overlap (pieces used to double up their
// colliders at each seam, which jitters contacts); pieces now butt up exactly.
// This small virtual margin additionally bridges any hairline crack a fast
// marble could catch on in real time. Tiny relative to MARBLE_RADIUS (0.8) so
// the float is imperceptible.
export const TRACK_CONTACT_SKIN = 0.03

export const FINISH_CHECK_RADIUS = 5
export const FINISH_CHECK_HEIGHT = 3
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
  { id: 'camera', label: 'Camera' },
  { id: 'back', label: 'Back to setup' },
  { id: 'editor', label: 'Back to editor' },
  { id: 'exit', label: 'Exit game' },
  { id: 'undo', label: 'Undo' },
  { id: 'redo', label: 'Redo' },
  { id: 'save', label: 'Save track' },
  { id: 'new-track', label: 'New track' },
  { id: 'delete-track', label: 'Delete track' },
  { id: 'select-previous', label: 'Select previous piece' },
  { id: 'select-next', label: 'Select next piece' },
  { id: 'play', label: 'Race the track' },
  { id: 'camera-pan', label: 'Camera pan (hold)' }
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
    c: 'camera',
    z: 'undo',
    y: 'redo'
  },
  gamepad: {
    'axis1-up': 'forward',
    'axis1-down': 'backward',
    'axis0-left': 'left',
    'axis0-right': 'right',
    'dpad-up': 'forward',
    'dpad-down': 'backward',
    'dpad-left': 'left',
    'dpad-right': 'right',
    triangle: 'camera',
    square: 'exit',
    options: 'back',
    l1: 'undo',
    r1: 'redo'
  }
}

// The mapper stores one flat mapping for the whole game; race bindings win
// key conflicts and each phase picks out the actions it owns.
export const COMBINED_DEFAULT_MAPPING = {
  keyboard: {
    z: 'undo',
    y: 'redo',
    n: 'new-track',
    ...KEYBOARD_MAPPING.keyboard
  },
  gamepad: {
    square: 'save',
    l2: 'camera-pan',
    ...KEYBOARD_MAPPING.gamepad
  }
}

export const CONTROLS_CONFIG: ControlsMapperGameConfig = {
  gameId: CONTROLS_GAME_ID,
  actions: CONTROLS_ACTIONS,
  defaultMapping: COMBINED_DEFAULT_MAPPING
}

export const EDITOR_ACTION_IDS = new Set([
  'undo',
  'redo',
  'save',
  'new-track',
  'delete-track',
  'select-previous',
  'select-next',
  'play',
  'camera-pan',
  'camera-left',
  'camera-right',
  'camera-up',
  'camera-down'
])

// Edit-phase pad scheme: right stick orbits the camera, the d-pad cycles the
// selected track piece, Options starts the race. The left stick and face
// buttons belong to EDITOR_MENU_MAPPING (UI focus) instead.
export const EDITOR_MAPPING = {
  keyboard: {
    z: 'undo',
    y: 'redo',
    s: 'save',
    n: 'new-track',
    Delete: 'delete-track',
    Backspace: 'delete-track'
  },
  gamepad: {
    l1: 'undo',
    r1: 'redo',
    square: 'save',
    triangle: 'new-track',
    circle: 'delete-track',
    'dpad-left': 'select-previous',
    'dpad-up': 'select-previous',
    'dpad-right': 'select-next',
    'dpad-down': 'select-next',
    options: 'play',
    l2: 'camera-pan',
    'axis2-left': 'camera-left',
    'axis2-right': 'camera-right',
    'axis3-up': 'camera-up',
    'axis3-down': 'camera-down'
  }
}

export const EDITOR_MENU_MAPPING = {
  keyboard: {
    ArrowUp: 'up',
    ArrowDown: 'down',
    ArrowLeft: 'left',
    ArrowRight: 'right',
    Enter: 'activate',
    Escape: 'cancel'
  },
  gamepad: {
    'axis0-left': 'left',
    'axis0-right': 'right',
    'axis1-up': 'up',
    'axis1-down': 'down',
    cross: 'activate',
    circle: 'cancel'
  }
}

export const EDITOR_CAMERA_ROTATE_SPEED = 1.6
export const EDITOR_CAMERA_PAN_SPEED = 40
export const EDITOR_CAMERA_POLAR_MIN = 0.15
export const EDITOR_CAMERA_POLAR_MAX = 1.45
// Distance the camera settles at when focusing a selected piece: pulled back
// so the piece and its neighbours stay in view (a gentle, less-zoomed frame).
export const EDITOR_FOCUS_DISTANCE = 55
export const EDITOR_FOCUS_LERP = 0.16
export const EDITOR_FOCUS_EPSILON = 0.08

export const SELECTION_PULSE_MIN = 0.7
export const SELECTION_PULSE_MAX = 1.4
export const SELECTION_PULSE_SPEED = 2

// Opacity of a track piece that sits between the race camera and the marble,
// so the marble is never fully hidden behind the track.
export const OCCLUSION_OPACITY = 0.5

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
export const EDITOR_CAMERA_POSITION: [number, number, number] = [26, 28, 34]
export const EDITOR_ORBIT_TARGET: [number, number, number] = [0, 0, -30]
export const SELECTION_EMISSIVE = 0x3fae5a

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
