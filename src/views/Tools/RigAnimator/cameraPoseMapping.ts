import * as THREE from 'three'
import { CAMERA_LANDMARK_SMOOTHING_FACTOR } from './config'

/** One BlazePose landmark: metres in world mode, normalized [0,1] in image mode either way. */
export interface CameraLandmark {
  x: number
  y: number
  z: number
  visibility: number
}

/**
 * Blend a newly detected frame's landmarks into the previous smoothed set, an exponential
 * moving average per landmark. The raw per-frame detection is noisy enough on its own (most
 * visibly on depth) that applying it straight to the rig reads as jitter rather than motion;
 * blending it against where the landmark just was removes that noise at the cost of a little
 * lag. Visibility is taken from the new frame as-is rather than blended, so a landmark that just
 * left or entered frame is not treated as still partway visible for a few extra frames.
 * @param previous The previous frame's smoothed landmarks, or null for the first frame
 * @param next This frame's freshly detected landmarks
 * @param factor Fraction of `next` blended in; lower reads smoother but laggier
 * @returns The smoothed landmarks to actually map onto the rig
 */
export const smoothCameraLandmarks = (
  previous: CameraLandmark[] | null,
  next: CameraLandmark[],
  factor: number = CAMERA_LANDMARK_SMOOTHING_FACTOR
): CameraLandmark[] =>
  next.map((landmark, index) => {
    const previousLandmark = previous?.[index]
    if (!previousLandmark) return landmark
    return {
      x: previousLandmark.x + (landmark.x - previousLandmark.x) * factor,
      y: previousLandmark.y + (landmark.y - previousLandmark.y) * factor,
      z: previousLandmark.z + (landmark.z - previousLandmark.z) * factor,
      visibility: landmark.visibility
    }
  })

const LANDMARK_INDEX = {
  nose: 0,
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
 * Which landmark drives each mapped bone, matching `HUMANOID_BONE_HIERARCHY`'s naming. Key
 * order matters and is relied on by callers that apply these targets with `Object.entries`:
 * the head's IK chain root is `mixamorigSpine2`, an ancestor of both arms, so aiming the head
 * rotates the whole upper body its hands hang off. The head has to apply first, or its spine
 * bend drags an already-placed hand out of the position it was just aimed at.
 */
export const CAMERA_POSE_BONE_LANDMARKS: Record<string, number> = {
  mixamorigHead: LANDMARK_INDEX.nose,
  mixamorigLeftHand: LANDMARK_INDEX.leftWrist,
  mixamorigRightHand: LANDMARK_INDEX.rightWrist,
  mixamorigLeftFoot: LANDMARK_INDEX.leftAnkle,
  mixamorigRightFoot: LANDMARK_INDEX.rightAnkle
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
  /** Move the rig's root to the detected hip midpoint, instead of leaving it at rest. */
  includeHips: boolean
  /**
   * Use the landmark's depth (z) at all. A single photo gives MediaPipe far less to estimate
   * depth from than two eyes or a video's motion do, making z the least reliable axis it
   * reports; turning this off flattens every target onto the shoulder anchor's own depth plane.
   */
  includeDepth: boolean
}

export const CAMERA_POSE_MAPPING_OPTIONS_DEFAULT: CameraPoseMappingOptions = {
  includeElbows: false,
  includeKnees: false,
  includeHips: false,
  includeDepth: true
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
 * The rig's own shoulder center and shoulder width, so detected landmarks scale and anchor to
 * this specific rig. Anchored to the shoulders rather than the hips: a webcam framed for arms
 * and head, the normal way to use this feature, usually leaves the hips out of frame, where
 * MediaPipe still reports a low-confidence guessed position for them rather than nothing.
 */
export interface CameraRigAnchor {
  shoulderCenterWorldPosition: THREE.Vector3
  shoulderWidthWorld: number
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
  return {
    shoulderCenterWorldPosition: leftWorldPosition
      .clone()
      .add(rightWorldPosition)
      .multiplyScalar(0.5),
    shoulderWidthWorld: leftWorldPosition.distanceTo(rightWorldPosition)
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
  const scale = anchor.shoulderWidthWorld / shoulderWidthLandmark

  // Landmark y grows downward and z grows away from the camera (MediaPipe's image-space
  // convention extended to 3D); the scene's y grows upward and, since the rig faces the scene
  // camera the same way the person faces their webcam, its z grows toward the viewer. Both flip.
  // `includeDepth: false` drops the z term entirely instead, projecting onto the anchor's plane.
  const boneTarget = (landmark: CameraLandmark): THREE.Vector3 =>
    anchor.shoulderCenterWorldPosition
      .clone()
      .add(
        new THREE.Vector3(
          (landmark.x - shoulderCenter.x) * scale,
          -(landmark.y - shoulderCenter.y) * scale,
          options.includeDepth ? -(landmark.z - shoulderCenter.z) * scale : 0
        )
      )

  const targetForLandmark = (landmarkIndex: number): THREE.Vector3 | null => {
    const landmark = landmarks[landmarkIndex]
    if (!landmark || landmark.visibility < CAMERA_LANDMARK_VISIBILITY_THRESHOLD) return null
    return boneTarget(landmark)
  }

  const entriesFor = (landmarksByBone: Record<string, number>): Record<string, THREE.Vector3> =>
    Object.fromEntries(
      Object.entries(landmarksByBone)
        .map(([boneName, landmarkIndex]): [string, THREE.Vector3 | null] => [
          boneName,
          targetForLandmark(landmarkIndex)
        ])
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
    return { [CAMERA_POSE_HIPS_BONE]: boneTarget(landmarkMidpoint(leftHip, rightHip)) }
  }

  return {
    boneTargets: { ...entriesFor(CAMERA_POSE_BONE_LANDMARKS), ...hipsTarget() },
    poleTargets: entriesFor({
      ...(options.includeElbows ? CAMERA_POSE_ELBOW_POLE_LANDMARKS : {}),
      ...(options.includeKnees ? CAMERA_POSE_KNEE_POLE_LANDMARKS : {})
    })
  }
}
