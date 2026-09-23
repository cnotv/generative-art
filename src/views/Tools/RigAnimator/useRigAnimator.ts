import type { Ref } from 'vue'
import { useRigModel } from './useRigModel'
import { useRigKeyframes } from './useRigKeyframes'
import { useRigCameraPose } from './useRigCameraPose'
import { useRigHandPose } from './useRigHandPose'
import { useRigRecordedPresets } from './useRigRecordedPresets'
import { useRigPhysics } from './useRigPhysics'
import { poseCapture, type Pose, type PoseKeyframe } from '@webgamekit/rig'
import { boneNamesInGroups, type RigBodyPartGroup } from './bodyPartGroups'
import {
  filterKeyframesInList,
  reduceKeyframesInList,
  replaceKeyframesInRange
} from './keyframeOps'
import type { RigAnimatorConfig } from './types'

/** Composes the rig/model, keyframe, camera-pose-capture, hand-pose and physics state for the
 * rig animator tool, each split into its own focused composable. */
export const useRigAnimator = (config: Ref<RigAnimatorConfig>) => {
  const rigModel = useRigModel(config)
  const rigKeyframes = useRigKeyframes(
    config,
    rigModel.model,
    rigModel.skinnedMesh,
    rigModel.boneNames
  )
  const rigCameraPose = useRigCameraPose(rigModel.bones, rigModel.resetAllBonesToRest)
  const rigHandPose = useRigHandPose(rigModel.bones, config, rigModel.getRestQuaternions)
  const recordedPresets = useRigRecordedPresets()
  const rigPhysics = useRigPhysics(config, rigModel.bones, rigModel.model)

  /** Point both the renderer's scene and the physics world at the same scene. */
  const setScene = (scene: Parameters<typeof rigModel.setScene>[0]): void => {
    rigModel.setScene(scene)
    rigPhysics.setPhysicsScene(scene)
  }

  /** Load a model and drop whatever keyframes and bodies belonged to the one it replaces. */
  const loadModel = async (url: string): Promise<void> => {
    rigPhysics.clearPhysics()
    await rigModel.loadModel(url)
    rigKeyframes.reset()
    rigPhysics.rebuildPhysics()
  }

  /** Capture the rig's current pose as a keyframe at the panel's current frame. */
  const addKeyframe = (): void => rigKeyframes.addKeyframe(rigModel.bones.value)

  /** Capture a keyframe without the rebuild-and-persist cost `addKeyframe` pays every call —
   * see `captureKeyframeSilently`'s own doc comment. For motion recording's per-frame sampling;
   * call `commitRecordedKeyframes` once the burst of captures ends. */
  const captureKeyframeSilently = (): void =>
    rigKeyframes.captureKeyframeSilently(rigModel.bones.value)

  /** The rig's current pose, for motion recording's in-between samples. */
  const capturePose = (): Pose => poseCapture(rigModel.bones.value)

  /** Swap a finished take's live keyframes for its filtered ones, before they are committed. */
  const replaceRecordedTake = (
    fromFrame: number,
    toFrame: number,
    keyframes: PoseKeyframe[]
  ): void => {
    rigKeyframes.keyframes.value = replaceKeyframesInRange(
      rigKeyframes.keyframes.value,
      fromFrame,
      toFrame,
      keyframes
    )
  }

  /** Swap in an edited keyframe list, then rebuild, persist and show the pose at the playhead.
   * @param keyframes The edited list
   * @param label What the edit is called in the history log */
  const commitEditedKeyframes = (keyframes: PoseKeyframe[], label: string): void => {
    if (keyframes === rigKeyframes.keyframes.value) return
    rigKeyframes.keyframes.value = keyframes
    rigKeyframes.commitKeyframes(label)
    rigKeyframes.scrubToFrame(config.value.frame)
  }

  /** Smooth the keyframes at `frames` one pass further, see `filterKeyframesInList`. */
  const filterKeyframes = (frames: number[]): void =>
    commitEditedKeyframes(
      filterKeyframesInList(rigKeyframes.keyframes.value, frames),
      'Polished keyframes'
    )

  /** Halve the keyframes at `frames`, see `reduceKeyframesInList`. */
  const reduceKeyframes = (frames: number[]): void =>
    commitEditedKeyframes(
      reduceKeyframesInList(rigKeyframes.keyframes.value, frames),
      'Halved keyframes'
    )

  /** Rebuild the preview clip and persist once, after a burst of `captureKeyframeSilently` calls. */
  const commitRecordedKeyframes = (): void => rigKeyframes.commitKeyframes('Recorded motion')

  /** Paste the copied pose(s) onto the current frame and apply the landing one to the live rig. */
  const pasteKeyframes = (): void => rigKeyframes.pasteKeyframes(rigModel.bones.value)

  /** Load a bundled example animation, merged into `targetGroups` (see `mergeKeyframes`). */
  const loadPreset = (url: string, targetGroups: Set<RigBodyPartGroup>): Promise<void> =>
    rigKeyframes.loadPreset(url, boneNamesInGroups(rigModel.bones.value, targetGroups))

  /** Load a session recording back onto the timeline, merged into `targetGroups` the same way
   * a bundled preset is. */
  const applyRecordedPreset = (index: number, targetGroups: Set<RigBodyPartGroup>): void => {
    const preset = recordedPresets.recordedPresets.value[index]
    if (preset) {
      rigKeyframes.mergeKeyframes(
        preset.keyframes,
        boneNamesInGroups(rigModel.bones.value, targetGroups)
      )
    }
  }

  /** Clear every keyframe and the autosave behind them, and snap the live rig back to its rest
   * pose: a blank edit with the rig left wherever the last keyframe or drag happened to leave it
   * would read as though the reset had failed. The playhead goes back to frame 0 too, since a
   * blank timeline with the playhead still parked wherever it was reads the same way. */
  const resetAutosave = (): void => {
    rigKeyframes.resetAutosave()
    rigModel.resetAllBonesToRest()
    config.value.frame = 0
  }

  return {
    ...rigModel,
    ...rigKeyframes,
    ...rigCameraPose,
    ...rigHandPose,
    ...recordedPresets,
    ...rigPhysics,
    setScene,
    loadModel,
    addKeyframe,
    captureKeyframeSilently,
    capturePose,
    replaceRecordedTake,
    filterKeyframes,
    reduceKeyframes,
    commitRecordedKeyframes,
    pasteKeyframes,
    resetAutosave,
    loadPreset,
    applyRecordedPreset
  }
}
