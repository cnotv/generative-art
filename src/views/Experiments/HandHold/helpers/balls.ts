import * as THREE from 'three'

export interface BallSpawnBounds {
  radius: number
  spawnX: number
  spawnY: number
  respawnBelowY: number
}

export interface BallPhysicsConfig {
  gravity: number
  hitSpeed: number
  hitUpwardBias: number
  hitCooldownMs: number
}

export interface BallFieldSystem {
  update: (deltaSeconds: number) => void
  /** Marks the ball as hit, launching it away from `awayFrom`, if any of `points` is within
   * `radius` of it and it is not still cooling down from a previous hit. */
  checkHits: (
    points: readonly THREE.Vector3[],
    radius: number,
    awayFrom: THREE.Vector3,
    nowMs: number
  ) => void
  dispose: () => void
}

export const createBallField = (
  scene: THREE.Scene,
  bounds: BallSpawnBounds,
  physics: BallPhysicsConfig
): BallFieldSystem => {
  const geometry = new THREE.SphereGeometry(bounds.radius, 16, 12)
  const material = new THREE.MeshStandardMaterial({ color: 0xf2c9c2, roughness: 0.6 })
  const mesh = new THREE.Mesh(geometry, material)
  const velocity = new THREE.Vector3()
  scene.add(mesh)

  const resetBall = (): void => {
    mesh.position.set(bounds.spawnX, bounds.spawnY, 0)
    velocity.set(0, 0, 0)
  }
  resetBall()

  let lastHitMs = -Infinity

  const update = (deltaSeconds: number): void => {
    velocity.y -= physics.gravity * deltaSeconds
    mesh.position.addScaledVector(velocity, deltaSeconds)
    if (mesh.position.y < bounds.respawnBelowY) resetBall()
  }

  const hitDirectionScratch = new THREE.Vector3()

  const checkHits = (
    points: readonly THREE.Vector3[],
    radius: number,
    awayFrom: THREE.Vector3,
    nowMs: number
  ): void => {
    if (nowMs - lastHitMs < physics.hitCooldownMs) return
    const radiusSquared = radius * radius
    const isHit = points.some((point) => point.distanceToSquared(mesh.position) <= radiusSquared)
    if (!isHit) return
    hitDirectionScratch.subVectors(mesh.position, awayFrom)
    hitDirectionScratch.y += physics.hitUpwardBias
    hitDirectionScratch.normalize()
    velocity.copy(hitDirectionScratch).multiplyScalar(physics.hitSpeed)
    lastHitMs = nowMs
  }

  const dispose = (): void => {
    scene.remove(mesh)
    geometry.dispose()
    material.dispose()
  }

  return { update, checkHits, dispose }
}
