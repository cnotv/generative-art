import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { buildArcSweepGeometry, bankedCrossSection, buildFunnelGeometry } from './pieceGeometry'
import {
  LANE_WIDTH,
  BUMPER_LATERAL_OFFSET,
  BUMPER_SIZE_XZ,
  BUMPER_CLEARANCE_MARGIN
} from './config'
import { MARBLE_RADIUS } from '../MarbleMadness/config'

type Triangle = [THREE.Vector3, THREE.Vector3, THREE.Vector3]

const geometryTriangles = (geometry: THREE.BufferGeometry): Triangle[] => {
  const positions = geometry.getAttribute('position')
  const index = geometry.getIndex()
  const vertexAt = (vertexIndex: number): THREE.Vector3 =>
    new THREE.Vector3().fromBufferAttribute(positions, vertexIndex)
  const indices = index
    ? Array.from({ length: index.count }, (_, itemIndex) => index.getX(itemIndex))
    : Array.from({ length: positions.count }, (_, itemIndex) => itemIndex)
  return Array.from({ length: indices.length / 3 }, (_, triangleIndex) => [
    vertexAt(indices[triangleIndex * 3]),
    vertexAt(indices[triangleIndex * 3 + 1]),
    vertexAt(indices[triangleIndex * 3 + 2])
  ])
}

const triangleNormal = ([a, b, c]: Triangle): THREE.Vector3 =>
  new THREE.Vector3().crossVectors(b.clone().sub(a), c.clone().sub(a))

const signedVolume = (geometry: THREE.BufferGeometry): number =>
  geometryTriangles(geometry).reduce(
    (volume, [a, b, c]) => volume + a.dot(new THREE.Vector3().crossVectors(b, c)) / 6,
    0
  )

const ARC_CASES: { label: string; side: 1 | -1; crossSection?: [number, number][] }[] = [
  { label: 'curve-left', side: 1 },
  { label: 'curve-right', side: -1 },
  { label: 'banked-left', side: 1, crossSection: bankedCrossSection(1) },
  { label: 'banked-right', side: -1, crossSection: bankedCrossSection(-1) }
]

describe('buildArcSweepGeometry orientation', () => {
  it.each(ARC_CASES)(
    '$label winds triangles outward so the closed sweep has positive volume',
    ({ side, crossSection }) => {
      const geometry = buildArcSweepGeometry(side, crossSection)
      expect(signedVolume(geometry)).toBeGreaterThan(0)
    }
  )

  it.each(ARC_CASES)(
    '$label winds its deck-top surface to face upward',
    ({ side, crossSection }) => {
      const geometry = buildArcSweepGeometry(side, crossSection)
      const averageY = (triangles: Triangle[]): number =>
        triangles.reduce((sum, [a, b, c]) => sum + (a.y + b.y + c.y) / 3, 0) / triangles.length
      // The descending helix tilts the deck, so select the near-horizontal
      // surfaces (deck top and deck bottom) by their normal instead of by height.
      const horizontal = geometryTriangles(geometry).filter((triangle) => {
        const normal = triangleNormal(triangle)
        const length = normal.length()
        return length > 0 && Math.abs(normal.y) / length > 0.9
      })
      const upFacing = horizontal.filter((triangle) => triangleNormal(triangle).y > 0)
      const downFacing = horizontal.filter((triangle) => triangleNormal(triangle).y < 0)
      expect(upFacing.length).toBeGreaterThan(0)
      expect(downFacing.length).toBeGreaterThan(0)
      // Correct outward winding: the up-facing surface is the deck the marble
      // rolls on, and it sits above the down-facing underside.
      expect(averageY(upFacing)).toBeGreaterThan(averageY(downFacing))
    }
  )

  it.each(ARC_CASES)(
    '$label faces the entry cap toward the previous piece',
    ({ side, crossSection }) => {
      const geometry = buildArcSweepGeometry(side, crossSection)
      const entryZ = Math.max(
        ...geometryTriangles(geometry).flatMap((triangle) => triangle.map((vertex) => vertex.z))
      )
      const entryCapTriangles = geometryTriangles(geometry).filter((triangle) =>
        triangle.every((vertex) => Math.abs(vertex.z - entryZ) < 1e-4)
      )
      expect(entryCapTriangles.length).toBeGreaterThan(0)
      entryCapTriangles.forEach((triangle) => {
        expect(triangleNormal(triangle).z).toBeGreaterThan(0)
      })
    }
  )

  it.each([
    { label: 'banked-left', side: 1 as const },
    { label: 'banked-right', side: -1 as const }
  ])('$label raises its outer wall above a plain curve to hold the marble', ({ side }) => {
    const maxVertexY = (geometry: THREE.BufferGeometry): number =>
      Math.max(
        ...geometryTriangles(geometry).flatMap((triangle) => triangle.map((vertex) => vertex.y))
      )
    const curveTop = maxVertexY(buildArcSweepGeometry(side))
    const bankedTop = maxVertexY(buildArcSweepGeometry(side, bankedCrossSection(side)))
    expect(bankedTop).toBeGreaterThan(curveTop)
  })
})

describe('bumper field clearances', () => {
  it('leaves more than a marble diameter between bumper edge and wall', () => {
    const wallGap = LANE_WIDTH / 2 - BUMPER_LATERAL_OFFSET - BUMPER_SIZE_XZ / 2
    expect(wallGap).toBeGreaterThanOrEqual(2 * MARBLE_RADIUS + BUMPER_CLEARANCE_MARGIN)
  })
})

describe('buildFunnelGeometry orientation', () => {
  it('faces every bowl triangle toward the rolling surface (upward)', () => {
    const geometry = buildFunnelGeometry()
    geometryTriangles(geometry).forEach((triangle) => {
      const normal = triangleNormal(triangle)
      if (normal.lengthSq() < 1e-10) return
      expect(normal.y).toBeGreaterThan(0)
    })
  })
})
