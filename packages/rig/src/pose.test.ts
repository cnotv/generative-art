import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import {
  poseCapture,
  poseApply,
  poseBuildClip,
  poseCaptureRootPosition,
  poseApplyPositions
} from './pose'
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

  it('adds no position track when no keyframe carries positions', () => {
    const clip = poseBuildClip(keyframes, ['hip'], 30)
    expect(clip.tracks.some((track) => track.name.endsWith('.position'))).toBe(false)
  })
})

describe('poseCaptureRootPosition', () => {
  it('snapshots only the skeleton root position, keyed by its name', () => {
    const hip = namedBone('hip', [0, 0, 0, 1])
    const knee = namedBone('knee', [0, 0, 0, 1])
    hip.position.set(1, 2, 3)
    knee.position.set(4, 5, 6)
    hip.add(knee)

    const positions = poseCaptureRootPosition([knee, hip])

    expect(positions).toEqual({ hip: { x: 1, y: 2, z: 3 } })
  })

  it('captures nothing for an empty bone list', () => {
    expect(poseCaptureRootPosition([])).toEqual({})
  })
})

describe('poseApplyPositions', () => {
  it('moves a named bone to its captured position and leaves every other bone untouched', () => {
    const hip = namedBone('hip', [0, 0, 0, 1])
    const knee = namedBone('knee', [0, 0, 0, 1])
    knee.position.set(7, 8, 9)

    poseApplyPositions([hip, knee], { hip: { x: 1, y: 2, z: 3 } })

    expect(hip.position.toArray()).toEqual([1, 2, 3])
    expect(knee.position.toArray()).toEqual([7, 8, 9])
  })
})

describe('poseBuildClip with root positions', () => {
  const keyframesWithPositions: PoseKeyframe[] = [
    {
      frame: 30,
      pose: { hip: { x: 0, y: 0, z: 0, w: 1 } },
      positions: { hip: { x: 0, y: 0, z: 2 } }
    },
    {
      frame: 0,
      pose: { hip: { x: 0, y: 0, z: 0, w: 1 } },
      positions: { hip: { x: 0, y: 0, z: 0 } }
    }
  ]

  it('adds a position track after the rotation tracks for a bone whose keyframes carry one', () => {
    const clip = poseBuildClip(keyframesWithPositions, ['hip'], 30)
    expect(clip.tracks.map((track) => track.name)).toEqual(['hip.quaternion', 'hip.position'])
  })

  it('sorts position keyframes by frame and flattens them into consecutive xyz values', () => {
    const clip = poseBuildClip(keyframesWithPositions, ['hip'], 30)
    const positionTrack = clip.tracks.find((track) => track.name === 'hip.position')!
    expect([...positionTrack.times]).toEqual([0, 1])
    expect([...positionTrack.values]).toEqual([0, 0, 0, 0, 0, 2])
  })
})
