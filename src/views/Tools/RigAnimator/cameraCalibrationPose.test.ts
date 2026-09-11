import { describe, it, expect } from 'vitest'
import { detectCalibrationTPose, averageCalibrationFrames } from './cameraCalibrationPose'
import type { CalibrationFrame, FrontCalibration, ImageLandmark } from './types'

const INDEX = {
  nose: 0,
  leftShoulder: 11,
  rightShoulder: 12,
  leftElbow: 13,
  rightElbow: 14,
  leftWrist: 15,
  rightWrist: 16,
  leftHip: 23,
  rightHip: 24
} as const

const point = (x: number, y: number, visibility = 1): ImageLandmark => ({ x, y, visibility })

/** Builds a 33-landmark image array from the named points given, every other index hidden. */
const imageFrom = (named: Partial<Record<keyof typeof INDEX, ImageLandmark>>): ImageLandmark[] =>
  Array.from({ length: 33 }, (_, index) => {
    const entry = Object.entries(INDEX).find(([, landmarkIndex]) => landmarkIndex === index)
    const namedPoint = entry ? named[entry[0] as keyof typeof INDEX] : undefined
    return namedPoint ?? point(0, 0, 0)
  })

/** A person square-on to the camera in a T-pose, in raw normalized image space. */
const frontTPose = (): Partial<Record<keyof typeof INDEX, ImageLandmark>> => ({
  nose: point(0.5, 0.2),
  leftShoulder: point(0.45, 0.3),
  rightShoulder: point(0.55, 0.3),
  leftElbow: point(0.35, 0.3),
  rightElbow: point(0.65, 0.3),
  leftWrist: point(0.25, 0.3),
  rightWrist: point(0.75, 0.3),
  leftHip: point(0.47, 0.6),
  rightHip: point(0.53, 0.6)
})

/** The same person turned sideways, arms still out: the far arm is barely detected. */
const sideTPose = (): Partial<Record<keyof typeof INDEX, ImageLandmark>> => ({
  nose: point(0.52, 0.2),
  leftShoulder: point(0.49, 0.3),
  rightShoulder: point(0.51, 0.3),
  leftElbow: point(0.5, 0.3),
  leftWrist: point(0.52, 0.31),
  rightElbow: point(0.5, 0.3, 0.2),
  rightWrist: point(0.48, 0.3, 0.2)
})

const frameOf = (image: ImageLandmark[], aspect = 1): CalibrationFrame => ({
  image,
  world: [],
  aspect
})

const FRONT: FrontCalibration = {
  shoulderSpanImage: 0.1,
  armSpanImage: 0.5,
  torsoHeightImage: 0.3,
  headHeightImage: 0.1,
  bodyCenterImage: { x: 0.5, y: 0.3 },
  shoulderWidthMeters: 0.4,
  armSpanMeters: 1.8,
  shoulderDirectionScene: { x: 1, z: 0 },
  handAngles: {}
}

const TOLERANCE_DEGREES = 20

