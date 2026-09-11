import {
  CAMERA_LANDMARK_VISIBILITY_THRESHOLD,
  LANDMARK_INDEX,
  type CameraLandmark
} from './cameraPoseMapping'
import { CALIBRATION_SIDE_SHOULDER_SPAN_RATIO } from './config'
import type {
  CalibrationFrame,
  CalibrationPoseKind,
  FrontCalibration,
  ImageLandmark
} from './types'

interface PlanePoint {
  x: number
  y: number
}

interface Arm {
  shoulder: PlanePoint
  elbow: PlanePoint
  wrist: PlanePoint
}

const isVisible = (landmark: ImageLandmark | undefined): landmark is ImageLandmark =>
  landmark !== undefined && (landmark.visibility ?? 1) >= CAMERA_LANDMARK_VISIBILITY_THRESHOLD

/** MediaPipe reports x across the frame's width and y across its height; scaling x by the aspect
 * puts both in height units, so an angle measured here is the angle a viewer actually sees. */
const toHeightUnits = (landmark: ImageLandmark, aspect: number): PlanePoint => ({
  x: landmark.x * aspect,
  y: landmark.y
})

const degreesToRadians = (degrees: number): number => (degrees * Math.PI) / 180

const angleFromLevel = (from: PlanePoint, to: PlanePoint): number =>
  Math.atan2(Math.abs(to.y - from.y), Math.abs(to.x - from.x))

/** Zero for a straight arm, growing as the elbow bends, whichever way it bends. */
const elbowBend = ({ shoulder, elbow, wrist }: Arm): number => {
  const upper = { x: elbow.x - shoulder.x, y: elbow.y - shoulder.y }
  const lower = { x: wrist.x - elbow.x, y: wrist.y - elbow.y }
  const cross = upper.x * lower.y - upper.y * lower.x
  const dot = upper.x * lower.x + upper.y * lower.y
  return Math.abs(Math.atan2(cross, dot))
}

const matchesFrontTPose = (frame: CalibrationFrame, toleranceRadians: number): boolean => {
  const indices = [
    LANDMARK_INDEX.leftShoulder,
    LANDMARK_INDEX.rightShoulder,
    LANDMARK_INDEX.leftElbow,
    LANDMARK_INDEX.rightElbow,
    LANDMARK_INDEX.leftWrist,
    LANDMARK_INDEX.rightWrist
  ]
  const landmarks = indices.map((index) => frame.image[index])
  if (!landmarks.every(isVisible)) return false
  const [leftShoulder, rightShoulder, leftElbow, rightElbow, leftWrist, rightWrist] = landmarks.map(
    (landmark) => toHeightUnits(landmark, frame.aspect)
  )
  const centerX = (leftShoulder.x + rightShoulder.x) / 2
  const arms: Arm[] = [
    { shoulder: leftShoulder, elbow: leftElbow, wrist: leftWrist },
    { shoulder: rightShoulder, elbow: rightElbow, wrist: rightWrist }
  ]
  return arms.every(
    (arm) =>
      angleFromLevel(arm.shoulder, arm.wrist) <= toleranceRadians &&
      elbowBend(arm) <= toleranceRadians &&
      Math.abs(arm.wrist.x - centerX) > Math.abs(arm.shoulder.x - centerX)
  )
}

/** Turned sideways the near arm points at the camera, so its image direction says nothing; what
 * still holds is that the shoulders overlap and the wrists stay at shoulder height. */
const matchesSideTPose = (
  frame: CalibrationFrame,
  toleranceRadians: number,
  front: FrontCalibration
): boolean => {
  const leftShoulderLandmark = frame.image[LANDMARK_INDEX.leftShoulder]
  const rightShoulderLandmark = frame.image[LANDMARK_INDEX.rightShoulder]
  if (!isVisible(leftShoulderLandmark) || !isVisible(rightShoulderLandmark)) return false
  const leftShoulder = toHeightUnits(leftShoulderLandmark, frame.aspect)
  const rightShoulder = toHeightUnits(rightShoulderLandmark, frame.aspect)
  const shoulderSpan = Math.hypot(
    leftShoulder.x - rightShoulder.x,
    leftShoulder.y - rightShoulder.y
  )
  if (shoulderSpan >= CALIBRATION_SIDE_SHOULDER_SPAN_RATIO * front.shoulderSpanImage) return false
  const shoulderY = (leftShoulder.y + rightShoulder.y) / 2
  const armLength = (front.armSpanImage - front.shoulderSpanImage) / 2
  const allowedDrop = Math.sin(toleranceRadians) * armLength
  const wrists = [frame.image[LANDMARK_INDEX.leftWrist], frame.image[LANDMARK_INDEX.rightWrist]]
    .filter(isVisible)
    .map((wrist) => toHeightUnits(wrist, frame.aspect))
  return wrists.length > 0 && wrists.every((wrist) => Math.abs(wrist.y - shoulderY) <= allowedDrop)
}

/**
 * Whether a frame shows the held T-pose a calibration step waits for.
 * @param frame The detected frame
 * @param kind Which T-pose: square-on, or turned sideways
 * @param toleranceDegrees How far an arm may tilt off level, or bend at the elbow
 * @param front The front calibration, needed to recognise the collapsed shoulders of a side pose
 * @returns Whether the pose matches
 */
export const detectCalibrationTPose = (
  frame: CalibrationFrame,
  kind: CalibrationPoseKind,
  toleranceDegrees: number,
  front: FrontCalibration | null
): boolean => {
  const toleranceRadians = degreesToRadians(toleranceDegrees)
  if (kind === 'front') return matchesFrontTPose(frame, toleranceRadians)
  return front !== null && matchesSideTPose(frame, toleranceRadians, front)
}

const mean = (values: number[]): number =>
  values.reduce((sum, value) => sum + value, 0) / values.length

/**
 * Average a run of held frames landmark by landmark, so a single noisy detection at the instant
 * the countdown ends does not become the calibration.
 * @param frames At least one frame, all from the same camera
 * @returns One frame whose every landmark is the mean of the inputs
 */
export const averageCalibrationFrames = (frames: CalibrationFrame[]): CalibrationFrame => {
  const last = frames[frames.length - 1]
  return {
    image: last.image.map(
      (_, index): ImageLandmark => ({
        x: mean(frames.map((frame) => frame.image[index].x)),
        y: mean(frames.map((frame) => frame.image[index].y)),
        visibility: mean(frames.map((frame) => frame.image[index].visibility ?? 1))
      })
    ),
    world: last.world.map(
      (_, index): CameraLandmark => ({
        x: mean(frames.map((frame) => frame.world[index].x)),
        y: mean(frames.map((frame) => frame.world[index].y)),
        z: mean(frames.map((frame) => frame.world[index].z)),
        visibility: mean(frames.map((frame) => frame.world[index].visibility))
      })
    ),
    aspect: last.aspect
  }
}
