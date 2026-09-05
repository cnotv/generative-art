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
 * Apply a canned finger pose to one hand, curling each joint by `angle` around its own local X
 * axis, composed on top of that joint's rest orientation rather than overwriting its Euler X
 * component directly. Those give the same result for a joint whose rest pose carries no twist of
 * its own (true for the four straight fingers on a mixamorig-named rig), but not for the thumb:
 * its CMC and MCP joints rest with a real, substantial tilt on every axis, an anatomical fact of
 * thumb opposition, not an authoring accident, so overwriting just the X component left most of
 * a detected or preset curl reading as barely any visible movement at all. Bones the rig doesn't
 * have, or has no rest quaternion recorded for, are skipped.
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
      bone.quaternion
        .copy(restQuaternion)
        .multiply(new THREE.Quaternion().setFromAxisAngle(FLEXION_AXIS, angle))
    })
  })
}
