import type { MapperActionConfig, ControlsMapperGameConfig } from '@/types/lobbyWizard'
import type { CoordinateTuple } from '@webgamekit/animation'
import type { PathTerm } from './types'

export const CONTROLS_GAME_ID = 'rock-runner'

export const CONTROLS_ACTIONS: MapperActionConfig[] = [
  { id: 'left', label: 'Steer left', directional: true },
  { id: 'right', label: 'Steer right', directional: true },
  { id: 'jump', label: 'Jump' },
  { id: 'camera', label: 'Camera' },
  { id: 'exit', label: 'Exit' }
]

export const KEYBOARD_MAPPING = {
  keyboard: {
    a: 'left',
    ArrowLeft: 'left',
    d: 'right',
    ArrowRight: 'right',
    ' ': 'jump',
    c: 'camera',
    Escape: 'exit'
  },
  gamepad: {
    'axis0-left': 'left',
    'axis0-right': 'right',
    button14: 'left',
    button15: 'right',
    button0: 'jump',
    button3: 'camera',
    button1: 'exit'
  }
}

export const CONTROLS_CONFIG: ControlsMapperGameConfig = {
  gameId: CONTROLS_GAME_ID,
  actions: CONTROLS_ACTIONS,
  defaultMapping: KEYBOARD_MAPPING
}

// Heading and height are each a sum of sine terms. The wavelengths are spread
// wide apart so the sum never settles into an obvious repeat.
//
// The amplitudes are bounded by the terrain, not by how hard the rock can
// steer: a swept ribbon folds through itself wherever its half-width exceeds
// the path's turn radius, so the sum of `amplitude * 2*pi / wavelength` has to
// stay under 1 / TERRAIN_HALF_WIDTH. See MIN_TURN_RADIUS below.
export const CURVE_TERMS: PathTerm[] = [
  { amplitude: 0.55, wavelength: 260 },
  { amplitude: 0.1, wavelength: 130 },
  { amplitude: 0.03, wavelength: 60 }
]

// Tightest turn the path can produce: the heading's derivative peaks when every
// term peaks together, and the radius is its reciprocal.
export const MAX_YAW_RATE = CURVE_TERMS.reduce(
  (total, term) => total + (term.amplitude * 2 * Math.PI) / term.wavelength,
  0
)
export const MIN_TURN_RADIUS = 1 / MAX_YAW_RATE

export const HILL_TERMS: PathTerm[] = [
  { amplitude: 9, wavelength: 340 },
  { amplitude: 3.2, wavelength: 131 },
  { amplitude: 1.1, wavelength: 57 }
]

// Distance between path stations. Small enough that the swept ground reads as a
// smooth curve, large enough that a chunk stays a few hundred triangles.
export const STATION_SPACING = 4

export const TRACK_WIDTH = 16
export const TRACK_HALF_WIDTH = TRACK_WIDTH / 2
export const DECK_THICKNESS = 1.2
export const DECK_FRICTION = 1.4
export const DECK_RESTITUTION = 0.05

// Invisible containment walls. They are physical only: the runner never sees
// them, so the ground reads as an open field while the rock cannot leave it.
export const WALL_HEIGHT = 3
export const WALL_THICKNESS = 1
// Frictionless: the rock is pushed forward every frame, so a wall it can grip
// turns into a wedge that pins it against the edge. It has to slide instead.
export const WALL_FRICTION = 0
export const WALL_RESTITUTION = 0.1
// A small virtual margin on every track collider, bridging the hairline seam
// where the deck meets a wall. Without it a rolling ball catches on that
// concave junction and stops dead. Tiny next to ROCK_RADIUS.
export const TRACK_CONTACT_SKIN = 0.04
// The wall stands off the deck edge by a little more than the rock's radius, so
// the rock meets a flat face rather than the deck/wall corner itself.
export const WALL_INSET = -0.2
export const WALL_ELEMENT_NAME = 'edge-walls'

// The countryside flanking the deck. Purely visual and collider-free: it gives
// the scatter something to stand on instead of floating over the sky.
//
// It is built as two strips that start where the deck ends, so it never
// overlaps the deck and the two surfaces cannot z-fight. Its half-width must
// stay under MIN_TURN_RADIUS or the swept strip folds through itself on the
// inside of a bend.
export const TERRAIN_WIDTH = 76
export const TERRAIN_HALF_WIDTH = TERRAIN_WIDTH / 2
export const TERRAIN_THICKNESS = 2
export const TERRAIN_DROP = 0.25
export const TERRAIN_TINT = 0xbcd79a

export const CHUNK_STATIONS = 12
export const CHUNK_LENGTH = CHUNK_STATIONS * STATION_SPACING

// The world starts behind the origin, not at it. The rock spawns at distance
// zero, so without ground behind it half the ball overhangs the leading edge
// and rolls backwards off the track. Keeping a stretch behind also means a
// glance back over the shoulder never shows the world simply stopping.
export const TRACK_BEHIND = CHUNK_LENGTH * 5
export const TRACK_LOOKAHEAD = 420
export const TRACK_DISPOSE_BEHIND = TRACK_BEHIND

