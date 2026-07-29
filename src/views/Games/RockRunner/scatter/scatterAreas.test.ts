import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { createScatterAreaManager, scatterChunkSpan, groupInstancesByTexture } from './scatterAreas'
import { createLateralFogUniforms } from '../lateralFog'
import { createTrackPath } from '../trackPath'
import { SCATTER_AREAS } from './illustrations'
import type { ScatterAreaConfig, ScatterAreaDefinition, ScatterInstance } from '../types'
import {
  SCATTER_BEHIND,
  SCATTER_CHUNK_LENGTH,
  SCATTER_DISPOSE_BEHIND,
  SCATTER_LOOKAHEAD
} from '../config'

const EXPECTED_CHUNKS = Math.ceil((SCATTER_LOOKAHEAD + SCATTER_BEHIND) / SCATTER_CHUNK_LENGTH)

const treeDefinition = SCATTER_AREAS.find((area) => area.name === 'tree') as ScatterAreaDefinition

const config: ScatterAreaConfig = {
  center: [0, 0, 0],
  variation: [0, 0, 50],
  baseSize: [14, 22, 1],
  sizeVariation: 0.05,
  rotationVariation: 0.035,
  frequency: 20,
  distanceMin: 14,
  distanceMax: 90,
  heightOffset: 0,
  seed: 1234,
  opacity: 1
}

const instance = (textureIndex: number): ScatterInstance => ({
  distance: 0,
  lateral: 0,
  position: new THREE.Vector3(),
  yaw: 0,
  width: 1,
  height: 1,
  textureIndex
})

const createManager = (overrides: Partial<ScatterAreaConfig> = {}) => {
  const scene = new THREE.Scene()
  const path = createTrackPath(11)
  const manager = createScatterAreaManager({
    scene,
    path,
    definition: treeDefinition,
    lateralFog: createLateralFogUniforms(0xffffff, 20, 40),
    getConfig: () => ({ ...config, ...overrides }),
    getTextures: () => treeDefinition.textures
  })
  return { scene, manager }
}

const scatterMeshes = (scene: THREE.Scene): THREE.InstancedMesh[] =>
  scene.children.filter(
    (child): child is THREE.InstancedMesh => child instanceof THREE.InstancedMesh
  )

describe('scatterChunkSpan', () => {
  it('gives every area the same streaming window', () => {
    const span = scatterChunkSpan()

    expect(span.lookahead).toBe(SCATTER_LOOKAHEAD)
    expect(span.chunkLength).toBe(SCATTER_CHUNK_LENGTH)
    expect(span.behind).toBe(SCATTER_BEHIND)
  })
})

describe('groupInstancesByTexture', () => {
  it('buckets instances by their texture', () => {
    const buckets = groupInstancesByTexture([instance(0), instance(1), instance(0)])

    expect(buckets.get(0)).toHaveLength(2)
    expect(buckets.get(1)).toHaveLength(1)
  })

  it('omits textures nothing drew', () => {
    const buckets = groupInstancesByTexture([instance(2), instance(2)])

    expect([...buckets.keys()]).toEqual([2])
  })

  it('returns nothing for no instances', () => {
    expect(groupInstancesByTexture([]).size).toBe(0)
  })
})

