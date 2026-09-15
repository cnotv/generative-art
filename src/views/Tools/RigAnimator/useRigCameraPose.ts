import { computed, type Ref } from 'vue'
import * as THREE from 'three'
import { ikFindTwoBoneChain, type Vector3Data } from '@webgamekit/rig'
import {
  CAMERA_POSE_REQUIRED_BONES,
  CAMERA_POSE_MAPPING_OPTIONS_DEFAULT,
  computeCameraRigAnchor,
  cameraLandmarksToBoneTargets,
  type CameraLandmark,
  type CameraPoseMappingOptions
} from './cameraPoseMapping'
import { applyPoleDrag, rotateBoneInWorldSpace } from './boneDragTarget'
import {
  boneNamesInGroups,
  type RigBodyPartGroup,
  type RigGroupRootBoneNames
} from './bodyPartGroups'
import { CAMERA_POSE_NECK_BONE_NAME, CAMERA_POSE_SPINE_BONE_NAMES } from './config'
import type { CameraBodyMotion } from './types'

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
 */
export const useRigCameraPose = (
  bones: Ref<THREE.Bone[]>,
  applyBoneDragTarget: (bone: THREE.Bone, targetWorldPosition: THREE.Vector3) => void,
  resetAllBonesToRest: (excludeBoneNames?: Set<string>) => void,
  getRestPositions: () => Map<string, THREE.Vector3>
) => {
  const canCaptureFromCamera = computed(() =>
    CAMERA_POSE_REQUIRED_BONES.every((name) => bones.value.some((bone) => bone.name === name))
  )

  const findBone = (name: string): THREE.Bone | undefined =>
    bones.value.find((bone) => bone.name === name)

  /** Measured from rest every frame rather than accumulated, so a dropped frame never drifts. */
  const applyRootOffset = (root: THREE.Bone, offset: Vector3Data): void => {
    const restPosition = getRestPositions().get(root.name)
    if (!restPosition) return
    const restWorldPosition = root.parent
      ? root.parent.localToWorld(restPosition.clone())
      : restPosition.clone()
    applyBoneDragTarget(
      root,
      restWorldPosition.add(new THREE.Vector3(offset.x, offset.y, offset.z))
    )
  }

  /**
   * Share the torso rotation equally between the spine bones the rig has, the way a real back
   * bends over every vertebra instead of folding at one joint.
   * @returns The rotation actually applied, identity when no spine bone is in scope
   */
  const applyTorsoRotation = (
    torso: THREE.Quaternion,
    boneNamesInScope: Set<string>
  ): THREE.Quaternion => {
    const spineBones = bones.value.filter(
      (bone) => CAMERA_POSE_SPINE_BONE_NAMES.includes(bone.name) && boneNamesInScope.has(bone.name)
    )
    if (spineBones.length === 0) return new THREE.Quaternion()
    const share = new THREE.Quaternion().slerp(torso, 1 / spineBones.length)
    spineBones.forEach((bone) => rotateBoneInWorldSpace(bone, share))
    return torso
  }

  /** The neck rotation is read relative to the torso, so it turns in whatever frame the torso
   * rotation just left the neck's parent in. */
  const applyNeckRotation = (neck: THREE.Quaternion, appliedTorso: THREE.Quaternion): void => {
    const neckBone = findBone(CAMERA_POSE_NECK_BONE_NAME)
    if (!neckBone) return
    rotateBoneInWorldSpace(
      neckBone,
      appliedTorso.clone().multiply(neck).multiply(appliedTorso.clone().invert())
    )
  }

  /**
   * Map a detected person's landmarks onto the rig's hands and feet, reusing the same drag-to-chain
   * IK solve a mouse drag uses for each mapped bone's target position, and turn the torso and neck
   * by their own rotations. Resets the rig to rest first, root bone excepted: a bone the mapping
   * does not drive this frame would otherwise keep whatever it was left at by an earlier manual
   * edit or a previous capture, mixing an old pose in with the new one. The root is kept out of
   * that reset so it holds wherever its offset last put it on a frame that carries none, instead of
   * twitching back to rest. The root, torso and neck apply before the limb targets are computed,
   * since those anchor to the shoulders the spine carries. A part not driven this frame, or missing
   * from the rig, simply rides along with its parent.
   *
   * `targetGroups` scopes all of it to the bones inside those groups (see `boneBodyPartGroup`): a
   * bone outside every selected group is left exactly as it was, so a capture can be re-shot for
   * one limb without disturbing the rest of the rig.
   * @param landmarks The detected person's world landmarks
   * @param options Which extra details (elbow and knee bend, depth) to derive, see
   *   `CameraPoseMappingOptions`
   * @param targetGroups Which body-part groups this capture is allowed to touch
   * @param rootBoneNames Which bone name marks each limb group's root on this rig, from a
   *   calibration's "assign parts" step; defaults to the fixed mixamorig convention
   * @param bodyMotion The root offset and torso and neck rotations to apply; each left out or null
   *   is not driven this frame
   */
  const applyCameraPose = (
    landmarks: CameraLandmark[],
    options: CameraPoseMappingOptions = CAMERA_POSE_MAPPING_OPTIONS_DEFAULT,
    targetGroups: Set<RigBodyPartGroup>,
    rootBoneNames?: RigGroupRootBoneNames,
    bodyMotion: Partial<CameraBodyMotion> = {}
  ): void => {
    const boneNamesInScope = boneNamesInGroups(bones.value, targetGroups, rootBoneNames)
    const root = findSkeletonRoot(bones.value)
    const excludeFromReset = new Set([
      ...bones.value.map((bone) => bone.name).filter((name) => !boneNamesInScope.has(name)),
      ...(root ? [root.name] : [])
    ])
    resetAllBonesToRest(excludeFromReset)
    const { rootOffset, torso, neck } = bodyMotion
    if (root && rootOffset && boneNamesInScope.has(root.name)) applyRootOffset(root, rootOffset)
    const appliedTorso = torso
      ? applyTorsoRotation(torso, boneNamesInScope)
      : new THREE.Quaternion()
    if (neck && boneNamesInScope.has(CAMERA_POSE_NECK_BONE_NAME)) {
      applyNeckRotation(neck, appliedTorso)
    }
    const anchor = computeCameraRigAnchor(bones.value)
    if (!anchor) return
    const { boneTargets, poleTargets } = cameraLandmarksToBoneTargets(landmarks, anchor, options)
    Object.entries(boneTargets)
      .filter(([boneName]) => boneNamesInScope.has(boneName))
      .forEach(([boneName, targetWorldPosition]) => {
        const bone = findBone(boneName)
        if (bone) applyBoneDragTarget(bone, targetWorldPosition)
      })
    Object.entries(poleTargets)
      .filter(([endBoneName]) => boneNamesInScope.has(endBoneName))
      .forEach(([endBoneName, poleWorldPosition]) => {
        const endBone = findBone(endBoneName)
        const chain = endBone ? ikFindTwoBoneChain(endBone) : null
        if (chain) applyPoleDrag(chain, poleWorldPosition)
      })
  }

  return { canCaptureFromCamera, applyCameraPose }
}
