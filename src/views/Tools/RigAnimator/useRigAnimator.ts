import type { Ref } from 'vue'
import { useRigModel } from './useRigModel'
import { useRigKeyframes } from './useRigKeyframes'
import type { RigAnimatorConfig } from './types'

/**
 * Composes the rig/model state with the pose-keyframe state for the rig animator tool. Split
 * across two composables so each stays focused: one owns the loaded model and its rig, the
 * other owns the authored keyframes and the clips built from them.
 */
export const useRigAnimator = (config: Ref<RigAnimatorConfig>) => {
  const rigModel = useRigModel(config)
  const rigKeyframes = useRigKeyframes(
    config,
    rigModel.model,
    rigModel.skinnedMesh,
    rigModel.boneNames
  )

  /** Load a model and drop whatever keyframes belonged to the one it replaces. */
  const loadModel = async (url: string): Promise<void> => {
    await rigModel.loadModel(url)
    rigKeyframes.reset()
  }

  /** Capture the rig's current pose as a keyframe at the panel's current frame. */
  const addKeyframe = (): void => rigKeyframes.addKeyframe(rigModel.bones.value)

  return {
    ...rigModel,
    ...rigKeyframes,
    loadModel,
    addKeyframe
  }
}
