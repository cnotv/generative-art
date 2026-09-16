import { describe, it, expect } from 'vitest'
import {
  clampLandmarkJump,
  estimateCameraYaw,
  filterCameraLandmarks,
  lowPassBlendFactor,
  mirrorCameraLandmarks
} from './cameraPoseMapping'
import { buildSmoothingSettings } from './fixtures/cameraPoseFixtures'
import type { CameraLandmark } from './types'

const landmark = (x: number, y: number, z: number, visibility = 1): CameraLandmark => ({
  x,
  y,
  z,
  visibility
})

describe('estimateCameraYaw', () => {
  // MediaPipe's own landmark space puts a subject's left shoulder at a larger x than their
  // right (x grows toward the subject's own left), confirmed against real detected photos.
  const landmarksWithShoulders = (
    leftShoulder: [number, number, number],
    rightShoulder: [number, number, number]
  ): CameraLandmark[] => {
    const landmarks: CameraLandmark[] = new Array(33).fill(null).map(() => landmark(0, 0, 0, 0))
    landmarks[11] = landmark(...leftShoulder)
    landmarks[12] = landmark(...rightShoulder)
    return landmarks
  }

  it('reads square-on as zero, both shoulders at the same depth', () => {
    const yaw = estimateCameraYaw(landmarksWithShoulders([0.2, -0.5, 0], [-0.2, -0.5, 0]))
    expect(yaw).toBeCloseTo(0)
  })

  it('reads a turn as a nonzero yaw, in the direction the shoulder line actually tilted', () => {
    // The right shoulder sits closer to the camera (smaller z) than the left: the subject has
    // turned toward their own right.
    const yaw = estimateCameraYaw(landmarksWithShoulders([0.2, -0.5, 0], [-0.2, -0.5, -0.3]))
    expect(yaw).not.toBeCloseTo(0)
    expect(Math.abs(yaw!)).toBeLessThan(Math.PI / 2)
  })

  it('returns null when a shoulder is below the visibility threshold', () => {
    const landmarks = landmarksWithShoulders([0.2, -0.5, 0], [-0.2, -0.5, 0])
    landmarks[12] = { ...landmarks[12], visibility: 0.1 }
    expect(estimateCameraYaw(landmarks)).toBeNull()
  })
})

describe('lowPassBlendFactor', () => {
  it.each([
    ['takes nothing when no time has passed', 5, 0, 0],
    ['takes everything with an unlimited cutoff', Infinity, 1 / 30, 1]
  ])('%s', (_, cutoffHertz, elapsedSeconds, expected) => {
    expect(lowPassBlendFactor(cutoffHertz, elapsedSeconds)).toBeCloseTo(expected)
  })

  it('takes a larger share of a reading the longer it has been since the last one', () => {
    expect(lowPassBlendFactor(2, 1 / 15)).toBeGreaterThan(lowPassBlendFactor(2, 1 / 60))
  })
})

describe('filterCameraLandmarks', () => {
  const FRAME_SECONDS = 1 / 30
  const SETTINGS = buildSmoothingSettings({ smoothingMilliseconds: 150 })
  const STILL = { x: 0, y: 0, z: 0 }

  /** How much of a move from the origin to `movedTo` one reading lets through. */
  const shareLetThrough = (movedTo: number, velocityX: number, settings = SETTINGS): number => {
    const { landmarks } = filterCameraLandmarks(
      { landmarks: [landmark(0, 0, 0)], velocities: [{ ...STILL, x: velocityX }] },
      [landmark(movedTo, 0, 0)],
      FRAME_SECONDS,
      settings
    )
    return landmarks[0].x / movedTo
  }

  it('takes a first reading as-is, standing still', () => {
    // Arrange
    const next = [landmark(1, 2, 3, 0.9)]

    // Act
    const filtered = filterCameraLandmarks(null, next, FRAME_SECONDS, SETTINGS)

    // Assert
    expect(filtered).toEqual({ landmarks: next, velocities: [STILL] })
  })

  it('passes every reading straight through with smoothing off', () => {
    expect(
      shareLetThrough(0.2, 0, buildSmoothingSettings({ smoothingMilliseconds: 0 }))
    ).toBeCloseTo(1)
  })

  it('holds a small jiggle back harder than a fast move', () => {
    expect(shareLetThrough(0.005, 0)).toBeLessThan(shareLetThrough(0.066, 2))
  })

  it.each([
    [
      'holds a still landmark back harder the longer the smoothing',
      { smoothingMilliseconds: 50 },
      { smoothingMilliseconds: 300 },
      0
    ],
    [
      'holds a fast landmark back harder the less its speed loosens smoothing',
      { speedResponse: 40 },
      { speedResponse: 0 },
      2
    ]
  ])('%s', (_, lighter, heavier, velocityX) => {
    const light = shareLetThrough(0.066, velocityX, buildSmoothingSettings(lighter))
    const heavy = shareLetThrough(0.066, velocityX, buildSmoothingSettings(heavier))
    expect(heavy).toBeLessThan(light)
  })

  it('reads a sudden reading as motion sooner with a higher speed sensitivity', () => {
    // Arrange: a landmark at rest jumps; how fast its speed estimate follows decides how much
    // the speed loosens the smoothing on this very reading.
    const moved = (speedCutoffHertz: number): number =>
      shareLetThrough(0.066, 0, buildSmoothingSettings({ speedCutoffHertz }))

    // Act, Assert
    expect(moved(8)).toBeGreaterThan(moved(0.2))
  })

  it('keeps the new reading’s visibility rather than blending it', () => {
    // Arrange, Act
    const { landmarks } = filterCameraLandmarks(
      { landmarks: [landmark(0, 0, 0, 1)], velocities: [STILL] },
      [landmark(0.01, 0, 0, 0.2)],
      FRAME_SECONDS,
      SETTINGS
    )

    // Assert
    expect(landmarks[0].visibility).toBe(0.2)
  })

  it('clamps a sudden jump past the max jump distance instead of applying it whole', () => {
    // Arrange, Act
    const { landmarks } = filterCameraLandmarks(
      { landmarks: [landmark(0, 0, 0)], velocities: [STILL] },
      [landmark(10, 0, 0)],
      FRAME_SECONDS,
      buildSmoothingSettings({ smoothingMilliseconds: 0, maxJump: 0.15 })
    )

    // Assert
    expect(landmarks[0].x).toBeCloseTo(0.15)
  })
})

