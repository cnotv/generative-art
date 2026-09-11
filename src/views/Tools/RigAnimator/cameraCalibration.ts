import type { HandSide } from '@webgamekit/rig'
import {
  CAMERA_LANDMARK_VISIBILITY_THRESHOLD,
  LANDMARK_INDEX,
  type CameraLandmark
} from './cameraPoseMapping'
import type { CameraHandLandmark } from './cameraHandPoseMapping'
import type {
  CalibratedRootMotionOptions,
  CalibrationFrame,
  CameraCalibration,
  FrontCalibration,
  ImageLandmark,
  RootMotion,
  SideCalibration
} from './types'

/** Below this, a span is too degenerate to divide by. */
const MINIMUM_EXTENT = 1e-6
/** Wrists closer in depth than this, in metres, show a side pose no depth to measure. */
const MINIMUM_DEPTH_EXTENT_METERS = 1e-3
const MIDDLE_KNUCKLE = 9

interface PlanePoint {
  x: number
  y: number
}

interface HorizontalVector {
  x: number
  z: number
}

const isVisible = (landmark: ImageLandmark | undefined): landmark is ImageLandmark =>
  landmark !== undefined && (landmark.visibility ?? 1) >= CAMERA_LANDMARK_VISIBILITY_THRESHOLD

/** A visible image landmark in image-height units, so x and y share one scale. */
const visiblePoint = (frame: CalibrationFrame, index: number): PlanePoint | null => {
  const landmark = frame.image[index]
  return isVisible(landmark) ? { x: landmark.x * frame.aspect, y: landmark.y } : null
}

const planeDistance = (a: PlanePoint, b: PlanePoint): number => Math.hypot(a.x - b.x, a.y - b.y)

const worldDistance = (a: CameraLandmark, b: CameraLandmark): number =>
  Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)

const shoulderMidpoint = (frame: CalibrationFrame): PlanePoint | null => {
  const left = visiblePoint(frame, LANDMARK_INDEX.leftShoulder)
  const right = visiblePoint(frame, LANDMARK_INDEX.rightShoulder)
  return left && right ? { x: (left.x + right.x) / 2, y: (left.y + right.y) / 2 } : null
}

/** Turning in place leaves the shoulder-to-hip height unchanged, so only distance scales it. */
const torsoHeight = (frame: CalibrationFrame): number | null => {
  const shoulders = shoulderMidpoint(frame)
  const leftHip = visiblePoint(frame, LANDMARK_INDEX.leftHip)
  const rightHip = visiblePoint(frame, LANDMARK_INDEX.rightHip)
  if (!shoulders || !leftHip || !rightHip) return null
  return Math.abs((leftHip.y + rightHip.y) / 2 - shoulders.y)
}

const headHeight = (frame: CalibrationFrame): number | null => {
  const shoulders = shoulderMidpoint(frame)
  const nose = visiblePoint(frame, LANDMARK_INDEX.nose)
  return shoulders && nose ? Math.abs(shoulders.y - nose.y) : null
}

/** The shoulder line through the same axis flips the rig mapping applies to every landmark, so a
 * turn read from it always agrees with where the mapping puts the hands. */
const sceneShoulderVector = (
  world: CameraLandmark[],
  depthScale: number
): HorizontalVector | null => {
  const left = world[LANDMARK_INDEX.leftShoulder]
  const right = world[LANDMARK_INDEX.rightShoulder]
  return left && right ? { x: left.x - right.x, z: -(left.z - right.z) * depthScale } : null
}

const focalLengthHeightUnits = (aspect: number, fieldOfViewDegrees: number): number =>
  (aspect * 0.5) / Math.tan((fieldOfViewDegrees * Math.PI) / 360)

/**
 * An empty calibration: nothing captured and no bone overrides.
 * @returns The empty calibration
 */
export const createEmptyCameraCalibration = (): CameraCalibration => ({
  front: null,
  side: null,
  rootBoneNames: {}
})

/**
 * Read the reference sizes of a held front T-pose.
 * @param frame The averaged frame the countdown captured
 * @param handAngles Each detected hand's scene-space angle at the same instant
 * @returns The front calibration, or null when the shoulders, wrists or nose are not detected
 */
