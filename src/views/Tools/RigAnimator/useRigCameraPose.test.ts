import { describe, it, expect } from 'vitest'
import { shallowRef } from 'vue'
import * as THREE from 'three'
import { useRigCameraPose } from './useRigCameraPose'
import { captureRestPoses, resetAllBonesToRest } from './boneDragTarget'
import { captureCameraRetargetRest } from './cameraPoseRetarget'
import { rigLegLength } from './cameraPoseTravel'
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

  it('eases the arm toward a new pose one frame later, and lands it whole after a pause', () => {
    // Arrange
    const { applyCameraPose, bone } = buildWiredRig()
    const smoothed = buildMappingOptions({ boneSmoothingMilliseconds: 150 })
    const raisedArm = {
      ...EMPTY_FRAME,
      bodyLandmarks: buildBodyLandmarks({ 13: [0.2, -0.8, 0], 15: [0.22, -1.05, 0] })
    }
    const tPose = { ...EMPTY_FRAME, bodyLandmarks: buildBodyLandmarks() }
    const reference = buildWiredRig()
    reference.applyCameraPose(tPose, OPTIONS, ALL_GROUPS, 0)
    const tPoseArm = reference.bone('mixamorigLeftArm').quaternion.clone()

    // Act
    applyCameraPose(raisedArm, smoothed, ALL_GROUPS, 0)
    const raisedArmQuaternion = bone('mixamorigLeftArm').quaternion.clone()
    applyCameraPose(tPose, smoothed, ALL_GROUPS, 33)
    const oneFrameLater = bone('mixamorigLeftArm').quaternion.clone()
    applyCameraPose(tPose, smoothed, ALL_GROUPS, 2000)

    // Assert
    const fullTurn = raisedArmQuaternion.angleTo(tPoseArm)
    expect(oneFrameLater.angleTo(tPoseArm)).toBeGreaterThan(0.1 * fullTurn)
    expect(oneFrameLater.angleTo(raisedArmQuaternion)).toBeGreaterThan(0.1 * fullTurn)
    expect(bone('mixamorigLeftArm').quaternion.angleTo(tPoseArm)).toBeLessThan(1e-6)
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

  describe('travel', () => {
    const STANDING = buildBodyLandmarks()
    const FRAME_MILLISECONDS = 1000 / 30
    /** The performer `metres` closer to the camera than where they started, three metres away. */
    const standingAt = (metresCloser: number): CameraPoseFrame => ({
      ...EMPTY_FRAME,
      bodyLandmarks: STANDING,
      bodyPosition: { x: 0, y: 0, z: -3 + metresCloser }
    })
    /** A walk of `metres` toward the camera over two seconds, then two seconds standing there. */
    const walkToward = (
      applyCameraPose: ReturnType<typeof buildWiredRig>['applyCameraPose'],
      options: ReturnType<typeof buildMappingOptions>,
      metres: number
    ): void =>
      Array.from({ length: 120 }).forEach((_, index) =>
        applyCameraPose(
          standingAt(Math.min(1, index / 60) * metres),
          options,
          ALL_GROUPS,
          index * FRAME_MILLISECONDS
        )
      )

    it.each([
      { followTravel: true, expectedLegLengths: 1 / 0.84 },
      { followTravel: false, expectedLegLengths: 0 }
    ])(
      'with Follow Travel $followTravel, a metre toward the camera carries the hips $expectedLegLengths leg lengths toward the viewer',
      ({ followTravel, expectedLegLengths }) => {
        // Arrange
        const { applyCameraPose, bone, restPoses } = buildWiredRig()
        const legLength = rigLegLength(captureCameraRetargetRest(buildMixamoRig()))!

        // Act
        walkToward(applyCameraPose, buildMappingOptions({ followTravel }), 1)

        // Assert
        const restHips = restPoses.get('mixamorigHips')!.position
        const hips = bone('mixamorigHips').position
        expect((hips.z - restHips.z) / legLength).toBeCloseTo(expectedLegLengths, 1)
        expect(hips.x - restHips.x).toBeCloseTo(0)
      }
    )

    it('starts the next source from the rig’s own spot, not from where the last one left it', () => {
      // Arrange
      const { applyCameraPose, resetCameraTravel, bone, restPoses } = buildWiredRig()
      const options = buildMappingOptions({ followTravel: true })
      walkToward(applyCameraPose, options, 1)

      // Act
      resetCameraTravel()
      applyCameraPose(standingAt(0.5), options, ALL_GROUPS, 10_000)

      // Assert
      expect(bone('mixamorigHips').position.z).toBeCloseTo(
        restPoses.get('mixamorigHips')!.position.z
      )
    })
  })
})
