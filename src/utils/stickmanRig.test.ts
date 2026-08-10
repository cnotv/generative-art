import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import {
  STICKMAN_ARM_SPREAD,
  STICKMAN_PART_NAMES,
  applyStickmanPartOffsets,
  buildStickmanPartRig,
  createStickmanPartOffsets,
  prepareStickmanRig
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
    expect(parts.torso).toEqual({ position: { x: 0, y: 0, z: 0 }, scale: 1 })
    expect(parts.head.scale).toBe(1)
  })

  it('spreads the arms apart so a texture can tell them from the torso', () => {
    const parts = createStickmanPartOffsets()
    expect(parts.armLeft.position.x).toBe(-STICKMAN_ARM_SPREAD)
    expect(parts.armRight.position.x).toBe(STICKMAN_ARM_SPREAD)
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
    parts.head = { position: { x: 0.5, y: -0.25, z: 1 }, scale: 3 }
    applyStickmanPartOffsets(rig, parts)

    const head = rig.head[0].node
    expect(head.position.toArray()).toEqual([0.5, 1.75, 1])
    expect(head.scale.toArray()).toEqual([6, 6, 6])
  })

  it('offsets from the measured rest pose, so repeats never compound', () => {
    const rig = buildStickmanPartRig(createRigModel())
    const parts = createStickmanPartOffsets()
    parts.torso = { position: { x: 0.2, y: 0, z: 0 }, scale: 2 }

    applyStickmanPartOffsets(rig, parts)
    applyStickmanPartOffsets(rig, parts)

    const torso = rig.torso[0].node
    expect(torso.position.x).toBeCloseTo(0.2)
    expect(torso.scale.x).toBe(2)
  })

  it('moves every node of a multi-node limb together', () => {
    const rig = buildStickmanPartRig(createRigModel())
    const parts = createStickmanPartOffsets()
    parts.legs = { position: { x: 0, y: -1, z: 0 }, scale: 1 }
    applyStickmanPartOffsets(rig, parts)

    expect(rig.legs.map(({ node }) => node.position.y)).toEqual([-1, -1])
  })
})

/** A mesh carrying the attributes the UV remap needs to run over it. */
const paintableMesh = (name: string): THREE.Mesh => {
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1, 1, 0], 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1], 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 1], 2))
  const mesh = new THREE.Mesh(geometry)
  mesh.name = name
  return mesh
}

/**
 * Mirrors the shipped rig where it matters: the shoulder caps hang off the
 * torso rather than the arms, and each arm already closes its far end with a
 * quarter-turned cap of its own.
 */
const createArmedRig = (): THREE.Object3D => {
  const root = new THREE.Object3D()
  const torso = paintableMesh('torso')
  const quarterTurn = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(1, 0, 0),
    Math.PI / 2
  )

  const buildArm = (name: string, shoulderName: string, side: number): void => {
    const arm = paintableMesh(name)
    arm.position.set(side * 0.24, 0.64, 0.02)
    const handCap = paintableMesh(`${name}Hand`)
    handCap.position.set(0, -0.3, 0)
    handCap.quaternion.copy(quarterTurn)
    arm.add(paintableMesh(`${name}Body`), handCap)

    const shoulder = paintableMesh(shoulderName)
    shoulder.position.set(side * 0.24, 0.08, 0)
    shoulder.quaternion.copy(quarterTurn)
    torso.add(shoulder)
    root.add(arm)
  }

  buildArm('leftArm', 'mesh_1', -1)
  buildArm('rightArm', 'mesh_2', 1)
  root.add(torso, paintableMesh('mesh_3'), paintableMesh('leftLeg'), paintableMesh('rightLeg'))
  return root
}

describe('prepareStickmanRig shoulder seating', () => {
  it('moves each shoulder cap onto the arm it belongs to', () => {
    const rig = createArmedRig()
    prepareStickmanRig(rig, createStickmanPartOffsets())

    expect(rig.getObjectByName('mesh_1')?.parent?.name).toBe('leftArm')
    expect(rig.getObjectByName('mesh_2')?.parent?.name).toBe('rightArm')
  })

  it('seats the cap on the socket rather than keeping the rig own depth gap', () => {
    const rig = createArmedRig()
    prepareStickmanRig(rig, createStickmanPartOffsets())

    // The rig authors the cap at z 0 and the arm socket at z 0.02, so a
    // world-preserving reparent would leave the cap 0.02 behind its arm.
    expect(rig.getObjectByName('mesh_1')?.position.toArray()).toEqual([0, 0, 0])
    expect(rig.getObjectByName('mesh_2')?.position.toArray()).toEqual([0, 0, 0])
  })

  it('gives the shoulder the same shape as the hand, so both ends of an arm match', () => {
    const rig = createArmedRig()
    prepareStickmanRig(rig, createStickmanPartOffsets())

    const shoulder = rig.getObjectByName('mesh_1') as THREE.Mesh
    const hand = rig.getObjectByName('leftArmHand') as THREE.Mesh
    expect(shoulder.geometry).toBe(hand.geometry)
    expect(shoulder.quaternion.toArray()).toEqual(hand.quaternion.toArray())
  })

  it('leaves a rig with no shoulder caps alone rather than failing', () => {
    const rig = createArmedRig()
    rig.getObjectByName('mesh_1')?.removeFromParent()
    expect(() => prepareStickmanRig(rig, createStickmanPartOffsets())).not.toThrow()
  })
})
