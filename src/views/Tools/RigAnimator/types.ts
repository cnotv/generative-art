import type { Quaternion } from 'three'
import type { HandSide, QuaternionData, Vector3Data } from '@webgamekit/rig'
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
  cameraUseDepth: boolean
  cameraUseViewpoint: boolean
  cameraFollowTorsoRotation: boolean
  cameraFollowNeckRotation: boolean
  cameraReachMultiplier: number
  cameraSmoothingFactor: number
  cameraMaxJump: number
  cameraShowPreview: boolean
  calibrationCountdownSeconds: number
  calibrationToleranceDegrees: number
  calibrationFieldOfViewDegrees: number
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
export type CameraCalibrationStep = 'assignParts' | 'front' | null

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
  /** The torso's scene-space orientation in the T-pose, what later twists and leans are read against. */
  torsoOrientation: QuaternionData
  /** The head's orientation at the same moment; null when the ears or eyes were not detected. */
  headOrientation: QuaternionData | null
  handAngles: Partial<Record<HandSide, number>>
}

export interface CameraCalibration {
  front: FrontCalibration | null
  rootBoneNames: RigGroupRootBoneNames
}

export interface CalibratedRootOffsetOptions {
  fieldOfViewDegrees: number
  followSideToSide: boolean
  followDistance: boolean
  movementScale: number
  mirror: boolean
}

/** The orientations body rotations are read against. */
export type OrientationBaselines = Pick<FrontCalibration, 'torsoOrientation' | 'headOrientation'>

/** One frame's body rotations, in the body's own frame; each null when not detected. */
export interface BodyRotations {
  torso: Quaternion | null
  /** The head's rotation relative to the torso. */
  neck: Quaternion | null
}

/** What a capture moves besides the limb targets. */
export interface CameraBodyMotion extends BodyRotations {
  /** How far the skeleton root moves from rest, in rig world units. */
  rootOffset: Vector3Data | null
}

export interface CalibrationCountdownState {
  matchedSince: number | null
}

export interface CalibrationCountdownAdvance {
  state: CalibrationCountdownState
  remainingMs: number | null
  complete: boolean
}
