import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import {
  ikFindTwoBoneChain,
  ikSolveTwoBoneChain,
  ikSolveOneBoneAim,
  ikApplyWorldDirectionToBone
} from './ik'

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

describe('ikSolveOneBoneAim', () => {
  it('points the parent at the target while preserving the child’s segment length', () => {
    const { root, mid } = buildStraightChain()
    const target = new THREE.Vector3(1, 1, 0)

    ikSolveOneBoneAim(root, mid, target)

    const rootPosition = root.getWorldPosition(new THREE.Vector3())
    const midPosition = mid.getWorldPosition(new THREE.Vector3())
    const direction = midPosition.clone().sub(rootPosition).normalize()
    const expectedDirection = target.clone().sub(rootPosition).normalize()
    expect(direction.dot(expectedDirection)).toBeCloseTo(1, 4)
    expect(rootPosition.distanceTo(midPosition)).toBeCloseTo(1, 4)
  })

  it('leaves the child’s own local transform untouched', () => {
    const { root, mid } = buildStraightChain()
    const localPositionBefore = mid.position.clone()
    const localQuaternionBefore = mid.quaternion.clone()

    ikSolveOneBoneAim(root, mid, new THREE.Vector3(1, 1, 0))

    expect(mid.position.equals(localPositionBefore)).toBe(true)
    expect(mid.quaternion.equals(localQuaternionBefore)).toBe(true)
  })
})

describe('ikApplyWorldDirectionToBone', () => {
  it('rotates a bone so its current direction becomes the desired direction', () => {
    const { root, mid } = buildStraightChain()
    const desired = new THREE.Vector3(1, 0, 0)

    ikApplyWorldDirectionToBone(root, new THREE.Vector3(0, 1, 0), desired)

    const rootPosition = root.getWorldPosition(new THREE.Vector3())
    const midPosition = mid.getWorldPosition(new THREE.Vector3())
    const actual = midPosition.clone().sub(rootPosition).normalize()
    expect(actual.dot(desired)).toBeCloseTo(1, 4)
  })

  it('fully orients a bone with two sequential calls, the second a pure roll around the first axis', () => {
    // A bone with two children at right angles, so each tracks one of two reference directions.
    const root = new THREE.Bone()
    const childA = new THREE.Bone()
    childA.position.set(0, 1, 0)
    const childB = new THREE.Bone()
    childB.position.set(1, 0, 0)
    root.add(childA)
    root.add(childB)
    root.updateMatrixWorld(true)

    const rootPosition = root.getWorldPosition(new THREE.Vector3())
    const currentA = childA.getWorldPosition(new THREE.Vector3()).sub(rootPosition).normalize()
    const desiredA = new THREE.Vector3(0, 0, 1)
    // Perpendicular to desiredA, the same way childB starts out perpendicular to childA.
    const desiredB = new THREE.Vector3(0, 1, 0)

    ikApplyWorldDirectionToBone(root, currentA, desiredA)
    const afterFirstB = childB
      .getWorldPosition(new THREE.Vector3())
      .sub(root.getWorldPosition(new THREE.Vector3()))
      .normalize()
    ikApplyWorldDirectionToBone(root, afterFirstB, desiredB)

    const finalRootPosition = root.getWorldPosition(new THREE.Vector3())
    const finalA = childA.getWorldPosition(new THREE.Vector3()).sub(finalRootPosition).normalize()
    const finalB = childB.getWorldPosition(new THREE.Vector3()).sub(finalRootPosition).normalize()
    expect(finalA.dot(desiredA)).toBeCloseTo(1, 4)
    expect(finalB.dot(desiredB)).toBeCloseTo(1, 4)
  })
})
