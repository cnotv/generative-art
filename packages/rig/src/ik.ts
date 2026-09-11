import * as THREE from 'three'
import type { TwoBoneIkChain } from './types'

const IK_EPSILON = 1e-6

/**
 * Rotate a bone in world space so the direction it currently points turns into the direction
 * it should point, keeping whatever roll the minimal rotation between the two implies. Calling
 * this twice in a row on the same bone, once per reference direction, fully orients it: the
 * second call's minimal rotation is necessarily a pure roll around the first call's now-matched
 * axis, since both the current and desired second direction stay perpendicular to that shared
 * axis by construction. Only safe when "current" and "desired" stay reasonably close together;
 * `setFromUnitVectors`'s minimal-rotation construction is ill-defined right at the antipodal
 * point, and near it picks between two very different rotation axes unpredictably from one call
 * to the next, which reads as the bone flipping rather than turning. A caller whose "current"
 * direction is itself something that moves independently of "desired" (an ancestor's own
 * separately-solved orientation, say) can end up there by surprise; building the target
 * orientation directly, with no dependency on "current" at all, sidesteps the whole class of
 * failure (see `applyHandOrientation` in `handPose.ts` for a case that needed exactly that).
 * @param bone The bone to rotate
 * @param currentWorldDirection The direction the bone points right now, normalized
 * @param desiredWorldDirection The direction the bone should point, normalized
 * @returns Nothing; mutates the bone's local quaternion
 */
export const ikApplyWorldDirectionToBone = (
  bone: THREE.Bone,
  currentWorldDirection: THREE.Vector3,
  desiredWorldDirection: THREE.Vector3
): void => {
  const deltaRotation = new THREE.Quaternion().setFromUnitVectors(
    currentWorldDirection,
    desiredWorldDirection
  )
  const currentWorldQuaternion = bone.getWorldQuaternion(new THREE.Quaternion())
  const desiredWorldQuaternion = deltaRotation.multiply(currentWorldQuaternion)
  const parentWorldQuaternion = bone.parent
    ? bone.parent.getWorldQuaternion(new THREE.Quaternion())
    : new THREE.Quaternion()
  bone.quaternion.copy(parentWorldQuaternion.invert().multiply(desiredWorldQuaternion))
}

/**
 * Twist a bone by `angle` radians around a fixed world-space axis, composed on top of whatever
 * its current world orientation already is, rather than overwriting one raw Euler component of
 * its local rotation directly. Those read the same only when the bone's local rotation has
 * nothing else going on; a bone another solve already aimed for its own reasons (the Rig
 * Animator's torso bone doubles as the head IK chain's own root, so it can carry a real pitch
 * from aiming the head before this ever runs) composes unpredictably with a raw Euler-component
 * overwrite once that existing rotation is not near identity, reading as the bone flipping
 * rather than merely turning further. Composing in world space avoids that: the twist always
 * lands the same way relative to the true world axis, regardless of whatever local rotation the
 * bone already carried in.
 * @param bone The bone to twist
 * @param angle How far to twist, in radians
 * @param worldAxis The axis to twist around, in world space, normalized
 * @returns Nothing; mutates the bone's local quaternion
 */
export const ikTwistAroundWorldAxis = (
  bone: THREE.Bone,
  angle: number,
  worldAxis: THREE.Vector3
): void => {
  const twistQuaternion = new THREE.Quaternion().setFromAxisAngle(worldAxis, angle)
  const currentWorldQuaternion = bone.getWorldQuaternion(new THREE.Quaternion())
  const desiredWorldQuaternion = twistQuaternion.multiply(currentWorldQuaternion)
  const parentWorldQuaternion = bone.parent
    ? bone.parent.getWorldQuaternion(new THREE.Quaternion())
    : new THREE.Quaternion()
  bone.quaternion.copy(parentWorldQuaternion.invert().multiply(desiredWorldQuaternion))
}

/**
 * Find the two-bone chain a bone is the end effector of: its own parent as the mid joint and
 * its grandparent as the root, the shape a shoulder/elbow/hand or hip/knee/foot limb takes in
 * any rig, regardless of bone naming.
 * @param bone The candidate end effector, typically the bone a gizmo is attached to
 * @returns The chain, or null when the bone has fewer than two Bone ancestors to solve with
 */
export const ikFindTwoBoneChain = (bone: THREE.Bone): TwoBoneIkChain | null => {
  const mid = bone.parent instanceof THREE.Bone ? bone.parent : null
  const root = mid && mid.parent instanceof THREE.Bone ? mid.parent : null
  return root && mid ? { root, mid, end: bone } : null
}

/**
 * Solve a two-bone chain analytically so its end effector reaches a world-space target,
 * rotating only the root and mid bones and leaving the end bone's own local transform
 * untouched, exactly like dragging a hand and having the shoulder and elbow bend to follow.
 * Closed-form (law of cosines), so it never iterates or fails to converge: a target beyond
 * the chain's reach clamps to the fully extended limb instead.
 * @param chain The root/mid/end bones to solve, with up-to-date world matrices
 * @param targetWorldPosition Where the end effector should end up, in world space
 * @param poleWorldPosition A hint for which way the mid joint should bend, in world space;
 *   the chain's own current mid-bone position is a reasonable choice, so the bend stays where
 *   it already visually is as the target moves
 * @returns Nothing; mutates the root and mid bones' local quaternions
 */
