import type { Ref, ShallowRef } from 'vue'
import * as THREE from 'three'
import { poseBuildClip, type PoseKeyframe } from '@webgamekit/rig'
import { exportRigClipAsGlb, exportPosesAsJson, parsePosesJson } from './export'
import { EXPORT_GLB_FILENAME, EXPORT_JSON_FILENAME } from './config'
import { clearRigAutosave, type RigAutosave } from './autosave'
import { loadRigPreset } from './presets'
import type { RigAnimatorConfig } from './types'

interface RigKeyframeIODeps {
  config: Ref<RigAnimatorConfig>
  model: ShallowRef<THREE.Object3D | null>
  boneNames: Ref<string[]>
  keyframes: Ref<PoseKeyframe[]>
  keyframeFrames: Ref<number[]>
  frameMax: Ref<number>
  setFrameMax: (nextFrameMax: number) => void
  rebuildPreviewClip: () => void
  reset: () => void
}

/**
 * Owns every way keyframes enter or leave the tool: GLB/JSON export, JSON import, loading a
 * bundled example animation as a preset, and autosave restore/reset. Split out of
 * `useRigKeyframes` so that composable stays under the line cap and focused on the keyframes
 * themselves rather than their I/O.
 * @param deps The keyframe state and helpers this needs from `useRigKeyframes`
 */
export const useRigKeyframeIO = (deps: RigKeyframeIODeps) => {
  const {
    config,
    model,
    boneNames,
    keyframes,
    keyframeFrames,
    frameMax,
    setFrameMax,
    rebuildPreviewClip,
    reset
  } = deps

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

  /** Adopt an externally-sourced keyframe set, expand the frame range to fit, rebuild the clip. */
  const applyLoadedKeyframes = (nextKeyframes: PoseKeyframe[], nextFps?: number): void => {
    if (nextFps !== undefined) config.value.fps = nextFps
    keyframes.value = nextKeyframes
    setFrameMax(Math.max(frameMax.value, ...keyframeFrames.value))
    rebuildPreviewClip()
  }

  /** Load a previously exported poses file (`url`, a blob URL), replacing the current keyframes. */
  const importJson = async (url: string): Promise<void> => {
    if (!url) return
    const text = await fetch(url).then((response) => response.text())
    const parsed = parsePosesJson(text)
    if (parsed) applyLoadedKeyframes(parsed.keyframes, parsed.fps)
  }

  /** Load a bundled example animation and sample it into keyframes, replacing the current ones. */
  const loadPreset = async (url: string): Promise<void> => {
    const sampled = await loadRigPreset(url, config.value.fps)
    if (sampled.length > 0) applyLoadedKeyframes(sampled)
  }

  /** Restore a previously autosaved edit, rebuilding the preview clip from it. */
  const restoreAutosave = (autosave: RigAutosave): void => {
    config.value.fps = autosave.fps
    keyframes.value = autosave.keyframes
    frameMax.value = autosave.frameMax
    rebuildPreviewClip()
  }

  /** Clear every keyframe and the autosave behind them, back to a blank edit. */
  const resetAutosave = (): void => {
    reset()
    clearRigAutosave()
  }

  return { exportGlb, exportJson, importJson, loadPreset, restoreAutosave, resetAutosave }
}
