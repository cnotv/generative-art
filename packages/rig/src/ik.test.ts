import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { ikFindTwoBoneChain, ikSolveTwoBoneChain } from './ik'

/** A straight two-segment chain (root: 0..1, mid: 1..2), unit-length bones, rest pose vertical. */
const buildStraightChain = (): { root: THREE.Bone; mid: THREE.Bone; end: THREE.Bone } => {
  const root = new THREE.Bone()
  root.name = 'root'
  const mid = new THREE.Bone()
  mid.name = 'mid'
  mid.position.set(0, 1, 0)
  const end = new THREE.Bone()
  end.name = 'end'
  end.position.set(0, 1, 0)
  root.add(mid)
  mid.add(end)
  root.updateMatrixWorld(true)
  return { root, mid, end }
}

describe('ikFindTwoBoneChain', () => {
  it('returns null for a bone with fewer than two Bone ancestors', () => {
    const { root, mid } = buildStraightChain()

    expect(ikFindTwoBoneChain(root)).toBeNull()
    expect(ikFindTwoBoneChain(mid)).toBeNull()
  })

  it('returns the grandparent/parent/self chain for a deeper bone', () => {
    const { root, mid, end } = buildStraightChain()

    const chain = ikFindTwoBoneChain(end)

    expect(chain?.root).toBe(root)
    expect(chain?.mid).toBe(mid)
    expect(chain?.end).toBe(end)
  })
})

describe('ikSolveTwoBoneChain', () => {
  it('reaches a target within the chain’s span while preserving both bone lengths', () => {
    const { root, mid, end } = buildStraightChain()
    const target = new THREE.Vector3(1, 0.5, 0)
    const pole = mid.getWorldPosition(new THREE.Vector3())

    ikSolveTwoBoneChain({ root, mid, end }, target, pole)

    const rootPosition = root.getWorldPosition(new THREE.Vector3())
    const midPosition = mid.getWorldPosition(new THREE.Vector3())
    const endPosition = end.getWorldPosition(new THREE.Vector3())
    expect(endPosition.distanceTo(target)).toBeLessThan(1e-4)
    expect(rootPosition.distanceTo(midPosition)).toBeCloseTo(1, 4)
    expect(midPosition.distanceTo(endPosition)).toBeCloseTo(1, 4)
  })

  it('clamps an out-of-reach target to the fully extended limb', () => {
    const { root, mid, end } = buildStraightChain()
    const target = new THREE.Vector3(0, 10, 0)
    const pole = mid.getWorldPosition(new THREE.Vector3())

    ikSolveTwoBoneChain({ root, mid, end }, target, pole)

    const rootPosition = root.getWorldPosition(new THREE.Vector3())
    const endPosition = end.getWorldPosition(new THREE.Vector3())
    expect(rootPosition.distanceTo(endPosition)).toBeCloseTo(2, 3)
  })

  it('leaves the end bone’s own local transform untouched', () => {
    const { root, mid, end } = buildStraightChain()
    const localPositionBefore = end.position.clone()
    const localQuaternionBefore = end.quaternion.clone()
    const pole = mid.getWorldPosition(new THREE.Vector3())

    ikSolveTwoBoneChain({ root, mid, end }, new THREE.Vector3(1, 0.5, 0), pole)

    expect(end.position.equals(localPositionBefore)).toBe(true)
    expect(end.quaternion.equals(localQuaternionBefore)).toBe(true)
  })
})
