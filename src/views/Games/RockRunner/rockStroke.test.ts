import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { strokeThicknessAt, buildRockStrokeGeometry, attachRockStroke } from './rockStroke'
import {
  ROCK_RENDER_ORDER,
  ROCK_STROKE_NAME,
  ROCK_STROKE_RENDER_ORDER,
  ROCK_STROKE_SEGMENTS,
  ROCK_STROKE_WIDTH
} from './config'

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
  it('is built at the rock it wraps, not at unit size', () => {
    const geometry = buildRockStrokeGeometry(2.2, 0.04, 0)
    const radii = Array.from({ length: geometry.getAttribute('position').count }, (_, i) =>
      radiusAt(geometry, i)
    )

    expect(Math.min(...radii)).toBeCloseTo(2.2 * 1.04, 2)
    expect(Math.max(...radii)).toBeCloseTo(2.2 * 1.04, 2)
  })

  // The whole outline lives or dies on this. A hull smaller than the rock is
  // swallowed by it and renders nothing at all, silently.
  it.each([1, 2.2, 6.5])('clears the surface of a rock of radius %s', (radius) => {
    const geometry = buildRockStrokeGeometry(radius, ROCK_STROKE_WIDTH, 1)
    const radii = Array.from({ length: geometry.getAttribute('position').count }, (_, i) =>
      radiusAt(geometry, i)
    )

    expect(Math.min(...radii)).toBeGreaterThanOrEqual(radius)
  })

  // A UV sphere stacks a whole ring of vertices at each pole and duplicates
  // every vertex down the seam. Displacing coincident vertices differently is
  // what tears a sphere open, so they have to land back on top of each other.
  it('keeps coincident vertices coincident', () => {
    const geometry = buildRockStrokeGeometry(2.2, 0.05, 2)
    const position = geometry.getAttribute('position')
    const byKey = new Map<string, number[]>()
    Array.from({ length: position.count }).forEach((_, index) => {
      const source = new THREE.SphereGeometry(2.2, ROCK_STROKE_SEGMENTS, ROCK_STROKE_SEGMENTS / 2)
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
    expect(buildRockStrokeGeometry(2.2, 0.04, 1).getAttribute('normal')).toBeUndefined()
  })
})

describe('attachRockStroke', () => {
  it('parents the outline to the rock so it inherits every transform', () => {
    const rock = new THREE.Mesh(new THREE.SphereGeometry(2.2, 8, 8))

    const hull = attachRockStroke(rock, 0.04, 1)

    expect(hull.parent).toBe(rock)
    expect(rock.getObjectByName(ROCK_STROKE_NAME)).toBe(hull)
  })

  // Front faces, not the back ones an inverted hull is usually built from. Back
  // faces put the line at the far side of the ball, and everything between the
  // camera and that surface draws across it.
  it('draws front faces, so the line sits in front of the ball', () => {
    const rock = new THREE.Mesh(new THREE.SphereGeometry(2.2, 8, 8))

    const hull = attachRockStroke(rock, 0.04, 1)

    expect((hull.material as THREE.Material).side).toBe(THREE.FrontSide)
  })

  it('replaces an outline rather than stacking a second one on the rock', () => {
    const rock = new THREE.Mesh(new THREE.SphereGeometry(2.2, 8, 8))

    attachRockStroke(rock, 0.04, 1)
    attachRockStroke(rock, 0.08, 0.5)

    expect(rock.children.filter((child) => child.name === ROCK_STROKE_NAME)).toHaveLength(1)
  })

  // The rock carries its size in its geometry and leaves its scale at one, so a
  // hull built at unit size vanishes inside it. Measuring the radius off the
  // mesh is what stops a caller getting this wrong.
  it.each([1, 2.2, 6.5])('wraps a rock of radius %s rather than hiding inside it', (radius) => {
    const rock = new THREE.Mesh(new THREE.SphereGeometry(radius, 8, 8))

    const hull = attachRockStroke(rock, 0.04, 1)
    const position = hull.geometry.getAttribute('position')
    const radii = Array.from({ length: position.count }, (_, i) => radiusAt(hull.geometry, i))

    expect(Math.min(...radii)).toBeGreaterThan(radius)
  })

  it('casts no shadow, being a drawing rather than a solid', () => {
    const rock = new THREE.Mesh(new THREE.SphereGeometry(2.2, 8, 8))

    expect(attachRockStroke(rock, 0.04, 1).castShadow).toBe(false)
  })
})

describe('the outline against the debris trail', () => {
  const wrap = () => {
    const rock = new THREE.Mesh(new THREE.SphereGeometry(2.2, 8, 8))
    return { rock, hull: attachRockStroke(rock, 0.09, 1) }
  }

  // The rim has to lose to what is genuinely in front of the rock and win
  // against what is behind it, which is only possible if it takes part in depth
  // at all. Turning depth off fixed the debris and put the line under every
  // tree, since the scenery is transparent and draws after all opaque geometry.
  it('still takes part in depth, so the world can cover it', () => {
    const { hull } = wrap()

    expect((hull.material as THREE.Material).depthTest).toBe(true)
  })

  it('writes no depth, so the rock behind it is unaffected', () => {
    const { hull } = wrap()

    expect((hull.material as THREE.Material).depthWrite).toBe(false)
  })

  // Order is what keeps the outline from swallowing the rock: the hull paints
  // its whole disc, and the rock is drawn over it afterwards.
  it('draws the rock after the outline, not before it', () => {
    const { rock, hull } = wrap()

    expect(hull.renderOrder).toBe(ROCK_STROKE_RENDER_ORDER)
    expect(rock.renderOrder).toBe(ROCK_RENDER_ORDER)
    expect(rock.renderOrder).toBeGreaterThan(hull.renderOrder)
  })

  // Debris is left at the default, so both of these have to clear it.
  // The scenery is transparent and draws after every opaque object, so the
  // outline has to join that pass to sit above it — order alone cannot cross
  // the boundary between the two lists.
  it('joins the transparent pass, the only one drawn after the scenery', () => {
    const { rock, hull } = wrap()

    expect((hull.material as THREE.Material).transparent).toBe(true)
    expect((rock.material as THREE.Material).transparent).toBe(true)
  })

  it('draws both after the scenery, which orders at zero', () => {
    const { rock, hull } = wrap()

    expect(hull.renderOrder).toBeGreaterThan(0)
    expect(rock.renderOrder).toBeGreaterThan(0)
  })
})
