import * as THREE from 'three'
import type { SetupConfig } from '@webgamekit/threejs'
import type { CoordinateTuple } from '@webgamekit/animation'
import type { ControlMapping } from '@webgamekit/controls'

export const RIG_ANIMATOR_SETUP_CONFIG: SetupConfig = {
  scene: { backgroundColor: 0xf5f0e8 },
  camera: { position: [0, 1.6, 4] as CoordinateTuple, fov: 50 },
  ground: { size: 40, color: 0xcfe8d8 },
  sky: false,
  lights: {
    ambient: { color: 0xffffff, intensity: 2.2 },
    directional: {
      color: 0xfff2e0,
      intensity: 1.4,
      position: [4, 6, 4] as CoordinateTuple,
      castShadow: true
    }
  },
  orbit: { target: new THREE.Vector3(0, 1, 0) }
}

export const MODEL_FILE_ACCEPT = '.fbx,.glb,.gltf'
export const POSES_FILE_ACCEPT = 'application/json'
export const DEFAULT_MODEL_PATH = '/character2.fbx'

export const BONE_MARKER_RADIUS_FRACTION = 0.015
export const BONE_MARKER_COLOR_DEFAULT = 0xb8c4f0
export const BONE_MARKER_COLOR_SELECTED = 0xf0a8a0
/** Each hierarchy level below the root shrinks a marker by this factor, so depth reads visually. */
export const BONE_MARKER_DEPTH_FALLOFF = 0.82
/** A marker never shrinks past this fraction of its rig's base size, however deep the chain. */
export const BONE_MARKER_MIN_SCALE = 0.35

export const DEFAULT_FPS = 30
export const DEFAULT_FRAME_MAX = 150
/** The rig timeline's frame range never shrinks below this, dragging its resize handle in. */
export const FRAME_MAX_MIN = 10

export const ROTATION_CONTROL = {
  label: 'Bone Rotation',
  component: 'CoordinateInput',
  min: { x: -Math.PI, y: -Math.PI, z: -Math.PI },
  max: { x: Math.PI, y: Math.PI, z: Math.PI },
  step: { x: 0.01, y: 0.01, z: 0.01 }
}

/** Fraction of the rig's own spread used as the +/- range for the Bone Position panel field. */
export const POSITION_RANGE_FRACTION = 0.6
export const POSITION_STEP_FRACTION = 0.002
/** Fallback +/- range for Bone Position before any rig is loaded. */
export const DEFAULT_POSITION_RANGE = 1

export const EXPORT_GLB_FILENAME = 'rig-animation.glb'
export const EXPORT_JSON_FILENAME = 'rig-animation.json'

export const CAMERA_FRAME_DISTANCE_MULTIPLIER = 2.5

export const MEDIAPIPE_WASM_BASE_PATH =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm'
export const MEDIAPIPE_POSE_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task'
export const MEDIAPIPE_HAND_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'

/** Width of the docked camera/photo panel, as a fraction of the viewport, in both its own
 * layout and the 3D camera's re-centering onto the remaining visible half. */
export const CAMERA_PANEL_WIDTH_VW = 45

/** Fraction of each new frame's landmarks blended into the running smoothed set, for the live
 * camera feed. Lower reads smoother but laggier; 1 would turn smoothing off entirely. */
export const CAMERA_LANDMARK_SMOOTHING_FACTOR = 0.35
/** Range and step the Config panel's smoothing slider offers. */
export const CAMERA_SMOOTHING_FACTOR_RANGE = { min: 0.05, max: 1, step: 0.05 }

/** Range and step the Config panel's reach multiplier slider offers. */
export const CAMERA_REACH_MULTIPLIER_RANGE = { min: 0.5, max: 2, step: 0.05 }

/** How far, in metres, a smoothed landmark may move in a single frame before the excess past
 * this is clamped off as a sudden jump rather than genuine motion. */
export const CAMERA_LANDMARK_MAX_JUMP_METERS = 0.15
/** Range and step the Config panel's max jump slider offers. */
export const CAMERA_MAX_JUMP_RANGE = { min: 0.02, max: 0.5, step: 0.01 }

/**
 * Keyboard and gamepad shortcuts for the rig timeline. X and Square are the same physical
 * button under two different platforms' naming, so "X to save, Square for next" as asked
 * would bind one button to two actions; next/previous instead use the D-pad (button14/15),
 * matching the same convention this codebase already uses for a directional pair elsewhere
 * (see RockRunner's own KEYBOARD_MAPPING), leaving the single face button for save.
 */
export const RIG_TIMELINE_KEYBOARD_MAPPING: ControlMapping = {
  keyboard: {
    ' ': 'addKeyframe',
    ArrowLeft: 'nextFrame',
    ArrowRight: 'previousFrame'
  },
  gamepad: {
    button2: 'addKeyframe',
    button14: 'nextFrame',
    button15: 'previousFrame'
  }
}
