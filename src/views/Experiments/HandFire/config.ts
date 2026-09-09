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

export const HAND_FIRE_SETUP_CONFIG: SetupConfig = {
  scene: { transparent: true },
  camera: {
    position: [0, 0, CAMERA_DISTANCE] as CoordinateTuple,
    fov: CAMERA_FOV,
    lookAt: [0, 0, 0] as CoordinateTuple
  },
  ground: false,
  sky: false,
  lights: { ambient: { color: 0xfff2e0, intensity: 1.2 } },
  orbit: { target: new THREE.Vector3(0, 0, 0), disabled: true }
  // No postprocessing: UnrealBloomPass does not preserve alpha, and this scene relies on
  // scene.transparent to show the webcam feed through the canvas. The additive particle
  // shader already reads as glowing fire without a bloom pass on top.
}

export const FLAME_PARTICLES_PER_HAND = 90
export const MAX_FIREBALLS = 10
export const FIREBALL_PARTICLES_PER_BALL = 30
/** How long a thrown fireball flies before despawning, in milliseconds. */
export const FIREBALL_LIFETIME_MS = 1800
export const AMBIENT_EMBER_COUNT = 160
/** Ambient embers drift within this box, behind the hand flames and fireballs. */
export const AMBIENT_EMBER_BOUNDS = {
  halfWidth: 6,
  halfHeight: 3.2,
  depthRange: [-4, -2] as [number, number]
}

export const SPARK_POOL_SIZE = 60
/** Sparks thrown out in one burst when a fist finishes opening. */
export const SPARK_BURST_COUNT = 18
export const SPARK_LIFETIME_MS = 550
/** How long a hand's flame stays flared up past its steady state right after opening. */
export const FLAME_BURST_DURATION_MS = 450
/** Peak extra size/brightness multiplier at the instant a fist opens, decaying to 0 over
 * FLAME_BURST_DURATION_MS. */
export const FLAME_BURST_FLARE_BOOST = 1.1

/** Average fingertip-to-wrist distance over knuckle-to-wrist distance, below which a hand
 * counts as a closed fist. */
export const FIST_OPENNESS_THRESHOLD = 1.15
/** Same ratio, above which a hand counts as fully open. Between the two thresholds a hand
 * keeps whatever grip it last had, so noise near either edge does not flicker the state. */
export const OPEN_OPENNESS_THRESHOLD = 1.45

export const defaultConfigValues = {
  fireballSpeed: 6,
  fireballCooldownSeconds: 0.6,
  flameIntensity: 1.6
}

export const configControls = {
  fireballSpeed: { min: 2, max: 15, step: 0.5, label: 'Fireball Speed' },
  fireballCooldownSeconds: { min: 0.2, max: 2, step: 0.1, label: 'Throw Cooldown (s)' },
  flameIntensity: { min: 0.3, max: 3, step: 0.1, label: 'Flame Intensity' }
}
