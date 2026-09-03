import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { sampleClipAsPoseKeyframes } from './presets'

const buildClip = (): THREE.AnimationClip => {
  const hipsTrack = new THREE.QuaternionKeyframeTrack(
    'hips.quaternion',
    [0, 1, 2],
    [0, 0, 0, 1, 0, 0, 0.7071, 0.7071, 0, 0, 0, 1]
  )
  const positionTrack = new THREE.VectorKeyframeTrack('hips.position', [0, 2], [0, 0, 0, 1, 0, 0])
  return new THREE.AnimationClip('walk', 2, [hipsTrack, positionTrack])
}

describe('sampleClipAsPoseKeyframes', () => {
  it('samples only the quaternion tracks, keyed by bone name', () => {
    const keyframes = sampleClipAsPoseKeyframes(buildClip(), 30)

    expect(
      keyframes.every((keyframe) => Object.keys(keyframe.pose).every((name) => name === 'hips'))
    ).toBe(true)
  })

  it('produces frames in non-decreasing order across the clip’s duration', () => {
    const keyframes = sampleClipAsPoseKeyframes(buildClip(), 30)

    const frames = keyframes.map((keyframe) => keyframe.frame)
    expect(frames).toEqual([...frames].sort((a, b) => a - b))
    expect(frames[0]).toBe(0)
    expect(frames[frames.length - 1]).toBe(Math.round(2 * 30))
  })

  it('produces a fixed number of samples regardless of clip length', () => {
    const keyframes = sampleClipAsPoseKeyframes(buildClip(), 30)

    expect(keyframes.length).toBeGreaterThan(1)
    expect(new Set(keyframes.map((keyframe) => keyframe.frame)).size).toBeGreaterThan(1)
  })
})
