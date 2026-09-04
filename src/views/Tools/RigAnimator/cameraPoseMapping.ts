import * as THREE from 'three'

/** One BlazePose landmark: metres in world mode, normalized [0,1] in image mode either way. */
export interface CameraLandmark {
  x: number
  y: number
  z: number
  visibility: number
}

const LANDMARK_INDEX = {
  nose: 0,
  leftShoulder: 11,
  rightShoulder: 12,
  leftWrist: 15,
  rightWrist: 16,
  leftAnkle: 27,
  rightAnkle: 28
} as const

/** Which landmark drives each mapped bone, matching `HUMANOID_BONE_HIERARCHY`'s naming. */
export const CAMERA_POSE_BONE_LANDMARKS: Record<string, number> = {
  mixamorigLeftHand: LANDMARK_INDEX.leftWrist,
  mixamorigRightHand: LANDMARK_INDEX.rightWrist,
  mixamorigLeftFoot: LANDMARK_INDEX.leftAnkle,
  mixamorigRightFoot: LANDMARK_INDEX.rightAnkle,
  mixamorigHead: LANDMARK_INDEX.nose
}

/** Every bone name camera pose capture needs on the rig, the mapped bones plus the anchor bones. */
export const CAMERA_POSE_REQUIRED_BONES = [
  'mixamorigLeftShoulder',
  'mixamorigRightShoulder',
  ...Object.keys(CAMERA_POSE_BONE_LANDMARKS)
]

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
 * @param bones The rig's bones
 * @returns The anchor, or null when the rig is missing a bone camera pose capture needs
 */
export const computeCameraRigAnchor = (bones: THREE.Bone[]): CameraRigAnchor | null => {
  const leftShoulder = bones.find((bone) => bone.name === 'mixamorigLeftShoulder')
  const rightShoulder = bones.find((bone) => bone.name === 'mixamorigRightShoulder')
  if (!leftShoulder || !rightShoulder) return null

  const leftWorldPosition = leftShoulder.getWorldPosition(new THREE.Vector3())
  const rightWorldPosition = rightShoulder.getWorldPosition(new THREE.Vector3())
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
 * @returns World-space target positions keyed by bone name, ready for `applyBoneDragTarget`
 */
export const cameraLandmarksToBoneTargets = (
  landmarks: CameraLandmark[],
  anchor: CameraRigAnchor
): Record<string, THREE.Vector3> => {
  const leftShoulder = landmarks[LANDMARK_INDEX.leftShoulder]
  const rightShoulder = landmarks[LANDMARK_INDEX.rightShoulder]
  if (
    !leftShoulder ||
    !rightShoulder ||
    leftShoulder.visibility < CAMERA_LANDMARK_VISIBILITY_THRESHOLD ||
    rightShoulder.visibility < CAMERA_LANDMARK_VISIBILITY_THRESHOLD
  ) {
    return {}
  }

  const shoulderCenter = landmarkMidpoint(leftShoulder, rightShoulder)
  const shoulderWidthLandmark = landmarkDistance(leftShoulder, rightShoulder)
  if (shoulderWidthLandmark < MINIMUM_LANDMARK_SHOULDER_SPAN) return {}
  const scale = anchor.shoulderWidthWorld / shoulderWidthLandmark

  // Landmark y grows downward and z grows away from the camera (MediaPipe's image-space
  // convention extended to 3D); the scene's y grows upward and, since the rig faces the scene
  // camera the same way the person faces their webcam, its z grows toward the viewer. Both flip.
  const boneTarget = (landmark: CameraLandmark): THREE.Vector3 =>
    anchor.shoulderCenterWorldPosition
      .clone()
      .add(
        new THREE.Vector3(
          (landmark.x - shoulderCenter.x) * scale,
          -(landmark.y - shoulderCenter.y) * scale,
          -(landmark.z - shoulderCenter.z) * scale
        )
      )

  return Object.fromEntries(
    Object.entries(CAMERA_POSE_BONE_LANDMARKS)
      .map(([boneName, landmarkIndex]): [string, CameraLandmark | undefined] => [
        boneName,
        landmarks[landmarkIndex]
      ])
      .filter(
        (entry): entry is [string, CameraLandmark] =>
          entry[1] !== undefined && entry[1].visibility >= CAMERA_LANDMARK_VISIBILITY_THRESHOLD
      )
      .map(([boneName, landmark]): [string, THREE.Vector3] => [boneName, boneTarget(landmark)])
  )
}
