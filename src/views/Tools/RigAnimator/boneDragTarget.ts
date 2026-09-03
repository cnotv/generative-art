import * as THREE from 'three'
import { ikFindTwoBoneChain, ikSolveTwoBoneChain } from '@webgamekit/rig'

/** A bone's transform as loaded, so an IK solve can snap the dragged bone itself back to it. */
export interface BoneRestPose {
  position: THREE.Vector3
  quaternion: THREE.Quaternion
}

/**
 * Snapshot every bone's transform, so a bad edit (an IK or position drag gone too far) can
 * later be undone by copying it back.
 * @param bones The rig's bones, just attached
 * @returns Each bone's transform, keyed by name
 */
export const captureRestPoses = (bones: THREE.Bone[]): Map<string, BoneRestPose> =>
  new Map(
    bones.map((bone) => [
      bone.name,
      { position: bone.position.clone(), quaternion: bone.quaternion.clone() }
    ])
  )

/**
 * Resolve a gizmo drag on a bone into a two-bone IK solve when it has one to solve with. A
 * hand or a foot on any rig, regardless of naming, has two Bone ancestors: the shoulder and
 * elbow (or hip and knee) rotate to reach the dragged world position, and the dragged bone's
 * own local transform snaps back to rest so it never accumulates a raw position edit.
 * @param bone The bone the gizmo just moved, already carrying the drag's new local position
 * @param restPoses Every rigged bone's transform as loaded, keyed by name
 * @returns Nothing; mutates the chain's root/mid quaternions and the dragged bone's position
 *   when a two-bone chain exists, or leaves the bone exactly as the gizmo already set it
 */
export const applyGizmoDragToChain = (
  bone: THREE.Bone,
  restPoses: Map<string, BoneRestPose>
): void => {
  const chain = ikFindTwoBoneChain(bone)
  if (!chain) return
  const targetWorldPosition = bone.getWorldPosition(new THREE.Vector3())
  const rest = restPoses.get(bone.name)
  if (rest) bone.position.copy(rest.position)
  const poleWorldPosition = chain.mid.getWorldPosition(new THREE.Vector3())
  ikSolveTwoBoneChain(chain, targetWorldPosition, poleWorldPosition)
}

/**
 * Reset a bone back to rest, and the root/mid of its IK chain along with it when it has one:
 * an IK drag leaves the dragged bone's own transform at rest already, so undoing just that
 * bone would do nothing, the shoulder and elbow (or hip and knee) that actually moved need
 * resetting too.
 * @param bone The selected bone to reset
 * @param restPoses Every rigged bone's transform as loaded, keyed by name
 * @returns Nothing; mutates every bone in the chain back to its rest transform
 */
export const resetBoneChainToRest = (
  bone: THREE.Bone,
  restPoses: Map<string, BoneRestPose>
): void => {
  const chain = ikFindTwoBoneChain(bone)
  const chainBones = chain ? [chain.root, chain.mid, bone] : [bone]
  chainBones.forEach((chainBone) => {
    const rest = restPoses.get(chainBone.name)
    if (rest) {
      chainBone.position.copy(rest.position)
      chainBone.quaternion.copy(rest.quaternion)
    }
  })
}
