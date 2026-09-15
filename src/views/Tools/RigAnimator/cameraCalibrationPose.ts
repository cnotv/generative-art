import {
  CAMERA_LANDMARK_VISIBILITY_THRESHOLD,
  LANDMARK_INDEX,
  type CameraLandmark
} from './cameraPoseMapping'
import type { CalibrationFrame, ImageLandmark } from './types'

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

/**
 * Whether a frame shows the held front T-pose the calibration waits for: both arms level, straight
 * and out to the sides.
 * @param frame The detected frame
 * @param toleranceDegrees How far an arm may tilt off level, or bend at the elbow
 * @returns Whether the pose matches
 */
export const detectCalibrationTPose = (
  frame: CalibrationFrame,
  toleranceDegrees: number
): boolean => {
  const toleranceRadians = degreesToRadians(toleranceDegrees)
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
