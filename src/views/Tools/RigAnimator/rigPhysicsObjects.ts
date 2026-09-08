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
  MARBLE_DEFAULT_COLOR,
  MARBLE_FRICTION,
  MARBLE_METALNESS,
  MARBLE_RESTITUTION,
  MARBLE_ROUGHNESS
} from './config'
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

/** Kinematic rather than dynamic: posing, IK and clip playback all write the bone transforms
 * every frame, and a dynamic body would fight them for the same values. */
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

interface MarbleSpawn {
  position: CoordinateTuple
  radius: number
  textureUrl: string | undefined
  gravityScale: number
}

/** Drop one marble, reusing the Marble Editor's own texture assets when textures are on. */
export const createMarble = (
  scene: THREE.Scene,
  world: RAPIER.World,
  { position, radius, textureUrl, gravityScale }: MarbleSpawn
): PhysicsMesh =>
  getBall(scene, world, {
    name: 'marble',
    size: radius,
    position,
    color: MARBLE_DEFAULT_COLOR,
    texture: textureUrl,
    hasGravity: true,
    weight: gravityScale,
    // A rig authored in centimetres drops a marble further in one step than a wall is thick,
    // so without this it passes straight through the floor.
    ccd: true,
    restitution: MARBLE_RESTITUTION,
    friction: MARBLE_FRICTION,
    damping: MARBLE_DAMPING,
    roughness: MARBLE_ROUGHNESS,
    metalness: MARBLE_METALNESS
  }) as PhysicsMesh

/** The scene's own ground collider is a fixed forty units across, too small for a rig authored
 * in centimetres; this has no mesh of its own so the visible floor stays the scene's ground. */
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

/** Each run is a wall thickness longer than the space it encloses and sits half a thickness
 * past the joint line, so perpendicular walls overlap inside each corner instead of leaving
 * the quadrant a marble would squeeze through. */
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

/** Take a set of physics objects back out of both the scene and the world, freeing what they own. */
export const disposePhysicsMeshes = (world: RAPIER.World, meshes: PhysicsMesh[]): void => {
  meshes.forEach((mesh) => {
    mesh.geometry.dispose()
    mesh.material.map?.dispose()
    mesh.material.dispose()
  })
  removeElements(world, meshes)
}
