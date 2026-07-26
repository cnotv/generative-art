import * as THREE from 'three'
import type { DebrisField, DebrisParticle, DebrisEmitOptions } from '../types'
import {
  DEBRIS_BACK_SPEED,
  DEBRIS_COUNT,
  DEBRIS_GRAVITY,
  DEBRIS_LIFETIME,
  DEBRIS_SIZE,
  DEBRIS_SPIN,
  DEBRIS_SPREAD,
  DEBRIS_STROKE_COLOR,
  DEBRIS_STROKE_SCALE,
  DEBRIS_UP_SPEED
} from '../config'

const HALF = 0.5
const SPIN_AXIS = new THREE.Vector3(0.4, 1, 0.2).normalize()

// Written every frame for every live particle, so allocated once here.
const scratchMatrix = new THREE.Matrix4()
const scratchQuaternion = new THREE.Quaternion()
const scratchScale = new THREE.Vector3()
const scratchPosition = new THREE.Vector3()
const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0)

/**
 * Moves one particle forward in time under gravity.
 *
 * @param particle - Particle to advance, mutated in place
 * @param delta - Seconds elapsed
 * @returns Whether the particle is still alive afterwards
 */
export const advanceParticle = (particle: DebrisParticle, delta: number): boolean => {
  particle.life -= delta
  if (particle.life <= 0) return false
  particle.velocity.y += DEBRIS_GRAVITY * delta
  particle.position.addScaledVector(particle.velocity, delta)
  particle.angle += particle.spin * delta
  return true
}

/**
 * How large a particle draws for its remaining life: full size for most of it,
 * shrinking away at the end so chips vanish rather than blink out.
 *
 * @param particle - Particle being drawn
 * @returns A scale factor in [0, 1] times the particle's own size
 */
export const particleScale = (particle: DebrisParticle): number => {
  if (particle.life <= 0) return 0
  const remaining = particle.life / particle.maxLife
  return particle.size * Math.min(1, remaining / 0.35)
}

/**
 * Launch velocity for a chip thrown up behind the rock: backwards along travel,
 * upwards, and spread sideways so the trail fans out instead of forming a line.
 *
 * @param forward - The rock's travel direction
 * @param right - The track's right vector
 * @param samples - Three values in [0, 1) driving the spread
 * @returns A new velocity vector
 */
export const debrisVelocity = (
  forward: THREE.Vector3,
  right: THREE.Vector3,
  samples: [number, number, number]
): THREE.Vector3 =>
  new THREE.Vector3()
    .addScaledVector(forward, -DEBRIS_BACK_SPEED * (HALF + samples[0]))
    .addScaledVector(right, (samples[1] - HALF) * 2 * DEBRIS_SPREAD)
    .setY(DEBRIS_UP_SPEED * (HALF + samples[2]))

const createParticle = (): DebrisParticle => ({
  position: new THREE.Vector3(),
  velocity: new THREE.Vector3(),
  life: 0,
  maxLife: DEBRIS_LIFETIME,
  size: DEBRIS_SIZE,
  angle: 0,
  spin: 0,
  colorIndex: 0
})

const buildInstanced = (
  scene: THREE.Scene,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  name: string
): THREE.InstancedMesh => {
  const mesh = new THREE.InstancedMesh(geometry, material, DEBRIS_COUNT)
  mesh.name = name
  mesh.frustumCulled = false
  mesh.castShadow = false
  mesh.receiveShadow = false
  scene.add(mesh)
  return mesh
}

/**
 * A pooled trail of debris chips thrown up behind the rock.
 *
 * Everything is drawn in two instanced meshes: the chips themselves, and a
 * slightly larger copy drawn back-faces-only that reads as an ink outline
 * around each one. That keeps the hand-drawn stroke at two draw calls rather
 * than one per particle.
 *
 * @param scene - Scene to add the meshes to
 * @param colors - Colours chips are tinted with, normally the ground and the rock
 * @returns Handles to emit, advance and tear down the field
 */
export const createDebrisField = (scene: THREE.Scene, colors: number[]): DebrisField => {
  const geometry = new THREE.IcosahedronGeometry(1, 0)
  const strokeGeometry = geometry.clone()
  const fillMaterial = new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0 })
  const strokeMaterial = new THREE.MeshBasicMaterial({
    color: DEBRIS_STROKE_COLOR,
    side: THREE.BackSide
  })

  const fill = buildInstanced(scene, geometry, fillMaterial, 'debris')
  const stroke = buildInstanced(scene, strokeGeometry, strokeMaterial, 'debris-stroke')

  const particles = Array.from({ length: DEBRIS_COUNT }, createParticle)
  const palette = colors.map((color) => new THREE.Color(color))
  let cursor = 0
  let sinceEmit = 0

  const emit = (options: DebrisEmitOptions): void => {
    // Oldest-first recycling: with a full pool the longest-lived chip is the
    // one already fading, so reusing it is invisible.
    const particle = particles[cursor]
    cursor = (cursor + 1) % particles.length
    particle.position.copy(options.origin)
    particle.velocity.copy(debrisVelocity(options.forward, options.right, options.samples))
    particle.life = DEBRIS_LIFETIME
    particle.maxLife = DEBRIS_LIFETIME
    particle.size = DEBRIS_SIZE * (HALF + options.samples[0])
    particle.angle = options.samples[1] * Math.PI * 2
    particle.spin = (options.samples[2] - HALF) * 2 * DEBRIS_SPIN
    particle.colorIndex = Math.floor(options.samples[1] * palette.length) % palette.length
    fill.setColorAt(particles.indexOf(particle), palette[particle.colorIndex])
    if (fill.instanceColor) fill.instanceColor.needsUpdate = true
  }

  const update = (delta: number): void => {
    particles.forEach((particle, index) => {
      const alive = advanceParticle(particle, delta)
      if (!alive) {
        fill.setMatrixAt(index, HIDDEN)
        stroke.setMatrixAt(index, HIDDEN)
        return
      }
      const scale = particleScale(particle)
      scratchQuaternion.setFromAxisAngle(SPIN_AXIS, particle.angle)
      scratchPosition.copy(particle.position)
      scratchScale.setScalar(scale)
      scratchMatrix.compose(scratchPosition, scratchQuaternion, scratchScale)
      fill.setMatrixAt(index, scratchMatrix)
      scratchScale.setScalar(scale * DEBRIS_STROKE_SCALE)
      scratchMatrix.compose(scratchPosition, scratchQuaternion, scratchScale)
      stroke.setMatrixAt(index, scratchMatrix)
    })
    fill.instanceMatrix.needsUpdate = true
    stroke.instanceMatrix.needsUpdate = true
  }

  return {
    emit,
    update,
    /** True once enough time has passed to release the next chip. */
    shouldEmit: (delta: number, interval: number): boolean => {
      sinceEmit += delta
      if (sinceEmit < interval) return false
      sinceEmit = 0
      return true
    },
    liveCount: () => particles.filter((particle) => particle.life > 0).length,
    teardown: () => {
      scene.remove(fill)
      scene.remove(stroke)
      geometry.dispose()
      strokeGeometry.dispose()
      fillMaterial.dispose()
      strokeMaterial.dispose()
      fill.dispose()
      stroke.dispose()
    }
  }
}
