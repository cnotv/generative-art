import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import {
  cameraHandLandmarksToPose,
  cameraHandLandmarksToOrientation,
  cameraDetectedHandsToPoses,
  cameraDetectedHandsToOrientations,
  resolveCameraHandSide,
  smoothCameraHandLandmarks,
  mirrorCameraHandPoses,
  mirrorCameraHandOrientations,
  type CameraHandLandmark
} from './cameraHandPoseMapping'
import { CAMERA_HAND_SENSITIVITY_DEFAULT } from './config'

const point = (x: number, y: number, z: number): CameraHandLandmark => ({ x, y, z })

/** A fully open hand: every finger's four points run in a straight line out from the wrist. */
const buildOpenHandLandmarks = (): CameraHandLandmark[] => {
  const landmarks: CameraHandLandmark[] = new Array(21).fill(null).map(() => point(0, 0, 0))
  landmarks[0] = point(0, 0, 0) // wrist
  const straightFinger = (base: number, direction: [number, number, number]): void => {
    ;[1, 2, 3, 4].forEach((step, index) => {
      landmarks[base + index] = point(direction[0] * step, direction[1] * step, direction[2] * step)
    })
  }
  straightFinger(1, [-1, 1, 0]) // thumb
  straightFinger(5, [0, 1, 0]) // index
  straightFinger(9, [0.2, 1, 0]) // middle
  straightFinger(13, [0.4, 1, 0]) // ring
  straightFinger(17, [0.6, 1, 0]) // pinky
  return landmarks
}

describe('cameraHandLandmarksToPose', () => {
  it('reads a fully open hand as every joint straight (zero curl)', () => {
    const pose = cameraHandLandmarksToPose(buildOpenHandLandmarks())
    Object.values(pose).forEach((angles) => {
      angles.forEach((angle) => expect(angle).toBeCloseTo(0))
    })
  })

  it('reads a bent joint as a nonzero curl, isolated to that joint', () => {
    const landmarks = buildOpenHandLandmarks()
    // Bend the index finger's PIP joint (its second point) sharply backward.
    landmarks[6] = point(0, 2, 0) // PIP, still in line with MCP/wrist
    landmarks[7] = point(0, 2, -1) // DIP folds back
    landmarks[8] = point(0, 2, -2) // TIP follows

    // sensitivity: 1 to read the raw detected geometry, isolated from the tunable scaling
    // `CAMERA_HAND_SENSITIVITY_DEFAULT` applies by default.
    const pose = cameraHandLandmarksToPose(landmarks, 1)

    expect(pose.index[0]).toBeCloseTo(0) // MCP: still straight
    expect(pose.index[1]).toBeCloseTo(Math.PI / 2) // PIP: bent a quarter turn
    expect(pose.index[2]).toBeCloseTo(0) // DIP: straight again past the fold
    // Untouched fingers stay flat.
    expect(pose.thumb.every((angle) => Math.abs(angle) < 1e-6)).toBe(true)
  })

  it('returns all five fingers with three joint angles each', () => {
    const pose = cameraHandLandmarksToPose(buildOpenHandLandmarks())
    expect(Object.keys(pose).sort()).toEqual(['index', 'middle', 'pinky', 'ring', 'thumb'])
    Object.values(pose).forEach((angles) => expect(angles).toHaveLength(3))
  })

  it('reads a bent thumb CMC joint as a nonzero curl, the same as any other joint', () => {
    const landmarks = buildOpenHandLandmarks()
    // Fold the thumb's wrist->CMC->MCP angle the same way the index finger's bent-joint test
    // folds its own PIP: still in line up to the joint, then a clean fold past it.
    landmarks[2] = point(landmarks[1].x, landmarks[1].y, landmarks[1].z - 1)

    const pose = cameraHandLandmarksToPose(landmarks)

    expect(pose.thumb[0]).toBeGreaterThan(0.3)
  })

  it('scales every joint angle by the given sensitivity, defaulting to CAMERA_HAND_SENSITIVITY_DEFAULT', () => {
    const landmarks = buildOpenHandLandmarks()
    landmarks[6] = point(0, 2, 0)
    landmarks[7] = point(0, 2, -1)
    landmarks[8] = point(0, 2, -2)

    const raw = cameraHandLandmarksToPose(landmarks, 1)
    const doubled = cameraHandLandmarksToPose(landmarks, 2)
    const defaulted = cameraHandLandmarksToPose(landmarks)

    expect(doubled.index[1]).toBeCloseTo(raw.index[1] * 2)
    expect(defaulted.index[1]).toBeCloseTo(raw.index[1] * CAMERA_HAND_SENSITIVITY_DEFAULT)
  })
})

describe('cameraHandLandmarksToOrientation', () => {
  it('reads along as wrist-to-middle-knuckle and across as index-to-pinky-knuckle, y/z flipped', () => {
    const landmarks = buildOpenHandLandmarks()
    // From buildOpenHandLandmarks: wrist (0,0,0), middle MCP (0.2,1,0), index MCP (0,1,0),
    // pinky MCP (0.6,1,0).

    const orientation = cameraHandLandmarksToOrientation(landmarks, false)

    const expectedAlong = new THREE.Vector3(0.2, -1, 0).normalize()
    const expectedAcross = new THREE.Vector3(0.6, 0, 0).normalize()
    expect(orientation.along.distanceTo(expectedAlong)).toBeLessThan(1e-6)
    expect(orientation.across.distanceTo(expectedAcross)).toBeLessThan(1e-6)
  })

  it('negates x when mirrored, matching the mirrored live preview', () => {
    const landmarks = buildOpenHandLandmarks()

    const orientation = cameraHandLandmarksToOrientation(landmarks, true)

    const expectedAlong = new THREE.Vector3(-0.2, -1, 0).normalize()
    const expectedAcross = new THREE.Vector3(-0.6, 0, 0).normalize()
    expect(orientation.along.distanceTo(expectedAlong)).toBeLessThan(1e-6)
    expect(orientation.across.distanceTo(expectedAcross)).toBeLessThan(1e-6)
  })

  it('always returns unit-length directions', () => {
    const orientation = cameraHandLandmarksToOrientation(buildOpenHandLandmarks(), false)
    expect(orientation.along.length()).toBeCloseTo(1)
    expect(orientation.across.length()).toBeCloseTo(1)
  })
})

