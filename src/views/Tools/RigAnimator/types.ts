import type * as THREE from 'three'
import type {
  FaceLandmarker,
  HandLandmarker,
  NormalizedLandmark,
  PoseLandmarker
} from '@mediapipe/tasks-vision'
import type { HandSide, QuaternionData } from '@webgamekit/rig'

export interface RigAnimatorConfig {
  model: string
  poses: string
  selectedBone: string
  boneRotation: { x: number; y: number; z: number }
  bonePosition: { x: number; y: number; z: number }
  frame: number
  fps: number
  showBoneMarkers: boolean
  cameraGroundFeet: boolean
  cameraUseDepth: boolean
  cameraUseViewpoint: boolean
  cameraSmoothingMilliseconds: number
  cameraMaxJump: number
  cameraShowPreview: boolean
  targetLeftArm: boolean
  targetRightArm: boolean
  targetLeftLeg: boolean
  targetRightLeg: boolean
  targetSpineHead: boolean
  physicsEnabled: boolean
  marbleFlowEnabled: boolean
  marbleSpawnInterval: number
  marbleTextures: boolean
  enclosureSize: number
  enclosureOpacity: number
}

/** One BlazePose landmark: metres in world mode, normalized [0,1] in image mode either way. */
export interface CameraLandmark {
  x: number
  y: number
  z: number
  visibility: number
}

/**
 * One hand landmark from MediaPipe's Hand Landmarker. Unlike a body pose landmark, a hand
 * landmark carries no per-point visibility score; the model scores the whole hand instead.
 */
export interface CameraHandLandmark {
  x: number
  y: number
  z: number
}

/**
 * Everything one detection found, already mirrored when the source is a self-view. Any part may be
 * missing on its own: a close-up of a hand has no body, a subject turned away has no face.
 */
export interface CameraPoseFrame {
  /** BlazePose's 33 world landmarks, or null when no body was found. */
  bodyLandmarks: CameraLandmark[] | null
  /** The Hand Landmarker's 21 world landmarks for each side found. */
  handLandmarks: Partial<Record<HandSide, CameraHandLandmark[]>>
  /** The head's rotation read from the Face Landmarker, in scene axes, or null. */
  headRotation: QuaternionData | null
}

/** How fast a landmark was last moving, in its own units per second. */
export interface CameraLandmarkVelocity {
  x: number
  y: number
  z: number
}

/** Filtered landmarks and the velocity each was last moving at, carried between readings. */
export interface FilteredCameraLandmarks<T> {
  landmarks: T[]
  velocities: CameraLandmarkVelocity[]
}

/** The live feed's smoothing, tuned from the Config panel. */
export interface CameraSmoothingSettings {
  /** How long a landmark held still takes to settle; 0 turns smoothing off. */
  smoothingMilliseconds: number
  /** The furthest a landmark may move in one reading, in metres, before the rest is clamped off. */
  maxJump: number
}

/** Everything the live feed's filter carries from one reading to the next. */
export interface CameraPoseFilterState {
  frame: CameraPoseFrame
  bodyVelocities: CameraLandmarkVelocity[] | null
  handVelocities: Partial<Record<HandSide, CameraLandmarkVelocity[]>>
  timestampMilliseconds: number
}

/** The Config panel's switches for how a detected frame is applied to the rig. */
export interface CameraPoseMappingOptions {
  /**
   * Use each landmark's depth. A single photo gives MediaPipe far less to judge depth from than a
   * moving video does, so turning this off reads every direction flattened onto the image plane.
   */
  includeDepth: boolean
  /** Raise or lower the whole rig so its lowest foot stays on the floor it stands on at rest. */
  groundFeet: boolean
}

/** The rig's rest pose in world space, keyed by bone name: every applied rotation is a change from it. */
export interface CameraRetargetRest {
  worldQuaternions: Map<string, THREE.Quaternion>
  worldPositions: Map<string, THREE.Vector3>
}

/** A square region of a source image, in pixels, that a close-range detector is re-run on. */
export interface CameraCropSquare {
  left: number
  top: number
  size: number
}

/** The three MediaPipe detectors one capture source runs. */
export interface CameraLandmarkers {
  pose: PoseLandmarker
  hand: HandLandmarker
  face: FaceLandmarker
}

/** One detection pass: what to draw over the preview, and the frame to apply to the rig. */
export interface CameraDetection {
  previewLandmarks: NormalizedLandmark[] | null
  previewHandLandmarks: NormalizedLandmark[][]
  frame: CameraPoseFrame
}
