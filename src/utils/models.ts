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
    color = 0x222222
  }: ModelOptions = {},
) => {
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
    restitution: 1 / size / 3,
    friction: 5 * size,
    weight: 5,
    mass: 100,
    shape: 'ball',
    type: 'dynamic',
  })

  return { mesh, rigidBody, collider }
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
    color = 0x222222
  }: ModelOptions = {},
) => {
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
    shape: 'cuboid',
    type: 'fixed',
  })

  return { mesh, rigidBody, collider }
}
