import type { Ref } from 'vue'
import { useRigModel } from './useRigModel'
import { useRigKeyframes } from './useRigKeyframes'
import { useRigCameraPose } from './useRigCameraPose'
import { useRigHandPose } from './useRigHandPose'
import type { RigAnimatorConfig } from './types'

/**
 * Composes the rig/model state with the pose-keyframe, camera-pose-capture and hand-pose state
 * for the rig animator tool. Split across composables so each stays focused: one owns the loaded
 * model and its rig, one owns the authored keyframes and the clips built from them, one owns
 * mapping a detected camera pose onto the rig, and one owns applying a canned hand pose.
 */
export const useRigAnimator = (config: Ref<RigAnimatorConfig>) => {
  const rigModel = useRigModel(config)
  const rigKeyframes = useRigKeyframes(
    config,
    rigModel.model,
    rigModel.skinnedMesh,
    rigModel.boneNames
  )
  const rigCameraPose = useRigCameraPose(
    rigModel.bones,
    rigModel.applyBoneDragTarget,
    rigModel.resetAllBonesToRest
  )
  const rigHandPose = useRigHandPose(rigModel.bones, config, rigModel.getRestQuaternions)

  /** Load a model and drop whatever keyframes belonged to the one it replaces. */
  const loadModel = async (url: string): Promise<void> => {
    await rigModel.loadModel(url)
    rigKeyframes.reset()
  }

  /** Capture the rig's current pose as a keyframe at the panel's current frame. */
  const addKeyframe = (): void => rigKeyframes.addKeyframe(rigModel.bones.value)

  /** Capture a keyframe without the rebuild-and-persist cost `addKeyframe` pays every call —
   * see `captureKeyframeSilently`'s own doc comment. For motion recording's per-frame sampling;
   * call `commitRecordedKeyframes` once the burst of captures ends. */
  const captureKeyframeSilently = (): void =>
    rigKeyframes.captureKeyframeSilently(rigModel.bones.value)

  /** Rebuild the preview clip and persist once, after a burst of `captureKeyframeSilently` calls. */
  const commitRecordedKeyframes = (): void => rigKeyframes.commitKeyframes()

  /** Paste the copied pose onto the current frame and apply it to the live rig. */
  const pasteKeyframe = (): void => rigKeyframes.pasteKeyframe(rigModel.bones.value)

  /** Clear every keyframe and the autosave behind them, and snap the live rig back to its rest
   * pose: a blank edit with the rig left wherever the last keyframe or drag happened to leave it
   * would read as though the reset had failed. */
  const resetAutosave = (): void => {
    rigKeyframes.resetAutosave()
    rigModel.resetAllBonesToRest()
  }

  return {
    ...rigModel,
    ...rigKeyframes,
    ...rigCameraPose,
    ...rigHandPose,
    loadModel,
    addKeyframe,
    captureKeyframeSilently,
    commitRecordedKeyframes,
    pasteKeyframe,
    resetAutosave
  }
}
