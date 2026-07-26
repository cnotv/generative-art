import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { advanceParticle, particleScale, debrisVelocity, createDebrisField } from './debris'
import {
  DEBRIS_COUNT,
  DEBRIS_GRAVITY,
  DEBRIS_LIFETIME,
  DEBRIS_SIZE,
  DEBRIS_UP_SPEED
} from '../config'
import type { DebrisParticle } from '../types'

const particle = (overrides: Partial<DebrisParticle> = {}): DebrisParticle => ({
  position: new THREE.Vector3(),
  velocity: new THREE.Vector3(),
  life: DEBRIS_LIFETIME,
  maxLife: DEBRIS_LIFETIME,
  size: DEBRIS_SIZE,
  angle: 0,
  spin: 0,
  colorIndex: 0,
  ...overrides
})

const FORWARD = new THREE.Vector3(0, 0, -1)
const RIGHT = new THREE.Vector3(1, 0, 0)

describe('advanceParticle', () => {
  it('pulls a particle down under gravity', () => {
    const chip = particle()

    advanceParticle(chip, 0.1)

    expect(chip.velocity.y).toBeCloseTo(DEBRIS_GRAVITY * 0.1)
    expect(chip.position.y).toBeLessThan(0)
  })

  it('carries a particle along its velocity', () => {
    const chip = particle({ velocity: new THREE.Vector3(4, 0, 0) })

    advanceParticle(chip, 0.25)

    expect(chip.position.x).toBeCloseTo(1)
  })

  it('spins a particle at its own rate', () => {
    const chip = particle({ spin: 2 })

    advanceParticle(chip, 0.5)

    expect(chip.angle).toBeCloseTo(1)
  })

  it('reports a particle alive while it has life left', () => {
    expect(advanceParticle(particle(), 0.01)).toBe(true)
  })

  it('reports a particle dead once its life runs out', () => {
    expect(advanceParticle(particle({ life: 0.05 }), 0.1)).toBe(false)
  })

  it('leaves a dead particle where it died rather than moving it on', () => {
    const chip = particle({ life: 0.01, velocity: new THREE.Vector3(0, 0, -50) })

    advanceParticle(chip, 0.1)

    expect(chip.position.z).toBe(0)
  })
})

describe('particleScale', () => {
  it('draws a fresh particle at its full size', () => {
    expect(particleScale(particle())).toBeCloseTo(DEBRIS_SIZE)
  })

  it('shrinks a particle away at the end of its life rather than blinking it out', () => {
    const fading = particleScale(particle({ life: DEBRIS_LIFETIME * 0.1 }))

    expect(fading).toBeGreaterThan(0)
    expect(fading).toBeLessThan(DEBRIS_SIZE)
  })

  it('is zero once dead', () => {
    expect(particleScale(particle({ life: 0 }))).toBe(0)
  })

  it('never exceeds the particle own size', () => {
    expect(particleScale(particle({ life: DEBRIS_LIFETIME }))).toBeLessThanOrEqual(DEBRIS_SIZE)
  })
})

describe('debrisVelocity', () => {
  // Chips are scuffed off the ground behind a rock rolling forward, so they
  // must travel backwards relative to it.
  it('throws chips backwards against the direction of travel', () => {
    const velocity = debrisVelocity(FORWARD, RIGHT, [0.5, 0.5, 0.5])

    expect(velocity.dot(FORWARD)).toBeLessThan(0)
  })

  it('always throws chips upwards', () => {
    ;[0, 0.5, 0.99].forEach((sample) => {
      expect(debrisVelocity(FORWARD, RIGHT, [sample, sample, sample]).y).toBeGreaterThan(0)
    })
  })

  it('fans chips to both sides so the trail is not a line', () => {
    const left = debrisVelocity(FORWARD, RIGHT, [0.5, 0, 0.5]).dot(RIGHT)
    const right = debrisVelocity(FORWARD, RIGHT, [0.5, 0.99, 0.5]).dot(RIGHT)

    expect(left).toBeLessThan(0)
    expect(right).toBeGreaterThan(0)
  })

  it('scales the upward kick with its sample', () => {
    const gentle = debrisVelocity(FORWARD, RIGHT, [0.5, 0.5, 0]).y
    const hard = debrisVelocity(FORWARD, RIGHT, [0.5, 0.5, 0.99]).y

    expect(hard).toBeGreaterThan(gentle)
    expect(hard).toBeLessThanOrEqual(DEBRIS_UP_SPEED * 1.5)
  })
})

describe('createDebrisField', () => {
  const setup = () => {
    const scene = new THREE.Scene()
    const field = createDebrisField(scene, [0x112233, 0x445566])
    return { scene, field }
  }

  it('draws the whole trail in two instanced meshes, fill and stroke', () => {
    const { scene } = setup()
    const meshes = scene.children.filter((child) => child instanceof THREE.InstancedMesh)

    expect(meshes).toHaveLength(2)
    expect(scene.children.map((child) => child.name).sort()).toEqual(['debris', 'debris-stroke'])
  })

  it('draws the stroke back-faces-only, so it reads as an outline', () => {
    const { scene } = setup()
    const stroke = scene.children.find((child) => child.name === 'debris-stroke') as THREE.Mesh

    expect((stroke.material as THREE.Material).side).toBe(THREE.BackSide)
  })

  it('starts with nothing alive', () => {
    expect(setup().field.liveCount()).toBe(0)
  })

  it('brings a particle to life when emitting', () => {
    const { field } = setup()

    field.emit({
      origin: new THREE.Vector3(),
      forward: FORWARD,
      right: RIGHT,
      samples: [0.5, 0.5, 0.5]
    })

    expect(field.liveCount()).toBe(1)
  })

  it('retires particles once their life runs out', () => {
    const { field } = setup()
    field.emit({
      origin: new THREE.Vector3(),
      forward: FORWARD,
      right: RIGHT,
      samples: [0.5, 0.5, 0.5]
    })

    field.update(DEBRIS_LIFETIME + 0.1)

    expect(field.liveCount()).toBe(0)
  })

  // Pooled: the field must never grow, however long the run lasts.
  it('recycles rather than growing past its pool', () => {
    const { field, scene } = setup()

    Array.from({ length: DEBRIS_COUNT * 3 }).forEach(() =>
      field.emit({
        origin: new THREE.Vector3(),
        forward: FORWARD,
        right: RIGHT,
        samples: [0.5, 0.5, 0.5]
      })
    )

    expect(field.liveCount()).toBeLessThanOrEqual(DEBRIS_COUNT)
    expect(scene.children).toHaveLength(2)
  })

  it('paces emission by the interval rather than firing every frame', () => {
    const { field } = setup()

    expect(field.shouldEmit(0.01, 0.04)).toBe(false)
    expect(field.shouldEmit(0.01, 0.04)).toBe(false)
    expect(field.shouldEmit(0.05, 0.04)).toBe(true)
    expect(field.shouldEmit(0.01, 0.04)).toBe(false)
  })

  it('clears itself from the scene on teardown', () => {
    const { field, scene } = setup()

    field.teardown()

    expect(scene.children).toHaveLength(0)
  })
})
