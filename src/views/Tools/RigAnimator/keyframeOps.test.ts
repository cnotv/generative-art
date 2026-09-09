import { describe, it, expect } from 'vitest'
import type { PoseKeyframe } from '@webgamekit/rig'
import { moveKeyframesInList } from './keyframeOps'

const pose = (marker: string): PoseKeyframe['pose'] => ({
  [marker]: { x: 0, y: 0, z: 0, w: 1 }
})

describe('moveKeyframesInList', () => {
  it('repositions a single dragged keyframe by the given delta, keeping its pose', () => {
    const keyframes: PoseKeyframe[] = [
      { frame: 0, pose: pose('rest') },
      { frame: 10, pose: pose('reach') }
    ]

    const result = moveKeyframesInList(keyframes, [10], 10)

    expect(result).toEqual([
      { frame: 0, pose: pose('rest') },
      { frame: 20, pose: pose('reach') }
    ])
  })

  it('shifts every selected frame by the same delta, preserving their spacing', () => {
    const keyframes: PoseKeyframe[] = [
      { frame: 0, pose: pose('rest') },
      { frame: 5, pose: pose('mid') },
      { frame: 10, pose: pose('reach') }
    ]

    const result = moveKeyframesInList(keyframes, [5, 10], 3)

    expect(result).toEqual([
      { frame: 0, pose: pose('rest') },
      { frame: 8, pose: pose('mid') },
      { frame: 13, pose: pose('reach') }
    ])
  })

  it('overwrites whatever keyframe already sat at a landing frame', () => {
    const keyframes: PoseKeyframe[] = [
      { frame: 5, pose: pose('mid') },
      { frame: 8, pose: pose('stale') }
    ]

    const result = moveKeyframesInList(keyframes, [5], 3)

    expect(result).toEqual([{ frame: 8, pose: pose('mid') }])
  })

  it('returns the same list unchanged for a zero delta or an empty selection', () => {
    const keyframes: PoseKeyframe[] = [{ frame: 5, pose: pose('rest') }]

    expect(moveKeyframesInList(keyframes, [5], 0)).toBe(keyframes)
    expect(moveKeyframesInList(keyframes, [], 3)).toBe(keyframes)
  })

  it('returns the same list unchanged when none of the frames exist', () => {
    const keyframes: PoseKeyframe[] = [{ frame: 5, pose: pose('rest') }]

    expect(moveKeyframesInList(keyframes, [99], 3)).toBe(keyframes)
  })
})
