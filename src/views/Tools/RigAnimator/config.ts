import * as THREE from 'three'
import type { SetupConfig } from '@webgamekit/threejs'
import type { CoordinateTuple } from '@webgamekit/animation'
import type { ControlMapping } from '@webgamekit/controls'
import type { CameraJointLimitDegrees } from './types'

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

/** A soft sand tone a shade darker than the background, so the ground reads without a hard edge. */
export const GROUND_COLOR = 0xe6dccb
/** How far the ground disc reaches, in the loaded model's own bounding radii. */
export const GROUND_RADIUS_MULTIPLIER = 3
export const GROUND_SEGMENTS = 64
/** How wide the key light's shadow reaches around the model, in its bounding radii. */
export const GROUND_SHADOW_SPAN_MULTIPLIER = 2

/**
 * The most vertices an auto-rig binds by walking the mesh's surface. That search grows with the
 * square of the vertex count, about seven seconds at five thousand, so anything denser is bound
 * by straight-line distance instead, which takes a fraction of a second at any size.
 */
export const AUTO_SKIN_SURFACE_VERTEX_LIMIT = 3000

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
/**
 * How many poses Record Motion samples per timeline frame from the live camera; an uploaded video
 * samples `CAMERA_VIDEO_SLOWDOWN_RATIO` instead. The extra samples are never kept as keyframes:
 * when the take ends, each frame's keyframe is filtered from the samples around it, so a single
 * misread pose is outvoted by its neighbours instead of landing on the timeline.
 */
export const RECORDING_SAMPLES_PER_FRAME = 2
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
export const MEDIAPIPE_FACE_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'

/** Side of the square canvas a face or hand crop is drawn into before its detector reads it. */
export const CAMERA_CROP_CANVAS_SIZE = 256
/** A crop never shrinks below this many source pixels, however far away the subject stands. */
export const CAMERA_CROP_MIN_SIZE_PIXELS = 48
/** A face crop's side, as a multiple of the detected shoulder span. */
export const CAMERA_FACE_CROP_SPAN_MULTIPLIER = 1.3
/** A hand crop's side, as a multiple of the detected shoulder span. */
export const CAMERA_HAND_CROP_SPAN_MULTIPLIER = 1.2
/** How close, as a share of the image, a detected hand must be to a body wrist to belong to it. */
export const CAMERA_HAND_WRIST_MATCH_DISTANCE = 0.15

/** How much of the torso's lean the pelvis takes; the spine bones above it share the rest. */
export const CAMERA_PELVIS_LEAN_SHARE = 0.35
/** How much of the head's turn away from the chest the neck takes; the head takes the rest. */
export const CAMERA_NECK_TURN_SHARE = 0.5
/**
 * BlazePose places the nose below the ear line, so a level gaze read from the ears and nose alone
 * points down. Measured against the Face Landmarker on the same clip: about 19°.
 */
export const CAMERA_HEAD_PITCH_OFFSET_RADIANS = 0.33
/** The furthest the head can turn away from the chest, about 80°; a face reading past it is a misdetection. */
export const CAMERA_HEAD_MAX_TURN_RADIANS = 1.4
/** A limb bent less than this, in degrees, carries no trustworthy cue for how its upper bone is rolled. */
export const CAMERA_TWIST_MIN_BEND_DEGREES = 10
/** A limb bent at least this much, in degrees, has its roll read entirely from the bend. */
export const CAMERA_TWIST_FULL_BEND_DEGREES = 30
/** Range and step the Config panel's two roll cue sliders offer, in degrees. */
export const CAMERA_TWIST_BEND_DEGREES_RANGE = { min: 0, max: 90, step: 1 }
/**
 * How far each joint may turn from its rest pose when camera capture drives it, in degrees, keyed
 * by bone name without the rig prefix or side (`Finger` stands for the index, middle, ring and
 * pinky alike). A ball joint may swing off its rest direction by `swing` and roll about its own
 * length by `twist`. A finger's middle and last joints are hinges: they only curl about the
 * rig's flexion axis, between `hingeMin` and `hingeMax`, so a noisy sideways reading can never
 * bend or twist them. A bone without an entry is not limited.
 */
export const CAMERA_JOINT_LIMITS_DEGREES: Record<string, CameraJointLimitDegrees> = {
  Spine: { swing: 30, twist: 20 },
  Spine1: { swing: 30, twist: 20 },
  Spine2: { swing: 30, twist: 20 },
  Neck: { swing: 45, twist: 45 },
  Head: { swing: 45, twist: 45 },
  Arm: { swing: 180, twist: 100 },
  ForeArm: { swing: 160, twist: 120 },
  Hand: { swing: 85, twist: 60 },
  UpLeg: { swing: 140, twist: 50 },
  Leg: { swing: 160, twist: 25 },
  Foot: { swing: 60, twist: 30 },
  ToeBase: { swing: 50, twist: 10 },
  Thumb1: { swing: 70, twist: 30 },
  Thumb2: { swing: 70, twist: 10 },
  Thumb3: { swing: 90, twist: 10 },
  Finger1: { swing: 90, twist: 10 },
  Finger2: { hingeMin: -10, hingeMax: 110 },
  Finger3: { hingeMin: -10, hingeMax: 90 }
}

