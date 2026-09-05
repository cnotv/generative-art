import * as THREE from 'three'
import { CAMERA_LANDMARK_SMOOTHING_FACTOR, CAMERA_LANDMARK_MAX_JUMP_METERS } from './config'

/** One BlazePose landmark: metres in world mode, normalized [0,1] in image mode either way. */
export interface CameraLandmark {
  x: number
  y: number
  z: number
  visibility: number
}

/** The minimal shape `clampLandmarkJump` needs: any landmark-like point. */
interface LandmarkPoint {
  x: number
  y: number
  z: number
}

/**
 * Clamp how far `candidate` has moved from `previous`, in straight-line distance, to at most
 * `maxJump`: a single misdetected frame that puts a landmark somewhere far from where it just
 * was reads as a sudden, physically implausible snap rather than motion, and a real fast
 * movement still gets there, just over a couple of extra frames instead of one. Preserves every
 * other field `candidate` carries (a `CameraLandmark`'s `visibility`, say).
 * @param previous Where this landmark was last frame
 * @param candidate Where this frame's (possibly already-blended) landmark wants to move to
 * @param maxJump The furthest `candidate` may move from `previous` in one call, in the same
 *   units as the landmarks themselves (metres, for world landmarks)
 * @returns `candidate` unchanged if within reach, otherwise pulled back to `maxJump` away
 */
export const clampLandmarkJump = <T extends LandmarkPoint>(
  previous: LandmarkPoint,
  candidate: T,
  maxJump: number
): T => {
  const dx = candidate.x - previous.x
  const dy = candidate.y - previous.y
  const dz = candidate.z - previous.z
  const distance = Math.hypot(dx, dy, dz)
  if (maxJump <= 0 || distance <= maxJump) return candidate
  const scale = maxJump / distance
  return {
    ...candidate,
    x: previous.x + dx * scale,
    y: previous.y + dy * scale,
    z: previous.z + dz * scale
  }
}

/**
 * Blend a newly detected frame's landmarks into the previous smoothed set, an exponential
 * moving average per landmark, then clamp how far that blended result may have moved from the
 * previous frame. The raw per-frame detection is noisy enough on its own (most visibly on depth)
 * that applying it straight to the rig reads as jitter rather than motion; blending it against
 * where the landmark just was removes that noise at the cost of a little lag. The blend alone
 * still lets a single wildly misdetected frame through, scaled down by `factor` but still a
 * visible snap; the jump clamp catches that case specifically, on top of the blend. Visibility is
 * taken from the new frame as-is rather than blended, so a landmark that just left or entered
 * frame is not treated as still partway visible for a few extra frames.
 * @param previous The previous frame's smoothed landmarks, or null for the first frame
 * @param next This frame's freshly detected landmarks
 * @param factor Fraction of `next` blended in; lower reads smoother but laggier
 * @param maxJump The furthest a landmark may move from its previous position in one frame,
 *   after blending; a sudden misdetection past this is pulled back rather than applied whole
 * @returns The smoothed landmarks to actually map onto the rig
 */
export const smoothCameraLandmarks = (
  previous: CameraLandmark[] | null,
  next: CameraLandmark[],
  factor: number = CAMERA_LANDMARK_SMOOTHING_FACTOR,
  maxJump: number = CAMERA_LANDMARK_MAX_JUMP_METERS
): CameraLandmark[] =>
  next.map((landmark, index) => {
    const previousLandmark = previous?.[index]
    if (!previousLandmark) return landmark
    const blended = {
      x: previousLandmark.x + (landmark.x - previousLandmark.x) * factor,
      y: previousLandmark.y + (landmark.y - previousLandmark.y) * factor,
      z: previousLandmark.z + (landmark.z - previousLandmark.z) * factor,
      visibility: landmark.visibility
    }
    return clampLandmarkJump(previousLandmark, blended, maxJump)
  })

/**
 * Every one of BlazePose's 33 landmark indices that swaps with another under a left/right
 * mirror; the nose (0) is the only unpaired, on-the-midline point.
 */
const MIRRORED_LANDMARK_PAIRS: readonly (readonly [number, number])[] = [
  [1, 4],
  [2, 5],
  [3, 6],
  [7, 8],
  [9, 10],
  [11, 12],
  [13, 14],
  [15, 16],
  [17, 18],
  [19, 20],
  [21, 22],
  [23, 24],
  [25, 26],
  [27, 28],
  [29, 30],
  [31, 32]
]

