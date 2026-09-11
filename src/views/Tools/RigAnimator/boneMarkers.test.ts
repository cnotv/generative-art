import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { createBoneMarkers, computeRigDiagonal, pickBoneMarker } from './boneMarkers'
import { BONE_MARKER_HIT_RADIUS_MULTIPLIER, BONE_MARKER_MIN_SCALE } from './config'

const markerRadius = (marker: THREE.Mesh): number =>
  (marker.geometry as THREE.SphereGeometry).parameters.radius

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

const rayTowardNegativeZ = (x: number, y: number): THREE.Raycaster =>
  new THREE.Raycaster(new THREE.Vector3(x, y, 5), new THREE.Vector3(0, 0, -1))

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

describe('pickBoneMarker', () => {
  it.each([
    { radiusMultiple: 2, expected: 'bone-0' },
    { radiusMultiple: BONE_MARKER_HIT_RADIUS_MULTIPLIER + 1, expected: null }
  ])(
    'a ray $radiusMultiple drawn radii off a marker picks $expected',
    ({ radiusMultiple, expected }) => {
      const markers = createBoneMarkers(buildChain(2))
      const rootRadius = markerRadius(markers[0])

      const picked = pickBoneMarker(markers, rayTowardNegativeZ(rootRadius * radiusMultiple, 0))

      expect(picked).toBe(expected)
    }
  )

  it('picks the marker nearest the ray where hit areas overlap, not the one nearest the camera', () => {
    const root = new THREE.Bone()
    const nearCamera = new THREE.Bone()
    const underPointer = new THREE.Bone()
    nearCamera.name = 'near-camera'
    underPointer.name = 'under-pointer'
    nearCamera.position.set(0, 1, 0.5)
    underPointer.position.set(0.02, 0, -0.5)
    root.add(nearCamera)
    nearCamera.add(underPointer)
    root.updateMatrixWorld(true)
    const markers = createBoneMarkers([root, nearCamera, underPointer])
    const ray = rayTowardNegativeZ(0.014, 1)

    const picked = pickBoneMarker(markers, ray)

    expect(pickBoneMarker([markers[1]], ray)).toBe('near-camera')
    expect(picked).toBe('under-pointer')
  })
})
