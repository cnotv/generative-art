import { computed, type Ref } from 'vue'
import * as THREE from 'three'
import { ikFindTwoBoneChain } from '@webgamekit/rig'
import {
  CAMERA_POSE_REQUIRED_BONES,
  CAMERA_POSE_MAPPING_OPTIONS_DEFAULT,
  computeCameraRigAnchor,
  cameraLandmarksToBoneTargets,
  type CameraLandmark,
  type CameraPoseMappingOptions
} from './cameraPoseMapping'
import { applyPoleDrag, rotateBoneAboutWorldAxis } from './boneDragTarget'
import {
  boneNamesInGroups,
  type RigBodyPartGroup,
  type RigGroupRootBoneNames
} from './bodyPartGroups'
import type { RootMotion } from './types'

const WORLD_UP = new THREE.Vector3(0, 1, 0)

/** The skeleton root is found by structure rather than name, so a non-mixamorig rig works too. */
const findSkeletonRoot = (bones: THREE.Bone[]): THREE.Bone | undefined =>
  bones.find((bone) => !(bone.parent instanceof THREE.Bone))

/**
 * Owns the camera-pose-capture readiness check and applies a detected pose to the rig, split out
 * of `useRigModel` to stay under its function-length lint cap.
 * @param bones The rig's current bones
 * @param applyBoneDragTarget The same drag-to-chain solve a mouse drag uses, reused per mapped bone
 * @param resetAllBonesToRest Snaps bones back to their loaded rest transforms
 * @param getRestPositions Every bone's rest local position, keyed by name
 * @param getRestQuaternions Every bone's rest local rotation, keyed by name
 */
export const useRigCameraPose = (
  bones: Ref<THREE.Bone[]>,
  applyBoneDragTarget: (bone: THREE.Bone, targetWorldPosition: THREE.Vector3) => void,
  resetAllBonesToRest: (excludeBoneNames?: Set<string>) => void,
  getRestPositions: () => Map<string, THREE.Vector3>,
  getRestQuaternions: () => Map<string, THREE.Quaternion>
) => {
  const canCaptureFromCamera = computed(() =>
    CAMERA_POSE_REQUIRED_BONES.every((name) => bones.value.some((bone) => bone.name === name))
  )

  /** Measured from rest every frame rather than accumulated, so a dropped frame never drifts. */
  const applyRootMotion = (root: THREE.Bone, rootMotion: RootMotion): void => {
    const restPosition = getRestPositions().get(root.name)
    const restQuaternion = getRestQuaternions().get(root.name)
    if (!restPosition || !restQuaternion) return
    root.quaternion.copy(restQuaternion)
    rotateBoneAboutWorldAxis(root, WORLD_UP, rootMotion.yaw)
    const restWorldPosition = root.parent
      ? root.parent.localToWorld(restPosition.clone())
      : restPosition.clone()
    const { x, y, z } = rootMotion.offset
    applyBoneDragTarget(root, restWorldPosition.add(new THREE.Vector3(x, y, z)))
  }

  /**
   * Map a detected person's landmarks onto the rig's hands, feet and head, reusing the same
   * drag-to-chain IK solve a mouse drag uses for each mapped bone's target position. Resets the
   * rig to rest first, root bone excepted: a bone the mapping does not drive this frame would
   * otherwise keep whatever it was left at by an earlier manual edit or a previous capture,
   * mixing an old pose in with the new one. The root is kept out of that reset so it holds
   * wherever root motion last put it on a frame that carries none, instead of twitching back to
   * rest. Root motion applies before the limb targets are computed, since those anchor to the
   * shoulders the root carries.
   *
   * `targetGroups` scopes the reset, the root motion and the limb targets to the bones inside
   * those groups (see `boneBodyPartGroup`): a bone outside every selected group is left exactly
   * as it was, so a capture can be re-shot for one limb without disturbing the rest of the rig.
   * @param landmarks The detected person's world landmarks, depth-scaled when calibrated
   * @param options Which extra details (elbow, knee and neck bend, depth) to derive, see
   *   `CameraPoseMappingOptions`
   * @param targetGroups Which body-part groups this capture is allowed to touch
   * @param rootBoneNames Which bone name marks each limb group's root on this rig, from a
   *   calibration's "assign parts" step; defaults to the fixed mixamorig convention
   * @param rootMotion Calibrated movement and turn of the skeleton root, or null to hold it
   */
  const applyCameraPose = (
    landmarks: CameraLandmark[],
    options: CameraPoseMappingOptions = CAMERA_POSE_MAPPING_OPTIONS_DEFAULT,
    targetGroups: Set<RigBodyPartGroup>,
    rootBoneNames?: RigGroupRootBoneNames,
    rootMotion: RootMotion | null = null
  ): void => {
    const boneNamesInScope = boneNamesInGroups(bones.value, targetGroups, rootBoneNames)
    const root = findSkeletonRoot(bones.value)
    const excludeFromReset = new Set([
      ...bones.value.map((bone) => bone.name).filter((name) => !boneNamesInScope.has(name)),
      ...(root ? [root.name] : [])
    ])
    resetAllBonesToRest(excludeFromReset)
    if (root && rootMotion && boneNamesInScope.has(root.name)) applyRootMotion(root, rootMotion)
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
