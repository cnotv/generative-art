import { describe, it, expect } from 'vitest'
import {
  measureFrontCalibration,
  measureSideCalibration,
  computeCalibratedReachMultiplier,
  scaleLandmarkDepth,
  computeCalibratedRootMotion,
  computeSceneHandAngle,
  computeHandRotationDelta
} from './cameraCalibration'
import type {
  CalibratedRootMotionOptions,
  CalibrationFrame,
  CameraCalibration,
  FrontCalibration,
  ImageLandmark
} from './types'
import type { CameraLandmark } from './cameraPoseMapping'
import type { CameraHandLandmark } from './cameraHandPoseMapping'

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
type PointName = keyof typeof INDEX

const ASPECT = 4 / 3
const FIELD_OF_VIEW_DEGREES = 60
/** Pinhole focal length in image-height units, for a horizontal field of view over this aspect. */
const FOCAL = (ASPECT * 0.5) / Math.tan((FIELD_OF_VIEW_DEGREES * Math.PI) / 360)
const SHOULDER_WIDTH = 0.4
const ARM_SPAN = 1.6
const TORSO_HEIGHT = 0.5
const HEAD_HEIGHT = 0.25
const CALIBRATED_DISTANCE = 2
const RIG_SHOULDER_WIDTH = SHOULDER_WIDTH

interface ScenePoint {
  x: number
  y: number
  z: number
}

interface Placement {
  distance: number
  lateral: number
  yaw: number
}

const CALIBRATED: Placement = { distance: CALIBRATED_DISTANCE, lateral: 0, yaw: 0 }

/** A T-pose in scene space (x right, y up, z toward the camera), turned by `yaw` about +Y. */
const scenePoints = (yaw: number): Record<PointName, ScenePoint> => {
  const at = (x: number, y: number): ScenePoint => ({
    x: x * Math.cos(yaw),
    y,
    z: -x * Math.sin(yaw)
  })
  const elbowReach = SHOULDER_WIDTH / 2 + (ARM_SPAN - SHOULDER_WIDTH) / 4
  return {
    nose: at(0, HEAD_HEIGHT),
    leftShoulder: at(-SHOULDER_WIDTH / 2, 0),
    rightShoulder: at(SHOULDER_WIDTH / 2, 0),
    leftElbow: at(-elbowReach, 0),
    rightElbow: at(elbowReach, 0),
    leftWrist: at(-ARM_SPAN / 2, 0),
    rightWrist: at(ARM_SPAN / 2, 0),
    leftHip: at(-0.1, -TORSO_HEIGHT),
    rightHip: at(0.1, -TORSO_HEIGHT)
  }
}

/** Projects a scene point through a pinhole camera into MediaPipe's raw normalized image space. */
const toImage = (point: ScenePoint, placement: Placement): ImageLandmark => {
  const cameraDepth = placement.distance - point.z
  const heightUnitsX = ASPECT / 2 + (FOCAL * (point.x + placement.lateral)) / cameraDepth
  return {
    x: heightUnitsX / ASPECT,
    y: 0.5 - (FOCAL * point.y) / cameraDepth,
    visibility: 1
  }
}

/** A scene point as a MediaPipe world landmark: y grows down and z grows away from the camera. */
const toWorld = (point: ScenePoint, depthCompression = 1): CameraLandmark => ({
  x: point.x,
  y: -point.y,
  z: -point.z * depthCompression,
  visibility: 1
})

const frameAt = (
  placement: Placement,
  hidden: PointName[] = [],
  depthCompression = 1
): CalibrationFrame => {
  const points = scenePoints(placement.yaw)
  const nameAt = (index: number): PointName | undefined =>
    (Object.keys(INDEX) as PointName[]).find((name) => INDEX[name] === index)
  const isShown = (name: PointName | undefined): name is PointName =>
    name !== undefined && !hidden.includes(name)
  return {
    image: Array.from({ length: 33 }, (_, index) => {
      const name = nameAt(index)
      return isShown(name) ? toImage(points[name], placement) : { x: 0, y: 0, visibility: 0 }
    }),
    world: Array.from({ length: 33 }, (_, index) => {
      const name = nameAt(index)
      return isShown(name)
        ? toWorld(points[name], depthCompression)
        : { x: 0, y: 0, z: 0, visibility: 0 }
    }),
    aspect: ASPECT
  }
}

const OPTIONS: CalibratedRootMotionOptions = {
  fieldOfViewDegrees: FIELD_OF_VIEW_DEGREES,
  followRotation: true,
  followSideToSide: true,
  followDistance: true,
  movementScale: 1,
  mirror: false
}

const calibrated = (): CameraCalibration => ({
  front: measureFrontCalibration(frameAt(CALIBRATED), {}),
  side: null,
  rootBoneNames: {}
})

