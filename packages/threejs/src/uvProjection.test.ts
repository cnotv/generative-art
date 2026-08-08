import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { remapUVsToWorldProjection } from './uvProjection'

/**
 * Two quads a unit apart facing opposite ways along Z, spanning x in [-1, 1] —
 * the smallest thing that has a front, a back, and a measurable width.
 */
const createTwoSidedModel = (): THREE.Object3D => {
  const build = (normalZ: number): THREE.Mesh => {
    const geometry = new THREE.BufferGeometry()
    const corners = [
      [-1, 0, 0],
      [1, 0, 0],
      [1, 2, 0],
      [-1, 2, 0]
    ].flat()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(corners, 3))
    geometry.setAttribute(
      'normal',
      new THREE.Float32BufferAttribute(
        [0, 0, normalZ, 0, 0, normalZ, 0, 0, normalZ, 0, 0, normalZ],
        3
      )
    )
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0, 0, 0], 2))
    return new THREE.Mesh(geometry)
  }
  const root = new THREE.Object3D()
  const facingCamera = build(1)
  const facingAway = build(-1)
  facingAway.position.z = -1
  root.add(facingCamera, facingAway)
  return root
}

const uvsOf = (model: THREE.Object3D, index: number): [number, number][] => {
  const mesh = model.children[index] as THREE.Mesh
  const uv = mesh.geometry.attributes.uv
  return Array.from({ length: uv.count }, (_, i) => [uv.getX(i), uv.getY(i)])
}

describe('remapUVsToWorldProjection', () => {
  describe('wrapped', () => {
    it('sends both faces across the full sheet', () => {
      const model = createTwoSidedModel()
      remapUVsToWorldProjection(model)
      const near = uvsOf(model, 0).map(([u]) => u)
      const far = uvsOf(model, 1).map(([u]) => u)
      expect(Math.min(...near, ...far)).toBeCloseTo(0)
      expect(Math.max(...near, ...far)).toBeCloseTo(1)
    })

    it('mirrors the far face onto the same coordinates as the near one', () => {
      const model = createTwoSidedModel()
      remapUVsToWorldProjection(model)
      expect([...new Set(uvsOf(model, 0).map(([u]) => u))].sort()).toEqual(
        [...new Set(uvsOf(model, 1).map(([u]) => u))].sort()
      )
    })
  })

  describe('split', () => {
    it('keeps each face inside its own half of the sheet', () => {
      const model = createTwoSidedModel()
      remapUVsToWorldProjection(model, 'split')
      const near = uvsOf(model, 0).map(([u]) => u)
      const far = uvsOf(model, 1).map(([u]) => u)
      expect(Math.max(...near)).toBeLessThanOrEqual(0.5)
      expect(Math.min(...far)).toBeGreaterThanOrEqual(0.5)
    })

    it('gives each face the full width of its own panel', () => {
      const model = createTwoSidedModel()
      remapUVsToWorldProjection(model, 'split')
      const near = uvsOf(model, 0).map(([u]) => u)
      const far = uvsOf(model, 1).map(([u]) => u)
      expect(Math.min(...near)).toBeCloseTo(0)
      expect(Math.max(...far)).toBeCloseTo(1)
    })

    it('leaves the two faces sharing no coordinate, so a mark lands on one only', () => {
      const model = createTwoSidedModel()
      remapUVsToWorldProjection(model, 'split')
      const near = new Set(uvsOf(model, 0).map(([u]) => u.toFixed(4)))
      const far = uvsOf(model, 1).map(([u]) => u.toFixed(4))
      expect(far.some((u) => near.has(u) && u !== '0.5000')).toBe(false)
    })
  })

  it('parks faces pointing sideways on a single texel, in either layout', () => {
    const sideways = new THREE.Object3D()
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1, 1, 1], 3))
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute([1, 0, 0, 1, 0, 0], 3))
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute([0.9, 0.9, 0.9, 0.9], 2))
    sideways.add(new THREE.Mesh(geometry))

    remapUVsToWorldProjection(sideways, 'split')
    expect(uvsOf(sideways, 0)).toEqual([
      [0, 0],
      [0, 0]
    ])
  })
})
