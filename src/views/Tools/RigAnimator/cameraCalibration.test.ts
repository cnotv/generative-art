import { describe, it, expect } from 'vitest'
import {
  measureFrontCalibration,
  computeCalibratedReachMultiplier,
  computeCalibratedRootOffset,
  computeSceneHandAngle,
  computeHandRotationDelta
} from './cameraCalibration'
import type {
  CalibratedRootOffsetOptions,
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
const ELBOW_REACH = SHOULDER_WIDTH / 2 + (ARM_SPAN - SHOULDER_WIDTH) / 4

interface ScenePoint {
  x: number
  y: number
  z: number
}

interface Placement {
  distance: number
  lateral: number
}

const CALIBRATED: Placement = { distance: CALIBRATED_DISTANCE, lateral: 0 }

const at = (x: number, y: number): ScenePoint => ({ x, y, z: 0 })

/** A square-on T-pose in scene space (x right, y up, z toward the camera), in MediaPipe's real
 * convention of the subject's left side at the larger x. */
const SCENE_POINTS: Record<PointName, ScenePoint> = {
  nose: at(0, HEAD_HEIGHT),
  leftShoulder: at(SHOULDER_WIDTH / 2, 0),
  rightShoulder: at(-SHOULDER_WIDTH / 2, 0),
  leftElbow: at(ELBOW_REACH, 0),
  rightElbow: at(-ELBOW_REACH, 0),
  leftWrist: at(ARM_SPAN / 2, 0),
  rightWrist: at(-ARM_SPAN / 2, 0),
  leftHip: at(0.1, -TORSO_HEIGHT),
  rightHip: at(-0.1, -TORSO_HEIGHT)
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
const toWorld = (point: ScenePoint): CameraLandmark => ({
  x: point.x,
  y: -point.y,
  z: -point.z,
  visibility: 1
})

const frameAt = (placement: Placement, hidden: PointName[] = []): CalibrationFrame => {
  const nameAt = (index: number): PointName | undefined =>
    (Object.keys(INDEX) as PointName[]).find((name) => INDEX[name] === index)
  const isShown = (name: PointName | undefined): name is PointName =>
    name !== undefined && !hidden.includes(name)
  return {
    image: Array.from({ length: 33 }, (_, index) => {
      const name = nameAt(index)
      return isShown(name) ? toImage(SCENE_POINTS[name], placement) : { x: 0, y: 0, visibility: 0 }
    }),
    world: Array.from({ length: 33 }, (_, index) => {
      const name = nameAt(index)
      return isShown(name) ? toWorld(SCENE_POINTS[name]) : { x: 0, y: 0, z: 0, visibility: 0 }
    }),
    aspect: ASPECT
  }
}

const OPTIONS: CalibratedRootOffsetOptions = {
  fieldOfViewDegrees: FIELD_OF_VIEW_DEGREES,
  followSideToSide: true,
  followDistance: true,
  movementScale: 1,
  mirror: false
}

const calibrated = (): CameraCalibration => ({
  front: measureFrontCalibration(frameAt(CALIBRATED), {}),
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

  it('records the T-pose torso as square-on, and no head baseline without detected ears', () => {
    const front = measureFrontCalibration(frameAt(CALIBRATED), {})

    expect(Math.abs(front?.torsoOrientation.w ?? 0)).toBeCloseTo(1)
    expect(front?.headOrientation).toBeNull()
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

describe('computeCalibratedReachMultiplier', () => {
  it('scales the mapped arm span to the rig own arm span', () => {
    const front = measureFrontCalibration(frameAt(CALIBRATED), {})!
    const rigArmSpan = 1.2

    const multiplier = computeCalibratedReachMultiplier(front, rigArmSpan, RIG_SHOULDER_WIDTH)

    expect(multiplier).toBeCloseTo((rigArmSpan * SHOULDER_WIDTH) / (ARM_SPAN * RIG_SHOULDER_WIDTH))
  })
})

describe('computeCalibratedRootOffset', () => {
  it('reports no offset at the calibrated placement', () => {
    const offset = computeCalibratedRootOffset(
      frameAt(CALIBRATED),
      calibrated(),
      RIG_SHOULDER_WIDTH,
      OPTIONS
    )

    expect(offset?.x).toBeCloseTo(0)
    expect(offset?.y).toBe(0)
    expect(offset?.z).toBeCloseTo(0)
  })

  it.each([1, 3])('moves toward the viewer by the change in distance, at %s metres', (distance) => {
    const offset = computeCalibratedRootOffset(
      frameAt({ ...CALIBRATED, distance }),
      calibrated(),
      RIG_SHOULDER_WIDTH,
      OPTIONS
    )

    expect(offset?.z).toBeCloseTo(CALIBRATED_DISTANCE - distance, 1)
  })

  it('falls back to head height for distance when the hips are out of frame', () => {
    const offset = computeCalibratedRootOffset(
      frameAt({ ...CALIBRATED, distance: 1 }, ['leftHip', 'rightHip']),
      calibrated(),
      RIG_SHOULDER_WIDTH,
      OPTIONS
    )

    expect(offset?.z).toBeCloseTo(CALIBRATED_DISTANCE - 1, 1)
  })

  it.each([
    [false, 0.3],
    [true, -0.3]
  ])('follows a sideways step, mirrored: %s', (mirror, expectedX) => {
    const offset = computeCalibratedRootOffset(
      frameAt({ ...CALIBRATED, lateral: 0.3 }),
      calibrated(),
      RIG_SHOULDER_WIDTH,
      { ...OPTIONS, mirror }
    )

    expect(offset?.x).toBeCloseTo(expectedX)
  })

  it.each([
    ['followSideToSide', 'x'],
    ['followDistance', 'z']
  ] as const)('zeroes its own component when %s is off', (toggle, component) => {
    const offset = computeCalibratedRootOffset(
      frameAt({ distance: 1.5, lateral: 0.3 }),
      calibrated(),
      RIG_SHOULDER_WIDTH,
      { ...OPTIONS, [toggle]: false }
    )

    expect(offset?.[component]).toBe(0)
  })

  it('scales the offset by the movement scale', () => {
    const placement: Placement = { distance: 1.5, lateral: 0.3 }
    const normal = computeCalibratedRootOffset(
      frameAt(placement),
      calibrated(),
      RIG_SHOULDER_WIDTH,
      OPTIONS
    )

    const doubled = computeCalibratedRootOffset(
      frameAt(placement),
      calibrated(),
      RIG_SHOULDER_WIDTH,
      { ...OPTIONS, movementScale: 2 }
    )

    expect(doubled?.x).toBeCloseTo((normal?.x ?? 0) * 2)
    expect(doubled?.z).toBeCloseTo((normal?.z ?? 0) * 2)
  })

  it('returns null without a front calibration', () => {
    const uncalibrated: CameraCalibration = { front: null, rootBoneNames: {} }

    const offset = computeCalibratedRootOffset(
      frameAt(CALIBRATED),
      uncalibrated,
      RIG_SHOULDER_WIDTH,
      OPTIONS
    )

    expect(offset).toBeNull()
  })

  it('returns null when the shoulders are not both detected this frame', () => {
    const offset = computeCalibratedRootOffset(
      frameAt(CALIBRATED, ['rightShoulder']),
      calibrated(),
      RIG_SHOULDER_WIDTH,
      OPTIONS
    )

    expect(offset).toBeNull()
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
