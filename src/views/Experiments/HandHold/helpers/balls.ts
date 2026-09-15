import * as THREE from 'three'

export interface BallSpawnBounds {
  count: number
  radius: number
  halfWidth: number
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
  /** Marks every ball within `radius` of any of `points` as hit, launching it away from
   * `awayFrom`, unless it is still cooling down from a previous hit. */
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

  const resetBall = (mesh: THREE.Mesh, velocity: THREE.Vector3): void => {
    mesh.position.set((Math.random() * 2 - 1) * bounds.halfWidth, bounds.spawnY, 0)
    velocity.set(0, 0, 0)
  }

  // Every ball falls under the same fixed gravity from the same fixed height, so without a
  // staggered start they would all reset in lockstep and fall as one synchronized row rather
  // than a natural, independent rain. Starting each one partway down its own fall, at a
  // random height, gives it a different reset time from every other ball, and that offset
  // then holds forever since the fall itself never changes their timing relative to one
  // another.
  const spawnStaggered = (mesh: THREE.Mesh, velocity: THREE.Vector3): void => {
    mesh.position.set(
      (Math.random() * 2 - 1) * bounds.halfWidth,
      bounds.respawnBelowY + Math.random() * (bounds.spawnY - bounds.respawnBelowY),
      0
    )
    velocity.set(0, 0, 0)
  }

  const balls = Array.from({ length: bounds.count }, () => {
    const mesh = new THREE.Mesh(geometry, material)
    const velocity = new THREE.Vector3()
    spawnStaggered(mesh, velocity)
    scene.add(mesh)
    return { mesh, velocity, lastHitMs: -Infinity }
  })

  const update = (deltaSeconds: number): void => {
    balls.forEach((ball) => {
      ball.velocity.y -= physics.gravity * deltaSeconds
      ball.mesh.position.addScaledVector(ball.velocity, deltaSeconds)
      if (ball.mesh.position.y < bounds.respawnBelowY) resetBall(ball.mesh, ball.velocity)
    })
  }

  const hitDirectionScratch = new THREE.Vector3()

  const checkHits = (
    points: readonly THREE.Vector3[],
    radius: number,
    awayFrom: THREE.Vector3,
    nowMs: number
  ): void => {
    const radiusSquared = radius * radius
    balls.forEach((ball) => {
      if (nowMs - ball.lastHitMs < physics.hitCooldownMs) return
      const isHit = points.some(
        (point) => point.distanceToSquared(ball.mesh.position) <= radiusSquared
      )
      if (!isHit) return
      hitDirectionScratch.subVectors(ball.mesh.position, awayFrom)
      hitDirectionScratch.y += physics.hitUpwardBias
      hitDirectionScratch.normalize()
      ball.velocity.copy(hitDirectionScratch).multiplyScalar(physics.hitSpeed)
      ball.lastHitMs = nowMs
    })
  }

  const dispose = (): void => {
    balls.forEach((ball) => scene.remove(ball.mesh))
    geometry.dispose()
    material.dispose()
  }

  return { update, checkHits, dispose }
}
