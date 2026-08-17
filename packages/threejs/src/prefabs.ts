import * as THREE from 'three'
import RAPIER from '@dimforge/rapier3d-compat'
import { getModel } from './models'
import type { ComplexModel, ModelOptions, Prefab } from './types'

/**
 * Merge a prefab's declared options with the overrides for one spawn. The prefab is never
 * mutated, so the next spawn starts from the same declaration.
 * @param prefab The declared game object
 * @param overrides Per-spawn changes, typically position
 * @returns Options ready to hand to getModel
 */
export const prefabSpawnOptions = (prefab: Prefab, overrides: ModelOptions = {}): ModelOptions => ({
  name: prefab.name,
  ...prefab.options,
  ...overrides
})

/**
 * Bring a declared game object into the scene: its mesh, its collider and its gameplay
 * parameters, bound together. What comes back is the same shape the animation loop already
 * consumes, so nothing about the loop changes.
 * @param scene The Three.js scene
 * @param world The Rapier physics world
 * @param prefab The declared game object
 * @param overrides Per-spawn changes, typically position
 * @returns The spawned instance, with the prefab's parameters on its userData
 */
export const prefabSpawn = async (
  scene: THREE.Scene,
  world: RAPIER.World,
  prefab: Prefab,
  overrides: ModelOptions = {}
): Promise<ComplexModel> => {
  const instance = await getModel(scene, world, prefab.model, prefabSpawnOptions(prefab, overrides))
  instance.userData.prefab = prefab.name
  instance.userData.parameters = { ...prefab.parameters }
  return instance
}

/**
 * Remove a spawned instance from the scene and the physics world.
 *
 * Geometry and textures are deliberately not disposed: they belong to the asset cache, which
 * is still handing them to every other instance of the same prefab.
 * @param scene The Three.js scene
 * @param world The Rapier physics world
 * @param instance The instance to remove
 */
export const prefabDespawn = (
  scene: THREE.Scene,
  world: RAPIER.World,
  instance: ComplexModel
): void => {
  const { body, helper } = instance.userData ?? {}

  if (helper instanceof THREE.Object3D) {
    helper.removeFromParent()
    ;(helper as THREE.BoxHelper).dispose?.()
  }

  instance.removeFromParent()
  scene.remove(instance)

  if (body) world.removeRigidBody(body)
  if (instance.userData) instance.userData.body = undefined
}

/**
 * Have every prefab's model ready before the scene starts.
 * @param prefabs The prefabs whose models to load
 * @param preload The loader to use, normally assetsPreload
 * @returns Resolves once every model is cached
 */
export const prefabPreload = async (
  prefabs: readonly Prefab[],
  preload: (paths: readonly string[]) => Promise<void>
): Promise<void> => {
  const models = prefabs.map(({ model }) => model)
  await preload([...new Set(models)])
}
