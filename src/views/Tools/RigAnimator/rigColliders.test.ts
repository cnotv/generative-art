import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { buildBoneColliderSpecs, readBoneColliderTransform } from './rigColliders'
import { BONE_COLLIDER_MIN_RADIUS_FRACTION, BONE_COLLIDER_RADIUS_FRACTION } from './config'
import { computeRigDiagonal } from './boneMarkers'

/** A straight chain of bones, each one `segmentLength` along Y from the one above it. */
const buildChain = (length: number, segmentLength = 1): THREE.Bone[] => {
  const bones = Array.from({ length }, (_, index) => {
    const bone = new THREE.Bone()
    bone.name = `bone-${index}`
    return bone
  })
  bones.forEach((bone, index) => {
    const parent = bones[index - 1]
    if (!parent) return
    bone.position.set(0, segmentLength, 0)
    parent.add(bone)
  })
  bones[0].updateMatrixWorld(true)
  return bones
}

describe('buildBoneColliderSpecs', () => {
  it('emits one spec per bone segment, so the leaf bone contributes none', () => {
    const bones = buildChain(3)

    const specs = buildBoneColliderSpecs(bones)

    expect(specs.map((spec) => [spec.boneName, spec.childBoneName])).toEqual([
      ['bone-0', 'bone-1'],
      ['bone-1', 'bone-2']
    ])
  })

  it('emits a spec for every child of a bone that branches', () => {
    const hips = new THREE.Bone()
    hips.name = 'hips'
    const legNames = ['left-leg', 'right-leg', 'spine']
    legNames.forEach((name, index) => {
      const child = new THREE.Bone()
      child.name = name
      child.position.set(index - 1, 1, 0)
      hips.add(child)
    })
    hips.updateMatrixWorld(true)

    const specs = buildBoneColliderSpecs([hips])

    expect(specs.map((spec) => spec.childBoneName)).toEqual(legNames)
  })

  it('ignores non-bone children, so the clickable bone markers never grow colliders', () => {
    const bones = buildChain(2)
    bones[0].add(new THREE.Mesh(new THREE.SphereGeometry(0.1)))

    const specs = buildBoneColliderSpecs(bones)

    expect(specs).toHaveLength(1)
  })

  it.each([
    { segmentLength: 1, expectedHalfHeight: 0.5 },
    { segmentLength: 4, expectedHalfHeight: 2 },
    { segmentLength: 0.25, expectedHalfHeight: 0.125 }
  ])(
    'sizes the capsule to half the segment, $segmentLength long',
    ({ segmentLength, expectedHalfHeight }) => {
      const bones = buildChain(2, segmentLength)

      const [spec] = buildBoneColliderSpecs(bones)

      expect(spec.halfHeight).toBeCloseTo(expectedHalfHeight)
    }
  )

  it('measures the segment in world units, so a scaled rig is not under-sized', () => {
    const bones = buildChain(2)
    const holder = new THREE.Group()
    holder.scale.setScalar(10)
    holder.add(bones[0])
    holder.updateMatrixWorld(true)

    const [spec] = buildBoneColliderSpecs(bones)

    expect(spec.halfHeight).toBeCloseTo(5)
  })

  it('scales the radius with the bone length', () => {
    const bones = buildChain(2, 2)

    const [spec] = buildBoneColliderSpecs(bones)

    expect(spec.radius).toBeCloseTo(2 * BONE_COLLIDER_RADIUS_FRACTION)
  })

  it('floors the radius against the rig spread, so a short finger bone is not a needle', () => {
    const spine = buildChain(2, 10)
    const finger = new THREE.Bone()
    finger.name = 'finger-tip'
    finger.position.set(0, 0.1, 0)
    spine[1].add(finger)
    spine[0].updateMatrixWorld(true)

    const specs = buildBoneColliderSpecs([...spine, finger])
    const fingerSpec = specs.find((spec) => spec.childBoneName === 'finger-tip')

    expect(fingerSpec?.radius).toBeCloseTo(
      computeRigDiagonal([...spine, finger]) * BONE_COLLIDER_MIN_RADIUS_FRACTION
    )
  })

  it('drops segments too short to be worth a body at all', () => {
    const bones = buildChain(2, 10)
    const coincident = new THREE.Bone()
    coincident.name = 'coincident'
    bones[1].add(coincident)
    bones[0].updateMatrixWorld(true)

    const specs = buildBoneColliderSpecs([...bones, coincident])

    expect(specs.map((spec) => spec.childBoneName)).toEqual(['bone-1'])
  })

  it('returns nothing for a rig with no bones', () => {
    expect(buildBoneColliderSpecs([])).toEqual([])
  })
})

describe('readBoneColliderTransform', () => {
  const position = new THREE.Vector3()
  const quaternion = new THREE.Quaternion()

  it('places the capsule at the segment midpoint in world space', () => {
    const bones = buildChain(2, 4)
    const [spec] = buildBoneColliderSpecs(bones)

    readBoneColliderTransform(bones[0], spec, position, quaternion)

    expect(position.toArray().map((value) => Number(value.toFixed(5)))).toEqual([0, 2, 0])
  })

  it('aims the capsule axis down the segment', () => {
    const bones = buildChain(2)
    bones[1].position.set(3, 0, 0)
    bones[0].updateMatrixWorld(true)
    const [spec] = buildBoneColliderSpecs(bones)

    readBoneColliderTransform(bones[0], spec, position, quaternion)
    const axis = new THREE.Vector3(0, 1, 0).applyQuaternion(quaternion)

    expect(axis.x).toBeCloseTo(1)
    expect(axis.y).toBeCloseTo(0)
    expect(axis.z).toBeCloseTo(0)
  })

  it('follows the bone once it is posed, without rebuilding the spec', () => {
    const bones = buildChain(2, 2)
    const [spec] = buildBoneColliderSpecs(bones)
    bones[0].position.set(0, 0, 6)
    bones[0].updateMatrixWorld(true)

    readBoneColliderTransform(bones[0], spec, position, quaternion)

    expect(position.z).toBeCloseTo(6)
    expect(position.y).toBeCloseTo(1)
  })
})
