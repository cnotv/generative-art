import { describe, it, expect, vi } from 'vitest'
import { ref, computed } from 'vue'
import type { PoseKeyframe } from '@webgamekit/rig'
import { useRigFrameRipple } from './useRigFrameRipple'
import type { RigAnimatorConfig } from './types'

const pose = (marker: string) => ({ [marker]: { x: 0, y: 0, z: 0, w: 1 } })

const buildRipple = (keyframes: PoseKeyframe[], frame: number, frameMaxValue: number) => {
  const config = ref({ frame } as RigAnimatorConfig)
  const keyframesReference = ref(keyframes)
  const keyframeFrames = computed(() =>
    keyframesReference.value.map((keyframe) => keyframe.frame).sort((a, b) => a - b)
  )
  const frameMax = ref(frameMaxValue)
  const rebuildPreviewClip = vi.fn()
  const persistAutosave = vi.fn()
  const ripple = useRigFrameRipple({
    config,
    keyframes: keyframesReference,
    keyframeFrames,
    frameMax,
    rebuildPreviewClip,
    persistAutosave
  })
  return { config, keyframesReference, frameMax, rebuildPreviewClip, persistAutosave, ...ripple }
}

describe('useRigFrameRipple', () => {
  describe('removeFrameRange', () => {
    it('cuts the range out, shifts later keyframes left, and shrinks frameMax by the span', () => {
      const {
        keyframesReference,
        frameMax,
        removeFrameRange,
        rebuildPreviewClip,
        persistAutosave
      } = buildRipple(
        [
          { frame: 0, pose: pose('before') },
          { frame: 20, pose: pose('after') }
        ],
        0,
        100
      )

      removeFrameRange(4, 10)

      expect(keyframesReference.value).toEqual([
        { frame: 0, pose: pose('before') },
        { frame: 13, pose: pose('after') }
      ])
      expect(frameMax.value).toBe(93)
      expect(rebuildPreviewClip).toHaveBeenCalledOnce()
      expect(persistAutosave).toHaveBeenCalledOnce()
    })

    it('moves the playhead back by the span when it sat past the removed range', () => {
      const { config, removeFrameRange } = buildRipple([], 50, 100)

      removeFrameRange(4, 10)

      expect(config.value.frame).toBe(43)
    })

    it('lands the playhead on the range start when it sat inside the removed range', () => {
      const { config, removeFrameRange } = buildRipple([], 7, 100)

      removeFrameRange(4, 10)

      expect(config.value.frame).toBe(4)
    })

    it('leaves the playhead untouched when it sat before the removed range', () => {
      const { config, removeFrameRange } = buildRipple([], 2, 100)

      removeFrameRange(4, 10)

      expect(config.value.frame).toBe(2)
    })

    it('does nothing for an empty or inverted range', () => {
      const { keyframesReference, frameMax, removeFrameRange, rebuildPreviewClip } = buildRipple(
        [{ frame: 5, pose: pose('a') }],
        0,
        100
      )
      const before = keyframesReference.value

      removeFrameRange(10, 4)

      expect(keyframesReference.value).toBe(before)
      expect(frameMax.value).toBe(100)
      expect(rebuildPreviewClip).not.toHaveBeenCalled()
    })
  })

  describe('insertFrameRange', () => {
    it('opens up room at the insertion point and grows frameMax by the span', () => {
      const { keyframesReference, frameMax, insertFrameRange } = buildRipple(
        [
          { frame: 0, pose: pose('before') },
          { frame: 5, pose: pose('after') }
        ],
        0,
        100
      )

      insertFrameRange(5, 4)

      expect(keyframesReference.value).toEqual([
        { frame: 0, pose: pose('before') },
        { frame: 9, pose: pose('after') }
      ])
      expect(frameMax.value).toBe(104)
    })

    it('moves the playhead along when it sat at or past the insertion point', () => {
      const { config, insertFrameRange } = buildRipple([], 5, 100)

      insertFrameRange(5, 4)

      expect(config.value.frame).toBe(9)
    })

    it('leaves the playhead untouched when it sat before the insertion point', () => {
      const { config, insertFrameRange } = buildRipple([], 2, 100)

      insertFrameRange(5, 4)

      expect(config.value.frame).toBe(2)
    })

    it('does nothing for a zero or negative span', () => {
      const { keyframesReference, frameMax, insertFrameRange, rebuildPreviewClip } = buildRipple(
        [{ frame: 5, pose: pose('a') }],
        0,
        100
      )
      const before = keyframesReference.value

      insertFrameRange(5, 0)

      expect(keyframesReference.value).toBe(before)
      expect(frameMax.value).toBe(100)
      expect(rebuildPreviewClip).not.toHaveBeenCalled()
    })
  })
})
