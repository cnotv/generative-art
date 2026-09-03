import { describe, it, expect } from 'vitest'
import type { PoseKeyframe } from '@webgamekit/rig'
import { moveKeyframeInList } from './keyframeOps'

const pose = (marker: string): PoseKeyframe['pose'] => ({
  [marker]: { x: 0, y: 0, z: 0, w: 1 }
})

describe('moveKeyframeInList', () => {
  it('repositions the keyframe at oldFrame to newFrame, keeping its pose', () => {
    const keyframes: PoseKeyframe[] = [
      { frame: 0, pose: pose('rest') },
      { frame: 10, pose: pose('reach') }
    ]

    const result = moveKeyframeInList(keyframes, 10, 20)

    expect(result).toEqual([
      { frame: 0, pose: pose('rest') },
      { frame: 20, pose: pose('reach') }
    ])
  })

  it('overwrites whatever keyframe already sat at the target frame', () => {
    const keyframes: PoseKeyframe[] = [
      { frame: 0, pose: pose('rest') },
      { frame: 10, pose: pose('reach') },
      { frame: 20, pose: pose('stale') }
    ]

    const result = moveKeyframeInList(keyframes, 10, 20)

    expect(result).toEqual([
      { frame: 0, pose: pose('rest') },
      { frame: 20, pose: pose('reach') }
    ])
  })

  it('returns the same list unchanged when oldFrame equals newFrame', () => {
    const keyframes: PoseKeyframe[] = [{ frame: 5, pose: pose('rest') }]

    expect(moveKeyframeInList(keyframes, 5, 5)).toBe(keyframes)
  })

  it('returns the same list unchanged when there is nothing at oldFrame', () => {
    const keyframes: PoseKeyframe[] = [{ frame: 5, pose: pose('rest') }]

    expect(moveKeyframeInList(keyframes, 99, 10)).toBe(keyframes)
  })
})