describe('measureFrontCalibration', () => {
  it('reads reference sizes in aspect-corrected image units and real sizes in metres', () => {
    const front = measureFrontCalibration(frameAt(CALIBRATED), { Left: 0.3 })

    expect(front?.shoulderSpanImage).toBeCloseTo((FOCAL * SHOULDER_WIDTH) / CALIBRATED_DISTANCE)
    expect(front?.armSpanImage).toBeCloseTo((FOCAL * ARM_SPAN) / CALIBRATED_DISTANCE)
    expect(front?.torsoHeightImage).toBeCloseTo((FOCAL * TORSO_HEIGHT) / CALIBRATED_DISTANCE)
    expect(front?.headHeightImage).toBeCloseTo((FOCAL * HEAD_HEIGHT) / CALIBRATED_DISTANCE)
    expect(front?.bodyCenterImage.x).toBeCloseTo(0.5)
    expect(front?.shoulderWidthMeters).toBeCloseTo(SHOULDER_WIDTH)
    expect(front?.armSpanMeters).toBeCloseTo(ARM_SPAN)
    expect(front?.handAngles).toEqual({ Left: 0.3 })
  })

  it('records the square-on shoulder direction in scene space as a unit vector', () => {
    const front = measureFrontCalibration(frameAt(CALIBRATED), {})

    expect(front?.shoulderDirectionScene.x).toBeCloseTo(-1)
    expect(front?.shoulderDirectionScene.z).toBeCloseTo(0)
  })

  it('leaves torso height empty when the hips are out of frame', () => {
    const front = measureFrontCalibration(frameAt(CALIBRATED, ['leftHip', 'rightHip']), {})

    expect(front?.torsoHeightImage).toBeNull()
  })

  it('returns null when the shoulders are not both detected', () => {
    const front = measureFrontCalibration(frameAt(CALIBRATED, ['leftShoulder']), {})

    expect(front).toBeNull()
  })
})

describe('measureSideCalibration', () => {
  it('derives how much MediaPipe compresses depth from the arm span seen side-on', () => {
    const front = measureFrontCalibration(frameAt(CALIBRATED), {})!
    const side = frameAt({ ...CALIBRATED, yaw: Math.PI / 2 }, [], 0.5)

    const result = measureSideCalibration(side, front)

    expect(result?.depthScale).toBeCloseTo(2)
  })

  it('returns null when the arms show no depth extent at all', () => {
    const front = measureFrontCalibration(frameAt(CALIBRATED), {})!

    const result = measureSideCalibration(frameAt(CALIBRATED), front)

    expect(result).toBeNull()
  })
})

describe('computeCalibratedReachMultiplier', () => {
  it('scales the mapped arm span to the rig own arm span', () => {
    const front = measureFrontCalibration(frameAt(CALIBRATED), {})!
    const rigArmSpan = 1.2

    const multiplier = computeCalibratedReachMultiplier(front, rigArmSpan, RIG_SHOULDER_WIDTH)

    expect(multiplier).toBeCloseTo((rigArmSpan * SHOULDER_WIDTH) / (ARM_SPAN * RIG_SHOULDER_WIDTH))
  })
})

describe('scaleLandmarkDepth', () => {
  it('multiplies depth only, leaving x, y and visibility untouched', () => {
    const scaled = scaleLandmarkDepth([{ x: 1, y: 2, z: 3, visibility: 0.5 }], 2)

    expect(scaled).toEqual([{ x: 1, y: 2, z: 6, visibility: 0.5 }])
  })
})

