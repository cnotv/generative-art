import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { isGltfModelUrl, resolveHierarchyBones, sortBoneNamesForDisplay } from './rigModel'

describe('resolveHierarchyBones', () => {
  it('swaps a copy hung beneath a same-named bone for the bone that carries the hierarchy', () => {
    // Arrange: the Y Bot shape, a second skeleton's forearm at zero offset under the real one.
    const arm = Object.assign(new THREE.Bone(), { name: 'mixamorigLeftArm' })
    const forearm = Object.assign(new THREE.Bone(), { name: 'mixamorigLeftForeArm' })
    const forearmCopy = Object.assign(new THREE.Bone(), { name: 'mixamorigLeftForeArm' })
    arm.add(forearm)
    forearm.add(forearmCopy)

    // Act
    const resolved = resolveHierarchyBones([arm, forearmCopy])

    // Assert
    expect(resolved).toEqual([arm, forearm])
    expect(resolved[1]).toBe(forearm)
  })
})

describe('isGltfModelUrl', () => {
  it.each([
    ['/character2.fbx', false],
    ['/goomba.glb', true],
    ['/tree.gltf', true],
    // A bare blob URL carries no extension at all, so it falls back to FBX.
    ['blob:http://localhost:5327/00000000-0000-0000-0000-000000000000', false],
    // The real filename tagged on as a fragment, per `loadModelFile`'s own doc comment.
    ['blob:http://localhost:5327/00000000-0000-0000-0000-000000000000#goomba.glb', true],
    ['blob:http://localhost:5327/00000000-0000-0000-0000-000000000000#character2.fbx', false]
  ])('%s resolves to gltf: %s', (url, expected) => {
    expect(isGltfModelUrl(url)).toBe(expected)
  })
})

describe('sortBoneNamesForDisplay', () => {
  it('puts the core skeleton first, in a sensible posing order, however the source scrambled it', () => {
    // The exact scramble a real uploaded model's own skeleton.bones array came back in.
    const scrambled = [
      'mixamorigNeck',
      'mixamorigSpine2',
      'mixamorigSpine1',
      'mixamorigLeftShoulder',
      'mixamorigSpine',
      'mixamorigHips'
    ]
    expect(sortBoneNamesForDisplay(scrambled)).toEqual([
      'mixamorigHips',
      'mixamorigSpine',
      'mixamorigSpine1',
      'mixamorigSpine2',
      'mixamorigNeck',
      'mixamorigLeftShoulder'
    ])
  })

  it('sorts anything outside the canonical skeleton alphabetically after all of it', () => {
    const names = ['mixamorigLeftHandThumb2', 'mixamorigHips', 'mixamorigLeftHandThumb1']
    expect(sortBoneNamesForDisplay(names)).toEqual([
      'mixamorigHips',
      'mixamorigLeftHandThumb1',
      'mixamorigLeftHandThumb2'
    ])
  })

  it('does not mutate the array it was given', () => {
    const names = ['mixamorigNeck', 'mixamorigHips']
    sortBoneNamesForDisplay(names)
    expect(names).toEqual(['mixamorigNeck', 'mixamorigHips'])
  })
})
