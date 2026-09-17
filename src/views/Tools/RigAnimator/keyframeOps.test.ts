import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import type { PoseKeyframe } from '@webgamekit/rig'
import {
  filterRecordedSamples,
  replaceKeyframesInRange,
  moveKeyframesInList,
  removeFrameRangeFromList,
  insertFrameRangeIntoList,
  mergeSampledKeyframesIntoScope
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

describe('mergeSampledKeyframesIntoScope', () => {
  const bothBonesPose = (): PoseKeyframe['pose'] => ({
    ...pose('leftArm'),
    ...pose('leftLeg')
  })

  it('leaves keyframes and bones outside the scope completely untouched', () => {
    const existing: PoseKeyframe[] = [{ frame: 5, pose: bothBonesPose() }]
    const sampled: PoseKeyframe[] = [{ frame: 0, pose: pose('leftArm') }]

    const result = mergeSampledKeyframesIntoScope(existing, sampled, new Set(['rightArm']))

    expect(result).toEqual(existing)
  })

  it('adds the sampled source at its own frame when nothing already covers that bone there', () => {
    const existing: PoseKeyframe[] = [{ frame: 5, pose: pose('leftLeg') }]
    const sampled: PoseKeyframe[] = [{ frame: 0, pose: pose('leftArm') }]

    const result = mergeSampledKeyframesIntoScope(existing, sampled, new Set(['leftArm']))

    expect(result).toEqual([
      { frame: 5, pose: pose('leftLeg') },
      { frame: 0, pose: pose('leftArm') }
    ])
  })

  it('replaces only the in-scope bone at a frame shared with an out-of-scope bone', () => {
    const existing: PoseKeyframe[] = [{ frame: 5, pose: bothBonesPose() }]
    const sampled: PoseKeyframe[] = [{ frame: 5, pose: { leftArm: { x: 1, y: 0, z: 0, w: 0 } } }]

    const result = mergeSampledKeyframesIntoScope(existing, sampled, new Set(['leftArm']))

    expect(result).toEqual([
      {
        frame: 5,
        pose: { leftLeg: { x: 0, y: 0, z: 0, w: 1 }, leftArm: { x: 1, y: 0, z: 0, w: 0 } }
      }
    ])
  })

  it('drops an existing keyframe left with no bones once its in-scope bone is stripped', () => {
    const existing: PoseKeyframe[] = [
      { frame: 5, pose: pose('leftArm') },
      { frame: 8, pose: pose('leftLeg') }
    ]
    const sampled: PoseKeyframe[] = []

    const result = mergeSampledKeyframesIntoScope(existing, sampled, new Set(['leftArm']))

    expect(result).toEqual([{ frame: 8, pose: pose('leftLeg') }])
  })

  it('degenerates to a full replace when every bone is in scope, the same as loading a preset today', () => {
    const existing: PoseKeyframe[] = [
      { frame: 5, pose: pose('leftArm') },
      { frame: 40, pose: pose('leftLeg') }
    ]
    const sampled: PoseKeyframe[] = [
      { frame: 0, pose: pose('leftArm') },
      { frame: 12, pose: pose('leftLeg') }
    ]

    const result = mergeSampledKeyframesIntoScope(
      existing,
      sampled,
      new Set(['leftArm', 'leftLeg'])
    )

    expect(result).toEqual(sampled)
  })

  it('re-shooting the same group a second time replaces its earlier contribution entirely', () => {
    const firstShoot = mergeSampledKeyframesIntoScope(
      [],
      [{ frame: 0, pose: pose('leftArm') }],
      new Set(['leftArm'])
    )
    const reshoot = mergeSampledKeyframesIntoScope(
      firstShoot,
      [{ frame: 3, pose: { leftArm: { x: 1, y: 0, z: 0, w: 0 } } }],
      new Set(['leftArm'])
    )

    expect(reshoot).toEqual([{ frame: 3, pose: { leftArm: { x: 1, y: 0, z: 0, w: 0 } } }])
  })
})

describe('replaceKeyframesInRange', () => {
  it('swaps only the keyframes inside the range, both ends included', () => {
    // Arrange
    const pose = { mixamorigHips: { x: 0, y: 0, z: 0, w: 1 } }
    const keyframes = [0, 2, 3, 5, 8].map((frame) => ({ frame, pose }))
    const replacements = [{ frame: 4, pose }]

    // Act
    const result = replaceKeyframesInRange(keyframes, 2, 5, replacements)

    // Assert
    expect(result.map(({ frame }) => frame).sort((a, b) => a - b)).toEqual([0, 4, 8])
  })
})

describe('filterRecordedSamples', () => {
  const turned = (degrees: number) => {
    const { x, y, z, w } = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 1, 0),
      THREE.MathUtils.degToRad(degrees)
    )
    return { mixamorigHips: { x, y, z, w } }
  }
  const angleOf = (keyframe: PoseKeyframe): number => {
    const { x, y, z, w } = keyframe.pose.mixamorigHips
    return THREE.MathUtils.radToDeg(
      new THREE.Quaternion(x, y, z, w).angleTo(new THREE.Quaternion())
    )
  }

  it('keeps one keyframe per whole frame from samples taken twice a frame', () => {
    // Arrange
    const samples = [0, 0.5, 1, 1.5, 2].map((frame) => ({ frame, pose: turned(10 * frame) }))

    // Act
    const keyframes = filterRecordedSamples(samples)

    // Assert
    expect(keyframes.map(({ frame }) => frame)).toEqual([0, 1, 2])
  })

  it('drops a single misread sample outvoted by the samples either side of it', () => {
    // Arrange: frame 1 itself read turned half round, its half-frame neighbours agree on 10°.
    const samples = [
      { frame: 0.5, pose: turned(10) },
      { frame: 1, pose: turned(180) },
      { frame: 1.5, pose: turned(12) }
    ]

    // Act
    const [, frameOne] = filterRecordedSamples(samples)

    // Assert
    expect(frameOne.frame).toBe(1)
    expect(angleOf(frameOne)).toBeLessThan(15)
  })

  it('meets two samples halfway when there are too few to outvote either', () => {
    // Arrange
    const samples = [
      { frame: 0, pose: turned(0) },
      { frame: 0.5, pose: turned(20) }
    ]

    // Act
    const [frameZero] = filterRecordedSamples(samples)

    // Assert
    expect(angleOf(frameZero)).toBeCloseTo(10)
  })
})
