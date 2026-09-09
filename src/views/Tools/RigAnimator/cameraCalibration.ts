import * as THREE from 'three'
import type { HandSide } from '@webgamekit/rig'
import { ikFindTwoBoneChain } from '@webgamekit/rig'
import {
  CAMERA_LANDMARK_VISIBILITY_THRESHOLD,
  estimateCameraYaw,
  computeCameraRigAnchor,
  type CameraLandmark,
  type CameraRigAnchor
} from './cameraPoseMapping'
import type { CameraHandLandmark } from './cameraHandPoseMapping'
import type { RigGroupRootBoneNames } from './bodyPartGroups'

/** Which step of the calibration flow is active, or `null` while it isn't running. */
export type CameraCalibrationStep = 'assignParts' | 'front' | 'side' | null

/** A landmark carrying only what body-center tracking needs: MediaPipe's raw (unmirrored)
 * image-space output, the same shape `previewLandmarks` already exposes. */
export interface ImageLandmark {
  x: number
  y: number
  visibility?: number
}

/** Everything a calibration session has captured so far. Every field starts empty; each one is
 * usable as soon as its own step captures it, independent of whether the others have run. */
export interface CameraCalibrationBaseline {
  /** Shoulder-line yaw at the calibrated neutral stance, radians; live yaw reads relative to
   * this instead of true zero, so "facing the camera" while calibrated needn't mean square-on. */
  originYaw: number | null
  /** Wrist-to-middle-knuckle angle per hand at the calibrated neutral stance, radians. */
  handRotationOrigin: Partial<Record<HandSide, number>>
  /** Body center in MediaPipe's raw image space (0..1) at the calibrated neutral stance; a
   * later frame's drift from this is what drives the hip bone's world position. */
  originBodyCenterImage: { x: number; y: number } | null
  /** Reach multiplier derived from the side-view stretch capture, see `captureSideCalibration`. */
  autoReachMultiplier: number | null
  rootBoneNames: RigGroupRootBoneNames
}

export const createEmptyCalibrationBaseline = (): CameraCalibrationBaseline => ({
  originYaw: null,
  handRotationOrigin: {},
  originBodyCenterImage: null,
  autoReachMultiplier: null,
  rootBoneNames: {}
})

const isVisible = (landmark: CameraLandmark | undefined): landmark is CameraLandmark =>
  landmark !== undefined && landmark.visibility >= CAMERA_LANDMARK_VISIBILITY_THRESHOLD

const LEFT_SHOULDER = 11
const RIGHT_SHOULDER = 12
const LEFT_WRIST = 15
const RIGHT_WRIST = 16

/**
 * The wrist-to-middle-knuckle angle in the landmark's own screen plane (x/y), the same way a
 * clock hand's angle is read: 0 along +x, growing counterclockwise. Depth (z) is left out since
 * a wrist's own twist around its forearm is not something MediaPipe's hand landmarks resolve
 * reliably along that axis.
 * @param landmarks One detected hand's 21 landmarks, wrist first
 * @returns The angle in radians
 */
export const computeHandRotationAngle = (landmarks: CameraHandLandmark[]): number => {
  const wrist = landmarks[0]
  const middleKnuckle = landmarks[9]
  return Math.atan2(middleKnuckle.y - wrist.y, middleKnuckle.x - wrist.x)
}

/**
 * The body's center in raw image space, from the shoulder midpoint: stable across most poses
 * and already required for the rest of camera pose capture to work at all.
 * @param landmarks MediaPipe's raw (unmirrored) image-space landmarks for one frame
 * @returns The center, or null when the shoulders aren't both confidently detected
 */
export const computeBodyCenterImage = (
  landmarks: ImageLandmark[] | null
): { x: number; y: number } | null => {
  const left = landmarks?.[LEFT_SHOULDER]
  const right = landmarks?.[RIGHT_SHOULDER]
  if (!left || !right) return null
  if ((left.visibility ?? 1) < CAMERA_LANDMARK_VISIBILITY_THRESHOLD) return null
  if ((right.visibility ?? 1) < CAMERA_LANDMARK_VISIBILITY_THRESHOLD) return null
  return { x: (left.x + right.x) / 2, y: (left.y + right.y) / 2 }
}

/** What the front-facing calibration step reads off one settled frame. `handRotations` and
 * `bodyCenterImage` are already computed per frame upstream (`useVideoLandmarkDetection`'s
 * `handRotations`, and `computeBodyCenterImage` applied to `previewLandmarks`), so this just
 * adopts them as the origin rather than recomputing anything from raw landmarks. */
export const captureFrontCalibration = (
  landmarks: CameraLandmark[],
  bodyCenterImage: { x: number; y: number } | null,
  handRotations: Partial<Record<HandSide, number>>
): Pick<
  CameraCalibrationBaseline,
  'originYaw' | 'handRotationOrigin' | 'originBodyCenterImage'
> => ({
  originYaw: estimateCameraYaw(landmarks),
  handRotationOrigin: { ...handRotations },
  originBodyCenterImage: bodyCenterImage
})

/** The straight-line reach of a two-bone limb chain at its current (assumed near-rest) pose:
 * the sum of each segment's own bind-pose length, unaffected by how the chain is currently
 * rotated. `position` is a bone's local offset from its parent, so its length is that segment's
 * length regardless of pose.
 * ponytail: assumes the chain hasn't had its local `position` hand-edited away from bind pose
 * (Bone Position panel field) before calibrating; a chain that has reports a stale length. */
const chainReachMeters = (endBone: THREE.Bone): number | null => {
  const chain = ikFindTwoBoneChain(endBone)
  if (!chain) return null
  return chain.mid.position.length() + chain.end.position.length()
}

