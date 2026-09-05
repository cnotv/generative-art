import { computed, type Ref } from 'vue'
import type * as THREE from 'three'
import {
  applyHandPose,
  resolveHandSide,
  handPoseRequiredBoneNames,
  HAND_POSE_PRESETS
} from '@webgamekit/rig'
import type { RigAnimatorConfig } from './types'

/**
 * Owns applying a canned finger pose to whichever hand the panel's selected bone belongs to,
 * split out of `useRigModel` to stay under its function-length lint cap.
 * @param getRestQuaternions Every bone's rest-pose local quaternion, from `useRigModel`, so the
 *   preset's curl composes on top of each joint's own rest tilt rather than overwriting it
 */
export const useRigHandPose = (
  bones: Ref<THREE.Bone[]>,
  config: Ref<RigAnimatorConfig>,
  getRestQuaternions: () => Map<string, THREE.Quaternion>
) => {
  const selectedHandSide = computed(() => resolveHandSide(config.value.selectedBone))

  const canApplyHandPose = computed(() => {
    const side = selectedHandSide.value
    if (!side) return false
    const requiredNames = handPoseRequiredBoneNames(side)
    return requiredNames.every((name) => bones.value.some((bone) => bone.name === name))
  })

  /** Apply a preset by its display name (a `HAND_POSE_PRESETS` key) to the selected hand. */
  const applyHandPosePreset = (presetName: string): void => {
    const side = selectedHandSide.value
    const preset = HAND_POSE_PRESETS[presetName]
    if (!side || !preset) return
    applyHandPose(bones.value, side, preset, getRestQuaternions())
  }

  return { canApplyHandPose, applyHandPosePreset }
}