export const measureFrontCalibration = (
  frame: CalibrationFrame,
  handAngles: Partial<Record<HandSide, number>>
): FrontCalibration | null => {
  const leftShoulder = visiblePoint(frame, LANDMARK_INDEX.leftShoulder)
  const rightShoulder = visiblePoint(frame, LANDMARK_INDEX.rightShoulder)
  const leftWrist = visiblePoint(frame, LANDMARK_INDEX.leftWrist)
  const rightWrist = visiblePoint(frame, LANDMARK_INDEX.rightWrist)
  const head = headHeight(frame)
  const direction = sceneShoulderVector(frame.world, 1)
  if (!leftShoulder || !rightShoulder || !leftWrist || !rightWrist || head === null || !direction) {
    return null
  }
  const shoulderSpanImage = planeDistance(leftShoulder, rightShoulder)
  const shoulderWidthMeters = worldDistance(
    frame.world[LANDMARK_INDEX.leftShoulder],
    frame.world[LANDMARK_INDEX.rightShoulder]
  )
  const directionLength = Math.hypot(direction.x, direction.z)
  if (
    shoulderSpanImage < MINIMUM_EXTENT ||
    shoulderWidthMeters < MINIMUM_EXTENT ||
    directionLength < MINIMUM_EXTENT
  ) {
    return null
  }
  return {
    shoulderSpanImage,
    armSpanImage: planeDistance(leftWrist, rightWrist),
    torsoHeightImage: torsoHeight(frame),
    headHeightImage: head,
    bodyCenterImage: {
      x: (leftShoulder.x + rightShoulder.x) / 2 / frame.aspect,
      y: (leftShoulder.y + rightShoulder.y) / 2
    },
    shoulderWidthMeters,
    armSpanMeters: worldDistance(
      frame.world[LANDMARK_INDEX.leftWrist],
      frame.world[LANDMARK_INDEX.rightWrist]
    ),
    shoulderDirectionScene: { x: direction.x / directionLength, z: direction.z / directionLength },
    handAngles: { ...handAngles }
  }
}

/**
 * Read how much MediaPipe compresses depth, from a held side T-pose: the arms now span the depth
 * axis, and the front pose already measured how long that span really is.
 * @param frame The averaged frame the countdown captured
 * @param front The front calibration
 * @returns The side calibration, or null when the wrists show no depth extent
 */
export const measureSideCalibration = (
  frame: CalibrationFrame,
  front: FrontCalibration
): SideCalibration | null => {
  const leftWrist = frame.world[LANDMARK_INDEX.leftWrist]
  const rightWrist = frame.world[LANDMARK_INDEX.rightWrist]
  if (!leftWrist || !rightWrist) return null
  const depthExtent = Math.abs(leftWrist.z - rightWrist.z)
  return depthExtent < MINIMUM_DEPTH_EXTENT_METERS
    ? null
    : { depthScale: front.armSpanMeters / depthExtent }
}

/**
 * The reach multiplier that makes a real full T-pose reach the rig's own full T-pose.
 * @param front The front calibration
 * @param rigArmSpanWorld Wrist-to-wrist distance of the rig at rest, in world units
 * @param rigShoulderWidthWorld Arm-to-arm distance of the rig, in world units
 * @returns The multiplier for the mapping's `reachMultiplier`
 */
export const computeCalibratedReachMultiplier = (
  front: FrontCalibration,
  rigArmSpanWorld: number,
  rigShoulderWidthWorld: number
): number =>
  (rigArmSpanWorld * front.shoulderWidthMeters) / (front.armSpanMeters * rigShoulderWidthWorld)

/**
 * Scale every landmark's depth, leaving x, y and visibility as they are.
 * @param landmarks World landmarks
 * @param depthScale The side calibration's depth scale
 * @returns The rescaled landmarks
 */
export const scaleLandmarkDepth = (
  landmarks: CameraLandmark[],
  depthScale: number
): CameraLandmark[] => landmarks.map((landmark) => ({ ...landmark, z: landmark.z * depthScale }))

/** Calibrated apparent size over current apparent size, which is current distance over calibrated
 * distance; torso height when both frames show the hips, head height otherwise. */
const distanceRatio = (frame: CalibrationFrame, front: FrontCalibration): number | null => {
  const torso = torsoHeight(frame)
  if (torso !== null && front.torsoHeightImage !== null && torso > MINIMUM_EXTENT) {
    return front.torsoHeightImage / torso
  }
  const head = headHeight(frame)
  return head !== null && head > MINIMUM_EXTENT ? front.headHeightImage / head : null
}