describe('detectCalibrationTPose, front', () => {
  it('matches a level, straight-armed T-pose', () => {
    const frame = frameOf(imageFrom(frontTPose()))

    const matched = detectCalibrationTPose(frame, 'front', TOLERANCE_DEGREES, null)

    expect(matched).toBe(true)
  })

  it.each([
    [10, true],
    [30, false]
  ])(
    'with one arm tilted %i degrees off level against a 20 degree tolerance, matches: %s',
    (degrees, expected) => {
      const radians = (degrees * Math.PI) / 180
      const reach = 0.2
      const frame = frameOf(
        imageFrom({
          ...frontTPose(),
          leftElbow: point(
            0.45 - (reach / 2) * Math.cos(radians),
            0.3 - (reach / 2) * Math.sin(radians)
          ),
          leftWrist: point(0.45 - reach * Math.cos(radians), 0.3 - reach * Math.sin(radians))
        })
      )

      const matched = detectCalibrationTPose(frame, 'front', TOLERANCE_DEGREES, null)

      expect(matched).toBe(expected)
    }
  )

  it('reads tilt in aspect-corrected units, so a wide frame does not exaggerate a small tilt', () => {
    const aspect = 2
    const radians = (15 * Math.PI) / 180
    const reach = 0.3
    // A 15 degree tilt in real pixels: x offsets are divided by the aspect to land back in the
    // normalized width units MediaPipe reports.
    const frame = frameOf(
      imageFrom({
        ...frontTPose(),
        leftElbow: point(
          0.45 - ((reach / 2) * Math.cos(radians)) / aspect,
          0.3 - (reach / 2) * Math.sin(radians)
        ),
        leftWrist: point(
          0.45 - (reach * Math.cos(radians)) / aspect,
          0.3 - reach * Math.sin(radians)
        )
      }),
      aspect
    )

    const matched = detectCalibrationTPose(frame, 'front', TOLERANCE_DEGREES, null)

    expect(matched).toBe(true)
  })

  it('rejects a bent elbow even when the wrist is level with the shoulder', () => {
    const frame = frameOf(imageFrom({ ...frontTPose(), leftElbow: point(0.35, 0.4) }))

    const matched = detectCalibrationTPose(frame, 'front', TOLERANCE_DEGREES, null)

    expect(matched).toBe(false)
  })

  it('rejects a frame where a wrist is not confidently detected', () => {
    const frame = frameOf(imageFrom({ ...frontTPose(), rightWrist: point(0.75, 0.3, 0.1) }))

    const matched = detectCalibrationTPose(frame, 'front', TOLERANCE_DEGREES, null)

    expect(matched).toBe(false)
  })

  it('rejects arms held level in front of the body instead of out to the sides', () => {
    const frame = frameOf(
      imageFrom({
        ...frontTPose(),
        leftElbow: point(0.48, 0.3),
        leftWrist: point(0.5, 0.3),
        rightElbow: point(0.52, 0.3),
        rightWrist: point(0.5, 0.3)
      })
    )

    const matched = detectCalibrationTPose(frame, 'front', TOLERANCE_DEGREES, null)

    expect(matched).toBe(false)
  })
})

describe('detectCalibrationTPose, side', () => {
  it('matches a profile T-pose: shoulder span collapsed, near wrist at shoulder height', () => {
    const frame = frameOf(imageFrom(sideTPose()))

    const matched = detectCalibrationTPose(frame, 'side', TOLERANCE_DEGREES, FRONT)

    expect(matched).toBe(true)
  })

  it('needs a front calibration to compare the shoulder span against', () => {
    const frame = frameOf(imageFrom(sideTPose()))

    const matched = detectCalibrationTPose(frame, 'side', TOLERANCE_DEGREES, null)

    expect(matched).toBe(false)
  })

  it('rejects a square-on stance whose shoulder span has not collapsed', () => {
    const frame = frameOf(imageFrom(frontTPose()))

    const matched = detectCalibrationTPose(frame, 'side', TOLERANCE_DEGREES, FRONT)

    expect(matched).toBe(false)
  })

  it('rejects a near wrist hanging well below shoulder height', () => {
    const frame = frameOf(imageFrom({ ...sideTPose(), leftWrist: point(0.52, 0.5) }))

    const matched = detectCalibrationTPose(frame, 'side', TOLERANCE_DEGREES, FRONT)

    expect(matched).toBe(false)
  })
})

describe('averageCalibrationFrames', () => {
  it('averages every image and world landmark across the frames', () => {
    const first: CalibrationFrame = {
      image: [point(0.4, 0.2)],
      world: [{ x: 1, y: 0, z: 0, visibility: 1 }],
      aspect: 1.5
    }
    const second: CalibrationFrame = {
      image: [point(0.6, 0.4)],
      world: [{ x: 3, y: 2, z: 4, visibility: 0.5 }],
      aspect: 1.5
    }

    const averaged = averageCalibrationFrames([first, second])

    expect(averaged.image[0].x).toBeCloseTo(0.5)
    expect(averaged.image[0].y).toBeCloseTo(0.3)
    expect(averaged.world[0]).toEqual({ x: 2, y: 1, z: 2, visibility: 0.75 })
    expect(averaged.aspect).toBe(1.5)
  })
})
