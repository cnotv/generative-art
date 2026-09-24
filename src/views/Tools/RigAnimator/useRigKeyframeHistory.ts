import type { Ref } from 'vue'
import type { PoseKeyframe } from '@webgamekit/rig'
import { useEditorHistory } from '@/composables/useEditorHistory'
import { saveRigAutosave } from './autosave'
import type { RigAnimatorConfig, RigHistorySnapshot } from './types'

interface RigKeyframeHistoryDeps {
  config: Ref<RigAnimatorConfig>
  keyframes: Ref<PoseKeyframe[]>
  frameMax: Ref<number>
  rebuildPreviewClip: () => void
}

/**
 * The autosave and the undo history behind the keyframe list, which move together: every genuine
 * user change both survives a refresh and becomes one step the user can walk back. Split out of
 * `useRigKeyframes` so that composable stays under the line cap.
 * @param deps The keyframe state and the clip rebuild this needs from `useRigKeyframes`
 */
export const useRigKeyframeHistory = ({
  config,
  keyframes,
  frameMax,
  rebuildPreviewClip
}: RigKeyframeHistoryDeps) => {
  const snapshot = (): RigHistorySnapshot => ({
    keyframes: keyframes.value,
    frameMax: frameMax.value
  })

  const saveAutosave = (): void => {
    saveRigAutosave({ fps: config.value.fps, frameMax: frameMax.value, keyframes: keyframes.value })
  }

  const history = useEditorHistory<RigHistorySnapshot>('Opened', snapshot(), (restored) => {
    keyframes.value = restored.keyframes
    frameMax.value = restored.frameMax
    rebuildPreviewClip()
    saveAutosave()
  })

  return {
    canUndo: history.canUndo,
    canRedo: history.canRedo,
    historyLog: history.log,
    undoKeyframeEdit: history.undo,
    redoKeyframeEdit: history.redo,
    goToKeyframeEdit: history.goTo,
    /**
     * Persist the current edit and record it as one undoable action, called explicitly from every
     * genuine user change (never from `reset` or `restoreAutosave`, so the reset-then-restore that
     * runs on every model load can never win a race and save a transient empty edit over a real
     * one).
     * @param label What the action is called in the history log
     */
    persistAutosave: (label: string): void => {
      saveAutosave()
      history.record(label, snapshot())
    },
    /**
     * Start the history over on whatever is loaded now. A model or an autosave arriving is not an
     * action to undo: stepping back past it would put the previous model's keyframes onto bones
     * that no longer exist.
     * @param label What to call the state the editor now opens in
     */
    reopenHistory: (label: string): void => {
      history.reopen(label, snapshot())
    }
  }
}
