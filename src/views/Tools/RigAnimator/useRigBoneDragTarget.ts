import type { Ref } from 'vue'
import type * as THREE from 'three'
import { applyGizmoDragToChain, type BoneRestPose } from './boneDragTarget'
import type { RigAnimatorConfig } from './types'

/**
 * Owns applying a drag-to-world-target solve to a bone and syncing the panel's Bone Position
 * field with the result, split out of `useRigModel` to stay under its function-length lint cap.
 * @param getRestPoses Every rigged bone's transform as loaded, read fresh on each call since
 *   `useRigModel` replaces the whole map on every model load
 */
export const useRigBoneDragTarget = (
  config: Ref<RigAnimatorConfig>,
  getRestPoses: () => Map<string, BoneRestPose>
) => {
  /** Handle a drag toward a world target: an IK solve or a plain translate, see `applyGizmoDragToChain`. */
  const applyBoneDragTarget = (
    bone: THREE.Bone,
    targetWorldPosition: THREE.Vector3,
    allowRootFollow = true
  ): void => {
    applyGizmoDragToChain(bone, targetWorldPosition, getRestPoses(), allowRootFollow)
    config.value.bonePosition = { x: bone.position.x, y: bone.position.y, z: bone.position.z }
  }

  return { applyBoneDragTarget }
}
