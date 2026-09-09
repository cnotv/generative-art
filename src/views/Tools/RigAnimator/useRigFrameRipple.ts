import type { Ref } from 'vue'
import type { PoseKeyframe } from '@webgamekit/rig'
import { clampFrameMax } from './frameRange'
import { removeFrameRangeFromList, insertFrameRangeIntoList } from './keyframeOps'
import type { RigAnimatorConfig } from './types'

interface Dependencies {
  config: Ref<RigAnimatorConfig>
  keyframes: Ref<PoseKeyframe[]>
  keyframeFrames: Ref<number[]>
  frameMax: Ref<number>
  rebuildPreviewClip: () => void
  persistAutosave: () => void
}

/**
 * Owns ripple removing and inserting a frame range — changing the timeline's own length,
 * unlike deleting keyframes which only clears poses and leaves a gap — split out of
 * `useRigKeyframes` to stay under its function-length lint cap.
 */
export const useRigFrameRipple = ({
  config,
  keyframes,
  keyframeFrames,
  frameMax,
  rebuildPreviewClip,
  persistAutosave
}: Dependencies) => {
  /**
   * Cut the selected frame range out of the timeline entirely and shift everything after it
   * left to close the gap, shrinking the timeline's own length by the span removed. The
   * playhead moves back by the same span if it sat past the cut, or lands on the cut's start
   * if it sat inside it.
   */
  const removeFrameRange = (startFrame: number, endFrame: number): void => {
    const span = endFrame - startFrame + 1
    if (span <= 0) return
    keyframes.value = removeFrameRangeFromList(keyframes.value, startFrame, endFrame)
    if (config.value.frame > endFrame) config.value.frame -= span
    else if (config.value.frame >= startFrame) config.value.frame = startFrame
    frameMax.value = clampFrameMax(frameMax.value - span, config.value.frame, keyframeFrames.value)
    rebuildPreviewClip()
    persistAutosave()
  }

  /**
   * Open up blank room the size of the selected frame range at its own start, shifting
   * everything at or after it later and growing the timeline's own length by that much. The
   * playhead moves along with whatever now sits after it if it was at or past the insertion
   * point.
   */
  const insertFrameRange = (atFrame: number, span: number): void => {
    if (span <= 0) return
    keyframes.value = insertFrameRangeIntoList(keyframes.value, atFrame, span)
    if (config.value.frame >= atFrame) config.value.frame += span
    frameMax.value = clampFrameMax(frameMax.value + span, config.value.frame, keyframeFrames.value)
    rebuildPreviewClip()
    persistAutosave()
  }

  return { removeFrameRange, insertFrameRange }
}
