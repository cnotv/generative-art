import { computed, type Ref } from 'vue'
import type * as THREE from 'three'
import { ikFindTwoBoneChain } from '@webgamekit/rig'
import {
  CAMERA_POSE_REQUIRED_BONES,
  CAMERA_POSE_MAPPING_OPTIONS_DEFAULT,
  CAMERA_POSE_HIPS_BONE,
  computeCameraRigAnchor,
  cameraLandmarksToBoneTargets,
  type CameraLandmark,
  type CameraPoseMappingOptions
} from './cameraPoseMapping'
import { applyPoleDrag } from './boneDragTarget'
import { boneNamesInGroups, type RigBodyPartGroup } from './bodyPartGroups'

/** Excluded from the per-frame reset in `applyCameraPose`, see its own doc comment. */
const BONES_KEPT_ACROSS_FRAMES = new Set([CAMERA_POSE_HIPS_BONE])

/**
 * Owns the camera-pose-capture readiness check and applies a detected pose to the rig, split out
 * of `useRigModel` to stay under its function-length lint cap.
 * @param bones The rig's current bones
 * @param applyBoneDragTarget The same drag-to-chain solve a mouse drag uses, reused per mapped bone
 */
export const useRigCameraPose = (
  bones: Ref<THREE.Bone[]>,
  applyBoneDragTarget: (bone: THREE.Bone, targetWorldPosition: THREE.Vector3) => void,
  resetAllBonesToRest: (excludeBoneNames?: Set<string>) => void
) => {
  const canCaptureFromCamera = computed(() =>
    CAMERA_POSE_REQUIRED_BONES.every((name) => bones.value.some((bone) => bone.name === name))
  )

  /**
   * Map a detected person's landmarks onto the rig's hands, feet and head, reusing the same
   * drag-to-chain IK solve a mouse drag uses for each mapped bone's target position. Resets the
   * rig to rest first, root bone excepted: a bone the mapping does not drive this frame (a
   * low-visibility landmark, or a bone camera capture never touches at all) would otherwise
   * keep whatever it was left at by an earlier manual edit or a previous capture, mixing an old
   * pose in with the new one instead of the photo driving the whole body. The root bone is kept
   * out of that reset on purpose: hip landmarks are the ones most often out of frame or briefly
   * occluded, and snapping the whole rig back to the origin every time they drop out read as a
   * twitch back to rest rather than the rig simply not moving that frame. Leaving it be means it
   * holds wherever it was last driven to, the same way a bone the mapping never touches at all
   * already does, until a fresh hip target moves it again. A pole target re-bends an already
   * placed chain toward the detected elbow or knee, the same re-solve a manual pole drag does,
   * so it never changes where the hand or foot itself ended up.
   *
   * `targetGroups` scopes both the reset and the application below to the bones that fall
   * inside those groups (see `boneBodyPartGroup`): a bone outside every selected group is left
   * exactly as it was, whether that is an earlier capture, a preset, or a manual edit, so a
   * capture can be re-shot for just one limb without disturbing whatever the rest of the rig
   * already carries.
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
    const excludeFromReset = new Set([
      ...bones.value.map((bone) => bone.name).filter((name) => !boneNamesInScope.has(name)),
      ...BONES_KEPT_ACROSS_FRAMES
    ])
    resetAllBonesToRest(excludeFromReset)
    const anchor = computeCameraRigAnchor(bones.value)
    if (!anchor) return
    const { boneTargets, poleTargets } = cameraLandmarksToBoneTargets(landmarks, anchor, options)
    Object.entries(boneTargets)
      .filter(([boneName]) => boneNamesInScope.has(boneName))
      .forEach(([boneName, targetWorldPosition]) => {
        const bone = bones.value.find((candidate) => candidate.name === boneName)
        if (bone) applyBoneDragTarget(bone, targetWorldPosition)
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
