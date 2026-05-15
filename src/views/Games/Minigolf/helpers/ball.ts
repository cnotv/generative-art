import * as THREE from 'three'
import RAPIER from '@dimforge/rapier3d-compat'
import type { CoordinateTuple } from '@webgamekit/animation'
import {
  BALL_RADIUS,
  BALL_COLOR,
  BALL_RESTITUTION,
  BALL_FRICTION,
  BALL_LINEAR_DAMPING,
  BALL_ANGULAR_DAMPING
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
export const createBall = (
  position: CoordinateTuple,
  scene: THREE.Scene,
  world: RAPIER.World
): BallState => {
  const geo = new THREE.SphereGeometry(BALL_RADIUS, 16, 16)
  const mat = new THREE.MeshToonMaterial({ color: BALL_COLOR })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.castShadow = true
  mesh.position.set(...position)
  scene.add(mesh)

  const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
    .setTranslation(...position)
    .setLinearDamping(BALL_LINEAR_DAMPING)
    .setAngularDamping(BALL_ANGULAR_DAMPING)
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
 * Reset the ball to a new position, clearing all velocity.
 * @param ball BallState
 * @param position Target position
 */
export const resetBall = (ball: BallState, position: CoordinateTuple): void => {
  ball.body.setTranslation({ x: position[0], y: position[1], z: position[2] }, true)
  ball.body.setLinvel({ x: 0, y: 0, z: 0 }, true)
  ball.body.setAngvel({ x: 0, y: 0, z: 0 }, true)
}
