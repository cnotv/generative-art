import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { rigGenerateHumanoidSkeleton, rigAutoSkinMesh } from './humanoidRig'
import { HUMANOID_BONE_HIERARCHY } from './config'

describe('rigGenerateHumanoidSkeleton', () => {
  const box = new THREE.Box3(new THREE.Vector3(-0.5, 0, -0.25), new THREE.Vector3(0.5, 2, 0.25))
  const result = rigGenerateHumanoidSkeleton(box)

  it('creates one bone per template entry', () => {
    expect(result.bones).toHaveLength(HUMANOID_BONE_HIERARCHY.length)
  })

  it('places the root at its configured height fraction', () => {
    const worldPosition = result.root.getWorldPosition(new THREE.Vector3())
    expect(worldPosition.y).toBeCloseTo(0 + 0.52 * 2)
  })

  it('parents each bone to its template-declared parent', () => {
    const hips = result.bones.find((bone) => bone.name === 'mixamorigHips')
    const spine = result.bones.find((bone) => bone.name === 'mixamorigSpine')
    expect(spine?.parent).toBe(hips)
  })

  it('mirrors left and right bones to opposite sides of the centreline', () => {
    const leftHand = result.bones.find((bone) => bone.name === 'mixamorigLeftHand')
    const rightHand = result.bones.find((bone) => bone.name === 'mixamorigRightHand')
    const leftWorld = leftHand!.getWorldPosition(new THREE.Vector3())
    const rightWorld = rightHand!.getWorldPosition(new THREE.Vector3())
    expect(leftWorld.x).toBeCloseTo(-rightWorld.x)
    expect(leftWorld.x).toBeGreaterThan(0)
  })

  it('builds a skeleton over the same bones', () => {
    expect(result.skeleton.bones).toHaveLength(result.bones.length)
  })
})

describe('rigAutoSkinMesh', () => {
  // A three-bone chain (boneA: 0..1, boneB: 1..2) so each interior bone owns a real segment
  // rather than a single point, letting a vertex land closer to one segment than the other.
  const boneA = new THREE.Bone()
  boneA.name = 'boneA'
  const boneB = new THREE.Bone()
  boneB.name = 'boneB'
  boneB.position.set(0, 1, 0)
  const boneC = new THREE.Bone()
  boneC.name = 'boneC'
  boneC.position.set(0, 1, 0)
  boneA.add(boneB)
  boneB.add(boneC)
  boneA.updateMatrixWorld(true)
  const bones = [boneA, boneB, boneC]

  // A thin triangulated strip climbing from y=0 (boneA's joint) to y=2 (boneC's joint), two
  // vertices per row so the geodesic search has a real surface to walk rather than isolated
  // points. Row r holds vertices 2r (left) and 2r+1 (right).
  const buildLadderGeometry = (): THREE.BufferGeometry => {
    const rowYs = [0, 0.5, 1, 1.5, 2]
    const positions: number[] = []
    const indices: number[] = []
    rowYs.forEach((y, row) => {
      positions.push(-0.1, y, 0, 0.1, y, 0)
      if (row === 0) return
      const [a, b, c, d] = [(row - 1) * 2, (row - 1) * 2 + 1, row * 2, row * 2 + 1]
      indices.push(a, c, b, b, c, d)
    })
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geometry.setIndex(indices)
    return geometry
  }

  const skinIndexAt = (geometry: THREE.BufferGeometry, vertexIndex: number): number =>
    geometry.attributes.skinIndex.array[vertexIndex * 4]

  const skinWeightAt = (geometry: THREE.BufferGeometry, vertexIndex: number): number =>
    geometry.attributes.skinWeight.array[vertexIndex * 4]

  it('weighs a vertex mostly toward its nearest bone segment', () => {
    const geometry = buildLadderGeometry()

    rigAutoSkinMesh(geometry, bones)

    // Vertex 0 sits at row 0 (y=0), right at boneA's own joint.
    expect(skinIndexAt(geometry, 0)).toBe(0)
    expect(skinWeightAt(geometry, 0)).toBeGreaterThan(0.9)
  })

  it('shifts the dominant influence once the vertex is past the shared joint', () => {
    const geometry = buildLadderGeometry()

    rigAutoSkinMesh(geometry, bones)

    // Vertex 6 sits at row 3 (y=1.5), inside boneB's segment rather than boneA's.
    expect(skinIndexAt(geometry, 6)).toBe(1)
  })

  it('blends a vertex between bones only near the seam between them', () => {
    const geometry = buildLadderGeometry()

    rigAutoSkinMesh(geometry, bones)

    // Vertex 4 sits at row 2 (y=1), exactly on the boneA/boneB joint: its graph neighbours
    // span both bones, so it should carry a non-trivial weight on the second influence.
    const seamWeight = geometry.attributes.skinWeight.array[4 * 4 + 1]
    expect(seamWeight).toBeGreaterThan(0)

    // Vertex 0 sits far from any seam, so it should carry no second influence at all.
    const farWeight = geometry.attributes.skinWeight.array[0 * 4 + 1]
    expect(farWeight).toBe(0)
  })
})
