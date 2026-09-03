import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { createBoneMarkers, computeRigDiagonal } from './boneMarkers'
import { BONE_MARKER_MIN_SCALE } from './config'

const markerRadius = (marker: THREE.Mesh): number =>
  (marker.geometry as THREE.SphereGeometry).parameters.radius

describe('computeRigDiagonal', () => {
  it('measures the bounding diagonal across every bone', () => {
    const root = new THREE.Bone()
    const tip = new THREE.Bone()
    tip.position.set(3, 4, 0)
    root.add(tip)
    root.updateMatrixWorld(true)

    expect(computeRigDiagonal([root, tip])).toBeCloseTo(5)
  })
})

describe('createBoneMarkers', () => {
  const buildChain = (length: number): THREE.Bone[] => {
    const bones = Array.from({ length }, (_, index) => {
      const bone = new THREE.Bone()
      bone.name = `bone-${index}`
      return bone
    }).reduce<THREE.Bone[]>((chain, bone) => {
      const parent = chain[chain.length - 1]
      if (parent) {
        bone.position.set(0, 1, 0)
        parent.add(bone)
      }
      return [...chain, bone]
    }, [])
    bones[0].updateMatrixWorld(true)
    return bones
  }

  it('shrinks each marker the deeper its bone sits in the hierarchy', () => {
    const bones = buildChain(3)
    const markers = createBoneMarkers(bones)

    const [rootRadius, childRadius, grandchildRadius] = markers.map(markerRadius)
    expect(rootRadius).toBeGreaterThan(childRadius)
    expect(childRadius).toBeGreaterThan(grandchildRadius)
  })

  it('never shrinks a marker past the configured floor, however deep the chain', () => {
    const bones = buildChain(12)
    const markers = createBoneMarkers(bones)

    const rootRadius = markerRadius(markers[0])
    const deepestRadius = markerRadius(markers[markers.length - 1])
    expect(deepestRadius).toBeCloseTo(rootRadius * BONE_MARKER_MIN_SCALE)
  })

  it('parents each marker to its own bone so it tracks the pose automatically', () => {
    const bones = buildChain(2)
    const markers = createBoneMarkers(bones)

    expect(markers[0].parent).toBe(bones[0])
    expect(markers[1].parent).toBe(bones[1])
  })
})