export const SCATTER_CHUNK_LENGTH = CHUNK_LENGTH * 2
export const SCATTER_BEHIND = SCATTER_CHUNK_LENGTH * 3
export const SCATTER_LOOKAHEAD = 700
export const SCATTER_DISPOSE_BEHIND = SCATTER_BEHIND
export const BACKGROUND_CHUNK_LENGTH = CHUNK_LENGTH * 8
export const BACKGROUND_BEHIND = BACKGROUND_CHUNK_LENGTH * 2
export const BACKGROUND_LOOKAHEAD = 1800
export const BACKGROUND_DISPOSE_BEHIND = BACKGROUND_BEHIND

export const SCATTER_ALPHA_TEST = 0.35

export const ROCK_RADIUS = 1.1
export const ROCK_WEIGHT = 9
export const ROCK_RESTITUTION = 0.05
export const ROCK_FRICTION = 2.2
export const ROCK_LINEAR_DAMPING = 0.35
export const ROCK_ANGULAR_DAMPING = 0.25
export const ROCK_SPAWN_HEIGHT = 3
// High enough for the displacement map to have vertices to push around.
export const ROCK_SEGMENTS = 96
// Below 1 the stone pattern is scaled up, so the grain reads at the size the
// rock actually appears on screen rather than as fine noise.
export const ROCK_TEXTURE_REPEAT = 0.7
export const ROCK_DISPLACEMENT_SCALE = 0.07
// The scanned rock is very dark. The ambient-occlusion bite is eased off and a
// small emissive lift raises the whole surface, so it reads as light stone
// against the green ground instead of a black ball.
export const ROCK_AO_INTENSITY = 0.3
export const ROCK_EMISSIVE = 0x6b6660
export const ROCK_EMISSIVE_INTENSITY = 0.55
// Half-width of the start line players are spread across, so several rocks can
// share the track without spawning inside each other.
export const SPAWN_GATE_SPREAD = 4

// Auto-forward: the rock is pushed along the path tangent every frame and its
// speed cap climbs with distance, so the run gets faster the longer it lasts.
export const FORWARD_IMPULSE = 5.5
export const BASE_MAX_SPEED = 22
export const MAX_SPEED_CEILING = 46
export const SPEED_RAMP_DISTANCE = 4000

export const STEER_IMPULSE = 4.5
// Lateral speed is capped separately so steering stays responsive at any
// forward speed without letting the rock slide across the whole track at once.
export const MAX_LATERAL_SPEED = 12

export const JUMP_IMPULSE = 13
// The rock rests with its centre one radius above the deck; a little slack on
// top of that keeps jumping responsive while rolling over the hills.
export const GROUND_PROBE_DISTANCE = ROCK_RADIUS + 0.35
export const JUMP_COOLDOWN_SECONDS = 0.25

export const CAMERA_TRANSITION_SECONDS = 0.6
export const COUNTDOWN_MS = 3000

export const FIRST_PERSON_HEIGHT = 1.2
export const FIRST_PERSON_LOOK_AHEAD = 20
export const FREE_CAM_HEIGHT = 40
export const FREE_CAM_BACK = 50

export const LIGHT_AMBIENT_INTENSITY = 1.6
export const LIGHT_DIRECTIONAL_INTENSITY = 2.2
export const LIGHT_DIRECTIONAL_POSITION: CoordinateTuple = [60, 120, 60]

export const SKY_COLOR = 0xcfe8f6
// The terrain strip ends at TERRAIN_HALF_WIDTH and the streamed chunks end at
// the lookahead, so the fog is tuned to swallow both edges before they can be
// seen: it matches the sky exactly and closes in well inside TRACK_LOOKAHEAD.
export const FOG_COLOR = SKY_COLOR
export const FOG_NEAR = 60
export const FOG_FAR = 340

export const GROUND_TEXTURE_REPEAT_ALONG = 0.08
export const GROUND_TEXTURE_REPEAT_ACROSS = 1.5
// The ground art doubles as its own displacement and bump map, so the painted
// clumps read as raised turf instead of a flat decal. The deck is tessellated
// only along its length, so displacement stays subtle enough not to break the
// trimesh collider it is paired with.
// How finely the ground surfaces are subdivided across their width. Without
// this the displacement map has no vertices to move.
export const DECK_SEGMENTS_ACROSS = 12
export const TERRAIN_SEGMENTS_ACROSS = 20
export const GROUND_DISPLACEMENT_SCALE = 0.55
export const GROUND_DISPLACEMENT_BIAS = -0.25
export const GROUND_BUMP_SCALE = 0.4

export const DISTANCE_BROADCAST_MS = 120

export const CONFIG_STORAGE_KEY = 'rock-runner-lobby-config'
export const MATCHMAKER_ROOM = 'rock-runner-matchmaker'
