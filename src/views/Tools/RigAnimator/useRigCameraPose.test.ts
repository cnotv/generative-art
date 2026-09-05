import { describe, it, expect } from 'vitest'
import { ref } from 'vue'
import * as THREE from 'three'
import { rigGenerateHumanoidSkeleton } from '@webgamekit/rig'
import { useRigCameraPose } from './useRigCameraPose'
import { captureRestPoses, applyGizmoDragToChain, type BoneRestPose } from './boneDragTarget'
import type { CameraLandmark } from './cameraPoseMapping'

const landmark = (x: number, y: number, z: number, visibility = 1): CameraLandmark => ({
  x,
  y,
  z,
  visibility
})

/** A person facing the camera, standing straight with arms held out level with the shoulders. */
const buildTPoseLandmarks = (): CameraLandmark[] => {
  const landmarks: CameraLandmark[] = new Array(33).fill(null).map(() => landmark(0, 0, 0, 0))
  landmarks[0] = landmark(0, -0.3, 0) // nose, above the shoulders
  landmarks[11] = landmark(-0.2, 0, 0) // left shoulder
  landmarks[12] = landmark(0.2, 0, 0) // right shoulder
  landmarks[15] = landmark(-0.7, 0, 0) // left wrist, extended out level with the shoulder
  landmarks[16] = landmark(0.7, 0, 0) // right wrist, extended out level with the shoulder
  landmarks[27] = landmark(-0.15, 1.4, 0) // left ankle, near the floor
  landmarks[28] = landmark(0.15, 1.4, 0) // right ankle
  return landmarks
}

/** The same wiring `useRigModel` gives `useRigCameraPose`, built directly for a focused test. */
const buildRigWiring = (bones: THREE.Bone[]) => {
  const restPoses: Map<string, BoneRestPose> = captureRestPoses(bones)
  const applyBoneDragTarget = (bone: THREE.Bone, target: THREE.Vector3): void =>
    applyGizmoDragToChain(bone, target, restPoses)
  const resetAllBonesToRest = (): void => {
    bones.forEach((bone) => {
      const rest = restPoses.get(bone.name)
      if (rest) {
        bone.position.copy(rest.position)
        bone.quaternion.copy(rest.quaternion)
      }
    })
  }
  return { applyBoneDragTarget, resetAllBonesToRest }
}

describe('useRigCameraPose', () => {
  it('resets a bone camera capture never drives back to rest, instead of leaving it mixed in from an earlier edit', () => {
    const box = new THREE.Box3(new THREE.Vector3(-0.5, 0, -0.25), new THREE.Vector3(0.5, 2, 0.25))
    const { root, bones } = rigGenerateHumanoidSkeleton(box)
    root.updateMatrixWorld(true)
    const { applyBoneDragTarget, resetAllBonesToRest } = buildRigWiring(bones)
    const findBone = (name: string): THREE.Bone => bones.find((bone) => bone.name === name)!

    // Simulate a stale pose: the shoulder is rotated by a manual edit or an earlier capture,
    // and neither the head's aim nor the hand's two-bone chain has any reach back up to it.
    const shoulder = findBone('mixamorigLeftShoulder')
    shoulder.quaternion.setFromEuler(new THREE.Euler(0, 0, Math.PI / 2))

    const { applyCameraPose } = useRigCameraPose(
      ref(bones),
      applyBoneDragTarget,
      resetAllBonesToRest
    )
    applyCameraPose(buildTPoseLandmarks())

    expect(shoulder.quaternion.angleTo(new THREE.Quaternion())).toBeCloseTo(0)
  })

  it('still applies the detected pose to the mapped bones after resetting the rig', () => {
    const box = new THREE.Box3(new THREE.Vector3(-0.5, 0, -0.25), new THREE.Vector3(0.5, 2, 0.25))
    const { root, bones } = rigGenerateHumanoidSkeleton(box)
    root.updateMatrixWorld(true)
    const { applyBoneDragTarget, resetAllBonesToRest } = buildRigWiring(bones)
    const findBone = (name: string): THREE.Bone => bones.find((bone) => bone.name === name)!

    const { applyCameraPose } = useRigCameraPose(
      ref(bones),
      applyBoneDragTarget,
      resetAllBonesToRest
    )
    applyCameraPose(buildTPoseLandmarks())

    const leftShoulderPosition = findBone('mixamorigLeftShoulder').getWorldPosition(
      new THREE.Vector3()
    )
    const rightShoulderPosition = findBone('mixamorigRightShoulder').getWorldPosition(
      new THREE.Vector3()
    )
    const shoulderCenterX = (leftShoulderPosition.x + rightShoulderPosition.x) / 2
    const leftHandPosition = findBone('mixamorigLeftHand').getWorldPosition(new THREE.Vector3())
    const rightHandPosition = findBone('mixamorigRightHand').getWorldPosition(new THREE.Vector3())

    expect(leftHandPosition.x).toBeLessThan(shoulderCenterX)
    expect(rightHandPosition.x).toBeGreaterThan(shoulderCenterX)
  })
})
