import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as THREE from 'three'
import { prefabSpawnOptions, prefabDespawn } from './prefabs'
import type { ComplexModel, Prefab } from './types'

const treePrefab: Prefab = {
  name: 'tree',
  model: 'models/tree.glb',
  options: { scale: [2, 2, 2], castShadow: true, type: 'fixed' },
  parameters: { health: 40, choppable: true }
}

describe('prefabSpawnOptions', () => {
  it('carries the prefab name so the elements panel has something to show', () => {
    const options = prefabSpawnOptions(treePrefab)

    expect(options.name).toBe('tree')
  })

  it('keeps the options the prefab declared', () => {
    const options = prefabSpawnOptions(treePrefab)

    expect(options.scale).toEqual([2, 2, 2])
    expect(options.castShadow).toBe(true)
    expect(options.type).toBe('fixed')
  })

  it.each([
    { scenario: 'position', overrides: { position: [5, 0, 5] as [number, number, number] } },
    { scenario: 'body type', overrides: { type: 'dynamic' as const } },
    { scenario: 'scale', overrides: { scale: [1, 1, 1] as [number, number, number] } }
  ])('lets a spawn override the declared $scenario', ({ overrides }) => {
    const options = prefabSpawnOptions(treePrefab, overrides)

    Object.entries(overrides).forEach(([key, value]) => {
      expect(options[key as keyof typeof options]).toEqual(value)
    })
  })

  it('does not mutate the prefab, so the next spawn is unaffected', () => {
    prefabSpawnOptions(treePrefab, { scale: [9, 9, 9] })

    expect(treePrefab.options?.scale).toEqual([2, 2, 2])
  })

  it('gives a prefab with no options a usable set anyway', () => {
    const options = prefabSpawnOptions({ name: 'rock', model: 'models/rock.glb' })

    expect(options.name).toBe('rock')
  })
})

describe('prefabDespawn', () => {
  const makeInstance = (): {
    scene: THREE.Scene
    world: { removeRigidBody: ReturnType<typeof vi.fn> }
    instance: ComplexModel
    helper: THREE.BoxHelper
  } => {
    const scene = new THREE.Scene()
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial())
    const helper = new THREE.BoxHelper(mesh)
    scene.add(mesh)
    scene.add(helper)
    const instance = Object.assign(mesh, {
      userData: { body: { handle: 1 }, collider: {}, helper }
    }) as unknown as ComplexModel
    return { scene, world: { removeRigidBody: vi.fn() }, instance, helper }
  }

  let fixture: ReturnType<typeof makeInstance>

  beforeEach(() => {
    fixture = makeInstance()
  })

  it('takes the mesh out of the scene', () => {
    prefabDespawn(fixture.scene, fixture.world as never, fixture.instance)

    expect(fixture.scene.children).not.toContain(fixture.instance)
  })

  it('takes the rigid body out of the physics world', () => {
    // Read before despawning: the reference is cleared afterwards so a stale handle cannot
    // be used against a world that no longer knows about it.
    const body = fixture.instance.userData.body

    prefabDespawn(fixture.scene, fixture.world as never, fixture.instance)

    expect(fixture.world.removeRigidBody).toHaveBeenCalledWith(body)
    expect(fixture.instance.userData.body).toBeUndefined()
  })

  it('takes the debug helper with it, which is the part hand-written teardown forgets', () => {
    prefabDespawn(fixture.scene, fixture.world as never, fixture.instance)

    expect(fixture.scene.children).not.toContain(fixture.helper)
  })

  it('leaves nothing of the instance in the scene', () => {
    prefabDespawn(fixture.scene, fixture.world as never, fixture.instance)

    expect(fixture.scene.children).toHaveLength(0)
  })

  it('is safe for an instance that never had a body', () => {
    const scene = new THREE.Scene()
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial())
    scene.add(mesh)
    const world = { removeRigidBody: vi.fn() }

    expect(() =>
      prefabDespawn(scene, world as never, mesh as unknown as ComplexModel)
    ).not.toThrow()
    expect(world.removeRigidBody).not.toHaveBeenCalled()
  })

  it('is safe to call twice', () => {
    prefabDespawn(fixture.scene, fixture.world as never, fixture.instance)

    expect(() =>
      prefabDespawn(fixture.scene, fixture.world as never, fixture.instance)
    ).not.toThrow()
  })
})
