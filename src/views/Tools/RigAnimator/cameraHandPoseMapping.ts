import * as THREE from 'three'
import type { HandPoseDefinition, HandSide } from '@webgamekit/rig'
import { clampLandmarkJump } from './cameraPoseMapping'
import { CAMERA_LANDMARK_MAX_JUMP_METERS } from './config'

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
 * Blend a newly detected hand's landmarks into the previous smoothed set for that same side, the
 * same exponential moving average `smoothCameraLandmarks` uses for the body. A hand held up to
 * a webcam moves less steadily than a whole body does relative to its own scale, and a hand's
 * per-joint curl angle is a small difference between two nearby points, so raw per-frame noise
 * here reads as visible twitching in the fingers once mapped, more than the same noise does on
 * a body landmark's own larger-scale movement.
 * @param previous The previous frame's smoothed landmarks for this same hand side, or null for
 *   the first frame this side was seen
 * @param next This frame's freshly detected landmarks
 * @param factor Fraction of `next` blended in; lower reads smoother but laggier
 * @param maxJump The furthest a landmark may move from its previous position in one frame,
 *   after blending; same jump clamp `smoothCameraLandmarks` applies to the body
 * @returns The smoothed landmarks to actually read a finger pose from
 */
export const smoothCameraHandLandmarks = (
  previous: CameraHandLandmark[] | null,
  next: CameraHandLandmark[],
  factor: number,
  maxJump: number = CAMERA_LANDMARK_MAX_JUMP_METERS
): CameraHandLandmark[] =>
  next.map((landmark, index) => {
    const previousLandmark = previous?.[index]
    if (!previousLandmark) return landmark
    const blended = {
      x: previousLandmark.x + (landmark.x - previousLandmark.x) * factor,
      y: previousLandmark.y + (landmark.y - previousLandmark.y) * factor,
      z: previousLandmark.z + (landmark.z - previousLandmark.z) * factor
    }
    return clampLandmarkJump(previousLandmark, blended, maxJump)
  })

/**
 * Resolve MediaPipe's own handedness label to the side it actually belongs to on the rig: no
 * swap, a direct passthrough. An earlier version of this swapped the label, reasoning from
 * MediaPipe's own documented caveat that Hand Landmarker assumes a mirrored ("selfie") input;
 * a real camera session immediately surfaced the opposite arm and hand moving as if they
 * belonged to each other, meaning that reasoning did not hold for this pipeline. The body Pose
 * Landmarker's own left/right needs no swap either (confirmed against a real photo, the
 * landmark it calls the left wrist sits on the subject's actual left side), so the two
 * detectors turn out to agree: pass both straight through.
 * @param categoryName MediaPipe's own "Left"/"Right" handedness label for one detected hand
 * @returns The subject's actual side, or null for an unrecognised label
 */
export const resolveCameraHandSide = (categoryName: string): HandSide | null => {
  if (categoryName === 'Left') return 'Left'
  if (categoryName === 'Right') return 'Right'
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

/**
 * Swap which side each detected hand's pose is keyed under, matching the mirrored reflection
 * `mirrorCameraLandmarks` gives the live camera's body pose: the subject's real right hand ends
 * up driving whichever wrist bone the mirrored body mapping now calls the rig's right, matching
 * the mirrored live preview right next to it. A photo has no mirrored preview to match (a static
 * photo is shown as captured, not as a self-view), so only the live camera path calls this.
 * @param handPoses Poses keyed by each hand's own detected (unmirrored) side
 * @returns The same poses, keyed by the opposite side
 */
export const mirrorCameraHandPoses = (
  handPoses: Partial<Record<HandSide, HandPoseDefinition>>
): Partial<Record<HandSide, HandPoseDefinition>> => ({
  ...(handPoses.Left ? { Right: handPoses.Left } : {}),
  ...(handPoses.Right ? { Left: handPoses.Right } : {})
})
