import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { poseCapture, poseApply, poseBuildClip } from './pose'
import type { PoseKeyframe } from './types'

const namedBone = (name: string, quaternion: [number, number, number, number]): THREE.Bone => {
  const bone = new THREE.Bone()
  bone.name = name
  bone.quaternion.set(...quaternion)
  return bone
}

describe('poseCapture', () => {
  it('snapshots every bone quaternion keyed by name', () => {
    const bones = [namedBone('hip', [0, 0, 0, 1]), namedBone('knee', [0.1, 0, 0, 0.995])]
    const pose = poseCapture(bones)
    expect(pose).toEqual({
      hip: { x: 0, y: 0, z: 0, w: 1 },
      knee: { x: 0.1, y: 0, z: 0, w: 0.995 }
    })
  })
})

describe('poseApply', () => {
  it('rotates a bone to match its named pose entry', () => {
    const bones = [namedBone('hip', [0, 0, 0, 1])]
    poseApply(bones, { hip: { x: 0.2, y: 0, z: 0, w: 0.98 } })
    expect(bones[0].quaternion.x).toBeCloseTo(0.2)
  })

  it('leaves a bone untouched when the pose has no entry for it', () => {
    const bones = [namedBone('hip', [0.5, 0, 0, 0.866])]
    poseApply(bones, {})
    expect(bones[0].quaternion.x).toBeCloseTo(0.5)
  })
})

describe('poseBuildClip', () => {
  const keyframes: PoseKeyframe[] = [
    { frame: 30, pose: { hip: { x: 0.1, y: 0, z: 0, w: 0.995 } } },
    { frame: 0, pose: { hip: { x: 0, y: 0, z: 0, w: 1 } } }
  ]

  it('builds one track per bone that appears in a keyframe', () => {
    const clip = poseBuildClip(keyframes, ['hip'], 30)
    expect(clip.tracks).toHaveLength(1)
    expect(clip.tracks[0].name).toBe('hip.quaternion')
  })

  it('sorts keyframes by frame before converting to clip time', () => {
    const clip = poseBuildClip(keyframes, ['hip'], 30)
    expect([...clip.tracks[0].times]).toEqual([0, 1])
  })

  it('flattens each keyframe pose into consecutive quaternion values', () => {
    const clip = poseBuildClip(keyframes, ['hip'], 30)
    const values = [...clip.tracks[0].values]
    ;[0, 0, 0, 1, 0.1, 0, 0, 0.995].forEach((expected, index) => {
      expect(values[index]).toBeCloseTo(expected)
    })
  })

  it('skips bones that no keyframe ever posed', () => {
    const clip = poseBuildClip(keyframes, ['hip', 'unposed'], 30)
    expect(clip.tracks.map((track) => track.name)).toEqual(['hip.quaternion'])
  })
})
