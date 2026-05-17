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
  CUP_DEPTH,
  FLAG_HEIGHT,
  type HoleConfig
} from '../config'

const toonMaterial = (color: number) => new THREE.MeshToonMaterial({ color })

interface GroundPiece {
  width: number
  depth: number
  cx: number
  cz: number
}

interface ColliderOptions {
  pieces: GroundPiece[]
  groundY: number
  fullWidth: number
  fullDepth: number
  position: CoordinateTuple
  holeX: number
  holeZ: number
}

const groundPiecesAroundHole = (hole: HoleConfig): GroundPiece[] => {
  const { width, depth, position } = hole.ground
  const gLeft = position[0] - width / 2
  const gRight = position[0] + width / 2
  const gBottom = position[2] - depth / 2
  const gTop = position[2] + depth / 2
  const hx = hole.holePosition[0]
  const hz = hole.holePosition[2]
  const HR = HOLE_RADIUS

  const holeInside = hx - HR > gLeft && hx + HR < gRight && hz - HR > gBottom && hz + HR < gTop

  if (!holeInside) {
    return [{ width, depth, cx: position[0], cz: position[2] }]
  }

  return [
    { width: hx - HR - gLeft, depth, cx: (gLeft + hx - HR) / 2, cz: position[2] },
    { width: gRight - (hx + HR), depth, cx: (hx + HR + gRight) / 2, cz: position[2] },
    { width: HR * 2, depth: hz - HR - gBottom, cx: hx, cz: (gBottom + hz - HR) / 2 },
    { width: HR * 2, depth: gTop - (hz + HR), cx: hx, cz: (hz + HR + gTop) / 2 }
  ].filter((p) => p.width > 0.01 && p.depth > 0.01)
}

const buildGroundColliders = (
  options: ColliderOptions,
  world: RAPIER.World
): RAPIER.RigidBody[] => {
  const { pieces, groundY, fullWidth, fullDepth, position, holeX, holeZ } = options
  const floorY = groundY - GROUND_THICKNESS / 2
  const ceilY = WALL_HEIGHT + GROUND_THICKNESS / 2

  const floorBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed())
  pieces.forEach((p) => {
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(p.width / 2, GROUND_THICKNESS / 2, p.depth / 2)
        .setTranslation(p.cx, floorY, p.cz)
        .setFriction(GROUND_FRICTION),
      floorBody
    )
  })

  const ceilBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed())
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(fullWidth / 2, GROUND_THICKNESS / 2, fullDepth / 2).setTranslation(
      position[0],
      ceilY,
      position[2]
    ),
    ceilBody
  )

  const cupBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed())
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(HOLE_RADIUS, GROUND_THICKNESS / 2, HOLE_RADIUS).setTranslation(
      holeX,
      -(CUP_DEPTH + GROUND_THICKNESS / 2),
      holeZ
    ),
    cupBody
  )

  return [floorBody, ceilBody, cupBody]
}

/**
 * Build the ground for a hole: single visual mesh + compound physics with a cup opening.
 * @param hole Hole configuration
 * @param scene Scene to add to
 * @param world Rapier world
 * @returns Ground mesh and all physics bodies
 */
export const buildGround = (
  hole: HoleConfig,
  scene: THREE.Scene,
  world: RAPIER.World
): { meshes: THREE.Mesh[]; bodies: RAPIER.RigidBody[] } => {
  const { width, depth, position } = hole.ground

  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(width, GROUND_THICKNESS, depth),
    toonMaterial(GROUND_COLOR)
  )
  mesh.position.set(position[0], position[1] - GROUND_THICKNESS / 2, position[2])
  mesh.receiveShadow = true
  scene.add(mesh)

  const pieces = groundPiecesAroundHole(hole)
  const bodies = buildGroundColliders(
    {
      pieces,
      groundY: position[1],
      fullWidth: width,
      fullDepth: depth,
      position,
      holeX: hole.holePosition[0],
      holeZ: hole.holePosition[2]
    },
    world
  )

  return { meshes: [mesh], bodies }
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
): RAPIER.RigidBody => {
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed())
  const collider = RAPIER.ColliderDesc.cuboid(width / 2, WALL_HEIGHT / 2, depth / 2)
    .setTranslation(position[0], position[1] + WALL_HEIGHT / 2, position[2])
    .setRestitution(0.3)
  world.createCollider(collider, body)
  return body
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
): { meshes: THREE.Mesh[]; bodies: RAPIER.RigidBody[] } => {
  const { width, depth, position } = hole.ground
  const hw = width / 2
  const hd = depth / 2
  const py = position[1]
  const px = position[0]
  const pz = position[2]

  const boundaries: { w: number; d: number; pos: CoordinateTuple }[] = [
    {
      w: width + WALL_THICKNESS * 2,
      d: WALL_THICKNESS,
      pos: [px, py, pz - hd - WALL_THICKNESS / 2]
    },
    {
      w: width + WALL_THICKNESS * 2,
      d: WALL_THICKNESS,
      pos: [px, py, pz + hd + WALL_THICKNESS / 2]
    },
    { w: WALL_THICKNESS, d: depth, pos: [px - hw - WALL_THICKNESS / 2, py, pz] },
    { w: WALL_THICKNESS, d: depth, pos: [px + hw + WALL_THICKNESS / 2, py, pz] }
  ]

  const boundaryResults = boundaries.map(({ w, d, pos }) => ({
    body: buildWallCollider(w, d, pos, world),
    mesh: buildWallMesh(w, d, pos, scene)
  }))

  const obstacleResults = hole.walls.map(({ width: w, depth: d, position: p }) => ({
    body: buildWallCollider(w, d, p as CoordinateTuple, world),
    mesh: buildWallMesh(w, d, p as CoordinateTuple, scene)
  }))

  const all = [...boundaryResults, ...obstacleResults]
  return { meshes: all.map((r) => r.mesh), bodies: all.map((r) => r.body) }
}

/**
 * Build the hole (dark disc) and flag at the target position.
 * @param holePosition World position of the hole centre
 * @param scene Scene to add to
 * @returns Group containing disc + flag
 */
export const buildHoleMarker = (holePosition: CoordinateTuple, scene: THREE.Scene): THREE.Group => {
  const group = new THREE.Group()

  // Dark opening disc at ground level
  const discGeo = new THREE.CircleGeometry(HOLE_RADIUS, 32)
  const discMat = toonMaterial(HOLE_COLOR)
  const disc = new THREE.Mesh(discGeo, discMat)
  disc.rotation.x = -Math.PI / 2
  disc.position.set(0, 0.005, 0)
  group.add(disc)

  // Cup walls (open cylinder going below ground)
  const cupGeo = new THREE.CylinderGeometry(HOLE_RADIUS, HOLE_RADIUS, CUP_DEPTH, 32, 1, true)
  const cupMat = new THREE.MeshToonMaterial({ color: HOLE_COLOR, side: THREE.BackSide })
  const cup = new THREE.Mesh(cupGeo, cupMat)
  cup.position.set(0, -CUP_DEPTH / 2, 0)
  group.add(cup)

  // Cup bottom
  const bottomGeo = new THREE.CircleGeometry(HOLE_RADIUS, 32)
  const bottomMesh = new THREE.Mesh(bottomGeo, toonMaterial(HOLE_COLOR))
  bottomMesh.rotation.x = Math.PI / 2
  bottomMesh.position.set(0, -CUP_DEPTH, 0)
  group.add(bottomMesh)

  // Flag pole
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