/**
 * Mirror a full set of detected landmarks across the vertical axis, the reflection a real mirror
 * gives: negate every point's x, and swap each left/right pair so the array's own "left" slot
 * still holds whichever side now reads as left after the reflection. Applied once, right where
 * MediaPipe's own landmarks are first read, so every downstream reader, the bone mapping below
 * and the camera yaw estimate alike, sees a consistently mirrored pose without needing its own
 * left/right handling changed: without this, a rig facing its own viewing camera the same way the
 * subject faces their webcam moved the subject's real right arm on the screen side an actual
 * mirror would show as the subject's left, the opposite of the mirrored live preview right next
 * to it. The preview itself needs no matching change: it is already mirrored by a CSS transform
 * on the video element, entirely separate from this landmark data.
 * @param landmarks This frame's freshly detected landmarks, in MediaPipe's own point order
 * @returns The same landmarks, reflected across the vertical axis
 */
export const mirrorCameraLandmarks = (landmarks: CameraLandmark[]): CameraLandmark[] => {
  const mirrored = landmarks.map((landmark) => ({ ...landmark, x: -landmark.x }))
  MIRRORED_LANDMARK_PAIRS.forEach(([a, b]) => {
    const landmarkA = mirrored[a]
    const landmarkB = mirrored[b]
    if (landmarkA && landmarkB) {
      mirrored[a] = landmarkB
      mirrored[b] = landmarkA
    }
  })
  return mirrored
}

const LANDMARK_INDEX = {
  nose: 0,
  leftEar: 7,
  rightEar: 8,
  leftShoulder: 11,
  rightShoulder: 12,
  leftElbow: 13,
  rightElbow: 14,
  leftWrist: 15,
  rightWrist: 16,
  leftHip: 23,
  rightHip: 24,
  leftKnee: 25,
  rightKnee: 26,
  leftAnkle: 27,
  rightAnkle: 28
} as const

/**
 * Which landmark drives each mapped upper-body bone: scaled and anchored off the shoulders,
 * see `cameraLandmarksToBoneTargets`. Key order matters and is relied on by callers that apply
 * these targets with `Object.entries`: the head's IK chain root is `mixamorigSpine2`, an
 * ancestor of both arms, so aiming the head rotates the whole upper body its hands hang off.
 * The head has to apply first, or its spine bend drags an already-placed hand out of the
 * position it was just aimed at.
 */
export const CAMERA_POSE_UPPER_BONE_LANDMARKS: Record<string, number> = {
  mixamorigHead: LANDMARK_INDEX.nose,
  mixamorigLeftHand: LANDMARK_INDEX.leftWrist,
  mixamorigRightHand: LANDMARK_INDEX.rightWrist
}

/**
 * Which landmark drives each mapped lower-body bone: scaled and anchored off the hips instead
 * of the shoulders, see `cameraLandmarksToBoneTargets`.
 */
export const CAMERA_POSE_LOWER_BONE_LANDMARKS: Record<string, number> = {
  mixamorigLeftFoot: LANDMARK_INDEX.leftAnkle,
  mixamorigRightFoot: LANDMARK_INDEX.rightAnkle
}

/** Every mapped bone, upper body first: order matters, see `CAMERA_POSE_UPPER_BONE_LANDMARKS`. */
export const CAMERA_POSE_BONE_LANDMARKS: Record<string, number> = {
  ...CAMERA_POSE_UPPER_BONE_LANDMARKS,
  ...CAMERA_POSE_LOWER_BONE_LANDMARKS
}

/** The rig's root bone, optionally driven to the detected hip midpoint. */
export const CAMERA_POSE_HIPS_BONE = 'mixamorigHips'

/** Which landmark bends the elbow's chain toward it, when that detail is turned on. */
export const CAMERA_POSE_ELBOW_POLE_LANDMARKS: Record<string, number> = {
  mixamorigLeftHand: LANDMARK_INDEX.leftElbow,
  mixamorigRightHand: LANDMARK_INDEX.rightElbow
}

/** Which landmark bends the knee's chain toward it, when that detail is turned on. */
export const CAMERA_POSE_KNEE_POLE_LANDMARKS: Record<string, number> = {
  mixamorigLeftFoot: LANDMARK_INDEX.leftKnee,
  mixamorigRightFoot: LANDMARK_INDEX.rightKnee
}

