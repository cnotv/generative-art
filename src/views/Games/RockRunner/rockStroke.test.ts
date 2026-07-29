import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { strokeThicknessAt, buildRockStrokeGeometry, attachRockStroke } from './rockStroke'
import { ROCK_STROKE_NAME, ROCK_STROKE_SEGMENTS, ROCK_STROKE_WIDTH } from './config'

const direction = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z).normalize()
const radiusAt = (geometry: THREE.BufferGeometry, index: number) => {
  const position = geometry.getAttribute('position')
  return Math.hypot(position.getX(index), position.getY(index), position.getZ(index))
}

describe('strokeThicknessAt', () => {
  it('is the base thickness exactly when nothing is allowed to vary', () => {
    expect(strokeThicknessAt(direction(1, 0.3, -0.4), 0.04, 0)).toBeCloseTo(0.04)
  })

  it('varies around the ball once wobble is allowed', () => {
    const samples = Array.from({ length: 40 }, (_, i) =>
      strokeThicknessAt(direction(Math.sin(i), Math.cos(i * 1.7), Math.sin(i * 0.6)), 0.04, 1)
    )

    expect(Math.max(...samples) - Math.min(...samples)).toBeGreaterThan(0.005)
  })

  // Two vertices in the same place must be pushed the same way or the mesh
  // tears open between them.
  it('gives the same answer for the same direction, however it is reached', () => {
    const once = strokeThicknessAt(direction(0.4, -0.2, 0.9), 0.04, 1)
    const again = strokeThicknessAt(direction(0.8, -0.4, 1.8), 0.04, 1)

    expect(once).toBeCloseTo(again)
  })

  it('never turns the outline inside out, however hard it is wobbled', () => {
    const samples = Array.from({ length: 200 }, (_, i) =>
      strokeThicknessAt(direction(Math.sin(i * 2.1), Math.cos(i), Math.sin(i * 0.3)), 0.04, 8)
    )

    expect(Math.min(...samples)).toBeGreaterThanOrEqual(0)
  })

  it('scales with the thickness it is given', () => {
    const thin = strokeThicknessAt(direction(1, 1, 1), 0.02, 0.5)
    const thick = strokeThicknessAt(direction(1, 1, 1), 0.04, 0.5)

    expect(thick).toBeCloseTo(thin * 2)
  })
})

describe('buildRockStrokeGeometry', () => {
  it('is built in unit space so the rock can scale it', () => {
    const geometry = buildRockStrokeGeometry(0.04, 0)
    const radii = Array.from({ length: geometry.getAttribute('position').count }, (_, i) =>
      radiusAt(geometry, i)
    )

    expect(Math.min(...radii)).toBeCloseTo(1.04, 2)
    expect(Math.max(...radii)).toBeCloseTo(1.04, 2)
  })

  it('sits outside the rock it outlines', () => {
    const geometry = buildRockStrokeGeometry(ROCK_STROKE_WIDTH, 1)
    const radii = Array.from({ length: geometry.getAttribute('position').count }, (_, i) =>
      radiusAt(geometry, i)
    )

    expect(Math.min(...radii)).toBeGreaterThanOrEqual(1)
  })

  // A UV sphere stacks a whole ring of vertices at each pole and duplicates
  // every vertex down the seam. Displacing coincident vertices differently is
  // what tears a sphere open, so they have to land back on top of each other.
  it('keeps coincident vertices coincident', () => {
    const geometry = buildRockStrokeGeometry(0.05, 2)
    const position = geometry.getAttribute('position')
    const byKey = new Map<string, number[]>()
    Array.from({ length: position.count }).forEach((_, index) => {
      const source = new THREE.SphereGeometry(1, ROCK_STROKE_SEGMENTS, ROCK_STROKE_SEGMENTS / 2)
      const original = source.getAttribute('position')
      const key = [original.getX(index), original.getY(index), original.getZ(index)]
        .map((value) => value.toFixed(4))
        .join(',')
      byKey.set(key, [...(byKey.get(key) ?? []), radiusAt(geometry, index)])
      source.dispose()
    })
    const shared = [...byKey.values()].filter((radii) => radii.length > 1)

    expect(shared.length).toBeGreaterThan(0)
    shared.forEach((radii) => {
      expect(Math.max(...radii) - Math.min(...radii)).toBeLessThan(1e-6)
    })
  })

  it('drops normals, which an unlit hull never reads', () => {
    expect(buildRockStrokeGeometry(0.04, 1).getAttribute('normal')).toBeUndefined()
  })
})

describe('attachRockStroke', () => {
  it('parents the outline to the rock so it inherits every transform', () => {
    const rock = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 8))

    const hull = attachRockStroke(rock, 0.04, 1)

    expect(hull.parent).toBe(rock)
    expect(rock.getObjectByName(ROCK_STROKE_NAME)).toBe(hull)
  })

  // Only the back faces survive, which is what leaves a rim rather than a shell
  // covering the rock entirely.
  it('draws back faces only', () => {
    const rock = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 8))

    const hull = attachRockStroke(rock, 0.04, 1)

    expect((hull.material as THREE.Material).side).toBe(THREE.BackSide)
  })

  it('replaces an outline rather than stacking a second one on the rock', () => {
    const rock = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 8))

    attachRockStroke(rock, 0.04, 1)
    attachRockStroke(rock, 0.08, 0.5)

    expect(rock.children.filter((child) => child.name === ROCK_STROKE_NAME)).toHaveLength(1)
  })

  it('casts no shadow, being a drawing rather than a solid', () => {
    const rock = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 8))

    expect(attachRockStroke(rock, 0.04, 1).castShadow).toBe(false)
  })
})
