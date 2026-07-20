import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { buildArcSweepGeometry, buildFunnelGeometry } from './pieceGeometry'
import {
  BANK_ANGLE,
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

const ARC_CASES: { label: string; side: 1 | -1; roll: number }[] = [
  { label: 'curve-left', side: 1, roll: 0 },
  { label: 'curve-right', side: -1, roll: 0 },
  { label: 'banked-left', side: 1, roll: BANK_ANGLE },
  { label: 'banked-right', side: -1, roll: BANK_ANGLE }
]

describe('buildArcSweepGeometry orientation', () => {
  it.each(ARC_CASES)(
    '$label winds triangles outward so the closed sweep has positive volume',
    ({ side, roll }) => {
      const geometry = buildArcSweepGeometry(side, roll)
      expect(signedVolume(geometry)).toBeGreaterThan(0)
    }
  )

  it.each(ARC_CASES.filter(({ roll }) => roll === 0))(
    '$label faces every deck-top triangle upward',
    ({ side, roll }) => {
      const geometry = buildArcSweepGeometry(side, roll)
      const deckTriangles = geometryTriangles(geometry).filter((triangle) =>
        triangle.every((vertex) => Math.abs(vertex.y) < 1e-4)
      )
      expect(deckTriangles.length).toBeGreaterThan(0)
      deckTriangles.forEach((triangle) => {
        expect(triangleNormal(triangle).y).toBeGreaterThan(0)
      })
    }
  )

  it.each(ARC_CASES)('$label faces the entry cap toward the previous piece', ({ side, roll }) => {
    const geometry = buildArcSweepGeometry(side, roll)
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
