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
// The path is a flat pastel brown rather than the ground art, so it reads as a
// worn trail cutting through the textured countryside.
export const DECK_COLOR = 0xdcc7a4
export const DECK_FRICTION = 1.4
export const DECK_RESTITUTION = 0.05

// Invisible containment walls. They are physical only: the runner never sees
// them, so the ground reads as an open field while the rock cannot leave it.
export const WALL_HEIGHT = 15
export const WALL_THICKNESS = 1
// A small virtual margin on every track collider, bridging the hairline seam
// where the deck meets a wall. Without it a rolling ball catches on that
// concave junction and stops dead. Tiny next to ROCK_RADIUS.
export const TRACK_CONTACT_SKIN = 0.04
// The wall stands off the deck edge by a little more than the rock's radius, so
// the rock meets a flat face rather than the deck/wall corner itself.
export const WALL_INSET = -0.2
export const WALL_ELEMENT_NAME = 'edge-walls'
export const TRACK_ELEMENT_NAME = 'track'
export const FOG_ELEMENT_NAME = 'fog'

// The countryside flanking the deck. Purely visual and collider-free: it gives
// the scatter something to stand on instead of floating over the sky.
//
// It is built as two strips that start where the deck ends, so it never
// overlaps the deck and the two surfaces cannot z-fight. Its half-width must
// stay under MIN_TURN_RADIUS or the swept strip folds through itself on the
// inside of a bend.
// The widest a ribbon swept along this path can go without folding through
// itself; see MIN_TURN_RADIUS. Raising it means changing how the countryside is
// built, not just this number.
export const TERRAIN_WIDTH = 92
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

export const ROCK_RADIUS = 2.2
export const ROCK_WEIGHT = 72
// Taken from the marble editor's bowling ball, which is the heaviest-feeling
// preset there. Its weight does not come from mass: it comes from gripping
// hard enough to roll rather than skid, and from a negative restitution that
// absorbs an impact instead of returning any of it.
export const ROCK_RESTITUTION = -0.3
export const ROCK_FRICTION = 10
export const ROCK_LINEAR_DAMPING = 0.35
// A gripping ball puts much of the drive into spin. Damping that spin is
// damping the drive, so it is kept low.
export const ROCK_ANGULAR_DAMPING = 0.05
// Rests on the deck rather than dropping onto it: the rock is held still for
// the countdown, so a drop would only be a lurch the moment it is released.
export const ROCK_SPAWN_HEIGHT = ROCK_RADIUS + 0.05
// High enough for the displacement map to have vertices to push around.
export const ROCK_SEGMENTS = 192
// Ghosts are never displaced, so they need only enough segments to read as
// round at the distance other players are seen from.
export const GHOST_SEGMENTS = 48
// Must stay a whole number. The sphere's u wraps from 1 back to 0 around the
// ball, so a fractional repeat samples different texels either side of that
// seam — the displacement map then pushes the two edges apart and the rock
// appears cracked. 1 is therefore the most zoomed-in the grain can go.
export const ROCK_TEXTURE_REPEAT = 1
// Kept low on purpose. A UV sphere's vertices all converge at its poles, and
// displacement samples a different texel for each of them, prising them apart
// into a visible star. The normal map carries the fine relief instead, since it
// shades per pixel and cannot tear geometry.
export const ROCK_DISPLACEMENT_SCALE = 0.06
// The scanned rock is very dark. The ambient-occlusion bite is eased off and a
// small emissive lift raises the whole surface, so it reads as light stone
// against the green ground instead of a black ball.
// Ambient occlusion darkens indirect light only; at full strength it doubles up
// with the albedo and the rock reads as a black ball.
export const ROCK_AO_INTENSITY = 0.28
// Emissive light is unlit and uniform, so every bit of it washes out the very
// shading that makes a normal map read as stone. Lightening the rock this way
// flattened it; brightness belongs to the material colour and the lights.
export const ROCK_EMISSIVE_INTENSITY = 0
export const ROCK_NORMAL_SCALE = 1.6
// The material colour multiplies the albedo, so it can only ever subtract. Red
// is left at full and the other channels pulled down: that shifts the grey
// stone warm without the flat wash an emissive tint would give. The ambient
// occlusion is eased to pay back the brightness the tint costs.
export const ROCK_TINT = 0xffd2a8
// Half-width of the start line players are spread across, so several rocks can
// share the track without spawning inside each other.
export const SPAWN_GATE_SPREAD = 4

// Auto-forward: the rock is pushed along the path tangent every frame and its
// speed cap climbs with distance, so the run gets faster the longer it lasts.
// Impulses are momentum, so they scale with the mass above. They are raised by
// slightly less than the weight was, which is what makes the rock read as
// heavier: it still drives, but takes longer to get going and to change line.
export const FORWARD_IMPULSE = 34
export const BASE_MAX_SPEED = 22
export const MAX_SPEED_CEILING = 46
export const SPEED_RAMP_DISTANCE = 4000

export const STEER_IMPULSE = 26
// Lateral speed is capped separately so steering stays responsive at any
// forward speed without letting the rock slide across the whole track at once.
export const MAX_LATERAL_SPEED = 12

