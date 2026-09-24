import * as THREE from 'three'

const FULL_TURN = 2 * Math.PI
/** Every bone of a Mixamo rig runs along its own local +y, so a roll is a turn about that axis. */
export const BONE_LENGTH_AXIS = new THREE.Vector3(0, 1, 0)

/**
 * The same angle, moved by whole turns until it sits as close to `reference` as it can. A roll
 * read off two directions only ever comes back within half a turn of zero, so a limb rolling
 * steadily past that point reads as jumping to the opposite sign; measured against where the
 * roll already was, the reading carries on instead.
 * @param angle The angle as it was read, in radians
 * @param reference The angle to keep it near, in radians
 * @returns The equivalent angle nearest the reference
 */
export const angleNearReference = (angle: number, reference: number): number => {
  const difference = angle - reference
  return reference + difference - FULL_TURN * Math.round(difference / FULL_TURN)
}

/**
 * Split a rotation into its turn about `unitAxis`, as a signed angle, and the swing left over, so
 * that `swing * twist` rebuilds it.
 * @param rotation The rotation to split
 * @param unitAxis The axis to measure the turn about, normalized
 * @returns The swing, and the turn about the axis in radians
 */
export const splitSwingTwist = (
  rotation: THREE.Quaternion,
  unitAxis: THREE.Vector3
): { swing: THREE.Quaternion; twistAngle: number } => {
  // The same rotation has two quaternions; the one with w >= 0 keeps the angle within half a turn.
  const hemisphere = rotation.w < 0 ? -1 : 1
  const along = new THREE.Vector3(rotation.x, rotation.y, rotation.z).dot(unitAxis) * hemisphere
  const twistAngle = 2 * Math.atan2(along, rotation.w * hemisphere)
  const twist = new THREE.Quaternion().setFromAxisAngle(unitAxis, twistAngle)
  return { swing: rotation.clone().multiply(twist.invert()), twistAngle }
}

/**
 * Whether one rotation reaches another almost entirely by rolling the bone about its own length,
 * far enough that it has turned over. That is what a flipped twist cue leaves behind, and what
 * tells it apart from a limb genuinely swinging hard: a swing turns the bone somewhere else,
 * a flip only spins it in place.
 * @param from The rotation before
 * @param to The rotation after
 * @param flipRadians How far a roll must turn, and a swing must stay under, to count
 * @returns Whether the change is a roll that flipped over
 */
export const isBoneRollFlip = (
  from: THREE.Quaternion,
  to: THREE.Quaternion,
  flipRadians: number
): boolean => {
  const change = to.clone().multiply(from.clone().invert())
  const { swing, twistAngle } = splitSwingTwist(change, BONE_LENGTH_AXIS)
  const swingAngle = 2 * Math.acos(Math.min(1, Math.abs(swing.w)))
  return Math.abs(angleNearReference(twistAngle, 0)) > flipRadians && swingAngle < flipRadians
}
