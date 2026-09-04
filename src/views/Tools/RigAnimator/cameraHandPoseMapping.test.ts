import { describe, it, expect } from 'vitest'
import {
  cameraHandLandmarksToPose,
  cameraDetectedHandsToPoses,
  resolveCameraHandSide,
  type CameraHandLandmark
} from './cameraHandPoseMapping'

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

    const pose = cameraHandLandmarksToPose(landmarks)

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
})

describe('resolveCameraHandSide', () => {
  it.each([
    ['Left', 'Right'],
    ['Right', 'Left']
  ])("swaps MediaPipe's %s label to the subject's actual %s side", (categoryName, expectedSide) => {
    expect(resolveCameraHandSide(categoryName)).toBe(expectedSide)
  })

  it('returns null for an unrecognised label', () => {
    expect(resolveCameraHandSide('unknown')).toBeNull()
  })
})

describe('cameraDetectedHandsToPoses', () => {
  it('keys each detected hand by its resolved side, swapping the raw label', () => {
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
