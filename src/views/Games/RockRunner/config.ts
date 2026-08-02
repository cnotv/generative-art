import type { MapperActionConfig, ControlsMapperGameConfig } from '@/types/lobbyWizard'
import type { CoordinateTuple } from '@webgamekit/animation'
import type { CharacterType, PathTerm } from './types'

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
  },
  'faux-pad': {
    left: 'left',
    right: 'right'
  }
}

// Jump gets its own on-screen button rather than a faux-pad direction: it's
// easy to miss buried in an up/down tilt, and this is the only fauxpad
// action outside the pad's four directions.
export const FAUXPAD_BUTTONS: Record<string, string> = {
  Jump: 'jump'
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
// The furthest from the centreline anything may be scattered.
//
// A band at distance d from a centreline turning with radius R covers arc
// length in proportion to R - d on the inside of the bend and R + d on the
// outside. At d approaching R the inside collapses to nothing and then folds
// through the centre of curvature, which is what makes one side of a bend look
// crowded and close while the other looks sparse and far. The margin is the
// same one the side ground already keeps for the same reason.
export const MAX_SCATTER_DISTANCE = MIN_TURN_RADIUS - 2

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
export const WALL_HEIGHT = 20
export const WALL_THICKNESS = 1
// A small virtual margin on every track collider, bridging the hairline seam
// where the deck meets a wall. Without it a rolling ball catches on that
// concave junction and stops dead. Tiny next to ROCK_RADIUS.
export const TRACK_CONTACT_SKIN = 0.04
// The wall stands off the deck edge by a little more than the rock's radius, so
// the rock meets a flat face rather than the deck/wall corner itself.
export const WALL_INSET = -0.2

// A drawn edge along each side of the deck, so the path reads as an
// illustration rather than as a shape the renderer happened to produce.
// Every stroke in the game shares one ink: the path's edges, the rock's
// outline and the debris chips. A near-black warmed slightly off pure black,
// which sits better against the sand and the illustrations than a flat black
// does without reading as a different pen.
export const STROKE_COLOR = 0x150f0c
export const STROKE_WIDTH = 0.55
// Enough to clear the deck without floating above it. The deck is flat colour
// and the stroke sits directly on it, so anything less z-fights.
export const STROKE_LIFT = 0.03
// How far the line wanders from the deck edge. Long wavelengths against short
// ones: one gives the slow drift of a hand not quite following a straight line,
// the other the small tremor within it. Neither alone reads as drawn — pure
// drift looks like a bent track, pure tremor like noise.
export const STROKE_WANDER_TERMS = [
  { amplitude: 0.42, wavelength: 37 },
  { amplitude: 0.18, wavelength: 11.3 },
  { amplitude: 0.07, wavelength: 3.7 }
]
// The thickness wanders too. A band of constant width reads as an inlay however
// much it snakes, because a drawn line is uneven where the hand pressed harder.
export const STROKE_WIDTH_TERMS = [
  { amplitude: 0.6, wavelength: 19 },
  { amplitude: 0.4, wavelength: 5.9 }
]
// Fraction of the base width the variation can add or remove.
export const STROKE_WIDTH_VARIATION = 0.45

// The rock carries the same ink line around its silhouette, drawn as an
// inverted hull: a grown copy of the ball rendered back-faces-only, so the rock
// covers its inside and only the rim survives.
export const ROCK_STROKE_NAME = 'rock-stroke'
// Relative to the rock's own radius, so it survives the size slider unchanged.
// Reads as ink at this weight: the rock is dark and the line is nearly black,
// so an outline thin enough to work against pale ground disappears on it.
export const ROCK_STROKE_WIDTH = 0.09
// The rock's own ink, a shade off the one the path is drawn in. The two sit on
// very different backgrounds — pale sand against dark stone — so matching them
// exactly is not the same as making them read alike.
export const ROCK_STROKE_COLOR = 0x10100a
export const ROCK_STROKE_WOBBLE = 0.55
// Far below the rock's own segment count. The hull is only ever seen as a rim a
// few pixels wide, where the difference between 24 and 192 segments is nothing
// and the triangles are all cost.
export const ROCK_STROKE_SEGMENTS = 24
// The rock and its outline are ordered by hand, because the renderer's own
// order cannot express what is wanted. The scenery is transparent, and
// transparent geometry draws after every opaque object whatever its render
// order, so an opaque outline always loses to grass standing in front of it.
//
// Joining the transparent pass brings the three under one order: scenery
// first, then the outline over it, then the rock over both. The path's edge
// stays opaque and depth-sorted, so grass still crosses it — that trade was
// worth taking for a line spanning the screen, and not for a ball.
export const ROCK_STROKE_RENDER_ORDER = 2
export const ROCK_RENDER_ORDER = 3
// Products of sines over the direction a point sits in, which gives a smooth
// lumpiness around the ball rather than the ring-shaped banding a single axis
// would produce.
export const ROCK_STROKE_WOBBLE_TERMS = [
  { amplitude: 0.55, frequency: 2.7, phase: 0.9 },
  { amplitude: 0.3, frequency: 5.3, phase: 2.1 }
]
export const WALL_ELEMENT_NAME = 'edge-walls'
export const TRACK_ELEMENT_NAME = 'track'
export const FOG_ELEMENT_NAME = 'fog'
export const ROCK_ELEMENT_NAME = 'player-rock'
export const CAMERA_ELEMENT_NAME = 'run-camera'

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
// The side ground walks the same stages as the fog and the trees. These are the
// stage colours lightened: the terrain tint multiplies a ground texture, so
// using the fog colours as they are would darken the countryside to mud.
export const TERRAIN_STAGE_TINTS = [TERRAIN_TINT, 0xd9c096, 0xd39a92]

export const CHUNK_STATIONS = 12
export const CHUNK_LENGTH = CHUNK_STATIONS * STATION_SPACING
// Colliders reach a station past their chunk so consecutive ones overlap.
// Chunks are separate colliders, and Rapier only smooths contact normals across
// a mesh's own internal edges — where two butt together their end caps meet as
// an unsmoothed junction that a rolling ball catches on. Overlapping buries
// each cap inside its neighbour's solid, so the ball never reaches one. The
// visual meshes still butt exactly, or their surfaces would z-fight.
export const COLLIDER_OVERLAP_STATIONS = 1

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

export const SCATTER_ALPHA_TEST = 0.35
// How far the rock runs before the scenery moves to its next set of
// illustrations, so the wood slowly changes character over a long run.
export const SCATTER_STAGE_LENGTH = 500

export const ROCK_RADIUS = 2.2

// A stickman rides the same invisible rolling sphere rather than getting its
// own collider: cosmetic swap only, so every existing steering/jump/autopilot
// system keeps working on the sphere underneath, untouched. What does change
// by character is how that shared sphere is tuned — a running figure reads
// wrong pushed and gravity-pulled as hard as a boulder — so a handful of the
// sphere's own physics figures are overridden per character below rather than
// duplicating the whole preset.
export const CHARACTER_TYPES: { value: CharacterType; label: string }[] = [
  { value: 'rock', label: 'Rock' },
  { value: 'stickman', label: 'Stickman' }
]
export const DEFAULT_CHARACTER_TYPE: CharacterType = 'rock'
export const STICKMAN_MODEL_PATH = 'stickboy_maze.glb'
export const STICKMAN_ELEMENT_NAME = 'player-stickman'
// Sized well past the rig's own scale so it reads clearly against the rock's
// track width rather than looking lost on it; tune live from the elements
// panel rather than trusting this figure exactly.
export const STICKMAN_SCALE = 4.5
// Gentler than the rock's own figures across the board: lighter drive so it
// doesn't look shoved, lower speeds that read as a run rather than a roll,
// and a floatier jump to match the lower gravity. Tuned live in the elements
// panel, not derived from the rock's own numbers.
export const STICKMAN_FORWARD_IMPULSE = 30
export const STICKMAN_BASE_MAX_SPEED = 10
export const STICKMAN_MAX_SPEED_CEILING = 30
export const STICKMAN_JUMP_IMPULSE = 2350
export const STICKMAN_GRAVITY_SCALE = 5
// The sphere's centre sits one radius above the deck; the stickman's feet
// need to land there instead of at the centre.
export const STICKMAN_GROUND_OFFSET = -ROCK_RADIUS
// Mass in the sense of resistance to being pushed, which is the only thing mass
// does here: a body's fall rate is independent of it, so this cannot make the
// rock drop faster however large it gets.
//
// A hundred rather than more. The impulses below are scaled to match, so the
// handling is the one already tuned, but mass is what a fixed impulse has to
// overcome: left unscaled at 150 the rock tops out at 11.8 against a starting
// cap of 22, so it never reaches its own speed ramp at all.
export const ROCK_MASS = 100
// Rapier has one world gravity, so a body's own weight is expressed as a
// multiplier on it. The shared package calls this option `weight`, which is
// what it simulates, but it scales acceleration and not mass.
//
// Twenty, with the jump raised to match. One gravity governs both halves of an
// arc, so a heavier fall costs height unless the launch pays it back: together
// these clear 8.5 units in 0.3s up and 0.28s down, a far sharper hop than the
// 11.2 units and 0.57s each way they replace.
export const ROCK_GRAVITY_SCALE = 20
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
// Impulses are momentum, so this is divided by the mass above rather than
// producing a speed directly.
//
// It sets how hard the rock accelerates, not how fast it ends up: the push
// stops at the speed cap either way, so raising it shortens the climb to that
// cap without lifting it. Measured, the cap is reached in 0.4s against 0.93s at
// the figure before.
export const FORWARD_IMPULSE = 130
export const BASE_MAX_SPEED = 22
export const MAX_SPEED_CEILING = 46
export const SPEED_RAMP_DISTANCE = 4000

export const STEER_IMPULSE = 75
// Lateral speed is capped separately so steering stays responsive at any
// forward speed without letting the rock slide across the whole track at once.
export const MAX_LATERAL_SPEED = 12

// Self driving: how strongly the rock's offset from the centreline converts
// into a commanded centering velocity, and the fastest it will ever servo
// back toward the middle.
export const AUTOPILOT_GAIN = 1.5
export const AUTOPILOT_MAX_SPEED = 10

// An impulse is momentum, so it is divided by the rock's mass rather than
// producing a speed directly. Raised alongside the gravity above and measured
// against the solver with it: the pair clear 8.5 units in 0.3s of rise.
export const JUMP_IMPULSE = 6000
// The rock rests with its centre one radius above the deck; a little slack on
// top of that keeps jumping responsive while rolling over the hills.
// How far above its resting height the rock may sit and still be allowed to
// jump. Generous on purpose: measured along the real track the rock clears its
// resting height on roughly half of all frames just from rolling over the
// undulations, and a tight probe read that as airborne and refused the jump.
export const GROUND_PROBE_SLACK = 2
// The rock is thrown off its resting height by the terrain constantly, so the
// jump cannot insist on it descending either.
export const JUMP_RISING_TOLERANCE = 4
export const JUMP_COOLDOWN_SECONDS = 0.25
// A press still counts this long after rolling off an edge or over a crest.
// Without it the rock refuses to jump exactly when a player expects it to, since
// cresting a hill lifts it off the deck for a few frames at a time.
export const JUMP_COYOTE_SECONDS = 0.12
// A press this far ahead of landing is remembered and fires on touchdown, so
// pressing slightly early is not silently swallowed.
export const JUMP_BUFFER_SECONDS = 0.15

// Debris kicked up behind the rock. Pooled: a fixed set of particles is recycled
// oldest-first rather than allocated and collected every frame.
export const DEBRIS_COUNT = 220
// Three tenths of a second: the chips are a scuff at the rock's heels, not a
// smoke trail behind it. Landed between the four tenths this ran at and the two
// it was cut to, which read as too clipped.
export const DEBRIS_LIFETIME = 0.3
/** Seconds a chip lives when the rock is barely moving, so the trail shortens with speed. */
export const DEBRIS_MIN_LIFETIME = 0.105
// Around a tenth is the floor: smaller than this a chip is under two pixels at
// the distance the chase camera sits, and the trail simply stops resolving.
export const DEBRIS_SIZE = 0.11
// The stroke is an inverted hull: the same shape, grown slightly and drawn
// back-faces-only, so it reads as an outline around every chip.
export const DEBRIS_STROKE_SCALE = 1.5
export const DEBRIS_STROKE_COLOR = STROKE_COLOR
// Chips are ground kicked up by the rock, so they take the path's own colour.
// Pitched a shade darker than the deck itself: an exact match against the
// surface they sit on would leave them readable only by their outline.
export const DEBRIS_GROUND_COLOR = 0xc9ae83
export const DEBRIS_GRAVITY = -22
// Chips are thrown forty times a second. The rate is the honest place to thin
// the trail: cutting the burst instead runs into integer rounding, which takes
// a fifth off at full speed but half off at mid speed, where the burst is
// already only a chip or two.
export const DEBRIS_EMIT_INTERVAL = 0.025
// Chips released together each tick, scaled by how fast the rock is going: a
// rock barely rolling flicks up almost nothing, one at full speed throws a
// proper spray. The floor keeps a trail alive at walking pace.
export const DEBRIS_PER_BURST = 7
// Zero on purpose: a rock that is barely rolling should kick up nothing at all.
export const DEBRIS_MIN_BURST = 0
// Below this the rock is barely moving and kicking up dust would look wrong.
export const DEBRIS_MIN_SPEED = 1.2
export const DEBRIS_BACK_SPEED = 4
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

// The chase camera's own offsets. Previously borrowed from the marble game,
// which meant this game's camera was configured in another game's file and
// would have moved with it.
export const CHASE_HEIGHT = 14
export const CHASE_BACK = 12
export const CAMERA_TRANSITION_SECONDS = 0.6
export const COUNTDOWN_MS = 3000

// The eye rides ahead of the rock rather than on its crown. Perched on top, a
// ball this size fills the bottom of the frame with its own body; pushed forward
// past its own radius, the whole sphere falls behind the camera and is never
// drawn.
export const FIRST_PERSON_EYE_CLEARANCE = 0.15
export const FIRST_PERSON_FORWARD = ROCK_RADIUS + 0.6
// Measured from the rock's centre, which already sits a radius above the deck,
// so the eye ends up at two and a half radii above the ground. Lower than this
// and the deck fills the frame: the view is level rather than angled down, so
// height is the only thing setting how much of the path ahead is visible.
export const FIRST_PERSON_HEIGHT = ROCK_RADIUS * 1.5
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
// The fog walks the same stages as the scenery, so the whole wood changes
// character together rather than the trees swapping inside an unchanged haze.
// It blends between them, landing exactly on each colour at its own milestone.
export const FOG_STAGE_COLORS = [SKY_COLOR, 0xb08a55, 0xb0534e]

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