/** A body landmark reported less confident than this is treated as not detected. */
export const CAMERA_LANDMARK_VISIBILITY_THRESHOLD = 0.5
/** Range and step the Config panel's landmark confidence slider offers. */
export const CAMERA_VISIBILITY_THRESHOLD_RANGE = { min: 0.05, max: 0.95, step: 0.05 }
/**
 * How sure the Hand Landmarker has to be about which hand it found before that hand drives any
 * finger. Its handedness score reads a palm's own orientation, so it is the score that sags
 * exactly when a hand is about to read as flipped round, which is what makes a rig hand snap
 * back and forth between two orientations frame after frame.
 */
export const CAMERA_HAND_CONFIDENCE = 0.7
/** Range and step the Config panel's hand confidence slider offers. */
export const CAMERA_HAND_CONFIDENCE_RANGE = { min: 0.05, max: 0.99, step: 0.01 }
/** The shortest and longest a fitted limb may come out, as a multiple of its own rest length. */
export const CAMERA_LIMB_FIT_MIN_SCALE = 0.5
export const CAMERA_LIMB_FIT_MAX_SCALE = 2

/**
 * How many times slower an uploaded video plays while it drives the rig, and how many poses Record
 * Motion samples per frame of it before filtering them down to one: slowed N times, detection gets
 * about N readings of every video frame, so N samples a frame is what it can fill. Record Motion
 * follows the video's own clock, so a take keeps the video's real timing at any ratio. 1 plays at
 * normal speed with one sample a frame and nothing to filter.
 */
export const CAMERA_VIDEO_SLOWDOWN_RATIO = 2
export const CAMERA_VIDEO_SLOWDOWN_RATIO_RANGE = { min: 1, max: 6, step: 1 }

/** Width of the docked camera/photo panel, as a fraction of the viewport, in both its own
 * layout and the 3D camera's re-centering onto the part of the canvas it leaves visible. */
export const CAMERA_PANEL_WIDTH_VW = 30

/**
 * How long, in milliseconds, the live feed takes to settle on a landmark held still. Longer irons
 * out more jiggle; a moving landmark is barely delayed either way, since the filter lets go as it
 * speeds up (see `filterCameraLandmarks`). 0 turns smoothing off.
 */
export const CAMERA_SMOOTHING_MILLISECONDS = 150
/** Range and step the Config panel's smoothing slider offers. */
export const CAMERA_SMOOTHING_MILLISECONDS_RANGE = { min: 0, max: 500, step: 10 }
/** How much a landmark's speed, per metre a second, loosens its smoothing: the One Euro filter's beta. */
export const CAMERA_SMOOTHING_SPEED_RESPONSE = 12
export const CAMERA_SMOOTHING_SPEED_RESPONSE_RANGE = { min: 0, max: 60, step: 1 }
/** How much the head's turn, per radian a second, loosens its smoothing. */
export const CAMERA_SMOOTHING_TURN_RESPONSE = 2
export const CAMERA_SMOOTHING_TURN_RESPONSE_RANGE = { min: 0, max: 20, step: 0.5 }
/** Cutoff for each landmark's speed estimate, so a single noisy reading does not read as motion. */
export const CAMERA_SMOOTHING_SPEED_CUTOFF_HERTZ = 1
export const CAMERA_SMOOTHING_SPEED_CUTOFF_RANGE = { min: 0.1, max: 10, step: 0.1 }
/**
 * How long, in milliseconds, each bone takes to settle on a newly applied rotation, on top of the
 * landmark smoothing. It evens out what landmark smoothing cannot: a limb snapping back to rest
 * when its landmarks drop out, or a roll flipping as an elbow straightens. 0 turns it off.
 */
export const CAMERA_BONE_SMOOTHING_MILLISECONDS = 0
export const CAMERA_BONE_SMOOTHING_MILLISECONDS_RANGE = { min: 0, max: 500, step: 10 }
/**
 * The fastest, in degrees a second, a joint may turn while following the camera. A real movement
 * rarely comes close; a misread frame that flips a limb or a roll half a turn does, so it is
 * spread over several readings and mostly undone by the next good one before it shows. 0 turns
 * the cap off.
 */
export const CAMERA_BONE_MAX_TURN_DEGREES_PER_SECOND = 720
export const CAMERA_BONE_MAX_TURN_DEGREES_PER_SECOND_RANGE = { min: 0, max: 3000, step: 30 }
/**
 * How long, in milliseconds, a hand the Hand Landmarker stops finding keeps its last reading. On
 * the attached dance clip it lost a hand for three frames or fewer about half the time; falling
 * back to the body's own wrist, pinky and index for those frames turned the palm by more than 90°
 * on most of them. 0 lets a hand drop out straight away.
 */
export const CAMERA_HAND_HOLD_MILLISECONDS = 330
export const CAMERA_HAND_HOLD_MILLISECONDS_RANGE = { min: 0, max: 1000, step: 10 }
/**
 * The furthest, in degrees, a palm may turn from the last trusted reading before the new one is
 * taken for a misreading and ignored, until `CAMERA_HAND_FLIP_CONFIRM_READINGS` readings in a row
 * agree on it. 180 turns the check off.
 */
export const CAMERA_HAND_FLIP_DEGREES = 45
export const CAMERA_HAND_FLIP_DEGREES_RANGE = { min: 10, max: 180, step: 5 }
/** How many readings in a row must agree before a sharply turned palm is believed. */
export const CAMERA_HAND_FLIP_CONFIRM_READINGS = 3
/** A trusted hand reading older than this, in milliseconds, no longer vetoes a sharply turned one. */
export const CAMERA_HAND_TRACK_RESET_MILLISECONDS = 500
/** A pose applied longer ago than this, in seconds, is not blended from: a new photo lands whole. */
export const CAMERA_BONE_SMOOTHING_RESET_SECONDS = 0.5

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
