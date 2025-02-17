import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d';
import { getPhysic } from './threeJs';

/**
 * Create a ball with physics, texture, and shadow
 * Friction and bounciness is size based
 * @param scene
 * @param orbit
 * @param world
 */
export const getBall = (
  scene: THREE.Scene,
  world: RAPIER.World,
  {
    size = 1,
    position = [0, 0, 0],
    color = 0x222222,
    mass = 1,
    density = 1,
    weight = 5,
    friction = 0,
    restitution = 0,
    damping = 0,
    type = 'dynamic',
  }: ModelOptions = {},
) => {
  const initialValues = { size, position, color }
  // Create and add model
  const geometry = new THREE.SphereGeometry(size as number)
  const material = new THREE.MeshPhysicalMaterial({
    color,
    transmission: 1,
  })
  const mesh = new THREE.Mesh(geometry, material)
  mesh.position.set(...position)
  mesh.castShadow = true
  mesh.receiveShadow = false //default
  scene.add(mesh)

  const { rigidBody, collider } = getPhysic(world, {
    position,
    size, 
    boundary: 0.8,
    rotation: { w: 1.0, x: 0.5, y: 0.5, z: 0.5 },
    restitution,
    friction: friction ?? 0,
    weight,
    density,
    damping,
    mass,
    shape: 'ball',
    type,
  })

  return { mesh, rigidBody, collider, initialValues }
}

/**
 * Create a cube with physics, texture, and shadow
 * Friction and bounciness is size based
 * @param scene
 * @param orbit
 * @param world
 */
export const getCube = (
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
    friction = 0,
    damping = 0,
    type = 'dynamic',
  }: ModelOptions = {},
) => {
  const initialValues = { size, rotation, position, color }
  // Create and add model
  const geometry = new THREE.BoxGeometry(...size)
  const material = new THREE.MeshPhysicalMaterial({
    color,
  })
  const mesh = new THREE.Mesh(geometry, material)
  mesh.position.set(...position)
  mesh.rotation.set(...rotation)
  mesh.castShadow = true
  mesh.receiveShadow = false //default
  scene.add(mesh)

  const { rigidBody, collider } = getPhysic(world, {
    position,
    size,
    rotation,
    restitution: 1,
    weight,
    density,
    friction,
    damping,
    mass,
    shape: 'cuboid',
    type,
  })

  return { mesh, rigidBody, collider, initialValues }
}
