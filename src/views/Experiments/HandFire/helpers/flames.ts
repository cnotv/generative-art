import * as THREE from 'three'

export interface Point2D {
  x: number
  y: number
}

/**
 * Project a mirrored normalized image-space point (as shown in the mirrored video preview)
 * onto the world-space plane at z=0, for a camera sitting on the z axis looking at the origin.
 * Writes into `target` rather than returning a new vector, so callers can reuse one allocation
 * across every landmark read each frame.
 */
export const mirroredImagePointToWorld = (
  point: Point2D,
  cameraDistance: number,
  verticalFovDegrees: number,
  aspect: number,
  target: THREE.Vector3
): void => {
  const halfHeight = cameraDistance * Math.tan((verticalFovDegrees * Math.PI) / 360)
  const halfWidth = halfHeight * aspect
  target.set((0.5 - point.x) * 2 * halfWidth, (0.5 - point.y) * 2 * halfHeight, 0)
}

const createFireParticleMaterial = (): THREE.ShaderMaterial =>
  new THREE.ShaderMaterial({
    vertexShader: `
      attribute float size;
      attribute float heat;
      varying float vHeat;
      void main() {
        vHeat = heat;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        gl_PointSize = size * (300.0 / -mvPosition.z);
      }
    `,
    fragmentShader: `
      varying float vHeat;
      void main() {
        vec2 uv = gl_PointCoord - vec2(0.5);
        float dist = length(uv);
        if (dist > 0.5) discard;
        float alpha = smoothstep(0.5, 0.0, dist) * vHeat;
        vec3 edgeColor = vec3(0.95, 0.35, 0.05);
        vec3 coreColor = vec3(1.0, 0.95, 0.7);
        vec3 color = mix(edgeColor, coreColor, vHeat);
        gl_FragColor = vec4(color, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  })

const createFireGeometry = (count: number): THREE.BufferGeometry => {
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3))
  geometry.setAttribute('size', new THREE.BufferAttribute(new Float32Array(count), 1))
  geometry.setAttribute('heat', new THREE.BufferAttribute(new Float32Array(count), 1))
  return geometry
}

const disposePoints = (scene: THREE.Scene, points: THREE.Points): void => {
  scene.remove(points)
  points.geometry.dispose()
  ;(points.material as THREE.Material).dispose()
}

export interface HandFlameSystem {
  update: (
    timeSeconds: number,
    handWorldPositions: readonly (THREE.Vector3 | null)[],
    intensity: number
  ) => void
  dispose: () => void
}

/**
 * One flame per tracked hand slot, each a cluster of particles that rise from the hand's
 * current world position and fade out, looping back to the hand rather than dying and
 * respawning: cheaper than pooling, and a flame has no "particle count" a player would notice.
 */
export const createHandFlameSystem = (
  scene: THREE.Scene,
  handSlots: number,
  particlesPerHand: number
): HandFlameSystem => {
  const totalCount = handSlots * particlesPerHand
  const geometry = createFireGeometry(totalCount)
  const material = createFireParticleMaterial()
  const points = new THREE.Points(geometry, material)
  points.frustumCulled = false
  scene.add(points)

  const positions = geometry.getAttribute('position') as THREE.BufferAttribute
  const sizes = geometry.getAttribute('size') as THREE.BufferAttribute
  const heats = geometry.getAttribute('heat') as THREE.BufferAttribute
  const indices = Array.from({ length: totalCount }, (_, index) => index)

  const phase = Float32Array.from(indices, () => Math.random())
  const spin = Float32Array.from(indices, () => Math.random() * Math.PI * 2)
  const riseSpeed = Float32Array.from(indices, () => 0.5 + Math.random() * 0.4)
  const wobbleRadius = Float32Array.from(indices, () => 0.04 + Math.random() * 0.1)

  const update = (
    timeSeconds: number,
    handWorldPositions: readonly (THREE.Vector3 | null)[],
    intensity: number
  ): void => {
    indices.forEach((index) => {
      const handIndex = Math.floor(index / particlesPerHand)
      const handPosition = handWorldPositions[handIndex]
      if (!handPosition) {
        heats.array[index] = 0
        sizes.array[index] = 0
        return
      }
      const rise = (phase[index] + timeSeconds * riseSpeed[index]) % 1
      const angle = spin[index] + timeSeconds * 1.5
      const outward = wobbleRadius[index] * (1 - rise)
      positions.array[index * 3] = handPosition.x + Math.cos(angle) * outward
      positions.array[index * 3 + 1] = handPosition.y + rise * 0.7
      positions.array[index * 3 + 2] = handPosition.z + Math.sin(angle) * outward
      heats.array[index] = (1 - rise) * intensity
      sizes.array[index] = (0.35 + (1 - rise) * 0.45) * intensity
    })
    positions.needsUpdate = true
    sizes.needsUpdate = true
    heats.needsUpdate = true
  }

  const dispose = (): void => disposePoints(scene, points)

  return { update, dispose }
}

interface FireballSlot {
  active: boolean
  origin: THREE.Vector3
  velocity: THREE.Vector3
  spawnTimeMs: number
}

export interface FireballSystem {
  spawn: (origin: THREE.Vector3, direction: THREE.Vector3, speed: number, nowMs: number) => void
  update: (nowMs: number, lifetimeMs: number) => void
  dispose: () => void
}

/** A fixed pool of fireballs, each a small rigid cluster of particles flying in a straight
 * line: pooled rather than spawned/collected per throw, so a rapid volley never allocates. */
export const createFireballSystem = (
  scene: THREE.Scene,
  maxFireballs: number,
  particlesPerBall: number
): FireballSystem => {
  const totalCount = maxFireballs * particlesPerBall
  const geometry = createFireGeometry(totalCount)
  const material = createFireParticleMaterial()
  const points = new THREE.Points(geometry, material)
  points.frustumCulled = false
  scene.add(points)

  const positions = geometry.getAttribute('position') as THREE.BufferAttribute
  const sizes = geometry.getAttribute('size') as THREE.BufferAttribute
  const heats = geometry.getAttribute('heat') as THREE.BufferAttribute

  const slots: FireballSlot[] = Array.from({ length: maxFireballs }, () => ({
    active: false,
    origin: new THREE.Vector3(),
    velocity: new THREE.Vector3(),
    spawnTimeMs: 0
  }))
  const slotIndices = Array.from({ length: maxFireballs }, (_, index) => index)
  const particleIndices = Array.from({ length: particlesPerBall }, (_, index) => index)
  const particleOffset = Float32Array.from(
    { length: particlesPerBall },
    () => (Math.random() - 0.5) * 0.12
  )
  const particlePhase = Float32Array.from(
    { length: particlesPerBall },
    () => Math.random() * Math.PI * 2
  )

  const scratchPosition = new THREE.Vector3()

  const spawn = (
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    speed: number,
    nowMs: number
  ): void => {
    const availableIndex = slots.findIndex((slot) => !slot.active)
    const oldestIndex = slotIndices.reduce(
      (oldest, index) => (slots[index].spawnTimeMs < slots[oldest].spawnTimeMs ? index : oldest),
      0
    )
    const slot = slots[availableIndex === -1 ? oldestIndex : availableIndex]
    slot.active = true
    slot.origin.copy(origin)
    slot.velocity.copy(direction).normalize().multiplyScalar(speed)
    slot.spawnTimeMs = nowMs
  }

  const update = (nowMs: number, lifetimeMs: number): void => {
    slotIndices.forEach((slotIndex) => {
      const slot = slots[slotIndex]
      const ageMs = nowMs - slot.spawnTimeMs
      if (slot.active && ageMs > lifetimeMs) slot.active = false
      const lifeFraction = slot.active ? Math.min(ageMs / lifetimeMs, 1) : 1
      const ageSeconds = Math.max(ageMs, 0) / 1000
      scratchPosition.copy(slot.velocity).multiplyScalar(ageSeconds).add(slot.origin)

      particleIndices.forEach((particleIndex) => {
        const bufferIndex = slotIndex * particlesPerBall + particleIndex
        const wobble = particleOffset[particleIndex]
        const angle = particlePhase[particleIndex] + nowMs * 0.01
        positions.array[bufferIndex * 3] = scratchPosition.x + Math.cos(angle) * wobble
        positions.array[bufferIndex * 3 + 1] = scratchPosition.y + Math.sin(angle) * wobble
        positions.array[bufferIndex * 3 + 2] = scratchPosition.z
        heats.array[bufferIndex] = slot.active ? 1 - lifeFraction * 0.6 : 0
        sizes.array[bufferIndex] = slot.active ? 0.55 * (1 - lifeFraction * 0.3) : 0
      })
    })
    positions.needsUpdate = true
    sizes.needsUpdate = true
    heats.needsUpdate = true
  }

  const dispose = (): void => disposePoints(scene, points)

  return { spawn, update, dispose }
}

export interface EmberFieldBounds {
  halfWidth: number
  halfHeight: number
  depthRange: [number, number]
}

export interface EmberFieldSystem {
  update: (timeSeconds: number) => void
  dispose: () => void
}

/** Ambient embers drifting slowly upward through a fixed volume behind the hand flames, as a
 * background atmosphere effect rather than anything the gesture logic drives. */
export const createEmberField = (
  scene: THREE.Scene,
  count: number,
  bounds: EmberFieldBounds
): EmberFieldSystem => {
  const geometry = createFireGeometry(count)
  const material = createFireParticleMaterial()
  const points = new THREE.Points(geometry, material)
  points.frustumCulled = false
  scene.add(points)

  const positions = geometry.getAttribute('position') as THREE.BufferAttribute
  const sizes = geometry.getAttribute('size') as THREE.BufferAttribute
  const heats = geometry.getAttribute('heat') as THREE.BufferAttribute
  const indices = Array.from({ length: count }, (_, index) => index)

  const baseX = Float32Array.from(indices, () => (Math.random() * 2 - 1) * bounds.halfWidth)
  const baseZ = Float32Array.from(
    indices,
    () => bounds.depthRange[0] + Math.random() * (bounds.depthRange[1] - bounds.depthRange[0])
  )
  const phase = Float32Array.from(indices, () => Math.random())
  const riseSpeed = Float32Array.from(indices, () => 0.04 + Math.random() * 0.07)
  const swayPhase = Float32Array.from(indices, () => Math.random() * Math.PI * 2)

  const update = (timeSeconds: number): void => {
    indices.forEach((index) => {
      const rise = (phase[index] + timeSeconds * riseSpeed[index]) % 1
      positions.array[index * 3] =
        baseX[index] + Math.sin(timeSeconds * 0.3 + swayPhase[index]) * 0.3
      positions.array[index * 3 + 1] = -bounds.halfHeight + rise * bounds.halfHeight * 2
      positions.array[index * 3 + 2] = baseZ[index]
      const fade = Math.sin(rise * Math.PI)
      heats.array[index] = fade * 0.45
      sizes.array[index] = 0.25 + fade * 0.35
    })
    positions.needsUpdate = true
    sizes.needsUpdate = true
    heats.needsUpdate = true
  }

  const dispose = (): void => disposePoints(scene, points)

  return { update, dispose }
}
