import * as THREE from 'three'
import type { HandPoseDefinition, HandSide } from './types'

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
