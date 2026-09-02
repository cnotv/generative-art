import { computed, shallowRef, ref, type Ref, type ShallowRef } from 'vue'
import * as THREE from 'three'
import { poseCapture, poseBuildClip, type PoseKeyframe } from '@webgamekit/animation'
import { exportRigClipAsGlb, exportPosesAsJson, parsePosesJson } from './export'
import { EXPORT_GLB_FILENAME, EXPORT_JSON_FILENAME } from './config'
import type { RigAnimatorConfig } from './types'

/** Owns the authored pose keyframes and the preview/export clips built from them. */
export const useRigKeyframes = (
  config: Ref<RigAnimatorConfig>,
  model: ShallowRef<THREE.Object3D | null>,
  skinnedMesh: ShallowRef<THREE.SkinnedMesh | null>,
  boneNames: Ref<string[]>
) => {
  const keyframes = ref<PoseKeyframe[]>([])
  const isPlaying = ref(false)
  const mixer = shallowRef<THREE.AnimationMixer | null>(null)
  const action = shallowRef<THREE.AnimationAction | null>(null)
  const clock = new THREE.Clock()

  const keyframeFrames = computed(() =>
    keyframes.value.map((keyframe) => keyframe.frame).sort((a, b) => a - b)
  )

  /** Drop every keyframe and the clip built from them, for a freshly loaded model. */
  const reset = (): void => {
    keyframes.value = []
    mixer.value = null
    action.value = null
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

  /** Scrub the preview to a given frame without advancing playback. */
  const scrubToFrame = (frame: number): void => {
    if (mixer.value) mixer.value.setTime(frame / config.value.fps)
  }

  /** Capture the rig's current pose as a keyframe at the panel's current frame. */
  const addKeyframe = (bones: THREE.Bone[]): void => {
    if (bones.length === 0) return
    const pose = poseCapture(bones)
    const withoutSameFrame = keyframes.value.filter(
      (keyframe) => keyframe.frame !== config.value.frame
    )
    keyframes.value = [...withoutSameFrame, { frame: config.value.frame, pose }]
    rebuildPreviewClip()
  }

  /** Remove the keyframe at the panel's current frame, if one exists there. */
  const deleteKeyframe = (): void => {
    keyframes.value = keyframes.value.filter((keyframe) => keyframe.frame !== config.value.frame)
    rebuildPreviewClip()
  }

  /** Start or stop real-time playback of the preview clip. */
  const togglePlayback = (): void => {
    isPlaying.value = !isPlaying.value
    if (isPlaying.value) clock.start()
  }

  /** Advance playback by one frame tick; a no-op while paused or with nothing to play. */
  const tickPlayback = (): void => {
    if (!isPlaying.value || !mixer.value || !action.value) return
    const delta = clock.getDelta()
    mixer.value.update(delta)
    const clipDuration = action.value.getClip().duration
    config.value.frame =
      clipDuration > 0 ? Math.round((mixer.value.time % clipDuration) * config.value.fps) : 0
  }

  /** Export the model with the authored clip baked in as a standalone .glb. */
  const exportGlb = async (): Promise<void> => {
    if (!model.value || keyframes.value.length === 0) return
    const clip = poseBuildClip(keyframes.value, boneNames.value, config.value.fps, 'RigAnimation')
    await exportRigClipAsGlb(model.value, clip, EXPORT_GLB_FILENAME)
  }

  /** Export the raw pose keyframes as JSON, for re-editing later in this same tool. */
  const exportJson = (): void => {
    exportPosesAsJson(keyframes.value, config.value.fps, EXPORT_JSON_FILENAME)
  }

  /**
   * Load a previously exported poses file, replacing the current keyframes.
   * @param url The blob URL the file input produced
   */
  const importJson = async (url: string): Promise<void> => {
    if (!url) return
    const text = await fetch(url).then((response) => response.text())
    const parsed = parsePosesJson(text)
    if (!parsed) return
    config.value.fps = parsed.fps
    keyframes.value = parsed.keyframes
    rebuildPreviewClip()
  }

  return {
    keyframes,
    keyframeFrames,
    isPlaying,
    reset,
    addKeyframe,
    deleteKeyframe,
    scrubToFrame,
    togglePlayback,
    tickPlayback,
    exportGlb,
    exportJson,
    importJson
  }
}