/** Every bone name camera pose capture needs on the rig, the mapped bones plus the anchor bones. */
export const CAMERA_POSE_REQUIRED_BONES = [
  'mixamorigLeftArm',
  'mixamorigRightArm',
  ...Object.keys(CAMERA_POSE_BONE_LANDMARKS)
]

/**
 * Which extra details a captured pose drives, all opt-in on top of the base head/hands/feet
 * mapping: a bone with no pole hint keeps whichever bend direction its rest pose had, and the
 * rig's root stays at rest unless hips are turned on. Depth defaults on since it is the base
 * mapping's existing behaviour; the other three default off since they are new to try.
 */
export interface CameraPoseMappingOptions {
  /** Bend the elbow chains toward the detected elbow, instead of the chain's rest bend. */
  includeElbows: boolean
  /** Bend the knee chains toward the detected knee, instead of the chain's rest bend. */
  includeKnees: boolean
  /**
   * Bend the head chain's neck joint toward the detected ear midpoint, instead of the chain's
   * rest bend. MediaPipe has no landmark for the neck itself the way it does for an elbow or
   * knee, so the ear midpoint stands in as the closest available proxy for which way the head
   * should lean; without a hint here the neck bends however the two-bone solve happens to pick,
   * which read as the head tending to point down with the neck folded implausibly.
   */
  includeNeck: boolean
  /** Move the rig's root to the detected hip midpoint, instead of leaving it at rest. */
  includeHips: boolean
  /**
   * Use the landmark's depth (z) at all. A single photo gives MediaPipe far less to estimate
   * depth from than two eyes or a video's motion do, making z the least reliable axis it
   * reports; turning this off flattens every target onto the shoulder anchor's own depth plane.
   */
  includeDepth: boolean
  /**
   * Scale every mapped target's distance from its anchor by this factor before applying it, on
   * top of the rig's own proportions. 1 leaves the computed scale as-is; above 1 reaches further
   * than the computed scale predicts, below 1 reaches less far. A rig whose own proportions
   * differ from a real body's in ways neither the shoulder nor the hip anchor accounts for (a
   * stylized head-and-neck length relative to shoulder width, say) can still systematically
   * under- or over-reach even with the right bone anchored to the right landmark; this is the
   * escape hatch for tuning that by eye rather than by a fixed formula.
   */
  reachMultiplier: number
}

export const CAMERA_POSE_MAPPING_OPTIONS_DEFAULT: CameraPoseMappingOptions = {
  includeElbows: false,
  includeKnees: false,
  includeNeck: false,
  includeHips: false,
  includeDepth: true,
  reachMultiplier: 1
}

export interface CameraPoseTargets {
  /** World-space targets for `applyBoneDragTarget`, keyed by bone name. */
  boneTargets: Record<string, THREE.Vector3>
  /** World-space bend hints for `applyPoleDrag`, keyed by the chain's end bone name. */
  poleTargets: Record<string, THREE.Vector3>
}

/** A landmark below this visibility is treated as not detected, leaving its bone untouched. */
export const CAMERA_LANDMARK_VISIBILITY_THRESHOLD = 0.5

/** Below this landmark-space shoulder span, the detected pose is too degenerate to scale from. */
const MINIMUM_LANDMARK_SHOULDER_SPAN = 1e-6

/**
 * The rig's own shoulder center and width, plus its hip center and width when it has hip bones
 * to measure, so detected landmarks scale and anchor to this specific rig rather than a fixed
 * size. Upper-body targets (head, hands) anchor to the shoulders: a webcam framed for arms and
 * head, the normal way to use this feature, usually leaves the hips out of frame, where
 * MediaPipe still reports a low-confidence guessed position for them rather than nothing.
 * Lower-body targets (feet, knees) anchor to the hips instead, and scale off hip width rather
 * than reusing the shoulder scale: a rig's leg length does not reliably track its shoulder
 * width the way a real human's roughly does, confirmed against a stylized character whose own
 * legs measured four times its shoulder width rest to rest, well past a real body's ratio, so
 * scaling detected ankle reach off the shoulders left the target barely a third of the leg's
 * own length, forcing the knee to fold into an unnatural crouch to take up the slack.
 */
export interface CameraRigAnchor {
  shoulderCenterWorldPosition: THREE.Vector3
  shoulderWidthWorld: number
  /** Null when the rig has no hip bones to measure; legs then fall back to the shoulder scale. */
  hipCenterWorldPosition: THREE.Vector3 | null
  hipWidthWorld: number | null
}

