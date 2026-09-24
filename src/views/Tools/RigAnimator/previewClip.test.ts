import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { buildPreviewClipMixer } from './previewClip'
import { buildMixamoRig } from './fixtures/cameraPoseFixtures'

const skinnedMeshFromRig = (): { mesh: THREE.SkinnedMesh; boneNames: string[] } => {
  const bones = buildMixamoRig()
  const mesh = new THREE.SkinnedMesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial())
  mesh.add(bones[0])
  mesh.bind(new THREE.Skeleton(bones))
  return { mesh, boneNames: bones.map((bone) => bone.name) }
}

const keyframeAt = (frame: number) => ({
  frame,
  pose: { mixamorigHips: { x: 0, y: 0, z: 0, w: 1 } }
})

describe('buildPreviewClipMixer', () => {
  it.each([
    ['there is no mesh to drive', false, [keyframeAt(0), keyframeAt(5)]],
    ['there are no keyframes to play', true, []]
  ])('builds nothing when %s', (_name, withMesh, keyframes) => {
    // Arrange
    const { mesh, boneNames } = skinnedMeshFromRig()

    // Act
    const built = buildPreviewClipMixer(withMesh ? mesh : null, keyframes, boneNames, 24)

    // Assert
    expect(built).toBeNull()
  })

  it('returns a mixer whose action is already playing', () => {
    // Arrange
    const { mesh, boneNames } = skinnedMeshFromRig()

    // Act
    const built = buildPreviewClipMixer(mesh, [keyframeAt(0), keyframeAt(12)], boneNames, 24)

    // Assert
    expect(built?.action.isRunning()).toBe(true)
  })

  it('reads the clip length from the frame rate it was authored at', () => {
    // Arrange
    const { mesh, boneNames } = skinnedMeshFromRig()

    // Act
    const built = buildPreviewClipMixer(mesh, [keyframeAt(0), keyframeAt(12)], boneNames, 24)

    // Assert
    expect(built?.action.getClip().duration).toBeCloseTo(0.5, 3)
  })
})
