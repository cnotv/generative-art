import { computed, type Ref } from 'vue'
import type * as THREE from 'three'
import {
  CAMERA_POSE_REQUIRED_BONES,
  computeCameraRigAnchor,
  cameraLandmarksToBoneTargets,
  type CameraLandmark
} from './cameraPoseMapping'

/**
 * Owns the camera-pose-capture readiness check and applies a detected pose to the rig, split out
 * of `useRigModel` to stay under its function-length lint cap.
 * @param bones The rig's current bones
 * @param applyBoneDragTarget The same drag-to-chain solve a mouse drag uses, reused per mapped bone
 */
export const useRigCameraPose = (
  bones: Ref<THREE.Bone[]>,
  applyBoneDragTarget: (bone: THREE.Bone, targetWorldPosition: THREE.Vector3) => void,
  resetAllBonesToRest: () => void
) => {
  const canCaptureFromCamera = computed(() =>
    CAMERA_POSE_REQUIRED_BONES.every((name) => bones.value.some((bone) => bone.name === name))
  )

  /**
   * Map a detected person's landmarks onto the rig's hands, feet and head, reusing the same
   * drag-to-chain IK solve a mouse drag uses for each mapped bone's target position. Resets the
   * whole rig to rest first: a bone the mapping does not drive this frame (a low-visibility
   * landmark, or a bone camera capture never touches at all) would otherwise keep whatever it
   * was left at by an earlier manual edit or a previous capture, mixing an old pose in with the
   * new one instead of the photo driving the whole body.
   * @param landmarks The detected person's world landmarks, from `useCameraPoseCapture`
   */
  const applyCameraPose = (landmarks: CameraLandmark[]): void => {
    resetAllBonesToRest()
    const anchor = computeCameraRigAnchor(bones.value)
    if (!anchor) return
    const targets = cameraLandmarksToBoneTargets(landmarks, anchor)
    Object.entries(targets).forEach(([boneName, targetWorldPosition]) => {
      const bone = bones.value.find((candidate) => candidate.name === boneName)
      if (bone) applyBoneDragTarget(bone, targetWorldPosition)
    })
  }

  return { canCaptureFromCamera, applyCameraPose }
}