/**
 * Estimate how far the subject is turned from square-to-camera, from the shoulder line's own
 * rotation in the horizontal plane. Facing the camera straight on, both shoulders sit at the
 * same depth, so the shoulder-to-shoulder vector points straight along x with no z component;
 * turning the body moves one shoulder closer to the camera than the other, tilting that vector
 * by exactly the angle turned. This is the one camera-relative angle a single photo's body
 * landmarks can actually support: not a full camera pose (MediaPipe's world landmarks are
 * already normalized to a real-world body scale, so they carry no cue at all about how far away
 * or how zoomed in the original camera was), just which way the subject is facing.
 * @param landmarks The detected person's world landmarks
 * @returns The estimated yaw in radians, matching `frameCameraOnModel`'s own convention (0 is
 *   square-on), or null when the shoulders aren't both confidently detected
 */
export const estimateCameraYaw = (landmarks: CameraLandmark[]): number | null => {
  const leftShoulder = landmarks[LANDMARK_INDEX.leftShoulder]
  const rightShoulder = landmarks[LANDMARK_INDEX.rightShoulder]
  if (
    !leftShoulder ||
    !rightShoulder ||
    leftShoulder.visibility < CAMERA_LANDMARK_VISIBILITY_THRESHOLD ||
    rightShoulder.visibility < CAMERA_LANDMARK_VISIBILITY_THRESHOLD
  ) {
    return null
  }
  // MediaPipe's own landmark space puts the left shoulder at a larger x than the right (x
  // grows toward the subject's own left), so the square-on reference vector points along
  // negative x; negating it here is what makes 0 mean square-on instead of a half turn.
  const dx = -(rightShoulder.x - leftShoulder.x)
  // Scene z grows toward the viewer where landmark z grows away from it, the same flip
  // `cameraLandmarksToBoneTargets` applies to every mapped position.
  const dz = -(rightShoulder.z - leftShoulder.z)
  return Math.atan2(dz, dx)
}

/**
 * Read the rig's own shoulder center and shoulder width from its current bone transforms, so
 * detected landmarks can be scaled and anchored to this specific rig instead of a fixed size.
 * Reads the `Arm` bones rather than `Shoulder`: on a mixamorig-named rig `Shoulder` is the
 * clavicle, close to the spine, not the outer joint a real shoulder-width measurement means.
 * Scaling off that distance understates the rig's real width several times over, collapsing
 * every mapped bone in toward the center, confirmed against a real detected pose where the
 * clavicle-to-clavicle span was a sixth of the rig's own T-pose arm span. `Arm` is the bone
 * where the visible arm actually begins, matching what MediaPipe's shoulder landmark measures.
 * @param bones The rig's bones
 * @returns The anchor, or null when the rig is missing a bone camera pose capture needs
 */
export const computeCameraRigAnchor = (bones: THREE.Bone[]): CameraRigAnchor | null => {
  const leftArm = bones.find((bone) => bone.name === 'mixamorigLeftArm')
  const rightArm = bones.find((bone) => bone.name === 'mixamorigRightArm')
  if (!leftArm || !rightArm) return null

  const leftWorldPosition = leftArm.getWorldPosition(new THREE.Vector3())
  const rightWorldPosition = rightArm.getWorldPosition(new THREE.Vector3())

  const leftUpLeg = bones.find((bone) => bone.name === 'mixamorigLeftUpLeg')
  const rightUpLeg = bones.find((bone) => bone.name === 'mixamorigRightUpLeg')
  const leftHipWorldPosition = leftUpLeg?.getWorldPosition(new THREE.Vector3()) ?? null
  const rightHipWorldPosition = rightUpLeg?.getWorldPosition(new THREE.Vector3()) ?? null
  const hasHipAnchor = leftHipWorldPosition !== null && rightHipWorldPosition !== null

  return {
    shoulderCenterWorldPosition: leftWorldPosition
      .clone()
      .add(rightWorldPosition)
      .multiplyScalar(0.5),
    shoulderWidthWorld: leftWorldPosition.distanceTo(rightWorldPosition),
    hipCenterWorldPosition: hasHipAnchor
      ? leftHipWorldPosition.clone().add(rightHipWorldPosition).multiplyScalar(0.5)
      : null,
    hipWidthWorld: hasHipAnchor ? leftHipWorldPosition.distanceTo(rightHipWorldPosition) : null
  }
}

