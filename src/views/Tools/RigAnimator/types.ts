import type { HandSide, Vector3Data } from '@webgamekit/rig'
import type { CameraLandmark } from './cameraPoseMapping'
import type { RigGroupRootBoneNames } from './bodyPartGroups'

export interface RigAnimatorConfig {
  model: string
  poses: string
  selectedBone: string
  boneRotation: { x: number; y: number; z: number }
  bonePosition: { x: number; y: number; z: number }
  frame: number
  fps: number
  showBoneMarkers: boolean
  cameraUseElbows: boolean
  cameraUseKnees: boolean
  cameraUseNeck: boolean
  cameraUseDepth: boolean
  cameraUseViewpoint: boolean
  cameraReachMultiplier: number
  cameraSmoothingFactor: number
  cameraMaxJump: number
  cameraShowPreview: boolean
  calibrationCountdownSeconds: number
  calibrationToleranceDegrees: number
  calibrationFieldOfViewDegrees: number
  calibratedFollowRotation: boolean
  calibratedFollowSideToSide: boolean
  calibratedFollowDistance: boolean
  calibratedFollowHandRotation: boolean
  calibratedMovementScale: number
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

/** Which step of the calibration flow is active, or null while it isn't running. */
export type CameraCalibrationStep = 'assignParts' | 'front' | 'side' | null

/** Which of the two held T-poses a calibration capture reads. */
export type CalibrationPoseKind = 'front' | 'side'

/** A MediaPipe normalized image landmark: 0 to 1 across the frame's own width and height. */
export interface ImageLandmark {
  x: number
  y: number
  visibility?: number
}

/** One detected frame as calibration and root motion read it. */
export interface CalibrationFrame {
  /** Raw image landmarks, unmirrored even for a live camera. */
  image: ImageLandmark[]
  /** World landmarks exactly as the rig mapping receives them, mirrored for a live camera. */
  world: CameraLandmark[]
  /** Video width over height, so image x and y can be measured in one unit. */
  aspect: number
}

/** Reference sizes read off the held front T-pose. Image sizes are in image-height units. */
export interface FrontCalibration {
  shoulderSpanImage: number
  armSpanImage: number
  /** Null when the hips were out of frame; distance then falls back to head height. */
  torsoHeightImage: number | null
  headHeightImage: number
  /** Shoulder midpoint in raw normalized image coordinates. */
  bodyCenterImage: { x: number; y: number }
  shoulderWidthMeters: number
  armSpanMeters: number
  /** Unit vector from the right shoulder toward the left on the scene's horizontal plane. */
  shoulderDirectionScene: { x: number; z: number }
  handAngles: Partial<Record<HandSide, number>>
}

export interface SideCalibration {
  /** Restores MediaPipe's compressed world depth to the scale of its own x axis. */
  depthScale: number
}

export interface CameraCalibration {
  front: FrontCalibration | null
  side: SideCalibration | null
  rootBoneNames: RigGroupRootBoneNames
}

export interface CalibratedRootMotionOptions {
  fieldOfViewDegrees: number
  followRotation: boolean
  followSideToSide: boolean
  followDistance: boolean
  movementScale: number
  mirror: boolean
}

/** How far the skeleton root moves from rest, in rig world units, and turns about world up. */
export interface RootMotion {
  offset: Vector3Data
  yaw: number
}

export interface CalibrationCountdownState {
  matchedSince: number | null
}

export interface CalibrationCountdownAdvance {
  state: CalibrationCountdownState
  remainingMs: number | null
  complete: boolean
}
