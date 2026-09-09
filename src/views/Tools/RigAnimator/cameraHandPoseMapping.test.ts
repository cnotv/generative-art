import { describe, it, expect } from 'vitest'
import {
  cameraHandLandmarksToPose,
  cameraDetectedHandsToPoses,
  resolveCameraHandSide,
  smoothCameraHandLandmarks,
  mirrorCameraHandPoses,
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

  it('never drives the thumb CMC joint, however sharply that segment is bent', () => {
    const landmarks = buildOpenHandLandmarks()
    // Fold the thumb's wrist->CMC->MCP angle sharply, exactly the shape a real detected curl
    // (or the anatomical rest tilt neither reference point tried so far read correctly) takes.
    landmarks[2] = point(landmarks[1].x - 1, landmarks[1].y, landmarks[1].z)

    const pose = cameraHandLandmarksToPose(landmarks)

    // Confirmed against a live feed: composing any nonzero magnitude here, from either
    // reference point tried, swung the joint to the wrong side of the hand rather than
    // merely curling it wrong, since its real motion is opposition, not a hinge around a
    // single fixed axis. Left at 0 so it stays at its own rest pose instead.
    expect(pose.thumb[0]).toBe(0)
  })

  it('still drives the thumb’s other two joints normally', () => {
    const landmarks = buildOpenHandLandmarks()
    // Fold the thumb's MCP->IP->TIP the same way the index finger's bent-joint test does.
    landmarks[3] = point(landmarks[2].x, landmarks[2].y, landmarks[2].z - 1)
    landmarks[4] = point(landmarks[2].x, landmarks[2].y, landmarks[2].z - 2)

    const pose = cameraHandLandmarksToPose(landmarks)

    expect(pose.thumb[0]).toBe(0)
    expect(pose.thumb[1]).toBeCloseTo(Math.PI / 2)
    expect(pose.thumb[2]).toBeCloseTo(0)
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
