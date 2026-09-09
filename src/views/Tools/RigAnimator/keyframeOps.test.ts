import { describe, it, expect } from 'vitest'
import type { PoseKeyframe } from '@webgamekit/rig'
import {
  moveKeyframesInList,
  removeFrameRangeFromList,
  insertFrameRangeIntoList
} from './keyframeOps'

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

describe('removeFrameRangeFromList', () => {
  it('drops every keyframe inside the range and shifts everything after it left by the span', () => {
    const keyframes: PoseKeyframe[] = [
      { frame: 0, pose: pose('before') },
      { frame: 5, pose: pose('inside') },
      { frame: 8, pose: pose('inside2') },
      { frame: 20, pose: pose('after') }
    ]

    const result = removeFrameRangeFromList(keyframes, 4, 10)

    expect(result).toEqual([
      { frame: 0, pose: pose('before') },
      { frame: 13, pose: pose('after') }
    ])
  })

  it('leaves keyframes before the range untouched', () => {
    const keyframes: PoseKeyframe[] = [{ frame: 2, pose: pose('before') }]

    expect(removeFrameRangeFromList(keyframes, 4, 10)).toEqual(keyframes)
  })

  it('returns the same list unchanged for an empty or inverted range', () => {
    const keyframes: PoseKeyframe[] = [{ frame: 5, pose: pose('rest') }]

    expect(removeFrameRangeFromList(keyframes, 5, 4)).toBe(keyframes)
  })
})

describe('insertFrameRangeIntoList', () => {
  it('shifts every keyframe at or after the insertion point later by the span', () => {
    const keyframes: PoseKeyframe[] = [
      { frame: 0, pose: pose('before') },
      { frame: 5, pose: pose('at') },
      { frame: 8, pose: pose('after') }
    ]

    const result = insertFrameRangeIntoList(keyframes, 5, 4)

    expect(result).toEqual([
      { frame: 0, pose: pose('before') },
      { frame: 9, pose: pose('at') },
      { frame: 12, pose: pose('after') }
    ])
  })

  it('leaves keyframes before the insertion point untouched', () => {
    const keyframes: PoseKeyframe[] = [{ frame: 2, pose: pose('before') }]

    expect(insertFrameRangeIntoList(keyframes, 5, 4)).toEqual(keyframes)
  })

  it('returns the same list unchanged for a zero or negative span', () => {
    const keyframes: PoseKeyframe[] = [{ frame: 5, pose: pose('rest') }]

    expect(insertFrameRangeIntoList(keyframes, 5, 0)).toBe(keyframes)
    expect(insertFrameRangeIntoList(keyframes, 5, -1)).toBe(keyframes)
  })
})
