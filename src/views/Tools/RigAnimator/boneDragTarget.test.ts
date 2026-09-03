import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { ikFindTwoBoneChain } from '@webgamekit/rig'
import {
  applyGizmoDragToChain,
  applyPoleDrag,
  captureRestPoses,
  resetBoneChainToRest
} from './boneDragTarget'

describe('applyGizmoDragToChain', () => {
  it('translates a root bone straight to the target when it has no Bone parent at all', () => {
    const root = new THREE.Bone()
    root.name = 'hips'
    root.updateMatrixWorld(true)
    const restPoses = captureRestPoses([root])

    applyGizmoDragToChain(root, new THREE.Vector3(5, 6, 7), restPoses)

    expect(root.position.equals(new THREE.Vector3(5, 6, 7))).toBe(true)
  })

  it('converts the target into the parent’s local space when the root sits under a group', () => {
    const root = new THREE.Bone()
    root.name = 'hips'
    const group = new THREE.Group()
    group.position.set(10, 0, 0)
    group.add(root)
    group.updateMatrixWorld(true)
    const restPoses = captureRestPoses([root])

    applyGizmoDragToChain(root, new THREE.Vector3(12, 3, 4), restPoses)

    const worldPosition = root.getWorldPosition(new THREE.Vector3())
    expect(worldPosition.distanceTo(new THREE.Vector3(12, 3, 4))).toBeLessThan(1e-5)
  })

  it('aims the parent instead of translating a bone that has a Bone parent', () => {
    const root = new THREE.Bone()
    root.name = 'root'
    const mid = new THREE.Bone()
    mid.name = 'mid'
    mid.position.set(0, 1, 0)
    root.add(mid)
    root.updateMatrixWorld(true)
    const restPoses = captureRestPoses([root, mid])
    const originalLocalPosition = mid.position.clone()

    applyGizmoDragToChain(mid, new THREE.Vector3(1, 1, 0), restPoses)

    expect(mid.position.equals(originalLocalPosition)).toBe(true)
    const rootWorldPosition = root.getWorldPosition(new THREE.Vector3())
    const midWorldPosition = mid.getWorldPosition(new THREE.Vector3())
    expect(rootWorldPosition.distanceTo(midWorldPosition)).toBeCloseTo(1, 4)
  })
})

describe('applyPoleDrag', () => {
  it('keeps the end effector fixed while re-aiming the bend toward the pole', () => {
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
    const chain = ikFindTwoBoneChain(end)!
    // Bend it once so the end effector sits somewhere off-axis, worth keeping fixed.
    applyGizmoDragToChain(end, new THREE.Vector3(1, 0.5, 0), captureRestPoses([root, mid, end]))
    const endWorldPositionBefore = end.getWorldPosition(new THREE.Vector3())

    applyPoleDrag(chain, new THREE.Vector3(-1, 1, 0))

    const endWorldPositionAfter = end.getWorldPosition(new THREE.Vector3())
    expect(endWorldPositionAfter.distanceTo(endWorldPositionBefore)).toBeLessThan(1e-4)
  })
})

describe('resetBoneChainToRest', () => {
  it('resets a plain-translated root back to its rest position', () => {
    const root = new THREE.Bone()
    root.name = 'hips'
    root.updateMatrixWorld(true)
    const restPoses = captureRestPoses([root])
    applyGizmoDragToChain(root, new THREE.Vector3(9, 9, 9), restPoses)

    resetBoneChainToRest(root, restPoses)

    expect(root.position.equals(new THREE.Vector3(0, 0, 0))).toBe(true)
  })
})
