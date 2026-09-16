import * as THREE from 'three'

export interface BallSpawnBounds {
  radius: number
  spawnX: number
  spawnY: number
  respawnBelowY: number
  trailLength: number
  trailSampleIntervalSeconds: number
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

  // A short ring buffer of the ball's own past positions, rendered as shrinking, fading ghost
  // spheres trailing behind it, so a single small object still reads as moving rather than
  // teleporting between frames.
  const trailPositions = Array.from({ length: bounds.trailLength }, () => new THREE.Vector3())
  const trailGhosts = trailPositions.map((_, index) => {
    const age = (index + 1) / bounds.trailLength
    const ghostMaterial = new THREE.MeshBasicMaterial({
      color: 0xf2c9c2,
      transparent: true,
      opacity: 0.5 * (1 - age)
    })
    const ghost = new THREE.Mesh(geometry, ghostMaterial)
    ghost.scale.setScalar(1 - age * 0.6)
    scene.add(ghost)
    return ghost
  })
  let trailCursor = 0
  let trailSampleAccumulator = 0

  const resetTrail = (): void => {
    trailPositions.forEach((position) => position.copy(mesh.position))
    trailGhosts.forEach((ghost) => ghost.position.copy(mesh.position))
    trailSampleAccumulator = 0
  }

  const resetBall = (): void => {
    mesh.position.set(bounds.spawnX, bounds.spawnY, 0)
    velocity.set(0, 0, 0)
    resetTrail()
  }
  resetBall()

  let lastHitMs = -Infinity

  const update = (deltaSeconds: number): void => {
    velocity.y -= physics.gravity * deltaSeconds
    mesh.position.addScaledVector(velocity, deltaSeconds)
    if (mesh.position.y < bounds.respawnBelowY) {
      resetBall()
      return
    }
    trailSampleAccumulator += deltaSeconds
    if (trailSampleAccumulator < bounds.trailSampleIntervalSeconds) return
    trailSampleAccumulator = 0
    trailPositions[trailCursor].copy(mesh.position)
    trailCursor = (trailCursor + 1) % bounds.trailLength
    trailGhosts.forEach((ghost, index) => {
      const historyIndex = (trailCursor - 1 - index + bounds.trailLength * 2) % bounds.trailLength
      ghost.position.copy(trailPositions[historyIndex])
    })
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
    trailGhosts.forEach((ghost) => {
      scene.remove(ghost)
      ;(ghost.material as THREE.Material).dispose()
    })
    material.dispose()
  }

  return { update, checkHits, dispose }
}
