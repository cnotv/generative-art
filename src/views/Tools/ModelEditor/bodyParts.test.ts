import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { applyPartScales, createPartScales, measureRigBones, partsInRig } from './bodyParts'
import type { ModelEditorPartName } from './types'

const createBone = (name: string, offset: [number, number, number]): THREE.Bone => {
  const bone = new THREE.Bone()
  bone.name = name
  bone.position.set(...offset)
  return bone
}

/**
 * A left arm chain in the proportions of the rigs this tool loads: every bone runs up its own
 * local Y, and the hand starts a finger chain the way a real Mixamo rig does.
 */
const createArmRig = (): THREE.Bone[] => {
  const arm = createBone('mixamorigLeftArm', [0, 0, 0])
  const foreArm = createBone('mixamorigLeftForeArm', [0, 2, 0])
  const hand = createBone('mixamorigLeftHand', [0, 2, 0])
  const finger = createBone('mixamorigLeftHandMiddle1', [0, 0.5, 0])
  arm.add(foreArm)
  foreArm.add(hand)
  hand.add(finger)
  new THREE.Object3D().add(arm)
  return [arm, foreArm, hand, finger]
}

const scaleOf = (bones: THREE.Bone[], name: string): [number, number, number] => {
  const bone = bones.find((candidate) => candidate.name === name)
  return bone ? [bone.scale.x, bone.scale.y, bone.scale.z] : [0, 0, 0]
}

describe('partsInRig', () => {
  it('keeps only the regions the loaded rig has bones for, in panel order', () => {
    const bones = createArmRig()

    const parts = partsInRig(bones.map((bone) => bone.name))

    expect(parts.map((part) => part.name)).toEqual(['upperArms', 'forearms', 'hands'])
  })

  it('offers nothing for a rig named by some other convention', () => {
    const parts = partsInRig(['Bip01_Head', 'Bip01_Spine'])

    expect(parts).toEqual([])
  })
})

describe('measureRigBones', () => {
  it('reads each bone length along the axis its named tip sits on', () => {
    const bones = createArmRig()

    const rig = measureRigBones(bones)

    expect(rig.map((rest) => rest.lengthAxis)).toEqual(['y', 'y', 'y', 'y'])
  })

  it('matches each bone to the region that covers it, and leaves the rest unassigned', () => {
    const bones = createArmRig()

    const rig = measureRigBones(bones)

    expect(rig.map((rest) => rest.part)).toEqual(['upperArms', 'forearms', 'hands', null])
  })
})

describe('applyPartScales', () => {
  it.each<{
    edit: string
    part: ModelEditorPartName
    length: number
    size: number
    arm: [number, number, number]
    foreArm: [number, number, number]
  }>([
    {
      edit: 'lengthening the upper arms',
      part: 'upperArms',
      length: 2,
      size: 1,
      arm: [1, 2, 1],
      foreArm: [1, 0.5, 1]
    },
    {
      edit: 'thickening the upper arms',
      part: 'upperArms',
      length: 1,
      size: 2,
      arm: [2, 1, 2],
      foreArm: [0.5, 1, 0.5]
    },
    {
      edit: 'shortening the upper arms',
      part: 'upperArms',
      length: 0.5,
      size: 1,
      arm: [1, 0.5, 1],
      foreArm: [1, 2, 1]
    }
  ])('$edit scales that region and hands the next one back its own size', (testCase) => {
    const bones = createArmRig()
    const rig = measureRigBones(bones)
    const parts = createPartScales()
    parts[testCase.part] = { length: testCase.length, size: testCase.size }

    applyPartScales(rig, parts)

    expect(scaleOf(bones, 'mixamorigLeftArm')).toEqual(testCase.arm)
    expect(scaleOf(bones, 'mixamorigLeftForeArm')).toEqual(testCase.foreArm)
    expect(scaleOf(bones, 'mixamorigLeftHand')).toEqual([1, 1, 1])
  })

  it('moves everything below a lengthened region without stretching it', () => {
    const bones = createArmRig()
    const rig = measureRigBones(bones)
    const parts = createPartScales()
    parts.upperArms = { length: 2, size: 1 }

    applyPartScales(rig, parts)
    bones[0].updateMatrixWorld(true)

    const handPosition = bones[2].getWorldPosition(new THREE.Vector3())
    expect(handPosition.y).toBeCloseTo(6)
  })

  it('offsets from the rig own rest scale rather than overwriting it', () => {
    const bones = createArmRig()
    bones[0].scale.set(2, 2, 2)
    const rig = measureRigBones(bones)
    const parts = createPartScales()
    parts.upperArms = { length: 3, size: 1 }

    applyPartScales(rig, parts)

    expect(scaleOf(bones, 'mixamorigLeftArm')).toEqual([2, 6, 2])
  })

  it('returns every bone to its rest scale once each region is back at one', () => {
    const bones = createArmRig()
    const rig = measureRigBones(bones)
    const parts = createPartScales()
    parts.upperArms = { length: 2, size: 2 }
    applyPartScales(rig, parts)

    applyPartScales(rig, createPartScales())

    expect(scaleOf(bones, 'mixamorigLeftArm')).toEqual([1, 1, 1])
    expect(scaleOf(bones, 'mixamorigLeftForeArm')).toEqual([1, 1, 1])
  })
})
