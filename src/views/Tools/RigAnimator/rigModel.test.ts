import { describe, it, expect } from 'vitest'
import { isGltfModelUrl } from './rigModel'

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
