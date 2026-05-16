import * as THREE from 'three'
import RAPIER from '@dimforge/rapier3d-compat'
import type { CoordinateTuple } from '@webgamekit/animation'
import {
  GROUND_COLOR,
  WALL_COLOR,
  HOLE_COLOR,
  FLAG_COLOR,
  GROUND_FRICTION,
  WALL_HEIGHT,
  WALL_THICKNESS,
  GROUND_THICKNESS,
  HOLE_RADIUS,
  FLAG_HEIGHT,
  type HoleConfig
} from '../config'

const toonMaterial = (color: number) => new THREE.MeshToonMaterial({ color })

/**
 * Build the flat ground plane for a hole.
 * @param hole Hole configuration
 * @param scene Scene to add to
 * @param world Rapier world
 * @returns The ground mesh
 */
export const buildGround = (
  hole: HoleConfig,
  scene: THREE.Scene,
  world: RAPIER.World
): THREE.Mesh => {
  const { width, depth, position } = hole.ground
  const geo = new THREE.BoxGeometry(width, GROUND_THICKNESS, depth)
  const mat = toonMaterial(GROUND_COLOR)
  const mesh = new THREE.Mesh(geo, mat)
  mesh.position.set(...(position as CoordinateTuple))
  mesh.position.y -= GROUND_THICKNESS / 2
  mesh.receiveShadow = true
  scene.add(mesh)

  const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed())
  const collider = RAPIER.ColliderDesc.cuboid(width / 2, GROUND_THICKNESS / 2, depth / 2)
    .setTranslation(mesh.position.x, mesh.position.y, mesh.position.z)
    .setFriction(GROUND_FRICTION)
  world.createCollider(collider, body)

  return mesh
}

const buildWallMesh = (
  width: number,
  depth: number,
  position: CoordinateTuple,
  scene: THREE.Scene
): THREE.Mesh => {
  const geo = new THREE.BoxGeometry(width, WALL_HEIGHT, depth)
  const mat = toonMaterial(WALL_COLOR)
  const mesh = new THREE.Mesh(geo, mat)
  mesh.position.set(...position)
  mesh.position.y += WALL_HEIGHT / 2
  mesh.castShadow = true
  scene.add(mesh)
  return mesh
}

const buildWallCollider = (
  width: number,
  depth: number,
  position: CoordinateTuple,
  world: RAPIER.World
): void => {
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed())
  const collider = RAPIER.ColliderDesc.cuboid(width / 2, WALL_HEIGHT / 2, depth / 2)
    .setTranslation(position[0], position[1] + WALL_HEIGHT / 2, position[2])
    .setRestitution(0.3)
  world.createCollider(collider, body)
}

/**
 * Build all boundary walls and obstacle walls for a hole.
 * @param hole Hole configuration
 * @param scene Scene to add to
 * @param world Rapier world
 */
export const buildWalls = (
  hole: HoleConfig,
  scene: THREE.Scene,
  world: RAPIER.World
): THREE.Mesh[] => {
  const { width, depth, position } = hole.ground
  const hw = width / 2
  const hd = depth / 2
  const py = position[1]
  const px = position[0]
  const pz = position[2]

  const boundaries: { w: number; d: number; pos: CoordinateTuple }[] = [
    { w: width, d: WALL_THICKNESS, pos: [px, py, pz - hd] },
    { w: width, d: WALL_THICKNESS, pos: [px, py, pz + hd] },
    { w: WALL_THICKNESS, d: depth, pos: [px - hw, py, pz] },
    { w: WALL_THICKNESS, d: depth, pos: [px + hw, py, pz] }
  ]

  const meshes = boundaries.map(({ w, d, pos }) => {
    buildWallCollider(w, d, pos, world)
    return buildWallMesh(w, d, pos, scene)
  })

  hole.walls.forEach(({ width: w, depth: d, position: p }) => {
    buildWallCollider(w, d, p as CoordinateTuple, world)
    meshes.push(buildWallMesh(w, d, p as CoordinateTuple, scene))
  })

  return meshes
}

/**
 * Build the hole (dark disc) and flag at the target position.
 * @param holePosition World position of the hole centre
 * @param scene Scene to add to
 * @returns Group containing disc + flag
 */
export const buildHoleMarker = (holePosition: CoordinateTuple, scene: THREE.Scene): THREE.Group => {
  const group = new THREE.Group()

  const discGeo = new THREE.CylinderGeometry(HOLE_RADIUS, HOLE_RADIUS, 0.05, 32)
  const discMat = toonMaterial(HOLE_COLOR)
  const disc = new THREE.Mesh(discGeo, discMat)
  disc.position.set(0, 0.01, 0)
  group.add(disc)

  const poleGeo = new THREE.CylinderGeometry(0.04, 0.04, FLAG_HEIGHT, 8)
  const poleMat = toonMaterial(0xdddddd)
  const pole = new THREE.Mesh(poleGeo, poleMat)
  pole.position.set(0, FLAG_HEIGHT / 2, 0)
  group.add(pole)

  const flagGeo = new THREE.PlaneGeometry(0.8, 0.5)
  const flagMat = new THREE.MeshToonMaterial({ color: FLAG_COLOR, side: THREE.DoubleSide })
  const flag = new THREE.Mesh(flagGeo, flagMat)
  flag.position.set(0.4, FLAG_HEIGHT - 0.25, 0)
  group.add(flag)

  group.position.set(...holePosition)
  scene.add(group)
  return group
}
