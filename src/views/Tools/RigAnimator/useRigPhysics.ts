import { shallowRef, type Ref, type ShallowRef } from 'vue'
import * as THREE from 'three'
import type RAPIER from '@dimforge/rapier3d-compat'
import type { CoordinateTuple } from '@webgamekit/threejs'
import { syncMeshesWithBodies } from '@webgamekit/threejs'
import { computeRigDiagonal } from './boneMarkers'
import { DEFAULT_POSITION_RANGE, MARBLE_GRAVITY_REFERENCE_SPREAD, MARBLE_SEED } from './config'
import { buildMarbleSpawnPlan } from './marbles'
import { buildBoneColliderSpecs, readBoneColliderTransform } from './rigColliders'
import {
  createBoneColliderBody,
  createEnclosure,
  createEnclosureFloor,
  createMarble,
  disposePhysicsMeshes,
  type BoneColliderBody,
  type PhysicsMesh
} from './rigPhysicsObjects'
import type { RigAnimatorConfig } from './types'

/**
 * Owns everything physical in the rig animator: the capsules that follow the posed bones, the
 * marbles that fall onto them and the enclosure that keeps those marbles in shot.
 *
 * Nothing here exists until the physics toggle is switched on. A posing session that never
 * wants marbles pays for none of it, which matters because a humanoid rig is upwards of fifty
 * kinematic bodies rewritten every frame before the world is even stepped.
 *
 * @param config The view's reactive config
 * @param bones The loaded rig's bones
 * @param model The loaded model, whose position the marbles are dropped over
 */
export const useRigPhysics = (
  config: Ref<RigAnimatorConfig>,
  bones: ShallowRef<THREE.Bone[]>,
  model: ShallowRef<THREE.Object3D | null>
) => {
  const scene = shallowRef<THREE.Scene | null>(null)
  const world = shallowRef<RAPIER.World | null>(null)
  let boneColliders: BoneColliderBody[] = []
  let marbles: PhysicsMesh[] = []
  let enclosure: PhysicsMesh[] = []
  let enclosureFloor: RAPIER.RigidBody | null = null

  const colliderPosition = new THREE.Vector3()
  const colliderRotation = new THREE.Quaternion()

  /** The rig's spread, which every physical size in here is a fraction of. */
  const rigDiagonal = (): number =>
    bones.value.length > 0 ? computeRigDiagonal(bones.value) : DEFAULT_POSITION_RANGE

  const setScene = (nextScene: THREE.Scene): void => {
    scene.value = nextScene
  }

  const setWorld = (nextWorld: RAPIER.World): void => {
    world.value = nextWorld
  }

  const clearBoneColliders = (): void => {
    const currentWorld = world.value
    if (currentWorld) boneColliders.forEach(({ body }) => currentWorld.removeRigidBody(body))
    boneColliders = []
  }

  const rebuildBoneColliders = (): void => {
    clearBoneColliders()
    const currentWorld = world.value
    if (!currentWorld || !config.value.physicsEnabled || bones.value.length === 0) return

    model.value?.updateMatrixWorld(true)
    const bonesByName = new Map(bones.value.map((bone) => [bone.name, bone]))
    boneColliders = buildBoneColliderSpecs(bones.value).flatMap((spec) => {
      const bone = bonesByName.get(spec.boneName)
      return bone ? [createBoneColliderBody(currentWorld, bone, spec)] : []
    })
  }

  const clearMarbles = (): void => {
    if (world.value) disposePhysicsMeshes(world.value, marbles)
    marbles = []
  }

  const rebuildMarbles = (): void => {
    clearMarbles()
    const currentScene = scene.value
    const currentWorld = world.value
    if (!currentScene || !currentWorld || !config.value.physicsEnabled) return

    const center = (model.value?.position.toArray() ?? [0, 0, 0]) as CoordinateTuple
    const plan = buildMarbleSpawnPlan({
      count: config.value.marbleCount,
      seed: MARBLE_SEED,
      center,
      rigDiagonal: rigDiagonal()
    })
    marbles = plan.map((spawn) =>
      createMarble(currentScene, currentWorld, spawn, {
        textured: config.value.marbleTextures,
        gravityScale: rigDiagonal() / MARBLE_GRAVITY_REFERENCE_SPREAD
      })
    )
  }

  const clearEnclosure = (): void => {
    const currentWorld = world.value
    if (currentWorld) {
      disposePhysicsMeshes(currentWorld, enclosure)
      if (enclosureFloor) currentWorld.removeRigidBody(enclosureFloor)
    }
    enclosure = []
    enclosureFloor = null
  }

  const rebuildEnclosure = (): void => {
    clearEnclosure()
    const currentScene = scene.value
    const currentWorld = world.value
    if (!currentScene || !currentWorld || !config.value.physicsEnabled) return

    // The floor is not part of the walls toggle: without it marbles fall through the world
    // wherever the scene's own smaller ground does not reach.
    enclosureFloor = createEnclosureFloor(currentWorld, rigDiagonal())
    if (!config.value.showEnclosure) return

    enclosure = createEnclosure(
      currentScene,
      currentWorld,
      rigDiagonal(),
      config.value.enclosureOpacity
    )
  }

  /** Rebuild everything the loaded rig's size and pose decide, after a model change or a toggle. */
  const rebuild = (): void => {
    rebuildBoneColliders()
    rebuildEnclosure()
    rebuildMarbles()
  }
  const clear = (): void => {
    clearBoneColliders()
    clearMarbles()
    clearEnclosure()
  }

  /**
   * Carry the frame's pose onto the kinematic bodies, and the stepped world back onto the
   * marbles. Runs before the world is stepped, so the marbles are resolved against where the
   * bones are now rather than where they were last frame.
   */
  const tickPhysics = (): void => {
    boneColliders.forEach(({ bone, spec, body }) => {
      readBoneColliderTransform(bone, spec, colliderPosition, colliderRotation)
      body.setNextKinematicTranslation(colliderPosition)
      body.setNextKinematicRotation(colliderRotation)
    })
    syncMeshesWithBodies(marbles)
  }

  return {
    setPhysicsScene: setScene,
    setWorld,
    rebuildPhysics: rebuild,
    rebuildMarbles,
    rebuildEnclosure,
    clearPhysics: clear,
    tickPhysics
  }
}
