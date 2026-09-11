import * as THREE from 'three'
import type { HandOrientation, HandPoseDefinition, HandSide } from './types'

const FINGERS: { key: keyof HandPoseDefinition; boneName: string }[] = [
  { key: 'thumb', boneName: 'Thumb' },
  { key: 'index', boneName: 'Index' },
  { key: 'middle', boneName: 'Middle' },
  { key: 'ring', boneName: 'Ring' },
  { key: 'pinky', boneName: 'Pinky' }
]

/**
 * Every finger bone name a hand pose preset needs for one side, so a caller can check a rig has
 * them all before offering a preset.
 * @param side Which hand to name bones for
 * @returns The 15 mixamorig-named finger bone names for that hand
 */
export const handPoseRequiredBoneNames = (side: HandSide): string[] =>
  FINGERS.flatMap(({ boneName }) =>
    [1, 2, 3].map((joint) => `mixamorig${side}Hand${boneName}${joint}`)
  )

/**
 * Resolve which hand a bone belongs to from its name, matching the hand bone itself or any of
 * its finger descendants.
 * @param boneName The bone name to test
 * @returns The side, or null when the name isn't a mixamorig hand bone
 */
export const resolveHandSide = (boneName: string): HandSide | null => {
  if (boneName.startsWith('mixamorigLeftHand')) return 'Left'
  if (boneName.startsWith('mixamorigRightHand')) return 'Right'
  return null
}

/** The flexion axis every finger joint curls around, in that joint's own local (rest) frame. */
const FLEXION_AXIS = new THREE.Vector3(1, 0, 0)

/**
 * The thumb's own first joint, unlike its other two and every other finger's own first joint,
 * rests with a real anatomical tilt on every axis rather than the near-identity rest every
 * other joint has (confirmed against a real mixamorig-named rig's own rest pose: this joint
 * rests at roughly 0.30/0.20/0.58 radians on x/y/z, its own other two joints at roughly
 * -0.06/0/0 and -0.04/0/0, matching the straight fingers). Composing a positive flexion angle
 * on top of that particular tilt curls the thumb away from the palm instead of into it,
 * confirmed by tracking the thumb tip's own distance from the palm center before and after
 * applying a curl; only this one joint needs its angle negated to curl the right way.
 */
const THUMB_CMC_JOINT_INDEX = 0

/**
 * Apply a canned finger pose to one hand, curling each joint by `angle` around its own local X
 * axis, composed on top of that joint's rest orientation rather than overwriting its Euler X
 * component directly. Those give the same result for a joint whose rest pose carries no twist of
 * its own (true for the four straight fingers, and the thumb's own other two joints, on a
 * mixamorig-named rig), but not for the thumb's own first joint: see
 * `THUMB_CMC_JOINT_INDEX`'s own doc comment for why it alone needs its angle negated. Bones the
 * rig doesn't have, or has no rest quaternion recorded for, are skipped.
 * @param bones The rig's bones
 * @param side Which hand the preset applies to
 * @param preset The per-finger joint angles to apply
 * @param restQuaternions Every finger bone's rest-pose local quaternion, keyed by name
 */
export const applyHandPose = (
  bones: THREE.Bone[],
  side: HandSide,
  preset: HandPoseDefinition,
  restQuaternions: Map<string, THREE.Quaternion>
): void => {
  FINGERS.forEach(({ key, boneName }) => {
    preset[key].forEach((angle, jointIndex) => {
      const name = `mixamorig${side}Hand${boneName}${jointIndex + 1}`
      const bone = bones.find((candidate) => candidate.name === name)
      const restQuaternion = restQuaternions.get(name)
      if (!bone || !restQuaternion) return
      const signedAngle =
        boneName === 'Thumb' && jointIndex === THUMB_CMC_JOINT_INDEX ? -angle : angle
      bone.quaternion
        .copy(restQuaternion)
        .multiply(new THREE.Quaternion().setFromAxisAngle(FLEXION_AXIS, signedAngle))
    })
  })
}

/**
 * The rotation that carries the standard basis onto the three given orthonormal axes (its own
 * columns), as a quaternion: applying it to (1,0,0) gives `xAxis`, to (0,1,0) gives `yAxis`, to
 * (0,0,1) gives `zAxis`.
 */
const basisQuaternion = (
  xAxis: THREE.Vector3,
  yAxis: THREE.Vector3,
  zAxis: THREE.Vector3
): THREE.Quaternion =>
  new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis))

/**
 * Turn a hand bone to face the way a detected hand does. Builds the bone's full target world
 * orientation directly from two independent detected directions (along the fingers, across the
 * knuckle row, plus their cross product for the third axis) and the same two directions read
 * from the rig's own rest pose, rather than a minimal rotation from wherever the bone currently
 * points: the arm's own position solve leaves the hand pointing almost anywhere depending on
 * where its target happens to be, occasionally close enough to the opposite of the detected
 * orientation to make a from-current alignment flip unpredictably between two possible rotation
 * axes, a known degenerate case for that construction. Building the target directly has no such
 * case, since it never depends on where the bone was already pointing.
 *
 * Requires the middle, index and pinky first finger bones, direct children of the hand bone, to
 * read the rig's own rest-local along/across directions from; a rig with no finger bones (the
 * auto-rig heuristic's own generated skeleton never has any) is left untouched.
 * @param bones The rig's bones, with up-to-date world matrices
 * @param side Which hand to orient
 * @param orientation The detected hand's own along/across directions, in world space
 */
export const applyHandOrientation = (
  bones: THREE.Bone[],
  side: HandSide,
  orientation: HandOrientation
): void => {
  const findBone = (name: string): THREE.Bone | undefined =>
    bones.find((candidate) => candidate.name === name)
  const hand = findBone(`mixamorig${side}Hand`)
  const middle1 = findBone(`mixamorig${side}HandMiddle1`)
  const index1 = findBone(`mixamorig${side}HandIndex1`)
  const pinky1 = findBone(`mixamorig${side}HandPinky1`)
  if (!hand || !middle1 || !index1 || !pinky1) return

  // middle1, index1 and pinky1 are direct children of the hand bone, so their own rest-pose
  // local positions already give these directions in the hand's own local space, with no world
  // transform (and so no dependency on the hand's current orientation) involved at all.
  const localAlong = middle1.position.clone().normalize()
  const localAcross = pinky1.position.clone().sub(index1.position).normalize()
  // along × across, not along/normal/across: that order keeps (x, y, z) right-handed, which
  // `setFromRotationMatrix` requires — the other order is a reflection, not a rotation, and
  // decomposing one to a quaternion silently produces a meaningless result.
  const localNormal = new THREE.Vector3().crossVectors(localAlong, localAcross).normalize()
  const localBasisQuaternion = basisQuaternion(localAlong, localAcross, localNormal)

  const worldAlong = orientation.along.clone().normalize()
  const worldAcross = orientation.across.clone().normalize()
  const worldNormal = new THREE.Vector3().crossVectors(worldAlong, worldAcross).normalize()
  const worldBasisQuaternion = basisQuaternion(worldAlong, worldAcross, worldNormal)

  const parentWorldQuaternion = hand.parent
    ? hand.parent.getWorldQuaternion(new THREE.Quaternion())
    : new THREE.Quaternion()
  const desiredWorldQuaternion = worldBasisQuaternion.multiply(localBasisQuaternion.invert())
  hand.quaternion.copy(parentWorldQuaternion.invert().multiply(desiredWorldQuaternion))
}
