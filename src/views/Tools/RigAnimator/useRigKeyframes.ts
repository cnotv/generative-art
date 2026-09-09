import { computed, shallowRef, ref, type Ref, type ShallowRef } from 'vue'
import * as THREE from 'three'
import { poseCapture, poseBuildClip, type PoseKeyframe } from '@webgamekit/rig'
import { DEFAULT_FRAME_MAX } from './config'
import { clampFrameMax } from './frameRange'
import { moveKeyframesInList } from './keyframeOps'
import { saveRigAutosave } from './autosave'
import { useRigKeyframeIO } from './useRigKeyframeIO'
import { useRigKeyframeClipboard } from './useRigKeyframeClipboard'
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

  /**
   * Persist the current edit, called explicitly from every genuine user change (never from
   * `reset` or `restoreAutosave`, so the reset-then-restore that runs on every model load can
   * never win a race and save a transient empty edit over a real one).
   */
  const persistAutosave = (): void => {
    saveRigAutosave({ fps: config.value.fps, frameMax: frameMax.value, keyframes: keyframes.value })
  }

  /** Drop every keyframe and the clip built from them, for a freshly loaded model. */
  const reset = (): void => {
    keyframes.value = []
    mixer.value = null
    action.value = null
    frameMax.value = DEFAULT_FRAME_MAX
  }

  /** Resize the rig timeline's visible frame range, see `clampFrameMax`. */
  const setFrameMax = (nextFrameMax: number): void => {
    frameMax.value = clampFrameMax(nextFrameMax, config.value.frame, keyframeFrames.value)
    persistAutosave()
  }

  /** Rebuild the preview clip from the current keyframes, or drop it when there are none. */
  const rebuildPreviewClip = (): void => {
    if (!skinnedMesh.value || keyframes.value.length === 0) {
      mixer.value = null
      action.value = null
      return
    }
    const clip = poseBuildClip(keyframes.value, boneNames.value, config.value.fps)
    const nextMixer = new THREE.AnimationMixer(skinnedMesh.value)
    const nextAction = nextMixer.clipAction(clip)
    nextAction.play()
    mixer.value = nextMixer
    action.value = nextAction
  }

  /** Push the rig's current pose into the keyframe list, without rebuilding the preview clip
   * or persisting. `rebuildPreviewClip` rebuilds every bone's track from the whole keyframe
   * list, so it costs more the longer the list already is; calling it on every single one of
   * a fast burst of captures (motion recording sampling several times a second) makes each
   * capture slower than the last. Callers batch the rebuild and persist via `commitKeyframes`
   * once the burst ends instead of paying that cost per frame. */
  const captureKeyframeSilently = (bones: THREE.Bone[]): void => {
    if (bones.length === 0) return
    const pose = poseCapture(bones)
    const withoutSameFrame = keyframes.value.filter(
      (keyframe) => keyframe.frame !== config.value.frame
    )
    keyframes.value = [...withoutSameFrame, { frame: config.value.frame, pose }]
  }

  /** Rebuild the preview clip and persist the autosave; the shared tail end of any change to
   * the keyframe list that has to actually show up and survive a refresh. */
  const commitKeyframes = (): void => {
    rebuildPreviewClip()
    persistAutosave()
  }

  /** Capture the rig's current pose as a keyframe at the panel's current frame. */
  const addKeyframe = (bones: THREE.Bone[]): void => {
    captureKeyframeSilently(bones)
    commitKeyframes()
  }

  /** Remove every keyframe in `frames` at once — a single current-frame delete is just a
   * one-frame list, and a multi-select delete is every frame the selection covered. One
   * rebuild and persist for the whole batch rather than one per frame. */
  const deleteKeyframesAt = (frames: number[]): void => {
    if (frames.length === 0) return
    const framesToDelete = new Set(frames)
    keyframes.value = keyframes.value.filter((keyframe) => !framesToDelete.has(keyframe.frame))
    rebuildPreviewClip()
    persistAutosave()
  }

  /** Drag every keyframe in `frames` by the same delta, see `moveKeyframesInList`. A plain
   * single-keyframe drag is just a one-frame list. */
  const moveKeyframesBy = (frames: number[], deltaFrames: number): void => {
    const next = moveKeyframesInList(keyframes.value, frames, deltaFrames)
    if (next === keyframes.value) return
    keyframes.value = next
    rebuildPreviewClip()
    persistAutosave()
  }

  const playback = useRigPlayback({ config, mixer, action })

  const io = useRigKeyframeIO({
    config,
    model,
    boneNames,
    keyframes,
    keyframeFrames,
    frameMax,
    setFrameMax,
    rebuildPreviewClip,
    reset
  })
  const clipboard = useRigKeyframeClipboard({
    config,
    keyframes,
    rebuildPreviewClip,
    persistAutosave
  })

  return {
    keyframes,
    keyframeFrames,
    frameMax,
    setFrameMax,
    reset,
    addKeyframe,
    captureKeyframeSilently,
    commitKeyframes,
    deleteKeyframesAt,
    moveKeyframesBy,
    ...playback,
    ...io,
    ...clipboard
  }
}
