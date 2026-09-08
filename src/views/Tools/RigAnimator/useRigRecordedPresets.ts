import { ref } from 'vue'
import type { PoseKeyframe } from '@webgamekit/rig'

export interface RecordedPreset {
  name: string
  keyframes: PoseKeyframe[]
}

/**
 * Session-only presets built from a finished Record Motion take, offered in the same picker
 * as the bundled mocap presets. Never persisted past a refresh — only the autosave is.
 */
export const useRigRecordedPresets = () => {
  const recordedPresets = ref<RecordedPreset[]>([])

  /** Snapshot the given keyframes as a new selectable preset, named after how many takes this
   * session has recorded so far. */
  const addRecordedPreset = (keyframes: PoseKeyframe[]): void => {
    const name = `Recording ${recordedPresets.value.length + 1}`
    recordedPresets.value = [...recordedPresets.value, { name, keyframes: [...keyframes] }]
  }

  return { recordedPresets, addRecordedPreset }
}
