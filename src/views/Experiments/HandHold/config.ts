import * as THREE from 'three'
import type { SetupConfig } from '@webgamekit/threejs'
import type { CoordinateTuple } from '@webgamekit/animation'

export const MEDIAPIPE_WASM_BASE_PATH =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm'
export const MEDIAPIPE_HAND_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'

/** Distance from the camera to the z=0 plane that hand landmarks are projected onto. */
export const CAMERA_DISTANCE = 6
export const CAMERA_FOV = 50

export const HAND_HOLD_SETUP_CONFIG: SetupConfig = {
  // No visible webcam feed: the video element still drives hand tracking, just hidden, so the
  // scene needs its own opaque backdrop instead of showing through a transparent canvas.
  scene: { backgroundColor: 0xcfe3f0 },
  camera: {
    position: [0, 0, CAMERA_DISTANCE] as CoordinateTuple,
    fov: CAMERA_FOV,
    lookAt: [0, 0, 0] as CoordinateTuple
  },
  ground: false,
  sky: false,
  lights: {
    ambient: { color: 0xffffff, intensity: 0.8 },
    directional: { color: 0xfff2e0, intensity: 1.6, position: [3, 4, 5] as CoordinateTuple },
    // Image-based lighting from every direction, softening the flat look a plain
    // directional/ambient rig gives a matte surface.
    environment: { intensity: 0.7 }
  },
  orbit: { target: new THREE.Vector3(0, 0, 0), disabled: true }
}

/** Average fingertip-to-wrist distance over knuckle-to-wrist distance, below which a hand
 * counts as a closed fist. */
export const FIST_OPENNESS_THRESHOLD = 1.15
/** Same ratio, above which a hand counts as fully open. Between the two thresholds a hand
 * keeps whatever grip it last had, so noise near either edge does not flicker the state.
 * Set well above the fist threshold for a generous margin: a fast swing that blurs the
 * fingertips for a frame should not read as an accidental open hand. */
export const OPEN_OPENNESS_THRESHOLD = 1.55
/** Per-finger version of the same ratio, above which that one finger counts as extended for
 * `countExtendedFingers`. Between the fist and open thresholds, tuned for a single finger
 * rather than the four-finger average. */
export const FINGER_EXTENDED_THRESHOLD = 1.3
/** Once a fist reads as open, it has to keep reading that way for this long before the grip
 * actually flips: a brief tracking glitch mid-swing recovers before the item is dropped. */
export const OPEN_GRIP_DELAY_MS = 250
/** How long a hand may go undetected (a dropped frame, motion blur mid-swing) before its item
 * is actually hidden, rather than blinking out on the very first missed frame. */
export const HAND_LOST_GRACE_MS = 250

/** Overall size multiplier applied to every held item, on top of the distance-based and
 * Config panel scaling below. */
export const ITEM_BASE_SCALE = 3
/** A hand's own wrist-to-knuckle span, in the same normalized units as `handSpan`, that reads
 * as "neutral" distance from the camera: an item's distance-based scale is 1 at this span. */
export const REFERENCE_HAND_SPAN = 0.12
/** How far the distance-based scale factor may move an item's size, so a bad detection frame
 * cannot shrink or balloon it without bound. */
export const HAND_DISTANCE_SCALE_RANGE = { min: 0.4, max: 2.5 }

/** Fraction of the remaining distance to the target an item's position/rotation/scale closes
 * each frame: lower reads smoother but laggier. Position and rotation are eased less than
 * scale, since a bat that lags behind a fast swing is expected, but one that visibly resizes
 * as it swings reads as a bug. */
export const ITEM_POSITION_SMOOTHING = 0.35
export const ITEM_ROTATION_SMOOTHING = 0.3
export const ITEM_SCALE_SMOOTHING = 0.5

/** Local length of the bat, knob to tip: shared between the bat geometry itself and the
 * world-space reach used to test whether it is touching a ball. */
export const BAT_LENGTH = 0.9
/**
 * Fractions of the scaled bat's length sampled every frame against the balls, concentrated
 * over the barrel end rather than the thin handle near the grip, since that is the part a
 * swing actually connects with.
 */
export const BAT_SAMPLE_FRACTIONS = [0.5, 0.65, 0.8, 0.95, 1] as const
/** How far a sampled point along the bat has to come from a ball to count as a hit. Balls and
 * hands both track at z=0, so this only has to cover the bat's own visual thickness (scaled
 * by hand distance) plus the ball's radius, with a margin for the gap between sample points. */
export const BAT_HIT_RADIUS = 0.45

export const BALL_RADIUS = 0.18
/** Fixed spawn point, straight ahead at z=0 like the hand plane itself, close enough to the
 * camera to already be in front of it rather than falling in from off the top of the frame. */
export const BALL_SPAWN_X = 0
export const BALL_SPAWN_Y = 1.4
/** Once a ball falls this far below centre, whether from gravity alone or after a hit arcs it
 * back down, it recycles back to a fresh spawn instead of continuing to fall forever. */
export const BALL_RESPAWN_BELOW_Y = -3.5
/** Slower than real gravity, so a falling ball stays reachable for a full swing instead of
 * dropping past the hand in a couple of frames. */
export const BALL_GRAVITY = 2.2
export const BALL_HIT_SPEED = 4.5
/** Added to the hit direction's own y before it is normalized, so a ball hit level with or
 * below the hand still arcs upward and away instead of skimming flat. */
export const BALL_HIT_UPWARD_BIAS = 0.6
/** Once hit, a ball ignores further hits for this long: without it, a bat lingering inside the
 * hit radius across several frames keeps resetting the ball's velocity to the same value
 * instead of letting it fly off, which reads as the ball vibrating in place. */
export const BALL_HIT_COOLDOWN_MS = 400

export const defaultConfigValues = {
  itemScale: 1
}

export const configControls = {
  itemScale: { min: 0.5, max: 2, step: 0.1, label: 'Item Scale' }
}
