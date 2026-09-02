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

  it('weighs a vertex mostly toward its nearest bone segment', () => {
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, -0.05, 0], 3))

    rigAutoSkinMesh(geometry, bones)

    const skinIndex = geometry.attributes.skinIndex.array
    const skinWeight = geometry.attributes.skinWeight.array
    expect(skinIndex[0]).toBe(0)
    expect(skinWeight[0]).toBeGreaterThan(0.9)
  })

  it('shifts the dominant influence once the vertex is past the shared joint', () => {
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 1.5, 0], 3))

    rigAutoSkinMesh(geometry, bones)

    const skinIndex = geometry.attributes.skinIndex.array
    expect(skinIndex[0]).toBe(1)
  })
})
