import { describe, it, expect, beforeEach, vi } from 'vitest'
import * as THREE from 'three'
import {
  assetsLoad,
  assetsRelease,
  assetsReleaseAll,
  assetsIsCached,
  assetsPreload,
  assetsParserKind,
  assetsOnProgress
} from './assets'
import { assetsLoadingManager } from './loaders'
import { disposeObject } from './dispose'

const makeObject = (): THREE.Object3D => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial())
  const group = new THREE.Group()
  group.add(mesh)
  return group
}

describe('assetsLoad', () => {
  beforeEach(() => {
    assetsReleaseAll()
  })

  it('parses a url once however many times it is requested', async () => {
    const parse = vi.fn(async () => makeObject())

    await assetsLoad('models/tree.glb', parse)
    await assetsLoad('models/tree.glb', parse)
    await assetsLoad('models/tree.glb', parse)

    expect(parse).toHaveBeenCalledTimes(1)
  })

  it('deduplicates requests that overlap in flight', async () => {
    // Two views mounting in the same frame must not race into two downloads.
    const parse = vi.fn(
      () => new Promise<THREE.Object3D>((resolve) => setTimeout(() => resolve(makeObject()), 10))
    )

    await Promise.all([
      assetsLoad('models/tree.glb', parse),
      assetsLoad('models/tree.glb', parse),
      assetsLoad('models/tree.glb', parse)
    ])

    expect(parse).toHaveBeenCalledTimes(1)
  })

  it('hands every caller the same source object', async () => {
    // Cloning is the caller's concern; the cache is about paying once.
    const parse = async () => makeObject()

    const first = await assetsLoad('models/tree.glb', parse)
    const second = await assetsLoad('models/tree.glb', parse)

    expect(second).toBe(first)
  })

  it('does not cache a failure, so a retry can still succeed', async () => {
    // A cached rejection would make one flaky network response permanent.
    const parse = vi
      .fn()
      .mockRejectedValueOnce(new Error('network died'))
      .mockResolvedValueOnce(makeObject())

    await expect(assetsLoad('models/tree.glb', parse)).rejects.toThrow('models/tree.glb')
    const recovered = await assetsLoad('models/tree.glb', parse)

    expect(recovered).toBeDefined()
    expect(parse).toHaveBeenCalledTimes(2)
  })

  it('names the failing url in the rejection', async () => {
    const parse = async () => {
      throw new Error('404')
    }

    await expect(assetsLoad('models/missing.glb', parse)).rejects.toThrow('models/missing.glb')
  })
})

describe('assetsRelease', () => {
  beforeEach(() => {
    assetsReleaseAll()
  })

  it('keeps the asset while another consumer still holds it', async () => {
    const parse = vi.fn(async () => makeObject())
    await assetsLoad('models/tree.glb', parse)
    await assetsLoad('models/tree.glb', parse)

    assetsRelease('models/tree.glb')

    expect(assetsIsCached('models/tree.glb')).toBe(true)
  })

  it('drops the asset once the last consumer releases it', async () => {
    const parse = vi.fn(async () => makeObject())
    await assetsLoad('models/tree.glb', parse)
    await assetsLoad('models/tree.glb', parse)

    assetsRelease('models/tree.glb')
    assetsRelease('models/tree.glb')

    expect(assetsIsCached('models/tree.glb')).toBe(false)
  })

  it('disposes the geometry and material of a dropped object', async () => {
    const object = makeObject()
    const mesh = object.children[0] as THREE.Mesh
    const disposeGeometry = vi.spyOn(mesh.geometry, 'dispose')
    const disposeMaterial = vi.spyOn(mesh.material as THREE.Material, 'dispose')
    await assetsLoad('models/tree.glb', async () => object)

    assetsRelease('models/tree.glb')

    expect(disposeGeometry).toHaveBeenCalled()
    expect(disposeMaterial).toHaveBeenCalled()
  })

  it('disposes a dropped texture', async () => {
    const texture = new THREE.Texture()
    const dispose = vi.spyOn(texture, 'dispose')
    await assetsLoad('textures/wood.png', async () => texture)

    assetsRelease('textures/wood.png')

    expect(dispose).toHaveBeenCalled()
  })

  it('reloads after the last release', async () => {
    const parse = vi.fn(async () => makeObject())
    await assetsLoad('models/tree.glb', parse)

    assetsRelease('models/tree.glb')
    await assetsLoad('models/tree.glb', parse)

    expect(parse).toHaveBeenCalledTimes(2)
  })

  it.each([
    { scenario: 'a url that was never loaded', url: 'models/never.glb' },
    { scenario: 'a url already released to zero', url: 'models/tree.glb' }
  ])('is a no-op for $scenario', async ({ url }) => {
    const parse = async () => makeObject()
    await assetsLoad('models/tree.glb', parse)
    assetsRelease('models/tree.glb')

    expect(() => assetsRelease(url)).not.toThrow()
  })
})

