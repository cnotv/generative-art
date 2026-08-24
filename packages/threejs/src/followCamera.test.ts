import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { DEFAULT_FOLLOW_CAMERA, followCameraCalibrate, followCameraPlacement } from './followCamera'
import type { FollowCameraMode } from './types'

describe('followCameraCalibrate', () => {
  const TARGET = new THREE.Vector3(0, 1, 0)
  const HEADING = new THREE.Vector3(0, 0, -1)

  /** Placing from calibrated offsets must land back where the camera already was. */
  const roundTrip = (mode: FollowCameraMode, cameraPosition: THREE.Vector3) => {
    const config = {
      ...DEFAULT_FOLLOW_CAMERA,
      ...followCameraCalibrate(mode, cameraPosition, TARGET, HEADING)
    }
    return followCameraPlacement(mode, TARGET, HEADING, config).position.clone()
  }

  it.each(['third', 'first', 'free'] as const)(
    'gives %s the offsets that leave the camera where it is',
    (mode) => {
      const camera = new THREE.Vector3(0, 9, 24)
      expect(roundTrip(mode, camera).toArray()).toEqual(camera.toArray())
    }
  )

  it('reads a camera in front of the target as a negative distance', () => {
    // The scene that introduces its character face-on: a real framing, and one the follow
    // config has to be able to hold rather than flip to the other side.
    const inFront = new THREE.Vector3(0, 8, -30)
    const calibrated = followCameraCalibrate('third', inFront, TARGET, HEADING)
    expect(calibrated.thirdPersonBack).toBeLessThan(0)
    expect(roundTrip('third', inFront).toArray()).toEqual(inFront.toArray())
  })

  it('folds a camera off to one side onto the heading, which is all the model holds', () => {
    const offToTheSide = new THREE.Vector3(20, 8, 0)
    expect(roundTrip('third', offToTheSide).x).toBe(0)
  })
})
