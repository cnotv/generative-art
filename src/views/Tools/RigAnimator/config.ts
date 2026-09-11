import * as THREE from 'three'
import type { SetupConfig } from '@webgamekit/threejs'
import type { CoordinateTuple } from '@webgamekit/animation'
import type { ControlMapping } from '@webgamekit/controls'

export const RIG_ANIMATOR_SETUP_CONFIG: SetupConfig = {
  scene: { backgroundColor: 0xf5f0e8 },
  camera: { position: [0, 1.6, 4] as CoordinateTuple, fov: 50 },
  ground: false,
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
export const MEDIA_FILE_ACCEPT = 'image/*,video/*'
export const DEFAULT_MODEL_PATH = '/character2.fbx'

export const BONE_MARKER_RADIUS_FRACTION = 0.009
/** A pointer ray picks a marker anywhere within this many of its drawn radii, so markers can be
 * drawn small without becoming hard to hit. */
export const BONE_MARKER_HIT_RADIUS_MULTIPLIER = 3
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

/** Radius of a bone's capsule collider, as a fraction of that bone's own length. */
export const BONE_COLLIDER_RADIUS_FRACTION = 0.3
/** A capsule never thins past this fraction of the rig's spread, however short its bone. */
export const BONE_COLLIDER_MIN_RADIUS_FRACTION = 0.012
/** Bones shorter than this fraction of the rig's spread carry no collider at all. */
export const BONE_COLLIDER_MIN_LENGTH_FRACTION = 0.004
/** How much a marble keeps of the speed it hits the rig with. */
export const BONE_COLLIDER_RESTITUTION = 0.3
export const BONE_COLLIDER_FRICTION = 0.6

/** Frames between one marble dropping and the next, same pattern as the Timeline view's
 * ball-spawn action, so the flow can be walked into rather than landing as one dump. */
export const DEFAULT_MARBLE_SPAWN_INTERVAL_FRAMES = 1
export const MARBLE_SPAWN_INTERVAL_RANGE = { min: 1, max: 200, step: 1 }
/** Marble radius range, as fractions of the rig's spread, so marbles scale with any model. */
export const MARBLE_RADIUS_FRACTION_RANGE: [number, number] = [0.014, 0.028]
/** Height of the drop point above the rig's feet, as a fraction of the rig's spread. */
export const MARBLE_DROP_HEIGHT_FRACTION = 3
/** Horizontal jitter of the drop point, as a fraction of the rig's spread, so a continuous
 * flow doesn't stack every marble on the exact same spot. */
export const MARBLE_FLOW_JITTER_FRACTION = 0.05
/**
 * Marbles keep little of the speed they land with, and shed a little more on every step.
 * Scaled-up gravity means a marble hits the floor several hundred units a second, and a lively
 * restitution turns that into a cloud that never settles rather than a heap.
 */
export const MARBLE_RESTITUTION = 0.18
export const MARBLE_DAMPING = 0.2
export const MARBLE_FRICTION = 0.6
export const MARBLE_ROUGHNESS = 0.35
export const MARBLE_METALNESS = 0.05
/** Fallback colour when marble textures are switched off. */
export const MARBLE_DEFAULT_COLOR = 0xd9e4f5
/**
 * The rig spread, in world units, that the world's own gravity already suits: roughly a
 * human-sized rig in metres. A model authored in centimetres is a hundred times that, and
 * falling at the same metres per second reads as slow motion, so a marble's gravity is scaled
 * by how far its rig is from this.
 */
export const MARBLE_GRAVITY_REFERENCE_SPREAD = 2

/** Inner width of the enclosure, as a fraction of the rig's spread. Sized to the narrow drop
 * column rather than the rig's full spread, since marbles now flow through one point. */
export const DEFAULT_ENCLOSURE_SIZE_FRACTION = 0.55
export const ENCLOSURE_SIZE_RANGE = { min: 0.55, max: 3, step: 0.05 }
export const ENCLOSURE_HEIGHT_FRACTION = 1.1
export const ENCLOSURE_THICKNESS_FRACTION = 0.04
export const ENCLOSURE_COLOR = 0xc9d4e4
export const ENCLOSURE_OPACITY_RANGE = { min: 0, max: 1, step: 0.05 }
export const DEFAULT_ENCLOSURE_OPACITY = 0

/** How far above the rig's feet the lamp's pivot sits, as a fraction of the rig's spread. */
export const LAMP_ANCHOR_HEIGHT_FRACTION = 1
/** How far to the side of the rig the pivot sits: close against the body rather than out by
 * the wall. */
export const LAMP_ANCHOR_SIDE_OFFSET_FRACTION = 0.08
/** How far toward the camera the lamp and the spawn cube both sit, in front of the rig rather
 * than level with it, so the two read as a matched pair at the same depth. */
export const PHYSICS_PROP_DEPTH_FRACTION = 0.2
/** Length of the rigid arm between the pivot and the lamp, as a fraction of the rig's spread. */
export const LAMP_ARM_LENGTH_FRACTION = 0.4
export const LAMP_RADIUS_FRACTION = 0.063
/** Cone height, as a fraction of the rig's spread: a lampshade reads taller than it is wide. */
export const LAMP_HEIGHT_FRACTION = 0.1
export const LAMP_CONE_SEGMENTS = 24
export const LAMP_COLOR = 0xf3e6d0
export const LAMP_OPACITY = 1
/** Next to nothing: a knock should barely move it, and gravity should pull it straight back to
 * hanging still rather than let it keep swinging. */
export const LAMP_RESTITUTION = 0.02
export const LAMP_FRICTION = 0.5
export const LAMP_DAMPING = 3
export const LAMP_ANGULAR_DAMPING = 4
export const LAMP_ROUGHNESS = 0.4
export const LAMP_METALNESS = 0.1
/** On top of the same rig-scaled gravity marbles get, so the lamp reads as a heavy fixture a
 * knock can barely budge rather than something light hanging off a wire. */
export const LAMP_WEIGHT_MULTIPLIER = 4

/** A touch-sensor cube on the rig's other side, no collision response, just detects the rig's
 * own bones brushing it and spawns a marble. Further out than the lamp sits close in, so
 * reaching it takes an actual, deliberate stretch. */
export const SPAWN_CUBE_SIDE_OFFSET_FRACTION = 0.35
export const SPAWN_CUBE_SIZE_FRACTION = 0.1
/** Same height as the lamp's own resting point, so both read as a matched pair. */
export const SPAWN_CUBE_HEIGHT_FRACTION = LAMP_ANCHOR_HEIGHT_FRACTION - LAMP_ARM_LENGTH_FRACTION
export const SPAWN_CUBE_COLOR = 0xd9e4f5
export const SPAWN_CUBE_ROUGHNESS = 0.5
export const SPAWN_CUBE_METALNESS = 0.1

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
/** Range and step the Config panel's smoothing slider offers. Lower than the default's own
 * 0.05 step reaches so heavier smoothing than the initial range allowed is still reachable. */
export const CAMERA_SMOOTHING_FACTOR_RANGE = { min: 0.01, max: 1, step: 0.01 }

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
    ArrowRight: 'previousFrame',
    'Shift+ArrowLeft': 'extendSelectionNext',
    'Shift+ArrowRight': 'extendSelectionPrevious'
  },
  gamepad: {
    button2: 'addKeyframe',
    button14: 'nextFrame',
    button15: 'previousFrame'
  }
}
