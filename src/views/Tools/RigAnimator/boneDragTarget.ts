import * as THREE from 'three'
import {
  ikFindTwoBoneChain,
  ikSolveTwoBoneChain,
  ikSolveOneBoneAim,
  type TwoBoneIkChain
} from '@webgamekit/rig'

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
 * Resolve a drag on a bone toward a world-space target into whichever length-preserving solve
 * it has bones to solve with, so no drag ever stretches a segment: two-bone IK for a hand or
 * foot (any bone with two Bone ancestors), a one-bone aim for a bone with only a Bone parent (a
 * spine segment, a thigh whose own parent is the skeleton root), or a plain translate for the
 * skeleton root itself, which has no parent segment to preserve. Either IK solve snaps the
 * dragged bone's own local transform back to rest first, since only its ancestor(s) ever rotate
 * to reach it.
 * @param bone The bone being dragged
 * @param targetWorldPosition Where the drag wants this bone to end up, in world space
 * @param restPoses Every rigged bone's transform as loaded, keyed by name
 * @returns Nothing; mutates whichever ancestor bone(s) solve for this bone, or the bone's own
 *   local position directly when it has no Bone parent at all
 */
export const applyGizmoDragToChain = (
  bone: THREE.Bone,
  targetWorldPosition: THREE.Vector3,
  restPoses: Map<string, BoneRestPose>
): void => {
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
    return
  }
  if (bone.parent) {
    bone.position.copy(bone.parent.worldToLocal(targetWorldPosition.clone()))
  } else {
    bone.position.copy(targetWorldPosition)
  }
}

/**
 * Re-solve a chain with its end effector held at its own current position but a new pole hint,
 * so dragging the mid joint (an elbow, a knee) swings which way the limb bends without moving
 * the hand or foot it belongs to: the same two-bone solve `applyGizmoDragToChain` uses, just
 * re-run with a different bend hint instead of a different target.
 * @param chain The chain whose mid bone is being dragged as a pole hint
 * @param poleWorldPosition Where the drag wants the bend to lean toward, in world space
 * @returns Nothing; mutates the chain's root/mid quaternions
 */
export const applyPoleDrag = (chain: TwoBoneIkChain, poleWorldPosition: THREE.Vector3): void => {
  const targetWorldPosition = chain.end.getWorldPosition(new THREE.Vector3())
  ikSolveTwoBoneChain(chain, targetWorldPosition, poleWorldPosition)
}

/**
 * Turn a bone about an axis given in world space, through its parent's world rotation. Three's
 * own `rotateOnWorldAxis` assumes an unrotated parent, which no limb has and an FBX armature's
 * root often lacks too; under a rotated parent it tips the bone instead of turning it.
 * @param bone The bone to turn
 * @param worldAxis The axis in world space, normalized
 * @param angle The turn in radians
 * @returns Nothing; mutates the bone's local quaternion
 */
export const rotateBoneAboutWorldAxis = (
  bone: THREE.Object3D,
  worldAxis: THREE.Vector3,
  angle: number
): void => {
  const parentWorldQuaternion = bone.parent
    ? bone.parent.getWorldQuaternion(new THREE.Quaternion())
    : new THREE.Quaternion()
  const worldTurn = new THREE.Quaternion().setFromAxisAngle(worldAxis, angle)
  bone.quaternion.premultiply(
    parentWorldQuaternion.clone().invert().multiply(worldTurn).multiply(parentWorldQuaternion)
  )
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

/**
 * Reset every bone back to its loaded rest transform. A caller that is about to derive a full
 * pose from an external source (a camera capture, a preset) uses this first, so that source
 * ends up driving the whole rig rather than mixing with whatever a handful of bones happened
 * to be left at from an earlier edit.
 * @param bones The rig's bones
 * @param restPoses Every rigged bone's transform as loaded, keyed by name
 * @param excludeBoneNames Bones to leave untouched, kept at whatever transform they already
 *   have. A per-frame caller that only sometimes has a fresh target for one of these (camera
 *   pose capture's root bone, when hip landmarks are occluded for a frame) uses this so that
 *   bone holds its last driven position instead of snapping back to rest every frame it isn't
 *   redriven.
 * @returns Nothing; mutates every non-excluded bone back to its rest transform
 */
export const resetAllBonesToRest = (
  bones: THREE.Bone[],
  restPoses: Map<string, BoneRestPose>,
  excludeBoneNames?: Set<string>
): void => {
  bones.forEach((bone) => {
    if (excludeBoneNames?.has(bone.name)) return
    const rest = restPoses.get(bone.name)
    if (rest) {
      bone.position.copy(rest.position)
      bone.quaternion.copy(rest.quaternion)
    }
  })
}