describe('shared resources survive a scene tearing itself down', () => {
  beforeEach(() => {
    assetsReleaseAll()
  })

  it('does not free the cached geometry when a consumer disposes its own copy', async () => {
    // Views call disposeScene on unmount. Copies share geometry with the cached source, so
    // an unmounting view must not leave the next one with a disposed model.
    const source = makeObject()
    const sourceMesh = source.children[0] as THREE.Mesh
    const disposeGeometry = vi.spyOn(sourceMesh.geometry, 'dispose')
    await assetsLoad('models/tree.glb', async () => source)

    const copy = source.clone()
    disposeObject(copy)

    expect(disposeGeometry).not.toHaveBeenCalled()
  })

  it('does not free a shared texture when a consumer disposes its own material', async () => {
    const source = makeObject()
    const sourceMesh = source.children[0] as THREE.Mesh
    const texture = new THREE.Texture()
    ;(sourceMesh.material as THREE.MeshBasicMaterial).map = texture
    const disposeTexture = vi.spyOn(texture, 'dispose')
    await assetsLoad('models/tree.glb', async () => source)

    const copy = source.clone()
    disposeObject(copy)

    expect(disposeTexture).not.toHaveBeenCalled()
  })

  it('frees the geometry once the cache itself releases it', async () => {
    const source = makeObject()
    const sourceMesh = source.children[0] as THREE.Mesh
    const disposeGeometry = vi.spyOn(sourceMesh.geometry, 'dispose')
    await assetsLoad('models/tree.glb', async () => source)

    disposeObject(source.clone())
    assetsRelease('models/tree.glb')

    expect(disposeGeometry).toHaveBeenCalled()
  })
})

describe('assetsPreload', () => {
  beforeEach(() => {
    assetsReleaseAll()
  })

  it('resolves once every declared asset is ready', async () => {
    const parse = vi.fn(async () => makeObject())

    await assetsPreload(['models/a.glb', 'models/b.glb'], parse)

    expect(assetsIsCached('models/a.glb')).toBe(true)
    expect(assetsIsCached('models/b.glb')).toBe(true)
  })

  it('does not refetch an asset that is already cached', async () => {
    const parse = vi.fn(async () => makeObject())
    await assetsLoad('models/a.glb', parse)

    await assetsPreload(['models/a.glb'], parse)

    expect(parse).toHaveBeenCalledTimes(1)
  })

  it('rejects naming the asset that failed', async () => {
    const parse = vi.fn(async (url: string) => {
      if (url === 'models/broken.glb') throw new Error('bad file')
      return makeObject()
    })

    await expect(assetsPreload(['models/a.glb', 'models/broken.glb'], parse)).rejects.toThrow(
      'models/broken.glb'
    )
  })
})

describe('assetsParserKind', () => {
  it.each([
    { path: 'models/tree.glb', expected: 'gltf' },
    { path: 'models/tree.gltf', expected: 'gltf' },
    { path: 'models/walk.fbx', expected: 'fbx' },
    { path: 'textures/wood.png', expected: 'texture' },
    { path: 'textures/wood.jpg', expected: 'texture' },
    { path: 'textures/wood.webp', expected: 'texture' },
    { path: 'models/TREE.GLB', expected: 'gltf' }
  ])('reads $path as $expected', ({ path, expected }) => {
    expect(assetsParserKind(path)).toBe(expected)
  })

  it('rejects an extension it cannot load rather than guessing', () => {
    expect(() => assetsParserKind('data/level.json')).toThrow('data/level.json')
  })
})

describe('assetsOnProgress', () => {
  it('reports progress as a fraction of the queue', () => {
    const listener = vi.fn()
    const unsubscribe = assetsOnProgress(listener)

    assetsLoadingManager.onProgress?.('models/tree.glb', 1, 4)

    expect(listener).toHaveBeenCalledWith({
      url: 'models/tree.glb',
      loaded: 1,
      total: 4,
      fraction: 0.25
    })
    unsubscribe()
  })

  it('stops reporting once unsubscribed', () => {
    const listener = vi.fn()
    const unsubscribe = assetsOnProgress(listener)

    unsubscribe()
    assetsLoadingManager.onProgress?.('models/tree.glb', 1, 4)

    expect(listener).not.toHaveBeenCalled()
  })

  it('treats an empty queue as complete rather than dividing by zero', () => {
    const listener = vi.fn()
    const unsubscribe = assetsOnProgress(listener)

    assetsLoadingManager.onProgress?.('models/tree.glb', 0, 0)

    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ fraction: 1, loaded: 0, total: 0 })
    )
    unsubscribe()
  })
})
