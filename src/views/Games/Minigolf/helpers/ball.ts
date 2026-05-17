import * as THREE from 'three'
import RAPIER from '@dimforge/rapier3d-compat'
import type { CoordinateTuple } from '@webgamekit/animation'
import {
  BALL_RADIUS,
  BALL_COLOR,
  BALL_RESTITUTION,
  BALL_FRICTION,
  BALL_LINEAR_DAMPING,
  BALL_ANGULAR_DAMPING,
  CUP_DEPTH,
  CONFETTI_COLORS,
  CONFETTI_COUNT
} from '../config'

export interface BallState {
  mesh: THREE.Mesh
  body: RAPIER.RigidBody
}

/**
 * Create the golf ball mesh and its Rapier dynamic rigid body.
 * @param position Initial world position
 * @param scene Scene to add the mesh to
 * @param world Rapier world
 * @returns BallState with mesh and body references
 */
const TEXTURE_SIZE = 256
const CHANNELS = 4
const DIMPLE_RADIUS = 11
const ALPHA_FULL = 255
const DIMPLE_DARK = 185
const DIMPLE_MID = 225
const DIMPLE_ROWS = 8
const DIMPLE_COLS = 7

const buildDimpleGrid = (): readonly (readonly [number, number])[] => {
  const spacingX = Math.round(TEXTURE_SIZE / DIMPLE_COLS)
  const spacingY = Math.round(TEXTURE_SIZE / DIMPLE_ROWS)
  return Array.from({ length: DIMPLE_ROWS }, (_, row) =>
    Array.from({ length: DIMPLE_COLS }, (_, col) => {
      const rowIsOdd = row % 2 === 1
      const xShift = rowIsOdd ? Math.round(spacingX / 2) : 0
      return [
        col * spacingX + xShift + Math.round(spacingX / 2),
        row * spacingY + Math.round(spacingY / 2)
      ] as const
    })
  ).flat()
}

const DIMPLE_POSITIONS = buildDimpleGrid()

const dimpleShade = (distance: number): number => {
  if (distance >= DIMPLE_RADIUS) return ALPHA_FULL
  const t = distance / DIMPLE_RADIUS
  const inner = t < 0.5 ? DIMPLE_DARK : DIMPLE_MID
  return Math.round(inner + (ALPHA_FULL - inner) * t)
}

const createBallTexture = (): THREE.DataTexture => {
  const total = TEXTURE_SIZE * TEXTURE_SIZE * CHANNELS
  const data = new Uint8Array(total).map((_, i) => {
    const channel = i % CHANNELS
    if (channel === 3) return ALPHA_FULL
    const pixel = Math.floor(i / CHANNELS)
    const px = pixel % TEXTURE_SIZE
    const py = Math.floor(pixel / TEXTURE_SIZE)
    const closestDimple = DIMPLE_POSITIONS.reduce((minimum, [dx, dy]) => {
      const distance = Math.hypot(px - dx, py - dy)
      return distance < minimum ? distance : minimum
    }, Infinity)
    return dimpleShade(closestDimple)
  })
  const texture = new THREE.DataTexture(data, TEXTURE_SIZE, TEXTURE_SIZE, THREE.RGBAFormat)
  texture.needsUpdate = true
  return texture
}

export const createBall = (
  position: CoordinateTuple,
  scene: THREE.Scene,
  world: RAPIER.World
): BallState => {
  const geo = new THREE.SphereGeometry(BALL_RADIUS, 16, 16)
  const mat = new THREE.MeshToonMaterial({ color: BALL_COLOR, map: createBallTexture() })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.castShadow = true
  mesh.position.set(...position)
  scene.add(mesh)

  const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
    .setTranslation(...position)
    .setLinearDamping(BALL_LINEAR_DAMPING)
    .setAngularDamping(BALL_ANGULAR_DAMPING)
    .setGravityScale(10)
    .setCcdEnabled(true)
  const body = world.createRigidBody(bodyDesc)

  const colliderDesc = RAPIER.ColliderDesc.ball(BALL_RADIUS)
    .setRestitution(BALL_RESTITUTION)
    .setFriction(BALL_FRICTION)
  world.createCollider(colliderDesc, body)

  return { mesh, body }
}

/**
 * Sync the Three.js mesh transform from the Rapier rigid body each frame.
 * @param ball BallState to sync
 */
export const syncBall = (ball: BallState): void => {
  const t = ball.body.translation()
  const r = ball.body.rotation()
  ball.mesh.position.set(t.x, t.y, t.z)
  ball.mesh.quaternion.set(r.x, r.y, r.z, r.w)
}

/**
 * Apply an impulse to launch the ball.
 * @param ball BallState
 * @param direction Normalised direction vector (x, y, z)
 * @param power 0–1 normalised power
 * @param maxPower Maximum impulse magnitude
 */
