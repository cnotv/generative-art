import * as THREE from 'three'
import RAPIER from '@dimforge/rapier3d-compat'
import { getBall, getCube, getPhysic, removeElements } from '@webgamekit/threejs'
import type { ComplexModel, CoordinateTuple } from '@webgamekit/threejs'
import {
  BONE_COLLIDER_FRICTION,
  BONE_COLLIDER_RESTITUTION,
  ENCLOSURE_COLOR,
  ENCLOSURE_HEIGHT_FRACTION,
  ENCLOSURE_THICKNESS_FRACTION,
  LAMP_ANGULAR_DAMPING,
  LAMP_ARM_LENGTH_FRACTION,
  LAMP_COLOR,
  LAMP_CONE_SEGMENTS,
  LAMP_DAMPING,
  LAMP_FRICTION,
  LAMP_HEIGHT_FRACTION,
  LAMP_METALNESS,
  LAMP_OPACITY,
  LAMP_RADIUS_FRACTION,
  LAMP_RESTITUTION,
  LAMP_ROUGHNESS,
  MARBLE_DAMPING,
  MARBLE_DEFAULT_COLOR,
  MARBLE_FRICTION,
  MARBLE_GRAVITY_REFERENCE_SPREAD,
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
  rigDiagonal: number,
  sizeFraction: number
): RAPIER.RigidBody => {
  const size = rigDiagonal * sizeFraction
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
  sizeFraction: number,
  opacity: number
): PhysicsMesh[] => {
  const size = rigDiagonal * sizeFraction
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

export interface HangingLamp {
  anchor: RAPIER.RigidBody
  lamp: PhysicsMesh
  joint: RAPIER.ImpulseJoint
}

/** A lamp on a rigid pivot arm, hung from a fixed point beside the rig: something to knock into
 * and watch swing, rather than only ever something marbles fall onto. The anchor carries no
 * collider of its own, only the joint the lamp swings from. */
export const createHangingLamp = (
  scene: THREE.Scene,
  world: RAPIER.World,
  anchorPosition: CoordinateTuple,
  rigDiagonal: number
): HangingLamp => {
  const armLength = rigDiagonal * LAMP_ARM_LENGTH_FRACTION
  const radius = rigDiagonal * LAMP_RADIUS_FRACTION
  const [anchorX, anchorY, anchorZ] = anchorPosition

  const anchor = world.createRigidBody(
    RAPIER.RigidBodyDesc.fixed().setTranslation(anchorX, anchorY, anchorZ)
  )

  const lamp = getBall(scene, world, {
    name: 'hanging-lamp',
    size: radius,
    position: [anchorX, anchorY - armLength, anchorZ] as CoordinateTuple,
    color: LAMP_COLOR,
    opacity: LAMP_OPACITY,
    type: 'dynamic',
    hasGravity: true,
    weight: rigDiagonal / MARBLE_GRAVITY_REFERENCE_SPREAD,
    ccd: true,
    restitution: LAMP_RESTITUTION,
    friction: LAMP_FRICTION,
    damping: LAMP_DAMPING,
    angular: LAMP_ANGULAR_DAMPING,
    roughness: LAMP_ROUGHNESS,
    metalness: LAMP_METALNESS
  }) as PhysicsMesh

  // A cone reads as a lampshade; the collider stays the ball getBall already built for it.
  lamp.geometry.dispose()
  lamp.geometry = new THREE.ConeGeometry(
    radius,
    rigDiagonal * LAMP_HEIGHT_FRACTION,
    LAMP_CONE_SEGMENTS
  )

  const joint = world.createImpulseJoint(
    RAPIER.JointData.spherical({ x: 0, y: 0, z: 0 }, { x: 0, y: armLength, z: 0 }),
    anchor,
    lamp.userData.body,
    true
  )

  return { anchor, lamp, joint }
}

export const disposeHangingLamp = (world: RAPIER.World, hangingLamp: HangingLamp | null): void => {
  if (!hangingLamp) return
  world.removeImpulseJoint(hangingLamp.joint, true)
  world.removeRigidBody(hangingLamp.anchor)
  disposePhysicsMeshes(world, [hangingLamp.lamp])
}
