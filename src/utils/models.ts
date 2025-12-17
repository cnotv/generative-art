import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { getPhysic, getTextures, applyMaterial } from '@webgametoolkit/threejs';

/**
 * Create a ball with physics, texture, and shadow
 * Friction and bounciness is size based
 * @param scene
 * @param world
 * @param options
 */
const getBall = (
  scene: THREE.Scene,
  world: RAPIER.World,
  {
    size = 1,
    position = [0, 0, 0],
    color = 0x222222,
    mass = 1,
    density = 1,
    weight = 50,
    friction = 1,
    restitution = 0,
    damping = 0,
    angular = 0,
    opacity = 1,
    reflectivity = 0.5,
    roughness = 1,
    metalness = 0,
    transmission = 0,
    type = 'dynamic',
    castShadow = true,
    showHelper = false,
    hasGravity = false,
    receiveShadow = true,
    material = 'MeshPhysicalMaterial',
    texture,
  }: ModelOptions = {},
) => {
  const initialValues = { size, position, color }
  // Create and add model
  const geometry = new THREE.SphereGeometry(size as number)
  const mesh = new THREE.Mesh(geometry)
  applyMaterial(mesh, {
    color,
    transmission,
    opacity,
    transparent: opacity < 1,
    reflectivity,
    roughness,
    metalness,
    material,
  })
  mesh.material.map = texture ? getTextures(texture) : null
  mesh.position.set(...position)
  mesh.castShadow = castShadow
  mesh.receiveShadow = receiveShadow
  scene.add(mesh)

  const { rigidBody, collider } = getPhysic(world, {
    position,
    size, 
    boundary: 0.8,
    rotation: { w: 1.0, x: 0.5, y: 0.5, z: 0.5 },
    restitution,
    friction,
    weight,
    density,
    damping,
    angular,
    mass,
    shape: 'ball',
    type,
  })

  let characterController
  if (type === 'kinematicPositionBased') {
    // Create a character controller for gravity and collision handling
    characterController = world.createCharacterController(0.01);
    characterController.setUp({ x: 0, y: 1, z: 0 }); // Set the up direction
    characterController.enableSnapToGround(0); // Enable snapping to the ground
    characterController.setMaxSlopeClimbAngle(45); // Set the maximum slope angle
    characterController.setMinSlopeSlideAngle(30); // Set the minimum slope angle
  }

  // HELPER: Create a mesh to visualize the collider
  const helper = new THREE.BoxHelper(mesh, 0x000000)
  if (showHelper) {
    scene.add(helper)
  }

  return { mesh, rigidBody, collider, initialValues, type, characterController, helper, hasGravity }
}

/**
 * Create a cube with physics, texture, and shadow
 * Friction and bounciness is size based
 * @param { THREE.Scene } scene
 * @param { RAPIER.World } world
 * @param { ModelOptions } options
 */
const getCube = (
  scene: THREE.Scene,
  world: RAPIER.World,
  {
    size = [5, 5, 5] as CoordinateTuple,
    rotation = [0, 0, 0] as CoordinateTuple,
    position = [0, 0, 0],
    color = 0x222222,
    mass = 1,
    density = 1,
    weight = 5,
    friction = 1,
    dominance = 0,
    restitution = 1,
    damping = 0,
    angular = 0,
    opacity = 1,
    reflectivity = 0,
    roughness = 1,
    metalness = 0,
    transmission = 0,
    boundary = 0.5,
    castShadow = true,
    receiveShadow = true,
    texture,
    hasGravity = false,
    showHelper = false,
    material = 'MeshPhysicalMaterial',
    type = 'dynamic',
  }: ModelOptions = {},
): ComplexModel => {
  const initialValues = { size, rotation, position, color }
  // Create and add model
  const geometry = new THREE.BoxGeometry(...size)
  const mesh = applyMaterial(new THREE.Mesh(geometry), {
    color,
    transmission,
    opacity,
    transparent: opacity < 1,
    reflectivity,
    roughness,
    metalness,
    material,
  })
  mesh.material.map = texture ? getTextures(texture) : null
  mesh.position.set(...position)
  mesh.rotation.set(...rotation)
  mesh.castShadow = castShadow
  mesh.receiveShadow = receiveShadow
  scene.add(mesh)

  const { rigidBody, collider } = getPhysic(world, {
    position,
    size,
    rotation,
    restitution,
    friction,
    weight,
    density,
    damping,
    angular,
    dominance,
    boundary,
    mass,
    shape: 'cuboid',
    type,
  })

  let characterController
  if (type === 'kinematicPositionBased') {
    // Create a character controller for gravity and collision handling
    characterController = world.createCharacterController(0.01);
    characterController.setUp({ x: 0, y: 1, z: 0 }); // Set the up direction
    characterController.enableSnapToGround(0); // Enable snapping to the ground
    characterController.setMaxSlopeClimbAngle(45); // Set the maximum slope angle
    characterController.setMinSlopeSlideAngle(30); // Set the minimum slope angle
  }

  // HELPER: Create a mesh to visualize the collider
  const helper = new THREE.BoxHelper(mesh, 0x000000)
  if (showHelper) {
    scene.add(helper)
  }

  return { mesh, rigidBody, collider, initialValues, type, characterController, helper, hasGravity }
}

const getWalls = (
  scene: THREE.Scene,
  world: RAPIER.World,
  {
    length = 200,
    height = 50,
    depth = 0.2,
    opacity = 1,
  } = {},
) => ([
  { position: [0, 0, 0], size: [length, depth, length] },
  { position: [-length/2, height/2, 0], size: [depth, height, length] },
  { position: [length/2, height/2, 0], size: [depth, height, length] },
  { position: [0, height/2, length/2], size: [length, height, depth] },
  { position: [0, height/2, -length/2], size: [length, height, depth] },
].map(({ position, size }) => 
  getCube(scene, world, {
    color: 0xcccccc,
    opacity,
    size,
    position,
    type: 'fixed',
  })
))

export {
  getBall,
  getCube,
  getWalls,
};