export const shootBall = (
  ball: BallState,
  direction: THREE.Vector3,
  power: number,
  maxPower: number
): void => {
  ball.body.setLinvel({ x: 0, y: 0, z: 0 }, true)
  ball.body.setAngvel({ x: 0, y: 0, z: 0 }, true)
  const force = direction.clone().multiplyScalar(power * maxPower)
  ball.body.applyImpulse({ x: force.x, y: force.y, z: force.z }, true)
}

/**
 * Return true when the ball velocity is effectively zero (ball at rest).
 * @param ball BallState
 * @param threshold Speed below which the ball is considered stopped
 */
export const isBallStopped = (ball: BallState, threshold = 0.05): boolean => {
  const v = ball.body.linvel()
  return Math.hypot(v.x, v.y, v.z) < threshold
}

/**
 * Freeze the ball in place by stopping all velocity (used before a sink animation).
 * @param ball BallState
 */
export const freezeBall = (ball: BallState): void => {
  ball.body.setLinvel({ x: 0, y: 0, z: 0 }, true)
  ball.body.setAngvel({ x: 0, y: 0, z: 0 }, true)
  ball.body.setEnabled(false)
}

export interface ConfettiParticle {
  mesh: THREE.Mesh
  vx: number
  vy: number
  vz: number
  age: number
}

export interface SpiralStart {
  x: number
  y: number
  z: number
}

/**
 * Animate the ball spiralling into the hole for one frame.
 * @param ball BallState
 * @param targetX Hole centre X
 * @param targetZ Hole centre Z
 * @param progress 0–1 animation progress
 * @param start Ball position when spiral began
 */
export const spiralStep = (
  ball: BallState,
  targetX: number,
  targetZ: number,
  progress: number,
  start: SpiralStart
): void => {
  const eased = 1 - Math.pow(1 - progress, 3)
  const radius = Math.hypot(start.x - targetX, start.z - targetZ) * (1 - eased)
  const baseAngle = Math.atan2(start.z - targetZ, start.x - targetX)
  const angle = baseAngle + eased * Math.PI * 4
  ball.mesh.position.set(
    targetX + radius * Math.cos(angle),
    start.y - CUP_DEPTH * eased,
    targetZ + radius * Math.sin(angle)
  )
}

/**
 * Spawn celebration confetti particles at the hole position.
 * @param scene Three.js scene
 * @param holeX Hole centre X
 * @param holeZ Hole centre Z
 * @returns Array of live confetti particles to be stepped each frame
 */
export const spawnConfetti = (
  scene: THREE.Scene,
  holeX: number,
  holeZ: number
): ConfettiParticle[] => {
  const geo = new THREE.BoxGeometry(0.14, 0.14, 0.14)
  return Array.from({ length: CONFETTI_COUNT }, (_, index) => {
    const color = CONFETTI_COLORS[index % CONFETTI_COLORS.length]
    const mat = new THREE.MeshToonMaterial({ color })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.userData.mgHole = true
    const angle = (index / CONFETTI_COUNT) * Math.PI * 2
    const spread = 0.15 + (index % 3) * 0.15
    mesh.position.set(holeX + Math.cos(angle) * spread, 0.1, holeZ + Math.sin(angle) * spread)
    scene.add(mesh)
    const upSpeed = 4 + (index % 4)
    return {
      mesh,
      vx: Math.cos(angle) * (1.5 + (index % 3) * 0.5) * 0.06,
      vy: upSpeed * 0.06,
      vz: Math.sin(angle) * (1.5 + (index % 3) * 0.5) * 0.06,
      age: 0
    }
  })
}

/**
 * Advance all confetti particles by one frame. Returns only still-alive particles.
 * @param particles Current confetti array
 * @param scene Scene (for removal)
 * @param lifetime Total lifetime in seconds
 */
export const stepConfetti = (
  particles: ConfettiParticle[],
  scene: THREE.Scene,
  lifetime: number
): ConfettiParticle[] => {
  const dt = 1 / 60
  return particles.filter((p) => {
    p.mesh.position.x += p.vx
    p.mesh.position.y += p.vy
    p.mesh.position.z += p.vz
    p.vy -= 0.014
    p.mesh.rotation.x += 0.12
    p.mesh.rotation.z += 0.09
    p.age += dt
    if (p.age >= lifetime) {
      scene.remove(p.mesh)
      return false
    }
    return true
  })
}

/**
 * Reset the ball to a new position, clearing all velocity.
 * @param ball BallState
 * @param position Target position
 */
export const resetBall = (ball: BallState, position: CoordinateTuple): void => {
  ball.body.setEnabled(true)
  ball.body.setTranslation({ x: position[0], y: position[1], z: position[2] }, true)
  ball.body.setLinvel({ x: 0, y: 0, z: 0 }, true)
  ball.body.setAngvel({ x: 0, y: 0, z: 0 }, true)
  ball.mesh.scale.setScalar(1)
}
