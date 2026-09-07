import * as THREE from 'three'
import type RAPIER from '@dimforge/rapier3d-compat'
import { getBall, getCube, getPhysic, removeElements } from '@webgamekit/threejs'
import type { ComplexModel, CoordinateTuple } from '@webgamekit/threejs'
import {
  BONE_COLLIDER_FRICTION,
  BONE_COLLIDER_RESTITUTION,
  ENCLOSURE_COLOR,
  ENCLOSURE_HEIGHT_FRACTION,
  ENCLOSURE_SIZE_FRACTION,
  ENCLOSURE_THICKNESS_FRACTION,
  MARBLE_DAMPING,
  MARBLE_FRICTION,
  MARBLE_METALNESS,
  MARBLE_RESTITUTION,
  MARBLE_ROUGHNESS
} from './config'
import { createMarbleTexture, type MarbleSpawn } from './marbles'
import type { BoneColliderSpec } from './rigColliders'

/** A mesh that owns both its material and the rigid body underneath it. */
export type PhysicsMesh = THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial> &
  ComplexModel

/** A segment's kinematic body, paired with the bone whose pose it has to follow. */
export interface BoneColliderBody {
  bone: THREE.Bone
  spec: BoneColliderSpec
  body: RAPIER.RigidBody
}

/**
 * Give one bone segment a kinematic capsule.
 *
 * Kinematic rather than dynamic because the rig is authored, not simulated: posing, IK and clip
 * playback all write the bone transforms, and a dynamic body would fight them for the same
 * values every frame. A kinematic body is moved by whoever moves the bone and pushes everything
 * else out of its way, which is exactly the relationship wanted here.
 *
 * @param world The Rapier physics world
 * @param bone The segment's parent bone
 * @param spec The segment's spec, from `buildBoneColliderSpecs`
 * @returns The bone, its spec and the body to keep in step with it
 */
export const createBoneColliderBody = (
  world: RAPIER.World,
  bone: THREE.Bone,
  spec: BoneColliderSpec
): BoneColliderBody => {
  const { rigidBody } = getPhysic(world, {
    type: 'kinematicPositionBased',
    shape: 'capsule',
    // A boundary of 1 is the collider at its stated size rather than scaled against a mesh:
    // these capsules have no mesh of their own to be a fraction of.
    boundary: 1,
    size: [spec.radius * 2, spec.halfHeight * 2, spec.radius * 2] as CoordinateTuple,
    position: bone.getWorldPosition(new THREE.Vector3()).toArray() as CoordinateTuple,
    friction: BONE_COLLIDER_FRICTION,
    restitution: BONE_COLLIDER_RESTITUTION
  })

  return { bone, spec, body: rigidBody }
}

/**
 * Add one marble, with a swirl texture unless textures are switched off.
 *
 * The texture is the expensive half: a canvas and an upload per marble. Dropping it leaves the
 * marble its palette colour, which reads as the same object at a fraction of the cost, so a
 * heavy count stays usable.
 *
 * @param scene The Three.js scene
 * @param world The Rapier physics world
 * @param spawn The marble's planned position, size and colours
 * @param options Whether to paint the swirl pattern, and the rig's own gravity scale
 * @returns The marble mesh, carrying its body on userData
 */
export const createMarble = (
  scene: THREE.Scene,
  world: RAPIER.World,
  spawn: MarbleSpawn,
  { textured, gravityScale }: { textured: boolean; gravityScale: number }
): PhysicsMesh => {
  const marble = getBall(scene, world, {
    name: 'marble',
    size: spawn.radius,
    position: spawn.position,
    color: spawn.baseColor,
    hasGravity: true,
    weight: gravityScale,
    // At a rig authored in centimetres a marble falls hundreds of units a second, further in one
    // step than a wall is thick, so without this it passes straight through the floor.
    ccd: true,
    restitution: MARBLE_RESTITUTION,
    friction: MARBLE_FRICTION,
    damping: MARBLE_DAMPING,
    roughness: MARBLE_ROUGHNESS,
    metalness: MARBLE_METALNESS
  }) as PhysicsMesh

  if (textured) {
    marble.material.map = createMarbleTexture(spawn)
    marble.material.needsUpdate = true
  }

  return marble
}

/**
 * Put a collider, and only a collider, under the whole enclosure.
 *
 * The scene's own ground carries one already, but it is a fixed forty units across while a rig
 * authored in centimetres spreads several hundred, so marbles landing outside it would fall
 * through the world. This has no mesh of its own precisely so that the visible floor stays the
 * scene's ground rather than a second slab drawn coplanar with it.
 *
 * @param world The Rapier physics world
 * @param rigDiagonal The rig's spread, which the enclosure is sized against
 * @returns The floor's fixed body
 */
export const createEnclosureFloor = (
  world: RAPIER.World,
  rigDiagonal: number
): RAPIER.RigidBody => {
  const size = rigDiagonal * ENCLOSURE_SIZE_FRACTION
  const thickness = rigDiagonal * ENCLOSURE_THICKNESS_FRACTION

  const { rigidBody } = getPhysic(world, {
    type: 'fixed',
    shape: 'cuboid',
    boundary: 0.5,
    size: [size, thickness, size] as CoordinateTuple,
    position: [0, -thickness / 2, 0] as CoordinateTuple
  })

  return rigidBody
}

/**
 * Build the four walls that keep the marbles around the rig.
 *
 * Each run is a wall thickness longer than the space it encloses and sits half a thickness past
 * the joint line, so perpendicular walls overlap inside each corner rather than leaving the
 * quadrant a marble would squeeze through. The scene's ground already carries a collider, so
 * there is no floor here to sit coplanar with it.
 *
 * @param scene The Three.js scene
 * @param world The Rapier physics world
 * @param rigDiagonal The rig's spread, which the enclosure is sized against
 * @param opacity How solid the walls are drawn, from barely visible to opaque
 * @returns The four wall meshes
 */
export const createEnclosure = (
  scene: THREE.Scene,
  world: RAPIER.World,
  rigDiagonal: number,
  opacity: number
): PhysicsMesh[] => {
  const size = rigDiagonal * ENCLOSURE_SIZE_FRACTION
  const height = rigDiagonal * ENCLOSURE_HEIGHT_FRACTION
  const thickness = rigDiagonal * ENCLOSURE_THICKNESS_FRACTION
  const half = size / 2
  const run = size + thickness

  return [
    { position: [0, 0, -half], size: [run, height, thickness] },
    { position: [0, 0, half], size: [run, height, thickness] },
    { position: [-half, 0, 0], size: [thickness, height, run] },
    { position: [half, 0, 0], size: [thickness, height, run] }
  ].map(
    ({ position, size: wallSize }) =>
      getCube(scene, world, {
        name: 'enclosure-wall',
        type: 'fixed',
        color: ENCLOSURE_COLOR,
        opacity,
        castShadow: false,
        receiveShadow: false,
        size: wallSize as CoordinateTuple,
        position: position as CoordinateTuple
      }) as PhysicsMesh
  )
}

/**
 * Take a set of physics objects back out of both the scene and the world, freeing what they own.
 * @param world The Rapier physics world
 * @param meshes The objects to remove
 */
export const disposePhysicsMeshes = (world: RAPIER.World, meshes: PhysicsMesh[]): void => {
  meshes.forEach((mesh) => {
    mesh.geometry.dispose()
    mesh.material.map?.dispose()
    mesh.material.dispose()
  })
  removeElements(world, meshes)
}
