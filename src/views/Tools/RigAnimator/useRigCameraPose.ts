import { computed, type Ref } from 'vue'
import type * as THREE from 'three'
import { ikFindTwoBoneChain } from '@webgamekit/rig'
import {
  CAMERA_POSE_REQUIRED_BONES,
  CAMERA_POSE_MAPPING_OPTIONS_DEFAULT,
  computeCameraRigAnchor,
  cameraLandmarksToBoneTargets,
  type CameraLandmark,
  type CameraPoseMappingOptions
} from './cameraPoseMapping'
import { applyPoleDrag } from './boneDragTarget'

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
   * new one instead of the photo driving the whole body. A pole target re-bends an already
   * placed chain toward the detected elbow or knee, the same re-solve a manual pole drag does,
   * so it never changes where the hand or foot itself ended up.
   * @param landmarks The detected person's world landmarks, from `useCameraPoseCapture`
   * @param options Which extra details (elbow/knee bend, hips, depth) to derive, see
   *   `CameraPoseMappingOptions`
   */
  const applyCameraPose = (
    landmarks: CameraLandmark[],
    options: CameraPoseMappingOptions = CAMERA_POSE_MAPPING_OPTIONS_DEFAULT
  ): void => {
    resetAllBonesToRest()
    const anchor = computeCameraRigAnchor(bones.value)
    if (!anchor) return
    const { boneTargets, poleTargets } = cameraLandmarksToBoneTargets(landmarks, anchor, options)
    Object.entries(boneTargets).forEach(([boneName, targetWorldPosition]) => {
      const bone = bones.value.find((candidate) => candidate.name === boneName)
      if (bone) applyBoneDragTarget(bone, targetWorldPosition)
    })
    Object.entries(poleTargets).forEach(([endBoneName, poleWorldPosition]) => {
      const endBone = bones.value.find((candidate) => candidate.name === endBoneName)
      const chain = endBone ? ikFindTwoBoneChain(endBone) : null
      if (chain) applyPoleDrag(chain, poleWorldPosition)
    })
  }

  return { canCaptureFromCamera, applyCameraPose }
}
