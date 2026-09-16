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
  cameraTurnHips: boolean
  cameraBendSpine: boolean
  cameraTurnHead: boolean
  cameraCorrectHeadPitch: boolean
  cameraLimitHeadTurn: boolean
  cameraAimArms: boolean
  cameraRollUpperArms: boolean
  cameraRollForearms: boolean
  cameraAimLegs: boolean
  cameraRollThighs: boolean
  cameraAimFeet: boolean
  cameraTrackFace: boolean
  cameraSearchFaceAroundBody: boolean
  cameraTrackHands: boolean
  cameraSearchHandsAroundWrists: boolean
  cameraSideHandsByWrist: boolean
  cameraIgnoreOutsideImage: boolean
  cameraMirrorLive: boolean
  cameraDetectOnlyWhilePlaying: boolean
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
  /** Turn the pelvis to the detected hip line; off, the spine takes the whole turn. */
  turnHips: boolean
  /** Turn and bend the spine bones toward the detected shoulder line. */
  bendSpine: boolean
  /** Turn the neck and head, from the face tracker or else the ears and nose. */
  turnHead: boolean
  /** Tip a head read from the ears and nose back up by BlazePose's measured nose offset. */
  correctHeadPitch: boolean
  /** Drop a face reading turned further from the chest than a neck can, using the ears instead. */
  limitHeadTurn: boolean
  /** Aim the upper arms at the elbows and the forearms at the wrists. */
  aimArms: boolean
  /** Roll each upper arm so the elbow bends the way the forearm swings. */
  rollUpperArmsFromElbows: boolean
  /** Roll each forearm, and turn the hand, to the detected palm. */
  rollForearmsToPalms: boolean
  /** Aim the thighs at the knees and the shins at the ankles. */
  aimLegs: boolean
  /** Roll each thigh to where the kneecap and the foot point. */
  rollThighsFromKneesAndFeet: boolean
  /** Aim each foot at its toes. */
  aimFeet: boolean
}

/** The Config panel's switches for how each frame is detected, before any bone is turned. */
export interface CameraDetectionOptions {
  /** Run the Face Landmarker for the head; off, the head is read from the ears and nose. */
  trackFace: boolean
  /** Look for a face the whole frame missed in a crop around the body's nose. */
  searchFaceAroundBody: boolean
  /** Run the Hand Landmarker for the fingers. */
  trackHands: boolean
  /** Look for a hand the whole frame missed in a crop around the body's wrist. */
  searchHandsAroundWrists: boolean
  /** Side each hand by the body's nearer wrist rather than the detector's own label. */
  sideHandsByNearestWrist: boolean
  /** Treat body landmarks placed outside the image as not detected. */
  ignoreLandmarksOutsideImage: boolean
  /** Mirror the live camera, body, hands and head, to match its mirrored preview. */
  mirrorLiveCamera: boolean
  /** Only detect while an uploaded video plays; off, a paused frame keeps being read. */
  detectOnlyWhilePlaying: boolean
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

/** Everything one detection pass reads from. */
export interface CameraDetectionContext {
  source: HTMLVideoElement | ImageBitmap
  frameSize: { width: number; height: number }
  landmarkers: CameraLandmarkers
  /** The canvas face and hand crops are drawn into. */
  cropCanvas: HTMLCanvasElement
  options: CameraDetectionOptions
}

/** One detection pass: what to draw over the preview, and the frame to apply to the rig. */
export interface CameraDetection {
  previewLandmarks: NormalizedLandmark[] | null
  previewHandLandmarks: NormalizedLandmark[][]
  frame: CameraPoseFrame
}
