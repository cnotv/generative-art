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
    // Image-based lighting from every direction: what makes a metal blade actually show a
    // reflection instead of reading as flat grey under only a point/directional light.
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
 * scale, since a sword that lags behind a fast swing is expected, but one that visibly resizes
 * as it swings reads as a bug. */
export const ITEM_POSITION_SMOOTHING = 0.35
export const ITEM_ROTATION_SMOOTHING = 0.3
export const ITEM_SCALE_SMOOTHING = 0.5

/** Local length of the sword's blade, tip included: shared between the blade geometry itself
 * and the world-space reach used to test whether it is touching a grass blade. */
export const SWORD_BLADE_LENGTH = 0.85

/** A dense, lush field rather than a scattering of individual blades. */
export const GRASS_BLADE_COUNT = 45000
/** A full patch filling the foreground across the bottom half of the frame, close enough to
 * the camera to dominate the view rather than sitting as a distant band behind the action. */
export const GRASS_PATCH_BOUNDS = {
  halfWidth: 8,
  y: { min: -2.9, max: -0.7 },
  depthRange: [-3, -0.6] as [number, number]
}
/**
 * How far a point along the sword has to come from a grass blade to cut it. Hands (and so the
 * whole sword) only ever track at z=0, but the patch sits behind that plane, its nearest edge
 * at depthRange[1] (-0.6): the radius has to clear that gap on its own before it can reach any
 * blade at all, so it is well past the sword's own visual thickness.
 */
export const GRASS_CUT_RADIUS = 1.2
/**
 * Fractions of the scaled blade's length (from just past the guard to the tip) sampled every
 * frame against the grass, rather than testing only the very tip. A sword held upright points
 * mostly upward, well above the grass, so only its lower reaches ever pass through the patch;
 * testing the tip alone missed the grass almost entirely.
 */
export const SWORD_CUT_SAMPLE_FRACTIONS = [0.15, 0.35, 0.55, 0.75, 1] as const

export const defaultConfigValues = {
  itemScale: 1
}

export const configControls = {
  itemScale: { min: 0.5, max: 2, step: 0.1, label: 'Item Scale' }
}