// An impulse is momentum, so it has to grow with the mass: at 95 against a mass
// of 72 the rock launched at 1.3 m/s and rose nine centimetres, which reads as
// the jump doing nothing at all. This clears roughly the rock's own height.
export const JUMP_IMPULSE = 540
// The rock rests with its centre one radius above the deck; a little slack on
// top of that keeps jumping responsive while rolling over the hills.
export const GROUND_PROBE_DISTANCE = ROCK_RADIUS + 0.35
export const JUMP_COOLDOWN_SECONDS = 0.25

// Debris kicked up behind the rock. Pooled: a fixed set of particles is recycled
// oldest-first rather than allocated and collected every frame.
export const DEBRIS_COUNT = 220
export const DEBRIS_LIFETIME = 1.1
export const DEBRIS_SIZE = 0.14
// The stroke is an inverted hull: the same shape, grown slightly and drawn
// back-faces-only, so it reads as an outline around every chip.
export const DEBRIS_STROKE_SCALE = 1.5
export const DEBRIS_STROKE_COLOR = 0x1c1712
// The two colours chips are tinted with: the path they are scuffed from, and
// the rock itself. Not ROCK_TINT — that is the multiplier applied to a dark
// albedo, so on its own it is a pale peach that vanishes against the path.
export const DEBRIS_GROUND_COLOR = 0xc9ae83
export const DEBRIS_ROCK_COLOR = 0x5f4634
export const DEBRIS_GRAVITY = -22
export const DEBRIS_EMIT_INTERVAL = 0.02
// Chips released together each tick.
export const DEBRIS_PER_BURST = 4
// Below this the rock is barely moving and kicking up dust would look wrong.
export const DEBRIS_MIN_SPEED = 1.2
export const DEBRIS_BACK_SPEED = 5.5
export const DEBRIS_UP_SPEED = 6
export const DEBRIS_SPREAD = 6
export const DEBRIS_SPIN = 9
// Where chips appear along the rock's own axis, as a fraction of its radius.
// Positive is ahead of centre: at speed the rock outruns anything spawned
// behind it and the trail falls out of frame before it is seen, so chips start
// just forward of the contact patch and are immediately left behind.
export const DEBRIS_TRAIL_OFFSET = 0.7
// The rock leaves the deck briefly over every crest. Judging contact on the
// path height alone made the trail flicker, so the probe is given room.
export const DEBRIS_GROUND_TOLERANCE = 1.2

export const CAMERA_TRANSITION_SECONDS = 0.6
export const COUNTDOWN_MS = 3000

// The eye rides at the rock's leading edge rather than on its crown. Perched on
// top, a ball this size fills the bottom of the frame with its own body; pushed
// forward past its own radius, the whole sphere falls behind the camera and is
// never drawn. The small height keeps it clear of the deck on a crest.
export const FIRST_PERSON_EYE_CLEARANCE = 0.15
export const FIRST_PERSON_FORWARD = ROCK_RADIUS + 0.6
export const FIRST_PERSON_HEIGHT = ROCK_RADIUS * 0.5
export const FIRST_PERSON_LOOK_AHEAD = 20
export const FREE_CAM_HEIGHT = 40
export const FREE_CAM_BACK = 50

export const LIGHT_AMBIENT_INTENSITY = 1.6
export const LIGHT_DIRECTIONAL_INTENSITY = 2.2
export const LIGHT_DIRECTIONAL_POSITION: CoordinateTuple = [60, 120, 60]

export const SKY_COLOR = 0x638638
// The terrain strip ends at TERRAIN_HALF_WIDTH and the streamed chunks end at
// the lookahead, so the fog is tuned to swallow both edges before they can be
// seen: it matches the sky exactly and closes in well inside TRACK_LOOKAHEAD.
export const FOG_COLOR = SKY_COLOR
export const FOG_NEAR = 35
export const FOG_FAR = 130
// Sideways fade. The world is a narrow strip, so its long edges sit only tens
// of units away and camera-distance fog can never reach them.
export const FOG_SIDE_NEAR = 8
export const FOG_SIDE_FAR = 43

export const GROUND_TEXTURE_REPEAT_ALONG = 0.08
export const GROUND_TEXTURE_REPEAT_ACROSS = 1.5
// The ground art doubles as its own displacement and bump map, so the painted
// clumps read as raised turf instead of a flat decal. The deck is tessellated
// only along its length, so displacement stays subtle enough not to break the
// trimesh collider it is paired with.
// How finely the terrain is subdivided across its width. Without this the
// displacement map has no vertices to move. The deck needs none: it is a flat
// colour, so it stays at the minimum outline.
export const DECK_SEGMENTS_ACROSS = 1
export const TERRAIN_SEGMENTS_ACROSS = 20
export const GROUND_DISPLACEMENT_SCALE = 0.55
export const GROUND_DISPLACEMENT_BIAS = -0.25
export const GROUND_BUMP_SCALE = 0.4

export const DISTANCE_BROADCAST_MS = 120

export const CONFIG_STORAGE_KEY = 'rock-runner-lobby-config'
export const MATCHMAKER_ROOM = 'rock-runner-matchmaker'