const landmarkMidpoint = (a: CameraLandmark, b: CameraLandmark): CameraLandmark => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2,
  z: (a.z + b.z) / 2,
  visibility: Math.min(a.visibility, b.visibility)
})

const landmarkDistance = (a: CameraLandmark, b: CameraLandmark): number =>
  Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)

interface LegAnchor {
  legCenter: CameraLandmark
  legScale: number
  legAnchorWorldPosition: THREE.Vector3
}

/**
 * Work out what to scale and anchor leg-related targets (feet, knees, hips) against: the rig's
 * own hip center and hip-width scale when both the rig and the detected landmarks have one, or
 * the shoulder anchor and scale as a fallback otherwise. A webcam framed for arms and head, the
 * normal way to use this feature, usually leaves the hips out of frame, so the fallback is the
 * common case, not an edge case.
 * @param landmarks The detected person's world landmarks
 * @param anchor The rig's own anchor, from `computeCameraRigAnchor`
 * @param shoulderCenter The already-validated shoulder landmark midpoint, the fallback center
 * @param shoulderScale The already-computed shoulder-based scale, the fallback scale
 * @returns Where and how large to map a leg-related landmark
 */
const computeLegAnchor = (
  landmarks: CameraLandmark[],
  anchor: CameraRigAnchor,
  shoulderCenter: CameraLandmark,
  shoulderScale: number
): LegAnchor => {
  const leftHip = landmarks[LANDMARK_INDEX.leftHip]
  const rightHip = landmarks[LANDMARK_INDEX.rightHip]
  const hipLandmarksVisible =
    leftHip !== undefined &&
    rightHip !== undefined &&
    leftHip.visibility >= CAMERA_LANDMARK_VISIBILITY_THRESHOLD &&
    rightHip.visibility >= CAMERA_LANDMARK_VISIBILITY_THRESHOLD
  const hipWidthLandmark = hipLandmarksVisible ? landmarkDistance(leftHip, rightHip) : 0
  const hasLegAnchor =
    hipLandmarksVisible &&
    anchor.hipCenterWorldPosition !== null &&
    anchor.hipWidthWorld !== null &&
    hipWidthLandmark >= MINIMUM_LANDMARK_SHOULDER_SPAN

  if (!hasLegAnchor) {
    return {
      legCenter: shoulderCenter,
      legScale: shoulderScale,
      legAnchorWorldPosition: anchor.shoulderCenterWorldPosition
    }
  }
  return {
    legCenter: landmarkMidpoint(leftHip, rightHip),
    legScale: anchor.hipWidthWorld! / hipWidthLandmark,
    legAnchorWorldPosition: anchor.hipCenterWorldPosition!
  }
}

/**
 * Map a detected person's world landmarks onto world-space targets for the rig's mapped bones,
 * scaled and anchored to this rig's own proportions rather than a fixed world size. A landmark
 * below the visibility threshold, or a missing/unreliable shoulder landmark needed to anchor
 * the rest, leaves the bones it would have driven untouched, the same partial-pose behaviour
 * `poseApply` already has.
 * @param landmarks The 33 BlazePose world landmarks for one detected person
 * @param anchor The rig's own shoulder center and shoulder width, from `computeCameraRigAnchor`
 * @param options Which extra details (elbow/knee bend, hips, depth) to derive from this frame
 * @returns Bone targets for `applyBoneDragTarget` and pole targets for `applyPoleDrag`
 */