describe('createScatterAreaManager', () => {
  // Ground built ahead already carries the illustrations for the stretch it
  // belongs to, so nothing standing is swapped out from under the player.
  it('stages each chunk from its own distance rather than the rock position', () => {
    const scene = new THREE.Scene()
    const asked: number[] = []
    const manager = createScatterAreaManager({
      scene,
      path: createTrackPath(11),
      definition: treeDefinition,
      lateralFog: createLateralFogUniforms(0xffffff, 20, 40),
      getConfig: () => config,
      getTextures: (distance) => {
        asked.push(distance)
        return treeDefinition.textures
      }
    })

    manager.ensureAhead(0)

    expect(asked.length).toBeGreaterThan(1)
    expect(new Set(asked).size).toBe(asked.length)
    expect(Math.max(...asked)).toBeGreaterThan(Math.min(...asked))
  })

  it('builds one instanced mesh per texture per chunk, not one mesh per billboard', () => {
    const { manager, scene } = createManager()

    manager.ensureAhead(0)

    const meshes = scatterMeshes(scene)
    expect(meshes).toHaveLength(EXPECTED_CHUNKS)
    expect(meshes.every((mesh) => mesh.count > 1)).toBe(true)
  })

  // Each mesh needs its own geometry: the per-instance offsets live on it, so a
  // shared plane would have every chunk overwrite the last one's.
  it('bakes each billboard own distance from the centreline', () => {
    const { manager, scene } = createManager()

    manager.ensureAhead(0)

    const meshes = scatterMeshes(scene)
    meshes.forEach((mesh) => {
      const offsets = mesh.geometry.getAttribute('lateralOffset')
      expect(offsets).toBeDefined()
      expect(offsets.count).toBe(mesh.count)
    })
    const geometries = new Set(meshes.map((mesh) => mesh.geometry))
    expect(geometries.size).toBe(meshes.length)
  })

  it('gives the billboards no physics body at all', () => {
    const { manager, scene } = createManager()

    manager.ensureAhead(0)

    scatterMeshes(scene).forEach((mesh) => expect(mesh.userData.body).toBeUndefined())
  })

  it('disables frustum culling so path-placed chunks never pop out', () => {
    const { manager, scene } = createManager()

    manager.ensureAhead(0)

    expect(scatterMeshes(scene).every((mesh) => mesh.frustumCulled === false)).toBe(true)
  })

  it('extends as the rock advances', () => {
    const { manager, scene } = createManager()
    manager.ensureAhead(0)
    const before = scatterMeshes(scene).length

    manager.ensureAhead(SCATTER_CHUNK_LENGTH * 5)

    expect(scatterMeshes(scene).length).toBeGreaterThan(before)
  })

  it('disposes chunks left behind', () => {
    const { manager, scene } = createManager()
    manager.ensureAhead(0)
    const before = scatterMeshes(scene).length

    manager.prune(SCATTER_DISPOSE_BEHIND + SCATTER_CHUNK_LENGTH * 3)

    expect(scatterMeshes(scene).length).toBeLessThan(before)
  })

  it('keeps chunks still within the window', () => {
    const { manager, scene } = createManager()
    manager.ensureAhead(0)
    const before = scatterMeshes(scene).length

    manager.prune(0)

    expect(scatterMeshes(scene).length).toBe(before)
  })

  it('reports how many billboards are live', () => {
    const { manager } = createManager()

    manager.ensureAhead(0)

    expect(manager.instanceCount()).toBeGreaterThan(0)
  })

  it('hides and shows every live chunk', () => {
    const { manager, scene } = createManager()
    manager.ensureAhead(0)

    manager.setHidden(true)
    expect(scatterMeshes(scene).every((mesh) => !mesh.visible)).toBe(true)

    manager.setHidden(false)
    expect(scatterMeshes(scene).every((mesh) => mesh.visible)).toBe(true)
  })

  it('applies the hidden state to chunks spawned afterwards', () => {
    const { manager, scene } = createManager()
    manager.setHidden(true)

    manager.ensureAhead(0)

    expect(scatterMeshes(scene).every((mesh) => !mesh.visible)).toBe(true)
  })

  it('rebuilds from scratch when a property changes', () => {
    const { manager, scene } = createManager()
    manager.ensureAhead(0)
    const before = manager.instanceCount()

    manager.rebuild(0)

    expect(scatterMeshes(scene).length).toBeGreaterThan(0)
    expect(manager.instanceCount()).toBe(before)
  })

  it('places nothing when the frequency is zero', () => {
    const { manager, scene } = createManager({ frequency: 0 })

    manager.ensureAhead(0)

    expect(scatterMeshes(scene)).toHaveLength(0)
    expect(manager.instanceCount()).toBe(0)
  })

  it('clears the scene on teardown', () => {
    const { manager, scene } = createManager()
    manager.ensureAhead(0)

    manager.teardown()

    expect(scene.children).toHaveLength(0)
  })
})