describe('computeCalibratedRootMotion', () => {
  it('reports no motion at the calibrated placement', () => {
    const motion = computeCalibratedRootMotion(
      frameAt(CALIBRATED),
      calibrated(),
      RIG_SHOULDER_WIDTH,
      OPTIONS
    )

    expect(motion?.offset.x).toBeCloseTo(0)
    expect(motion?.offset.y).toBe(0)
    expect(motion?.offset.z).toBeCloseTo(0)
    expect(motion?.yaw).toBeCloseTo(0)
  })

  it.each([1, 3])('moves toward the viewer by the change in distance, at %s metres', (distance) => {
    const motion = computeCalibratedRootMotion(
      frameAt({ ...CALIBRATED, distance }),
      calibrated(),
      RIG_SHOULDER_WIDTH,
      OPTIONS
    )

    expect(motion?.offset.z).toBeCloseTo(CALIBRATED_DISTANCE - distance, 1)
  })

  it('falls back to head height for distance when the hips are out of frame', () => {
    const motion = computeCalibratedRootMotion(
      frameAt({ ...CALIBRATED, distance: 1 }, ['leftHip', 'rightHip']),
      calibrated(),
      RIG_SHOULDER_WIDTH,
      OPTIONS
    )

    expect(motion?.offset.z).toBeCloseTo(CALIBRATED_DISTANCE - 1, 1)
  })

  it.each([
    [false, 0.3],
    [true, -0.3]
  ])('follows a sideways step, mirrored: %s', (mirror, expectedX) => {
    const motion = computeCalibratedRootMotion(
      frameAt({ ...CALIBRATED, lateral: 0.3 }),
      calibrated(),
      RIG_SHOULDER_WIDTH,
      { ...OPTIONS, mirror }
    )

    expect(motion?.offset.x).toBeCloseTo(expectedX)
  })

  it.each([Math.PI / 4, -Math.PI / 4, Math.PI / 2, -Math.PI / 2])(
    'turns the root by the body own yaw of %s radians',
    (yaw) => {
      const motion = computeCalibratedRootMotion(
        frameAt({ ...CALIBRATED, yaw }),
        calibrated(),
        RIG_SHOULDER_WIDTH,
        OPTIONS
      )

      expect(motion?.yaw).toBeCloseTo(yaw, 1)
    }
  )

  it('keeps the turn direction under MediaPipe depth compression once the side step corrects it', () => {
    const withSide: CameraCalibration = { ...calibrated(), side: { depthScale: 2 } }

    const motion = computeCalibratedRootMotion(
      frameAt({ ...CALIBRATED, yaw: -Math.PI / 4 }, [], 0.5),
      withSide,
      RIG_SHOULDER_WIDTH,
      OPTIONS
    )

    expect(motion?.yaw).toBeCloseTo(-Math.PI / 4, 1)
  })

  it.each([
    ['followRotation', 'yaw'],
    ['followSideToSide', 'x'],
    ['followDistance', 'z']
  ] as const)('zeroes its own component when %s is off', (toggle, component) => {
    const motion = computeCalibratedRootMotion(
      frameAt({ distance: 1.5, lateral: 0.3, yaw: Math.PI / 4 }),
      calibrated(),
      RIG_SHOULDER_WIDTH,
      { ...OPTIONS, [toggle]: false }
    )

    const value = component === 'yaw' ? motion?.yaw : motion?.offset[component]
    expect(value).toBe(0)
  })

  it('scales position offsets by the movement scale, leaving rotation alone', () => {
    const placement: Placement = { distance: 1.5, lateral: 0.3, yaw: Math.PI / 4 }
    const normal = computeCalibratedRootMotion(
      frameAt(placement),
      calibrated(),
      RIG_SHOULDER_WIDTH,
      OPTIONS
    )

    const doubled = computeCalibratedRootMotion(
      frameAt(placement),
      calibrated(),
      RIG_SHOULDER_WIDTH,
      { ...OPTIONS, movementScale: 2 }
    )

    expect(doubled?.offset.x).toBeCloseTo((normal?.offset.x ?? 0) * 2)
    expect(doubled?.offset.z).toBeCloseTo((normal?.offset.z ?? 0) * 2)
    expect(doubled?.yaw).toBeCloseTo(normal?.yaw ?? 0)
  })

  it('returns null without a front calibration', () => {
    const uncalibrated: CameraCalibration = { front: null, side: null, rootBoneNames: {} }

    const motion = computeCalibratedRootMotion(
      frameAt(CALIBRATED),
      uncalibrated,
      RIG_SHOULDER_WIDTH,
      OPTIONS
    )

    expect(motion).toBeNull()
  })

  it('returns null when the shoulders are not both detected this frame', () => {
    const motion = computeCalibratedRootMotion(
      frameAt(CALIBRATED, ['rightShoulder']),
      calibrated(),
      RIG_SHOULDER_WIDTH,
      OPTIONS
    )

    expect(motion).toBeNull()
  })
})

describe('computeSceneHandAngle', () => {
  const hand = (): CameraHandLandmark[] =>
    Array.from({ length: 21 }, (_, index) =>
      index === 9 ? { x: 1, y: -1, z: 0 } : { x: 0, y: 0, z: 0 }
    )

  it.each([
    [false, Math.PI / 4],
    [true, (3 * Math.PI) / 4]
  ])('reads the wrist-to-knuckle angle in scene space, mirrored: %s', (mirror, expected) => {
    const angle = computeSceneHandAngle(hand(), mirror)

    expect(angle).toBeCloseTo(expected)
  })
})

describe('computeHandRotationDelta', () => {
  const frontWith = (handAngles: FrontCalibration['handAngles']): FrontCalibration => ({
    ...measureFrontCalibration(frameAt(CALIBRATED), {})!,
    handAngles
  })

  it('reads the change from a calibrated side T-pose angle', () => {
    const delta = computeHandRotationDelta(0.5, 'Left', frontWith({ Left: 0.3 }))

    expect(delta).toBeCloseTo(0.2)
  })

  it('wraps across the half-turn so a small real turn never reads as a full circle', () => {
    const delta = computeHandRotationDelta(-3, 'Left', frontWith({ Left: 3 }))

    expect(delta).toBeCloseTo(2 * Math.PI - 6)
  })

  it.each([
    ['a side never calibrated', frontWith({ Left: 0.3 })],
    ['no front calibration', null]
  ])('is zero for %s', (_, front) => {
    const delta = computeHandRotationDelta(0.5, 'Right', front)

    expect(delta).toBe(0)
  })
})
