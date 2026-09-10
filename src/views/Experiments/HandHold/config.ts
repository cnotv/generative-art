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
  scene: { transparent: true },
  camera: {
    position: [0, 0, CAMERA_DISTANCE] as CoordinateTuple,
    fov: CAMERA_FOV,
    lookAt: [0, 0, 0] as CoordinateTuple
  },
  ground: false,
  sky: false,
  lights: {
    ambient: { color: 0xffffff, intensity: 1.4 },
    directional: { color: 0xfff2e0, intensity: 1.6, position: [3, 4, 5] as CoordinateTuple }
  },
  orbit: { target: new THREE.Vector3(0, 0, 0), disabled: true }
}

/** Average fingertip-to-wrist distance over knuckle-to-wrist distance, below which a hand
 * counts as a closed fist. */
export const FIST_OPENNESS_THRESHOLD = 1.15
/** Same ratio, above which a hand counts as fully open. Between the two thresholds a hand
 * keeps whatever grip it last had, so noise near either edge does not flicker the state. */
export const OPEN_OPENNESS_THRESHOLD = 1.45

export const defaultConfigValues = {
  itemScale: 1
}

export const configControls = {
  itemScale: { min: 0.5, max: 2, step: 0.1, label: 'Item Scale' }
}