describe('clampLandmarkJump', () => {
  it('leaves a candidate within reach untouched', () => {
    const previous = { x: 0, y: 0, z: 0 }
    const candidate = { x: 0.1, y: 0, z: 0, visibility: 1 }
    expect(clampLandmarkJump(previous, candidate, 0.15)).toEqual(candidate)
  })

  it('pulls a candidate back to the max jump distance, keeping its direction', () => {
    const previous = { x: 0, y: 0, z: 0 }
    const candidate = { x: 10, y: 0, z: 0, visibility: 1 }
    const clamped = clampLandmarkJump(previous, candidate, 0.15)
    expect(clamped.x).toBeCloseTo(0.15)
    expect(clamped.visibility).toBe(1)
  })

  it('treats a non-positive max jump as unlimited movement', () => {
    const previous = { x: 0, y: 0, z: 0 }
    const candidate = { x: 10, y: 0, z: 0, visibility: 1 }
    expect(clampLandmarkJump(previous, candidate, 0)).toEqual(candidate)
  })
})

describe('mirrorCameraLandmarks', () => {
  it('negates every landmark’s x, leaving y and z untouched', () => {
    const landmarks = new Array(33).fill(null).map(() => landmark(0, 0, 0, 0))
    landmarks[0] = landmark(0.3, -0.2, 0.5) // nose, unpaired
    const [mirroredNose] = mirrorCameraLandmarks(landmarks)
    expect(mirroredNose.x).toBeCloseTo(-0.3)
    expect(mirroredNose.y).toBeCloseTo(-0.2)
    expect(mirroredNose.z).toBeCloseTo(0.5)
  })

  it('swaps each left/right landmark pair, not just their sign', () => {
    const landmarks = new Array(33).fill(null).map(() => landmark(0, 0, 0, 0))
    landmarks[15] = landmark(-0.7, 0.1, 0) // left wrist
    landmarks[16] = landmark(0.7, 0.2, 0) // right wrist

    const mirrored = mirrorCameraLandmarks(landmarks)

    // The array's own left-wrist slot now holds the old right wrist's data, mirrored.
    expect(mirrored[15].x).toBeCloseTo(-0.7)
    expect(mirrored[15].y).toBeCloseTo(0.2)
    expect(mirrored[16].x).toBeCloseTo(0.7)
    expect(mirrored[16].y).toBeCloseTo(0.1)
  })

  it('mirrors every paired landmark BlazePose defines, not only the wrists', () => {
    const landmarks = new Array(33).fill(null).map((_, index) => landmark(index, 0, 0, 0))
    const mirrored = mirrorCameraLandmarks(landmarks)
    const pairs: Array<[number, number]> = [
      [1, 4],
      [2, 5],
      [3, 6],
      [7, 8],
      [9, 10],
      [11, 12],
      [13, 14],
      [15, 16],
      [17, 18],
      [19, 20],
      [21, 22],
      [23, 24],
      [25, 26],
      [27, 28],
      [29, 30],
      [31, 32]
    ]
    pairs.forEach(([a, b]) => {
      expect(mirrored[a].x).toBeCloseTo(-b)
      expect(mirrored[b].x).toBeCloseTo(-a)
    })
  })
})