export const cameraLandmarksToBoneTargets = (
  landmarks: CameraLandmark[],
  anchor: CameraRigAnchor,
  options: CameraPoseMappingOptions = CAMERA_POSE_MAPPING_OPTIONS_DEFAULT
): CameraPoseTargets => {
  const leftShoulder = landmarks[LANDMARK_INDEX.leftShoulder]
  const rightShoulder = landmarks[LANDMARK_INDEX.rightShoulder]
  if (
    !leftShoulder ||
    !rightShoulder ||
    leftShoulder.visibility < CAMERA_LANDMARK_VISIBILITY_THRESHOLD ||
    rightShoulder.visibility < CAMERA_LANDMARK_VISIBILITY_THRESHOLD
  ) {
    return { boneTargets: {}, poleTargets: {} }
  }

  const shoulderCenter = landmarkMidpoint(leftShoulder, rightShoulder)
  const shoulderWidthLandmark = landmarkDistance(leftShoulder, rightShoulder)
  if (shoulderWidthLandmark < MINIMUM_LANDMARK_SHOULDER_SPAN)
    return { boneTargets: {}, poleTargets: {} }
  const rawScale = anchor.shoulderWidthWorld / shoulderWidthLandmark
  const {
    legCenter,
    legScale: rawLegScale,
    legAnchorWorldPosition
  } = computeLegAnchor(landmarks, anchor, shoulderCenter, rawScale)
  const scale = rawScale * options.reachMultiplier
  const legScale = rawLegScale * options.reachMultiplier

  // Landmark y grows downward and z grows away from the camera (MediaPipe's image-space
  // convention extended to 3D); the scene's y grows upward and, since the rig faces the scene
  // camera the same way the person faces their webcam, its z grows toward the viewer. Both flip.
  // `includeDepth: false` drops the z term entirely instead, projecting onto the anchor's plane.
  const targetRelativeTo = (
    anchorWorldPosition: THREE.Vector3,
    center: CameraLandmark,
    landmarkScale: number,
    landmark: CameraLandmark
  ): THREE.Vector3 =>
    anchorWorldPosition
      .clone()
      .add(
        new THREE.Vector3(
          (landmark.x - center.x) * landmarkScale,
          -(landmark.y - center.y) * landmarkScale,
          options.includeDepth ? -(landmark.z - center.z) * landmarkScale : 0
        )
      )

  const boneTarget = (landmark: CameraLandmark): THREE.Vector3 =>
    targetRelativeTo(anchor.shoulderCenterWorldPosition, shoulderCenter, scale, landmark)
  const legTarget = (landmark: CameraLandmark): THREE.Vector3 =>
    targetRelativeTo(legAnchorWorldPosition, legCenter, legScale, landmark)

  const entriesFor = (
    landmarksByBone: Record<string, number>,
    targetFunction: (landmark: CameraLandmark) => THREE.Vector3
  ): Record<string, THREE.Vector3> =>
    Object.fromEntries(
      Object.entries(landmarksByBone)
        .map(([boneName, landmarkIndex]): [string, THREE.Vector3 | null] => {
          const landmark = landmarks[landmarkIndex]
          if (!landmark || landmark.visibility < CAMERA_LANDMARK_VISIBILITY_THRESHOLD) {
            return [boneName, null]
          }
          return [boneName, targetFunction(landmark)]
        })
        .filter((entry): entry is [string, THREE.Vector3] => entry[1] !== null)
    )

  const hipsTarget = (): Record<string, THREE.Vector3> => {
    if (!options.includeHips) return {}
    const leftHip = landmarks[LANDMARK_INDEX.leftHip]
    const rightHip = landmarks[LANDMARK_INDEX.rightHip]
    if (
      !leftHip ||
      !rightHip ||
      leftHip.visibility < CAMERA_LANDMARK_VISIBILITY_THRESHOLD ||
      rightHip.visibility < CAMERA_LANDMARK_VISIBILITY_THRESHOLD
    ) {
      return {}
    }
    return { [CAMERA_POSE_HIPS_BONE]: legTarget(landmarkMidpoint(leftHip, rightHip)) }
  }

  const neckPoleTarget = (): Record<string, THREE.Vector3> => {
    if (!options.includeNeck) return {}
    const leftEar = landmarks[LANDMARK_INDEX.leftEar]
    const rightEar = landmarks[LANDMARK_INDEX.rightEar]
    if (
      !leftEar ||
      !rightEar ||
      leftEar.visibility < CAMERA_LANDMARK_VISIBILITY_THRESHOLD ||
      rightEar.visibility < CAMERA_LANDMARK_VISIBILITY_THRESHOLD
    ) {
      return {}
    }
    return { mixamorigHead: boneTarget(landmarkMidpoint(leftEar, rightEar)) }
  }

  return {
    boneTargets: {
      ...entriesFor(CAMERA_POSE_UPPER_BONE_LANDMARKS, boneTarget),
      ...entriesFor(CAMERA_POSE_LOWER_BONE_LANDMARKS, legTarget),
      ...hipsTarget()
    },
    poleTargets: {
      ...(options.includeElbows ? entriesFor(CAMERA_POSE_ELBOW_POLE_LANDMARKS, boneTarget) : {}),
      ...(options.includeKnees ? entriesFor(CAMERA_POSE_KNEE_POLE_LANDMARKS, legTarget) : {}),
      ...neckPoleTarget()
    }
  }
}
