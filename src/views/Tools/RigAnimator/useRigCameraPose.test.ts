import { describe, it, expect } from 'vitest'
import { shallowRef } from 'vue'
import * as THREE from 'three'
import { useRigCameraPose } from './useRigCameraPose'
import { captureRestPoses, resetAllBonesToRest } from './boneDragTarget'
import { RIG_BODY_PART_GROUPS, type RigBodyPartGroup } from './bodyPartGroups'
import {
  buildBodyLandmarks,
  buildHandLandmarks,
  buildMappingOptions,
  buildMixamoRig
} from './fixtures/cameraPoseFixtures'
import type { CameraPoseFrame } from './types'

const ALL_GROUPS = new Set(RIG_BODY_PART_GROUPS)
const OPTIONS = buildMappingOptions()
const EMPTY_FRAME: CameraPoseFrame = { bodyLandmarks: null, handLandmarks: {}, headRotation: null }

/** The same wiring `useRigAnimator` gives `useRigCameraPose`, built on the real Mixamo skeleton. */
const buildWiredRig = () => {
  const bones = buildMixamoRig()
  const restPoses = captureRestPoses(bones)
  const rig = useRigCameraPose(shallowRef(bones), (exclude) =>
    resetAllBonesToRest(bones, restPoses, exclude)
  )
  const bone = (name: string): THREE.Bone => bones.find((candidate) => candidate.name === name)!
  return { ...rig, bone, restPoses }
}

describe('useRigCameraPose', () => {
  it('resets a bone the frame drives but has no landmark for, instead of keeping an earlier edit', () => {
    // Arrange: a stale clavicle rotation from a manual edit; no landmark drives a clavicle.
    const { applyCameraPose, bone, restPoses } = buildWiredRig()
    bone('mixamorigLeftShoulder').quaternion.setFromEuler(new THREE.Euler(0, 0, Math.PI / 2))

    // Act
    applyCameraPose({ ...EMPTY_FRAME, bodyLandmarks: buildBodyLandmarks() }, OPTIONS, ALL_GROUPS)

    // Assert
    const restQuaternion = restPoses.get('mixamorigLeftShoulder')!.quaternion
    expect(bone('mixamorigLeftShoulder').quaternion.angleTo(restQuaternion)).toBeCloseTo(0)
  })

  it('leaves a bone outside the target groups exactly as it was', () => {
    // Arrange
    const { applyCameraPose, bone } = buildWiredRig()
    const rightArm = bone('mixamorigRightArm')
    rightArm.quaternion.setFromEuler(new THREE.Euler(0, 0, Math.PI / 4))
    const staleRightArm = rightArm.quaternion.clone()
    const raisedArms = buildBodyLandmarks({ 13: [0.2, -0.8, 0], 15: [0.22, -1.05, 0] })

    // Act
    applyCameraPose(
      { ...EMPTY_FRAME, bodyLandmarks: raisedArms },
      OPTIONS,
      new Set<RigBodyPartGroup>(['leftArm'])
    )

    // Assert
    expect(rightArm.quaternion.equals(staleRightArm)).toBe(true)
    const leftElbow = bone('mixamorigLeftForeArm').getWorldPosition(new THREE.Vector3())
    const leftShoulder = bone('mixamorigLeftArm').getWorldPosition(new THREE.Vector3())
    expect(leftElbow.y).toBeGreaterThan(leftShoulder.y)
  })

  it('curls the fingers of a hand filmed on its own without resetting the posed body', () => {
    // Arrange: the body is posed by an earlier frame, then only a hand stays in view.
    const { applyCameraPose, bone } = buildWiredRig()
    applyCameraPose(
      {
        ...EMPTY_FRAME,
        bodyLandmarks: buildBodyLandmarks({ 13: [0.2, -0.8, 0], 15: [0.22, -1.05, 0] })
      },
      OPTIONS,
      ALL_GROUPS
    )
    const posedArm = bone('mixamorigLeftArm').quaternion.clone()
    const openIndex = bone('mixamorigLeftHandIndex2').quaternion.clone()

    // Act
    applyCameraPose(
      { ...EMPTY_FRAME, handLandmarks: { Left: buildHandLandmarks('Left', 'fist') } },
      OPTIONS,
      ALL_GROUPS
    )

    // Assert
    expect(bone('mixamorigLeftArm').quaternion.equals(posedArm)).toBe(true)
    expect(bone('mixamorigLeftHandIndex2').quaternion.angleTo(openIndex)).toBeGreaterThan(0.5)
  })
})
