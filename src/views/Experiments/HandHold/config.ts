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
 * keeps whatever grip it last had, so noise near either edge does not flicker the state. */
export const OPEN_OPENNESS_THRESHOLD = 1.45
/** Per-finger version of the same ratio, above which that one finger counts as extended for
 * `countExtendedFingers`. Between the fist and open thresholds, tuned for a single finger
 * rather than the four-finger average. */
export const FINGER_EXTENDED_THRESHOLD = 1.3

/** Overall size multiplier applied to every held item, on top of the distance-based and
 * Config panel scaling below. */
export const ITEM_BASE_SCALE = 3
/** A hand's own wrist-to-knuckle span, in the same normalized units as `handSpan`, that reads
 * as "neutral" distance from the camera: an item's distance-based scale is 1 at this span. */
export const REFERENCE_HAND_SPAN = 0.12
/** How far the distance-based scale factor may move an item's size, so a bad detection frame
 * cannot shrink or balloon it without bound. */
export const HAND_DISTANCE_SCALE_RANGE = { min: 0.4, max: 2.5 }

/** Local length of the sword's blade, tip included: shared between the blade geometry itself
 * and the world-space reach used to test whether it is touching a grass blade. */
export const SWORD_BLADE_LENGTH = 0.85

/** Denser than a thin strip would need, since the patch now covers most of the lower half of
 * the frame rather than a sliver along the very bottom edge. */
export const GRASS_BLADE_COUNT = 450
/** A full patch filling the foreground across the bottom half of the frame, close enough to
 * the camera to dominate the view rather than sitting as a distant band behind the action. */
export const GRASS_PATCH_BOUNDS = {
  halfWidth: 8,
  y: { min: -2.9, max: -0.7 },
  depthRange: [-3, -0.6] as [number, number]
}
/** How far a sword's tip has to come from a grass blade's base to cut it. */
export const GRASS_CUT_RADIUS = 0.35

export const defaultConfigValues = {
  itemScale: 1
}

export const configControls = {
  itemScale: { min: 0.5, max: 2, step: 0.1, label: 'Item Scale' }
}
