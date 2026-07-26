import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import {
  sweepPositions,
  sweepIndices,
  buildSweepGeometry,
  geometryWorldTriangles
} from './sweptGeometry'
import type { SweepStation, CrossSection } from '@/types/sweptGeometry'

const SQUARE: CrossSection = [
  [-1, 0],
  [-1, 1],
  [1, 1],
  [1, 0]
]

const straightStations = (count: number, spacing = 1): SweepStation[] =>
  Array.from({ length: count }, (_, index) => ({
    origin: new THREE.Vector3(0, 0, -index * spacing),
    orientation: new THREE.Quaternion()
  }))

describe('sweepPositions', () => {
  it('emits one vertex pair per cross-section edge per station', () => {
    const positions = sweepPositions(straightStations(3), SQUARE)

    expect(positions).toHaveLength(3 * SQUARE.length * 2 * 3)
  })

  it('places an unrotated cross-section at the station origin', () => {
    const positions = sweepPositions(
      [{ origin: new THREE.Vector3(5, 2, -7), orientation: new THREE.Quaternion() }],
      SQUARE
    )

    expect(positions.slice(0, 3)).toEqual([4, 2, -7])
  })

  it('applies the station orientation to the cross-section', () => {
    const halfTurn = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI)
    const positions = sweepPositions(
      [{ origin: new THREE.Vector3(), orientation: halfTurn }],
      SQUARE
    )

    expect(positions[0]).toBeCloseTo(1)
    expect(positions[1]).toBeCloseTo(0)
  })
})

describe('sweepIndices', () => {
  it.each([
    [2, SQUARE],
    [5, SQUARE],
    [3, [...SQUARE, [2, 2]] as CrossSection]
  ])('indexes %i stations of a %j-point section within bounds', (stationCount, crossSection) => {
    const indices = sweepIndices(stationCount, crossSection)
    const vertexCount = stationCount * crossSection.length * 2

    expect(indices.length % 3).toBe(0)
    expect(Math.max(...indices)).toBeLessThan(vertexCount)
    expect(Math.min(...indices)).toBeGreaterThanOrEqual(0)
  })

  it('emits six side indices per edge per station gap, plus both caps', () => {
    const sideIndices = 6 * SQUARE.length * (4 - 1)
    const capIndices = (SQUARE.length - 2) * 3 * 2

    expect(sweepIndices(4, SQUARE)).toHaveLength(sideIndices + capIndices)
  })
})

describe('buildSweepGeometry', () => {
  it('returns an indexed geometry with normals', () => {
    const geometry = buildSweepGeometry(straightStations(4), SQUARE)

    expect(geometry.getIndex()).not.toBeNull()
    expect(geometry.getAttribute('normal')).toBeDefined()
    expect(geometry.getAttribute('position').count).toBe(4 * SQUARE.length * 2)
  })

  it('spans the full station range along the sweep axis', () => {
    const geometry = buildSweepGeometry(straightStations(4, 10), SQUARE)
    geometry.computeBoundingBox()

    expect(geometry.boundingBox?.min.z).toBeCloseTo(-30)
    expect(geometry.boundingBox?.max.z).toBeCloseTo(0)
  })
})

describe('geometryWorldTriangles', () => {
  it('flattens an indexed geometry into a triangle soup', () => {
    const geometry = buildSweepGeometry(straightStations(2), SQUARE)
    const indexCount = geometry.getIndex()!.count

    const triangles = geometryWorldTriangles(geometry, new THREE.Matrix4())

    expect(triangles).toHaveLength(indexCount * 3)
  })

  it('applies the world matrix to every vertex', () => {
    const geometry = new THREE.BoxGeometry(2, 2, 2)
    const matrix = new THREE.Matrix4().makeTranslation(100, 0, 0)

    const triangles = geometryWorldTriangles(geometry, matrix)
    const xValues = triangles.filter((_, index) => index % 3 === 0)

    expect(Math.min(...xValues)).toBeCloseTo(99)
    expect(Math.max(...xValues)).toBeCloseTo(101)
  })

  it('leaves the source geometry untouched', () => {
    const geometry = new THREE.BoxGeometry(2, 2, 2)

    geometryWorldTriangles(geometry, new THREE.Matrix4().makeTranslation(50, 0, 0))
    geometry.computeBoundingBox()

    expect(geometry.boundingBox?.max.x).toBeCloseTo(1)
  })
})
