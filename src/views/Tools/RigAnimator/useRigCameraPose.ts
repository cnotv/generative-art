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
import { boneNamesInGroups, type RigBodyPartGroup } from './bodyPartGroups'

/**
 * Owns the camera-pose-capture readiness check and applies a detected pose to the rig, split out
 * of `useRigModel` to stay under its function-length lint cap.
 * @param bones The rig's current bones
 * @param applyBoneDragTarget The same drag-to-chain solve a mouse drag uses, reused per mapped bone
 */
export const useRigCameraPose = (
  bones: Ref<THREE.Bone[]>,
  applyBoneDragTarget: (
    bone: THREE.Bone,
    targetWorldPosition: THREE.Vector3,
    allowRootFollow?: boolean
  ) => void
) => {
  const canCaptureFromCamera = computed(() =>
    CAMERA_POSE_REQUIRED_BONES.every((name) => bones.value.some((bone) => bone.name === name))
  )

  /**
   * Map a detected person's landmarks onto the rig's hands, feet and head, reusing the same
   * drag-to-chain IK solve a mouse drag uses for each mapped bone's target position. A bone the
   * mapping does not drive this frame (a low-visibility landmark, or a bone camera capture never
   * touches at all) is left exactly where it already was, rather than snapped back to rest: a
   * live feed's own confidence dips frame to frame, and resetting on every dip read as the
   * affected limb flickering back to rest and forward again rather than holding still, most
   * visibly on a hand that drops out of frame for a moment while the body stays tracked. A pole
   * target re-bends an already placed chain toward the detected elbow or knee, the same re-solve
   * a manual pole drag does, so it never changes where the hand or foot itself ended up.
   *
   * `targetGroups` scopes the application above to the bones that fall inside those groups (see
   * `boneBodyPartGroup`): a bone outside every selected group is left exactly as it was, whether
   * that is an earlier capture, a preset, or a manual edit, so a capture can be re-shot for just
   * one limb without disturbing whatever the rest of the rig already carries.
   * @param landmarks The detected person's world landmarks, from `useCameraPoseCapture`
   * @param options Which extra details (elbow/knee bend, hips, depth) to derive, see
   *   `CameraPoseMappingOptions`
   * @param targetGroups Which body-part groups this capture is allowed to touch
   */
  const applyCameraPose = (
    landmarks: CameraLandmark[],
    options: CameraPoseMappingOptions = CAMERA_POSE_MAPPING_OPTIONS_DEFAULT,
    targetGroups: Set<RigBodyPartGroup>
  ): void => {
    const boneNamesInScope = boneNamesInGroups(bones.value, targetGroups)
    const anchor = computeCameraRigAnchor(bones.value)
    if (!anchor) return
    const { boneTargets, poleTargets } = cameraLandmarksToBoneTargets(landmarks, anchor, options)
    Object.entries(boneTargets)
      .filter(([boneName]) => boneNamesInScope.has(boneName))
      .forEach(([boneName, targetWorldPosition]) => {
        const bone = bones.value.find((candidate) => candidate.name === boneName)
        // Every mapped limb's target already reproduces the detected whole-body pose on its
        // own; letting one also carry the skeleton root along (as an interactive single-bone
        // drag does) would throw off every other limb's own target applied in this same pass.
        if (bone) applyBoneDragTarget(bone, targetWorldPosition, false)
      })
    Object.entries(poleTargets)
      .filter(([endBoneName]) => boneNamesInScope.has(endBoneName))
      .forEach(([endBoneName, poleWorldPosition]) => {
        const endBone = bones.value.find((candidate) => candidate.name === endBoneName)
        const chain = endBone ? ikFindTwoBoneChain(endBone) : null
        if (chain) applyPoleDrag(chain, poleWorldPosition)
      })
  }

  return { canCaptureFromCamera, applyCameraPose }
}
