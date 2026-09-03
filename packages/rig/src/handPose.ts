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

/**
 * Apply a canned finger pose to one hand, curling each joint around its local X axis (the
 * flexion axis for both hands on a mixamorig-named rig). Bones the rig doesn't have are skipped.
 * @param bones The rig's bones
 * @param side Which hand the preset applies to
 * @param preset The per-finger joint angles to apply
 */
export const applyHandPose = (
  bones: THREE.Bone[],
  side: HandSide,
  preset: HandPoseDefinition
): void => {
  FINGERS.forEach(({ key, boneName }) => {
    preset[key].forEach((angle, jointIndex) => {
      const bone = bones.find(
        (candidate) => candidate.name === `mixamorig${side}Hand${boneName}${jointIndex + 1}`
      )
      if (bone) bone.rotation.x = angle
    })
  })
}