describe('cameraDetectedHandsToOrientations', () => {
  it('keys each detected hand orientation by its resolved side', () => {
    const openHand = buildOpenHandLandmarks()
    const orientations = cameraDetectedHandsToOrientations(
      [
        { worldLandmarks: openHand, categoryName: 'Left' },
        { worldLandmarks: openHand, categoryName: 'Right' }
      ],
      false
    )
    expect(Object.keys(orientations).sort()).toEqual(['Left', 'Right'])
  })

  it('drops a hand MediaPipe could not classify', () => {
    const orientations = cameraDetectedHandsToOrientations(
      [{ worldLandmarks: buildOpenHandLandmarks(), categoryName: 'unknown' }],
      false
    )
    expect(orientations).toEqual({})
  })
})

describe('mirrorCameraHandOrientations', () => {
  it('swaps a left orientation onto the right side and vice versa', () => {
    const leftOrientation = cameraHandLandmarksToOrientation(buildOpenHandLandmarks(), true)
    const rightOrientation = cameraHandLandmarksToOrientation(buildOpenHandLandmarks(), true)
    const mirrored = mirrorCameraHandOrientations({
      Left: leftOrientation,
      Right: rightOrientation
    })
    expect(mirrored.Right).toBe(leftOrientation)
    expect(mirrored.Left).toBe(rightOrientation)
  })
})

describe('resolveCameraHandSide', () => {
  it.each([
    ['Left', 'Left'],
    ['Right', 'Right']
  ])(
    "passes MediaPipe's %s label straight through as the subject's %s side",
    (categoryName, expectedSide) => {
      expect(resolveCameraHandSide(categoryName)).toBe(expectedSide)
    }
  )

  it('returns null for an unrecognised label', () => {
    expect(resolveCameraHandSide('unknown')).toBeNull()
  })
})

describe('cameraDetectedHandsToPoses', () => {
  it('keys each detected hand by its resolved side', () => {
    const openHand = buildOpenHandLandmarks()
    const poses = cameraDetectedHandsToPoses([
      { worldLandmarks: openHand, categoryName: 'Left' },
      { worldLandmarks: openHand, categoryName: 'Right' }
    ])
    expect(Object.keys(poses).sort()).toEqual(['Left', 'Right'])
  })

  it('drops a hand MediaPipe could not classify', () => {
    const poses = cameraDetectedHandsToPoses([
      { worldLandmarks: buildOpenHandLandmarks(), categoryName: 'unknown' }
    ])
    expect(poses).toEqual({})
  })
})

describe('mirrorCameraHandPoses', () => {
  it('swaps a left pose onto the right side and vice versa', () => {
    const leftPose = cameraHandLandmarksToPose(buildOpenHandLandmarks())
    const rightPose = cameraHandLandmarksToPose(buildOpenHandLandmarks())
    const mirrored = mirrorCameraHandPoses({ Left: leftPose, Right: rightPose })
    expect(mirrored.Right).toBe(leftPose)
    expect(mirrored.Left).toBe(rightPose)
  })

  it('leaves a single detected side keyed under the opposite side, not both', () => {
    const leftPose = cameraHandLandmarksToPose(buildOpenHandLandmarks())
    const mirrored = mirrorCameraHandPoses({ Left: leftPose })
    expect(Object.keys(mirrored)).toEqual(['Right'])
  })

  it('returns an empty result when no hand was detected', () => {
    expect(mirrorCameraHandPoses({})).toEqual({})
  })
})

describe('smoothCameraHandLandmarks', () => {
  it('returns the new frame as-is when there is no previous frame to blend against', () => {
    const next = [point(1, 2, 3)]
    expect(smoothCameraHandLandmarks(null, next, 0.35)).toEqual(next)
  })

  it('blends position toward the new frame by the given factor', () => {
    const previous = [point(0, 0, 0)]
    const next = [point(1, 1, 1)]
    // A jump cap far past this blend's own distance, so only the blend itself is under test.
    const [smoothed] = smoothCameraHandLandmarks(previous, next, 0.25, 10)
    expect(smoothed.x).toBeCloseTo(0.25)
    expect(smoothed.y).toBeCloseTo(0.25)
    expect(smoothed.z).toBeCloseTo(0.25)
  })

  it('takes a landmark missing from the previous frame as-is', () => {
    const previous = [point(0, 0, 0)]
    const next = [point(0, 0, 0), point(5, 5, 5)]
    const smoothed = smoothCameraHandLandmarks(previous, next, 0.25, 10)
    expect(smoothed[1]).toEqual(next[1])
  })

  it('clamps a sudden jump past the max jump distance instead of applying it whole', () => {
    const previous = [point(0, 0, 0)]
    const next = [point(10, 0, 0)]
    const [smoothed] = smoothCameraHandLandmarks(previous, next, 1, 0.15)
    expect(smoothed.x).toBeCloseTo(0.15)
  })
})
