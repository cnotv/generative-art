import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import {
  STICKMAN_ARM_SPREAD,
  STICKMAN_PART_NAMES,
  applyStickmanPartOffsets,
  buildStickmanPartRig,
  createStickmanPartOffsets
} from './stickmanRig'

const namedNode = (name: string, position = [0, 0, 0], scale = [1, 1, 1]): THREE.Object3D => {
  const node = new THREE.Object3D()
  node.name = name
  node.position.set(position[0], position[1], position[2])
  node.scale.set(scale[0], scale[1], scale[2])
  return node
}

const createRigModel = (): THREE.Object3D => {
  const root = new THREE.Object3D()
  const torso = namedNode('torso', [0, 1, 0])
  const leftArm = namedNode('leftArm', [0, 1, 0])
  torso.add(namedNode('mesh_1'))
  root.add(torso, leftArm)
  root.add(namedNode('rightArm', [0, 1, 0]))
  root.add(namedNode('mesh_3', [0, 2, 0], [2, 2, 2]))
  root.add(namedNode('leftLeg'), namedNode('rightLeg'))
  return root
}

describe('createStickmanPartOffsets', () => {
  it('starts every limb un-nudged and full size', () => {
    const parts = createStickmanPartOffsets()
    expect(parts.torso).toEqual({ x: 0, y: 0, z: 0, scale: 1 })
    expect(parts.head.scale).toBe(1)
  })

  it('spreads the arms apart so a texture can tell them from the torso', () => {
    const parts = createStickmanPartOffsets()
    expect(parts.armLeft.x).toBe(-STICKMAN_ARM_SPREAD)
    expect(parts.armRight.x).toBe(STICKMAN_ARM_SPREAD)
  })

  it('hands out a fresh set each call, so one rig cannot nudge another', () => {
    const first = createStickmanPartOffsets()
    const second = createStickmanPartOffsets()
    first.head.scale = 2
    expect(second.head.scale).toBe(1)
  })
})

describe('buildStickmanPartRig', () => {
  it('matches every named limb to its own nodes', () => {
    const rig = buildStickmanPartRig(createRigModel())
    expect(STICKMAN_PART_NAMES.every((name) => rig[name].length > 0)).toBe(true)
    expect(rig.legs).toHaveLength(2)
    expect(rig.torso[0].node.name).toBe('torso')
  })

  it('records each node rest transform as its own, not the rig default', () => {
    const rig = buildStickmanPartRig(createRigModel())
    expect(rig.head[0].restPosition.y).toBe(2)
    expect(rig.head[0].restScale.x).toBe(2)
  })

  it('skips a limb the rig has no node for rather than failing', () => {
    const sparse = new THREE.Object3D()
    sparse.add(namedNode('torso'))
    const rig = buildStickmanPartRig(sparse)
    expect(rig.armLeft).toEqual([])
    expect(rig.torso).toHaveLength(1)
  })
})

describe('applyStickmanPartOffsets', () => {
  it('offsets position from rest and multiplies scale by it', () => {
    const rig = buildStickmanPartRig(createRigModel())
    const parts = createStickmanPartOffsets()
    parts.head = { x: 0.5, y: -0.25, z: 1, scale: 3 }
    applyStickmanPartOffsets(rig, parts)

    const head = rig.head[0].node
    expect(head.position.toArray()).toEqual([0.5, 1.75, 1])
    expect(head.scale.toArray()).toEqual([6, 6, 6])
  })

  it('offsets from the measured rest pose, so repeats never compound', () => {
    const rig = buildStickmanPartRig(createRigModel())
    const parts = createStickmanPartOffsets()
    parts.torso = { x: 0.2, y: 0, z: 0, scale: 2 }

    applyStickmanPartOffsets(rig, parts)
    applyStickmanPartOffsets(rig, parts)

    const torso = rig.torso[0].node
    expect(torso.position.x).toBeCloseTo(0.2)
    expect(torso.scale.x).toBe(2)
  })

  it('moves every node of a multi-node limb together', () => {
    const rig = buildStickmanPartRig(createRigModel())
    const parts = createStickmanPartOffsets()
    parts.legs = { x: 0, y: -1, z: 0, scale: 1 }
    applyStickmanPartOffsets(rig, parts)

    expect(rig.legs.map(({ node }) => node.position.y)).toEqual([-1, -1])
  })
})
