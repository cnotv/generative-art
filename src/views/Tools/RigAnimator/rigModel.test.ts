import { describe, it, expect } from 'vitest'
import { isGltfModelUrl, sortBoneNamesForDisplay } from './rigModel'

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
