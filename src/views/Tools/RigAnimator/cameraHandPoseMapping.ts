import * as THREE from 'three'
import type { HandPoseDefinition, HandSide } from '@webgamekit/rig'

/**
 * One hand landmark from MediaPipe's Hand Landmarker. Unlike a body pose landmark, a hand
 * landmark carries no per-point visibility score; the model reports one confidence per detected
 * hand instead, already used to decide whether a hand was found at all.
 */
export interface CameraHandLandmark {
  x: number
  y: number
  z: number
}

/**
 * Each finger's landmark indices in MediaPipe's 21-point hand topology, wrist first: the point
 * `applyHandPose`'s three joints (from the palm outward) are measured between.
 */
const FINGER_LANDMARK_INDEX = {
  thumb: [0, 1, 2, 3, 4],
  index: [0, 5, 6, 7, 8],
  middle: [0, 9, 10, 11, 12],
  ring: [0, 13, 14, 15, 16],
  pinky: [0, 17, 18, 19, 20]
} as const

const toVector3 = (landmark: CameraHandLandmark): THREE.Vector3 =>
  new THREE.Vector3(landmark.x, landmark.y, landmark.z)

/**
 * The bend at one joint: 0 when the segment into it and the segment out of it continue in the
 * same direction (the joint is straight), growing as the joint curls. Matches the sign and
 * rough scale `HAND_POSE_PRESETS` already uses for the same bones (a relaxed fist sits around
 * 1.0-1.2 radians), so a detected hand can drive `applyHandPose` exactly like a canned preset.
 * @param before The landmark before the joint
 * @param joint The joint itself
 * @param after The landmark after the joint
 * @returns The bend angle in radians
 */
const jointBendAngle = (
  before: CameraHandLandmark,
  joint: CameraHandLandmark,
  after: CameraHandLandmark
): number => {
  const into = toVector3(joint).sub(toVector3(before))
  const outOf = toVector3(after).sub(toVector3(joint))
  return into.angleTo(outOf)
}

/**
 * Read one detected hand's 21 landmarks into the same per-joint curl angles a hand pose preset
 * carries.
 * @param landmarks The 21 landmarks for one detected hand, in MediaPipe's own point order
 * @returns The per-finger joint curl angles, ready for `applyHandPose`
 */
export const cameraHandLandmarksToPose = (landmarks: CameraHandLandmark[]): HandPoseDefinition => {
  const fingerAngles = (indices: readonly number[]): [number, number, number] => {
    const [a, b, c, d, e] = indices.map((index) => landmarks[index])
    return [jointBendAngle(a, b, c), jointBendAngle(b, c, d), jointBendAngle(c, d, e)]
  }

  return {
    thumb: fingerAngles(FINGER_LANDMARK_INDEX.thumb),
    index: fingerAngles(FINGER_LANDMARK_INDEX.index),
    middle: fingerAngles(FINGER_LANDMARK_INDEX.middle),
    ring: fingerAngles(FINGER_LANDMARK_INDEX.ring),
    pinky: fingerAngles(FINGER_LANDMARK_INDEX.pinky)
  }
}

/**
 * Resolve MediaPipe's own handedness label to the side it actually belongs to on the rig.
 * MediaPipe's Hand Landmarker documents its handedness as assuming a mirrored ("selfie") input
 * image; this tool feeds the raw, unmirrored camera frame to the detector (the mirroring the
 * live preview shows is a CSS transform on the canvas only, never applied to the frame the
 * model actually reads), so its label comes out reversed from the subject's real side. The body
 * Pose Landmarker needs no such swap: unlike a hand considered in isolation, its landmark
 * topology already encodes the subject's own left/right from the whole body's shape, confirmed
 * against a real photo where the landmark it calls the left wrist sits on the subject's actual
 * left side with no correction needed.
 * @param categoryName MediaPipe's own "Left"/"Right" handedness label for one detected hand
 * @returns The subject's actual side, or null for an unrecognised label
 */
export const resolveCameraHandSide = (categoryName: string): HandSide | null => {
  if (categoryName === 'Left') return 'Right'
  if (categoryName === 'Right') return 'Left'
  return null
}

/** One detected hand's world landmarks plus MediaPipe's own handedness label for it. */
export interface CameraDetectedHand {
  worldLandmarks: CameraHandLandmark[]
  categoryName: string
}

/**
 * Map every hand MediaPipe found in one frame or photo onto per-side finger poses, resolving
 * each hand's actual side and reading its curl angles in one pass.
 * @param detectedHands Every hand MediaPipe reported for this detection
 * @returns The detected pose for whichever side(s) were found, keyed by side
 */
export const cameraDetectedHandsToPoses = (
  detectedHands: CameraDetectedHand[]
): Partial<Record<HandSide, HandPoseDefinition>> =>
  Object.fromEntries(
    detectedHands
      .map((hand): [HandSide | null, HandPoseDefinition] => [
        resolveCameraHandSide(hand.categoryName),
        cameraHandLandmarksToPose(hand.worldLandmarks)
      ])
      .filter((entry): entry is [HandSide, HandPoseDefinition] => entry[0] !== null)
  )
