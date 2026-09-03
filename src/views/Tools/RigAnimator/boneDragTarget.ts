import * as THREE from 'three'
import { ikFindTwoBoneChain, ikSolveTwoBoneChain, ikSolveOneBoneAim } from '@webgamekit/rig'

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
 * Resolve a gizmo drag on a bone into whichever length-preserving solve it has bones to solve
 * with, so no drag ever stretches a segment: two-bone IK for a hand or foot (any bone with two
 * Bone ancestors), a one-bone aim for a bone with only a Bone parent (a spine segment, a thigh
 * whose own parent is the skeleton root), or nothing at all for the skeleton root itself, which
 * has no parent segment to preserve and so keeps translating freely with the whole rig. Either
 * solve snaps the dragged bone's own local transform back to rest first, since only its
 * ancestor(s) ever rotate to reach it.
 * @param bone The bone the gizmo just moved, already carrying the drag's new local position
 * @param restPoses Every rigged bone's transform as loaded, keyed by name
 * @returns Nothing; mutates whichever ancestor bone(s) solve for this bone, or leaves the bone
 *   exactly as the gizmo already set it when it has no Bone parent at all
 */
export const applyGizmoDragToChain = (
  bone: THREE.Bone,
  restPoses: Map<string, BoneRestPose>
): void => {
  const targetWorldPosition = bone.getWorldPosition(new THREE.Vector3())
  const rest = restPoses.get(bone.name)
  const chain = ikFindTwoBoneChain(bone)
  if (chain) {
    if (rest) bone.position.copy(rest.position)
    const poleWorldPosition = chain.mid.getWorldPosition(new THREE.Vector3())
    ikSolveTwoBoneChain(chain, targetWorldPosition, poleWorldPosition)
    return
  }
  if (bone.parent instanceof THREE.Bone) {
    if (rest) bone.position.copy(rest.position)
    ikSolveOneBoneAim(bone.parent, bone, targetWorldPosition)
  }
}

/**
 * Reset a bone back to rest, and whichever ancestor(s) solved its last drag along with it: a
 * length-preserving drag leaves the dragged bone's own transform at rest already, so undoing
 * just that bone would do nothing, the ancestor(s) that actually rotated need resetting too.
 * @param bone The selected bone to reset
 * @param restPoses Every rigged bone's transform as loaded, keyed by name
 * @returns Nothing; mutates every bone in the reset back to its rest transform
 */
export const resetBoneChainToRest = (
  bone: THREE.Bone,
  restPoses: Map<string, BoneRestPose>
): void => {
  const chain = ikFindTwoBoneChain(bone)
  const chainBones = chain
    ? [chain.root, chain.mid, bone]
    : bone.parent instanceof THREE.Bone
      ? [bone.parent, bone]
      : [bone]
  chainBones.forEach((chainBone) => {
    const rest = restPoses.get(chainBone.name)
    if (rest) {
      chainBone.position.copy(rest.position)
      chainBone.quaternion.copy(rest.quaternion)
    }
  })
}