/**
 * Reach calibration: measure how far this side's wrist actually is from the shoulder line right
 * now (meant to be captured with the arm stretched to its fullest, turned to the side so depth
 * reads as the camera's more reliable x/y instead of its noisy z), then compare that to the
 * rig's own arm chain's straight-line reach to derive a reach multiplier that lets a real full
 * stretch drive the rig to its own full stretch, the same knob `cameraReachMultiplier` already
 * exposes as a manual slider, set from a measurement instead of by eye.
 * @param landmarks The detected person's world landmarks, arm extended
 * @param bones The rig's current bones
 * @returns The measured side and multiplier, or null when neither side is confidently detected
 *   or the rig has no matching arm chain
 */
export const captureSideCalibration = (
  landmarks: CameraLandmark[],
  bones: THREE.Bone[]
): { side: HandSide; autoReachMultiplier: number } | null => {
  const anchor = computeCameraRigAnchor(bones)
  if (!anchor) return null

  const candidates: { side: HandSide; shoulder: CameraLandmark; wrist: CameraLandmark }[] = [
    { side: 'Left', shoulder: landmarks[LEFT_SHOULDER], wrist: landmarks[LEFT_WRIST] },
    { side: 'Right', shoulder: landmarks[RIGHT_SHOULDER], wrist: landmarks[RIGHT_WRIST] }
  ].filter(
    (candidate): candidate is { side: HandSide; shoulder: CameraLandmark; wrist: CameraLandmark } =>
      isVisible(candidate.shoulder) && isVisible(candidate.wrist)
  )
  if (candidates.length === 0) return null

  const reachOf = (candidate: (typeof candidates)[number]): number =>
    Math.hypot(
      candidate.wrist.x - candidate.shoulder.x,
      candidate.wrist.y - candidate.shoulder.y,
      candidate.wrist.z - candidate.shoulder.z
    )
  const best = candidates.reduce((a, b) => (reachOf(a) > reachOf(b) ? a : b))

  const shoulderSpanLandmark = Math.hypot(
    landmarks[LEFT_SHOULDER].x - landmarks[RIGHT_SHOULDER].x,
    landmarks[LEFT_SHOULDER].y - landmarks[RIGHT_SHOULDER].y,
    landmarks[LEFT_SHOULDER].z - landmarks[RIGHT_SHOULDER].z
  )
  if (shoulderSpanLandmark <= 0) return null
  const scale = anchor.shoulderWidthWorld / shoulderSpanLandmark
  const mappedReachAtMultiplier1 = reachOf(best) * scale

  const handBoneName = best.side === 'Left' ? 'mixamorigLeftHand' : 'mixamorigRightHand'
  const handBone = bones.find((bone) => bone.name === handBoneName)
  const rigReach = handBone ? chainReachMeters(handBone) : null
  if (!rigReach || mappedReachAtMultiplier1 <= 0) return null

  return { side: best.side, autoReachMultiplier: rigReach / mappedReachAtMultiplier1 }
}

/**
 * How far the calibrated origin's body center has drifted, converted from raw image-space units
 * into the rig's own world units via the current frame's shoulder-width scale. Screen-plane only
 * (x/y): a step toward or away from the camera changes the very scale used to convert the other
 * two axes, so depth drift is left at zero rather than reported wrong.
 * ponytail: a real step-forward still reads as zero-depth movement; add a z term once the reach
 * calibration above needs to share its depth-from-stretch signal with this axis too.
 * @param currentBodyCenterImage This frame's body center, from `computeBodyCenterImage`
 * @param baseline The calibrated origin to measure drift from
 * @param landmarks This frame's world landmarks, for the current shoulder-width scale
 * @param anchor The rig's own shoulder anchor, from `computeCameraRigAnchor`
 * @returns The world-space offset to add to the hips bone's rest position, or null when there is
 *   nothing to offset from (uncalibrated, or the shoulders aren't detected this frame)
 */
export const computeBodyOffsetWorld = (
  currentBodyCenterImage: { x: number; y: number } | null,
  baseline: CameraCalibrationBaseline,
  landmarks: CameraLandmark[],
  anchor: CameraRigAnchor
): THREE.Vector3 | null => {
  if (!currentBodyCenterImage || !baseline.originBodyCenterImage) return null
  const leftShoulder = landmarks[LEFT_SHOULDER]
  const rightShoulder = landmarks[RIGHT_SHOULDER]
  if (!isVisible(leftShoulder) || !isVisible(rightShoulder)) return null
  const shoulderSpanLandmark = Math.hypot(
    leftShoulder.x - rightShoulder.x,
    leftShoulder.y - rightShoulder.y
  )
  if (shoulderSpanLandmark <= 0) return null
  const scale = anchor.shoulderWidthWorld / shoulderSpanLandmark
  const dx = currentBodyCenterImage.x - baseline.originBodyCenterImage.x
  const dy = currentBodyCenterImage.y - baseline.originBodyCenterImage.y
  // Image space grows right/down; scene space grows right/up, matching the same y flip
  // `cameraLandmarksToBoneTargets` applies to every other mapped position.
  return new THREE.Vector3(dx * scale, -dy * scale, 0)
}

/**
 * How far a hand has rotated since calibration, in the same angle `computeHandRotationAngle`
 * reads live. Zero when this side was never calibrated, so an uncalibrated hand's rotation is
 * simply never applied rather than snapping to an arbitrary angle.
 */
export const computeHandRotationDelta = (
  currentAngle: number,
  side: HandSide,
  baseline: CameraCalibrationBaseline
): number => {
  const origin = baseline.handRotationOrigin[side]
  return origin === undefined ? 0 : currentAngle - origin
}