export const ikSolveTwoBoneChain = (
  chain: TwoBoneIkChain,
  targetWorldPosition: THREE.Vector3,
  poleWorldPosition: THREE.Vector3
): void => {
  const rootWorldPosition = chain.root.getWorldPosition(new THREE.Vector3())
  const midWorldPosition = chain.mid.getWorldPosition(new THREE.Vector3())
  const endWorldPosition = chain.end.getWorldPosition(new THREE.Vector3())

  const upperLength = rootWorldPosition.distanceTo(midWorldPosition)
  const lowerLength = midWorldPosition.distanceTo(endWorldPosition)
  const maxReach = upperLength + lowerLength - IK_EPSILON
  const minReach = Math.abs(upperLength - lowerLength) + IK_EPSILON
  const targetDistance = THREE.MathUtils.clamp(
    rootWorldPosition.distanceTo(targetWorldPosition),
    minReach,
    maxReach
  )
  const forwardDirection = targetWorldPosition.clone().sub(rootWorldPosition).normalize()

  const poleOffset = poleWorldPosition.clone().sub(rootWorldPosition)
  const inPlanePoleOffset = poleOffset
    .clone()
    .sub(forwardDirection.clone().multiplyScalar(poleOffset.dot(forwardDirection)))
  const bendDirection =
    inPlanePoleOffset.lengthSq() < IK_EPSILON
      ? new THREE.Vector3().crossVectors(forwardDirection, new THREE.Vector3(0, 1, 0)).normalize()
      : inPlanePoleOffset.normalize()

  const rootAngle = Math.acos(
    THREE.MathUtils.clamp(
      (upperLength ** 2 + targetDistance ** 2 - lowerLength ** 2) /
        (2 * upperLength * targetDistance),
      -1,
      1
    )
  )
  const upperDirection = forwardDirection
    .clone()
    .multiplyScalar(Math.cos(rootAngle))
    .add(bendDirection.clone().multiplyScalar(Math.sin(rootAngle)))
    .normalize()
  const currentUpperDirection = midWorldPosition.clone().sub(rootWorldPosition).normalize()
  ikApplyWorldDirectionToBone(chain.root, currentUpperDirection, upperDirection)

  const midWorldPositionAfterRoot = chain.mid.getWorldPosition(new THREE.Vector3())
  const endWorldPositionAfterRoot = chain.end.getWorldPosition(new THREE.Vector3())
  const clampedTargetWorldPosition = rootWorldPosition
    .clone()
    .add(forwardDirection.clone().multiplyScalar(targetDistance))
  const desiredLowerDirection = clampedTargetWorldPosition
    .clone()
    .sub(midWorldPositionAfterRoot)
    .normalize()
  const currentLowerDirection = endWorldPositionAfterRoot
    .clone()
    .sub(midWorldPositionAfterRoot)
    .normalize()
  ikApplyWorldDirectionToBone(chain.mid, currentLowerDirection, desiredLowerDirection)
}

/**
 * Walk up from any bone to the topmost bone still in its own skeleton: a rig's hips,
 * conventionally, the joint every other bone's pose is ultimately relative to.
 * @param bone Any bone in the skeleton
 * @returns The topmost ancestor that is still a Bone, or `bone` itself when it already has no
 *   Bone parent
 */
export const ikFindSkeletonRoot = (bone: THREE.Bone): THREE.Bone =>
  bone.parent instanceof THREE.Bone ? ikFindSkeletonRoot(bone.parent) : bone

/**
 * Aim a single bone at a world-space target by rotating its parent, the degenerate one-segment
 * case of the same idea as `ikSolveTwoBoneChain`: only the direction from parent to child
 * changes, never the child's own local offset, so the segment can never stretch or shrink, only
 * point somewhere else. Used for a bone with a Bone parent but no full two-bone chain to solve
 * with (a spine segment, a shoulder root, a thigh whose own parent is the skeleton root).
 * @param parent The bone to rotate
 * @param child The bone being aimed at the target, whose own local transform is never touched
 * @param targetWorldPosition The direction to aim toward, in world space; only its direction
 *   from the parent matters, not its distance
 * @returns Nothing; mutates the parent bone's local quaternion
 */
export const ikSolveOneBoneAim = (
  parent: THREE.Bone,
  child: THREE.Bone,
  targetWorldPosition: THREE.Vector3
): void => {
  const parentWorldPosition = parent.getWorldPosition(new THREE.Vector3())
  const childWorldPosition = child.getWorldPosition(new THREE.Vector3())
  const desiredDirection = targetWorldPosition.clone().sub(parentWorldPosition).normalize()
  const currentDirection = childWorldPosition.clone().sub(parentWorldPosition).normalize()
  ikApplyWorldDirectionToBone(parent, currentDirection, desiredDirection)
}
