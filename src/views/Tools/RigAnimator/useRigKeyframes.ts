import { computed, shallowRef, ref, type Ref, type ShallowRef } from 'vue'
import * as THREE from 'three'
import { poseCapture, type PoseKeyframe } from '@webgamekit/rig'
import { DEFAULT_FRAME_MAX } from './config'
import { clampFrameMax } from './frameRange'
import { moveKeyframesInList } from './keyframeOps'
import { buildPreviewClipMixer } from './previewClip'
import { useRigKeyframeHistory } from './useRigKeyframeHistory'
import { useRigKeyframeIO } from './useRigKeyframeIO'
import { useRigKeyframeClipboard } from './useRigKeyframeClipboard'
import { useRigFrameRipple } from './useRigFrameRipple'
import { useRigPlayback } from './useRigPlayback'
import type { RigAnimatorConfig } from './types'

/** Owns the authored pose keyframes and the preview clip built from them. */
export const useRigKeyframes = (
  config: Ref<RigAnimatorConfig>,
  model: ShallowRef<THREE.Object3D | null>,
  skinnedMesh: ShallowRef<THREE.SkinnedMesh | null>,
  boneNames: Ref<string[]>
) => {
  const keyframes = ref<PoseKeyframe[]>([])
  const mixer = shallowRef<THREE.AnimationMixer | null>(null)
  const action = shallowRef<THREE.AnimationAction | null>(null)
  /** The rig timeline's visible frame range, resized by dragging its right edge. */
  const frameMax = ref(DEFAULT_FRAME_MAX)
  const keyframeFrames = computed(() =>
    keyframes.value.map((keyframe) => keyframe.frame).sort((a, b) => a - b)
  )

  const { persistAutosave, reopenHistory, ...history } = useRigKeyframeHistory({
    config,
    keyframes,
    frameMax,
    rebuildPreviewClip: () => rebuildPreviewClip()
  })

  /** Move the rig timeline's visible frame range without recording it as an action of its own. */
  const applyFrameMax = (nextFrameMax: number): void => {
    frameMax.value = clampFrameMax(nextFrameMax, config.value.frame, keyframeFrames.value)
  }

  /** Drop every keyframe and the clip built from them, for a freshly loaded model. */
  const reset = (): void => {
    keyframes.value = []
    mixer.value = null
    action.value = null
    frameMax.value = DEFAULT_FRAME_MAX
    reopenHistory('Opened')
  }

  /** Resize the rig timeline's visible frame range, see `clampFrameMax`. */
  const setFrameMax = (nextFrameMax: number): void => {
    applyFrameMax(nextFrameMax)
    persistAutosave('Resized timeline')
  }

  /** Rebuild the preview clip from the current keyframes, see `buildPreviewClipMixer`. */
  const rebuildPreviewClip = (): void => {
    const built = buildPreviewClipMixer(
      skinnedMesh.value,
      keyframes.value,
      boneNames.value,
      config.value.fps
    )
    mixer.value = built?.mixer ?? null
    action.value = built?.action ?? null
  }

  /** Push the rig's current pose into the keyframe list, without rebuilding the preview clip
   * or persisting: callers batch both via `commitKeyframes` once a burst of captures ends,
   * rather than paying the rebuild's growing cost on every sampled frame. */
  const captureKeyframeSilently = (bones: THREE.Bone[]): void => {
    if (bones.length === 0) return
    const pose = poseCapture(bones)
    const withoutSameFrame = keyframes.value.filter(
      (keyframe) => keyframe.frame !== config.value.frame
    )
    keyframes.value = [...withoutSameFrame, { frame: config.value.frame, pose }]
  }

  /** Rebuild the preview clip and persist the autosave; the shared tail end of any change to
   * the keyframe list that has to actually show up and survive a refresh.
   * @param label What the change is called in the history log */
  const commitKeyframes = (label: string): void => {
    rebuildPreviewClip()
    persistAutosave(label)
  }

  /** Capture the rig's current pose as a keyframe at the panel's current frame. */
  const addKeyframe = (bones: THREE.Bone[]): void => {
    captureKeyframeSilently(bones)
    commitKeyframes('Added keyframe')
  }

  /** Remove every keyframe in `frames` at once — a single current-frame delete is just a
   * one-frame list, and a multi-select delete is every frame the selection covered. One
   * rebuild and persist for the whole batch rather than one per frame. */
  const deleteKeyframesAt = (frames: number[]): void => {
    if (frames.length === 0) return
    const framesToDelete = new Set(frames)
    keyframes.value = keyframes.value.filter((keyframe) => !framesToDelete.has(keyframe.frame))
    rebuildPreviewClip()
    persistAutosave(frames.length > 1 ? 'Deleted keyframes' : 'Deleted keyframe')
  }

  /** Drag every keyframe in `frames` by the same delta, see `moveKeyframesInList`. A plain
   * single-keyframe drag is just a one-frame list. */
  const moveKeyframesBy = (frames: number[], deltaFrames: number): void => {
    const next = moveKeyframesInList(keyframes.value, frames, deltaFrames)
    if (next === keyframes.value) return
    keyframes.value = next
    rebuildPreviewClip()
    persistAutosave('Moved keyframes')
  }

  const playback = useRigPlayback({ config, mixer, action })

  const io = useRigKeyframeIO({
    config,
    model,
    boneNames,
    keyframes,
    keyframeFrames,
    frameMax,
    applyFrameMax,
    persistAutosave,
    reopenHistory,
    rebuildPreviewClip,
    reset
  })
  const clipboard = useRigKeyframeClipboard({
    config,
    keyframes,
    rebuildPreviewClip,
    persistAutosave
  })
  const frameRipple = useRigFrameRipple({
    config,
    keyframes,
    keyframeFrames,
    frameMax,
    rebuildPreviewClip,
    persistAutosave
  })

  return {
    keyframes,
    keyframeFrames,
    frameMax,
    ...history,
    setFrameMax,
    reset,
    addKeyframe,
    captureKeyframeSilently,
    commitKeyframes,
    deleteKeyframesAt,
    moveKeyframesBy,
    ...playback,
    ...io,
    ...clipboard,
    ...frameRipple
  }
}
