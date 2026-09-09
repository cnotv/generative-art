import { describe, it, expect, vi } from 'vitest'
import { ref } from 'vue'
import * as THREE from 'three'
import type { PoseKeyframe } from '@webgamekit/rig'
import { useRigKeyframeClipboard } from './useRigKeyframeClipboard'
import type { RigAnimatorConfig } from './types'

const pose = (marker: string) => ({ [marker]: { x: 0, y: 0, z: 0, w: 1 } })

const buildClipboard = (keyframes: PoseKeyframe[], frame = 0) => {
  const config = ref({ frame } as RigAnimatorConfig)
  const keyframesReference = ref(keyframes)
  const rebuildPreviewClip = vi.fn()
  const persistAutosave = vi.fn()
  const clipboard = useRigKeyframeClipboard({
    config,
    keyframes: keyframesReference,
    rebuildPreviewClip,
    persistAutosave
  })
  return { config, keyframesReference, rebuildPreviewClip, persistAutosave, ...clipboard }
}

describe('useRigKeyframeClipboard', () => {
  it('has no clipboard until something is copied', () => {
    const { hasClipboard } = buildClipboard([{ frame: 0, pose: pose('rest') }])

    expect(hasClipboard.value).toBe(false)
  })

  it('copies a single frame and pastes it at the current frame', () => {
    const { config, keyframesReference, copyKeyframes, pasteKeyframes, hasClipboard } =
      buildClipboard([{ frame: 5, pose: pose('reach') }])

    copyKeyframes([5])
    expect(hasClipboard.value).toBe(true)

    config.value.frame = 20
    pasteKeyframes([])

    expect(keyframesReference.value).toContainEqual({ frame: 20, pose: pose('reach') })
  })

  it('copies a multi-frame block relative to its earliest frame, preserving spacing on paste', () => {
    const { config, keyframesReference, copyKeyframes, pasteKeyframes } = buildClipboard([
      { frame: 4, pose: pose('a') },
      { frame: 6, pose: pose('b') },
      { frame: 10, pose: pose('c') }
    ])

    copyKeyframes([4, 6, 10])
    config.value.frame = 100
    pasteKeyframes([])

    expect(keyframesReference.value).toEqual(
      expect.arrayContaining([
        { frame: 100, pose: pose('a') },
        { frame: 102, pose: pose('b') },
        { frame: 106, pose: pose('c') }
      ])
    )
  })

  it('skips frames with no keyframe of their own when copying', () => {
    const { hasClipboard, copyKeyframes } = buildClipboard([{ frame: 4, pose: pose('a') }])

    copyKeyframes([4, 5])

    expect(hasClipboard.value).toBe(true)
  })

  it('does nothing when pasting with an empty clipboard', () => {
    const { keyframesReference, pasteKeyframes } = buildClipboard([{ frame: 4, pose: pose('a') }])
    const before = keyframesReference.value

    pasteKeyframes([])

    expect(keyframesReference.value).toBe(before)
  })

  it('overwrites whatever keyframe already sat at a pasted-onto frame', () => {
    const { config, keyframesReference, copyKeyframes, pasteKeyframes } = buildClipboard([
      { frame: 0, pose: pose('copied') },
      { frame: 20, pose: pose('stale') }
    ])

    copyKeyframes([0])
    config.value.frame = 20
    pasteKeyframes([])

    expect(keyframesReference.value).toEqual(
      expect.arrayContaining([{ frame: 20, pose: pose('copied') }])
    )
    expect(keyframesReference.value.find((keyframe) => keyframe.frame === 20)).toEqual({
      frame: 20,
      pose: pose('copied')
    })
  })

  it('applies the pasted pose landing on the current frame to the live rig bones', () => {
    const bone = new THREE.Bone()
    bone.name = 'root'
    const { config, copyKeyframes, pasteKeyframes } = buildClipboard([
      { frame: 0, pose: { root: { x: 1, y: 0, z: 0, w: 0 } } }
    ])

    copyKeyframes([0])
    config.value.frame = 10
    pasteKeyframes([bone])

    expect(bone.quaternion.x).toBe(1)
  })
})