/** The shoulder span shrinks with the cosine of the turn once distance is corrected for; the
 * direction comes from the depth-scaled shoulder line against the calibrated one. */
const calibratedYaw = (
  shoulderSpan: number,
  ratio: number,
  frame: CalibrationFrame,
  front: FrontCalibration,
  side: SideCalibration | null
): number => {
  const cosine = Math.min(1, Math.max(0, (shoulderSpan * ratio) / front.shoulderSpanImage))
  const magnitude = Math.acos(cosine)
  const current = sceneShoulderVector(frame.world, side?.depthScale ?? 1)
  if (!current) return magnitude
  const reference = front.shoulderDirectionScene
  const turn = reference.z * current.x - reference.x * current.z
  return turn < 0 ? -magnitude : magnitude
}

/**
 * How far the skeleton root should move and turn, read from a live frame against the calibration.
 * @param frame The live frame
 * @param calibration The captured calibration
 * @param rigShoulderWidthWorld Arm-to-arm distance of the rig, to convert metres to rig units
 * @param options Which components to follow, the webcam field of view, scale and mirroring
 * @returns The root motion, or null without a front calibration or detected shoulders
 */
export const computeCalibratedRootMotion = (
  frame: CalibrationFrame,
  calibration: CameraCalibration,
  rigShoulderWidthWorld: number,
  options: CalibratedRootMotionOptions
): RootMotion | null => {
  const { front, side } = calibration
  const leftShoulder = visiblePoint(frame, LANDMARK_INDEX.leftShoulder)
  const rightShoulder = visiblePoint(frame, LANDMARK_INDEX.rightShoulder)
  if (!front || !leftShoulder || !rightShoulder) return null
  const ratio = distanceRatio(frame, front)
  if (ratio === null) return null

  const focal = focalLengthHeightUnits(frame.aspect, options.fieldOfViewDegrees)
  const calibratedDistance = (focal * front.shoulderWidthMeters) / front.shoulderSpanImage
  const currentDistance = calibratedDistance * ratio
  const rigUnitsPerMeter =
    (rigShoulderWidthWorld / front.shoulderWidthMeters) * options.movementScale
  const lateralMeters = (heightUnitsX: number, distance: number): number =>
    ((heightUnitsX - frame.aspect / 2) * distance) / focal
  const currentCenterX = (leftShoulder.x + rightShoulder.x) / 2
  const calibratedCenterX = front.bodyCenterImage.x * frame.aspect
  const sideways =
    lateralMeters(currentCenterX, currentDistance) -
    lateralMeters(calibratedCenterX, calibratedDistance)

  return {
    offset: {
      x: options.followSideToSide ? (options.mirror ? -1 : 1) * sideways * rigUnitsPerMeter : 0,
      y: 0,
      z: options.followDistance ? (calibratedDistance - currentDistance) * rigUnitsPerMeter : 0
    },
    yaw: options.followRotation
      ? calibratedYaw(planeDistance(leftShoulder, rightShoulder), ratio, frame, front, side)
      : 0
  }
}

/**
 * A hand's wrist-to-middle-knuckle angle on the scene's viewing plane, through the same mirroring
 * the body gets, so a hand turned one way on screen turns the rig's hand the same way.
 * @param landmarks One detected hand's 21 world landmarks, wrist first
 * @param mirror Whether the source is a mirrored live camera
 * @returns The angle in radians, 0 pointing right and growing counterclockwise
 */
export const computeSceneHandAngle = (landmarks: CameraHandLandmark[], mirror: boolean): number => {
  const wrist = landmarks[0]
  const knuckle = landmarks[MIDDLE_KNUCKLE]
  return Math.atan2(-(knuckle.y - wrist.y), (mirror ? -1 : 1) * (knuckle.x - wrist.x))
}

/**
 * How far a hand has turned since the front T-pose, wrapped to the shorter way round.
 * @param currentAngle The hand's live scene-space angle
 * @param side Which hand
 * @param front The front calibration, or null when uncalibrated
 * @returns The turn in radians, or 0 when this hand was never calibrated
 */
export const computeHandRotationDelta = (
  currentAngle: number,
  side: HandSide,
  front: FrontCalibration | null
): number => {
  const origin = front?.handAngles[side]
  if (origin === undefined) return 0
  const delta = currentAngle - origin
  return Math.atan2(Math.sin(delta), Math.cos(delta))
}
