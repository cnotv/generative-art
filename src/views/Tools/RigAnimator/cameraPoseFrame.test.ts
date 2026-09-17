import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import {
  assignHandSides,
  hideLandmarksOutsideFrame,
  cropLandmarksToFrame,
  cropSquareAroundLandmark,
  faceMatrixToHeadRotation,
  hasCameraPoseContent,
  mirrorCameraPoseFrame,
  mirrorHeadRotation,
  smoothCameraPoseFrame,
  smoothHeadRotation,
  steadyCameraHands
} from './cameraPoseFrame'
import {
  CAMERA_CROP_MIN_SIZE_PIXELS,
  CAMERA_HAND_FLIP_CONFIRM_READINGS,
  CAMERA_HAND_TRACK_RESET_MILLISECONDS
} from './config'
import {
  buildBodyLandmarks,
  buildHandLandmarks,
  buildSmoothingSettings
} from './fixtures/cameraPoseFixtures'
import type { CameraHandLandmark, CameraHandTracks, CameraPoseFrame } from './types'

const EMPTY_FRAME: CameraPoseFrame = { bodyLandmarks: null, handLandmarks: {}, headRotation: null }

const quaternionData = (axis: THREE.Vector3, angle: number) => {
  const { x, y, z, w } = new THREE.Quaternion().setFromAxisAngle(axis, angle)
  return { x, y, z, w }
}

const toQuaternion = ({ x, y, z, w }: { x: number; y: number; z: number; w: number }) =>
  new THREE.Quaternion(x, y, z, w)

describe('cropSquareAroundLandmark', () => {
  it('centres a square sized off the shoulder span on the landmark', () => {
    // Arrange, Act
    const crop = cropSquareAroundLandmark({
      center: { x: 0.5, y: 0.5 },
      shoulders: [
        { x: 0.4, y: 0.3 },
        { x: 0.6, y: 0.3 }
      ],
      frameWidth: 1000,
      frameHeight: 500,
      spanMultiplier: 1.5
    })

    // Assert
    expect(crop.left).toBeCloseTo(350)
    expect(crop.top).toBeCloseTo(100)
    expect(crop.size).toBeCloseTo(300)
  })

  it('never shrinks below the minimum size for a subject far away', () => {
    // Arrange, Act
    const crop = cropSquareAroundLandmark({
      center: { x: 0.5, y: 0.5 },
      shoulders: [
        { x: 0.5, y: 0.5 },
        { x: 0.501, y: 0.5 }
      ],
      frameWidth: 100,
      frameHeight: 100,
      spanMultiplier: 1
    })

    // Assert
    expect(crop.size).toBe(CAMERA_CROP_MIN_SIZE_PIXELS)
  })
})

describe('hideLandmarksOutsideFrame', () => {
  it.each([
    ['inside the image', { x: 0.5, y: 0.9 }, 0.8],
    ['on the image edge', { x: 1, y: 0 }, 0.8],
    ['below the image', { x: 0.5, y: 1.3 }, 0],
    ['left of the image', { x: -0.1, y: 0.5 }, 0]
  ])(
    'keeps the visibility of a landmark %s only when it is actually in view',
    (_, imagePoint, expected) => {
      // Arrange
      const worldLandmarks = [{ x: 0.1, y: 0.8, z: 0, visibility: 0.8 }]

      // Act
      const [landmark] = hideLandmarksOutsideFrame(worldLandmarks, [imagePoint])

      // Assert
      expect(landmark.visibility).toBe(expected)
      expect(landmark.y).toBe(0.8)
    }
  )
})

describe('assignHandSides', () => {
  const BODY_WRISTS = { Left: { x: 0.7, y: 0.5 }, Right: { x: 0.3, y: 0.5 } }
  const NO_WRISTS = { Left: null, Right: null }

  it.each([
    [
      'a hand at a wrist belongs to that wrist, whatever its label',
      [{ x: 0.68, y: 0.52 }],
      ['Right'],
      BODY_WRISTS,
      ['Left']
    ],
    [
      'two hands take the wrist each is nearest',
      [
        { x: 0.31, y: 0.5 },
        { x: 0.69, y: 0.5 }
      ],
      ['Left', 'Left'],
      BODY_WRISTS,
      ['Right', 'Left']
    ],
    [
      'a hand far from every wrist keeps its label',
      [{ x: 0.5, y: 0.05 }],
      ['Right'],
      BODY_WRISTS,
      ['Right']
    ],
    [
      'with no wrist in view every label stands',
      [
        { x: 0.3, y: 0.5 },
        { x: 0.7, y: 0.5 }
      ],
      ['Left', 'Right'],
      NO_WRISTS,
      ['Left', 'Right']
    ],
    [
      'two hands near one wrist are split, the closer keeping it',
      [
        { x: 0.66, y: 0.5 },
        { x: 0.71, y: 0.5 }
      ],
      [null, null],
      { Left: { x: 0.7, y: 0.5 }, Right: null },
      ['Right', 'Left']
    ]
  ] as const)('%s', (_, handWrists, labels, bodyWrists, expected) => {
    expect(assignHandSides([...handWrists], [...labels], bodyWrists)).toEqual(expected)
  })
})

describe('cropLandmarksToFrame', () => {
  it('re-expresses crop-relative landmarks relative to the whole frame, keeping other fields', () => {
    // Arrange
    const landmarks = [{ x: 0.5, y: 0.25, z: 0.1, visibility: 0.8 }]

    // Act
    const [mapped] = cropLandmarksToFrame(landmarks, { left: 100, top: 50, size: 200 }, 1000, 500)

    // Assert
    expect(mapped).toEqual({ x: 0.2, y: 0.2, z: 0.1, visibility: 0.8 })
  })
})

describe('faceMatrixToHeadRotation', () => {
  it.each([
    ['looking into the lens', 0],
    ['turned', 0.5]
  ])('reads the rotation of a face %s, ignoring its position', (_, yaw) => {
    // Arrange
    const matrix = new THREE.Matrix4().makeRotationY(yaw).setPosition(2, -1, -40)

    // Act
    const rotation = faceMatrixToHeadRotation(matrix.toArray())

    // Assert
    const expected = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw)
    expect(toQuaternion(rotation).angleTo(expected)).toBeCloseTo(0)
  })
})

describe('mirrorHeadRotation', () => {
  it.each([
    ['a turn reverses', new THREE.Vector3(0, 1, 0), -0.4],
    ['a tilt reverses', new THREE.Vector3(0, 0, 1), -0.4],
    ['a nod stays', new THREE.Vector3(1, 0, 0), 0.4]
  ])('%s', (_, axis, expectedAngle) => {
    // Arrange, Act
    const mirrored = mirrorHeadRotation(quaternionData(axis, 0.4))

    // Assert
    const expected = new THREE.Quaternion().setFromAxisAngle(axis, expectedAngle)
    expect(toQuaternion(mirrored).angleTo(expected)).toBeCloseTo(0)
  })
})

describe('smoothHeadRotation', () => {
  const YAW_AXIS = new THREE.Vector3(0, 1, 0)

  it('takes the first rotation as-is', () => {
    const next = quaternionData(YAW_AXIS, 1)
    expect(smoothHeadRotation(null, next, 1 / 30, buildSmoothingSettings())).toEqual(next)
  })

  it.each([
    ['longer smoothing', { smoothingMilliseconds: 50 }, { smoothingMilliseconds: 300 }],
    ['less loosening on a fast turn', { turnResponse: 10 }, { turnResponse: 0 }]
  ])(
    'turns only part of the way toward a new rotation, less of it with %s',
    (_, lighter, heavier) => {
      // Arrange
      const turned = (overrides: object): number =>
        toQuaternion(
          smoothHeadRotation(
            quaternionData(YAW_AXIS, 0),
            quaternionData(YAW_AXIS, 0.2),
            1 / 30,
            buildSmoothingSettings(overrides)
          )
        ).angleTo(new THREE.Quaternion())

      // Act
      const light = turned(lighter)
      const heavy = turned(heavier)

      // Assert
      expect(light).toBeLessThan(0.2)
      expect(heavy).toBeGreaterThan(0)
      expect(heavy).toBeLessThan(light)
    }
  )
})

describe('hasCameraPoseContent', () => {
  it.each([
    ['nothing', EMPTY_FRAME, false],
    ['a body', { ...EMPTY_FRAME, bodyLandmarks: buildBodyLandmarks() }, true],
    [
      'a hand',
      { ...EMPTY_FRAME, handLandmarks: { Right: buildHandLandmarks('Right', 'open') } },
      true
    ],
    ['a face', { ...EMPTY_FRAME, headRotation: { x: 0, y: 0, z: 0, w: 1 } }, true]
  ])('reports a frame holding %s as %s', (_, frame, expected) => {
    expect(hasCameraPoseContent(frame)).toBe(expected)
  })
})

describe('mirrorCameraPoseFrame', () => {
  it('mirrors body, hands and head together', () => {
    // Arrange
    const leftHand = buildHandLandmarks('Left', 'open')
    const frame: CameraPoseFrame = {
      bodyLandmarks: buildBodyLandmarks(),
      handLandmarks: { Left: leftHand },
      headRotation: quaternionData(new THREE.Vector3(0, 1, 0), 0.4)
    }

    // Act
    const mirrored = mirrorCameraPoseFrame(frame)

    // Assert
    expect(mirrored.bodyLandmarks?.[15].x).toBeCloseTo(0.7)
    expect(mirrored.handLandmarks.Left).toBeUndefined()
    expect(mirrored.handLandmarks.Right?.[5].x).toBeCloseTo(-leftHand[5].x)
    expect(
      toQuaternion(mirrored.headRotation!).angleTo(
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -0.4)
      )
    ).toBeCloseTo(0)
  })
})

describe('smoothCameraPoseFrame', () => {
  const SETTINGS = buildSmoothingSettings()
  const firstReading = (frame: CameraPoseFrame) =>
    smoothCameraPoseFrame(null, frame, 1000, SETTINGS)

  it('filters a part both readings hold and takes a newly appeared part as-is', () => {
    // Arrange
    const previous = firstReading({ ...EMPTY_FRAME, bodyLandmarks: buildBodyLandmarks() })
    const shiftedBody = buildBodyLandmarks().map((landmark) => ({
      ...landmark,
      x: landmark.x + 0.1
    }))
    const rightHand = buildHandLandmarks('Right', 'fist')
    const next: CameraPoseFrame = {
      ...EMPTY_FRAME,
      bodyLandmarks: shiftedBody,
      handLandmarks: { Right: rightHand }
    }

    // Act
    const smoothed = smoothCameraPoseFrame(previous, next, 1033, SETTINGS)

    // Assert
    const shoulderX = smoothed.bodyLandmarks?.[11].x ?? 0
    expect(shoulderX).toBeGreaterThan(0.18)
    expect(shoulderX).toBeLessThan(0.28)
    expect(smoothed.handLandmarks.Right).toEqual(
      rightHand.map((landmark) => ({ ...landmark, velocity: { x: 0, y: 0, z: 0 } }))
    )
    expect(smoothed.timestampMilliseconds).toBe(1033)
  })

  it('drops a part the new reading no longer holds', () => {
    // Arrange
    const previous = firstReading({ ...EMPTY_FRAME, bodyLandmarks: buildBodyLandmarks() })

    // Act
    const smoothed = smoothCameraPoseFrame(previous, EMPTY_FRAME, 1033, SETTINGS)

    // Assert
    expect(smoothed.bodyLandmarks).toBeNull()
  })
})

describe('steadyCameraHands', () => {
  const SETTINGS = buildSmoothingSettings({
    handHoldMilliseconds: 300,
    handFlipRadians: THREE.MathUtils.degToRad(45)
  })
  const OPEN_HAND = buildHandLandmarks('Left', 'open')
  /** The open hand rolled about the fingers' own length, which runs along x. */
  const rolled = (degrees: number): CameraHandLandmark[] => {
    const turn = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(1, 0, 0),
      THREE.MathUtils.degToRad(degrees)
    )
    return OPEN_HAND.map(({ x, y, z }) => {
      const point = new THREE.Vector3(x, y, z).applyQuaternion(turn)
      return { x: point.x, y: point.y, z: point.z }
    })
  }
  const withHand = (landmarks?: CameraHandLandmark[]): CameraPoseFrame => ({
    ...EMPTY_FRAME,
    handLandmarks: landmarks ? { Left: landmarks } : {}
  })
  /** Feed readings 33 ms apart, returning what each one let through. */
  const feed = (
    readings: (CameraHandLandmark[] | undefined)[],
    startTracks: CameraHandTracks = {}
  ) =>
    readings.reduce<{ tracks: CameraHandTracks; shown: (CameraHandLandmark[] | undefined)[] }>(
      ({ tracks, shown }, reading, index) => {
        const steadied = steadyCameraHands(tracks, withHand(reading), index * 33, SETTINGS)
        return { tracks: steadied.tracks, shown: [...shown, steadied.frame.handLandmarks.Left] }
      },
      { tracks: startTracks, shown: [] }
    ).shown

  it.each([
    ['a moment', 5, true],
    ['longer than the hold', 12, false]
  ])('keeps the last reading of a hand lost for %s: %s', (_, missingReadings, kept) => {
    // Arrange
    const readings = [OPEN_HAND, ...Array.from({ length: missingReadings }, () => undefined)]

    // Act
    const shown = feed(readings)

    // Assert
    expect(shown.at(-1)).toEqual(kept ? OPEN_HAND : undefined)
  })

  it('takes a palm turned less than the flip limit straight away', () => {
    // Arrange, Act
    const shown = feed([OPEN_HAND, rolled(30)])

    // Assert
    expect(shown[1]).toEqual(rolled(30))
  })

  it('ignores a palm turned over until enough readings in a row agree on it', () => {
    // Arrange
    const flipped = Array.from({ length: CAMERA_HAND_FLIP_CONFIRM_READINGS }, () => rolled(170))

    // Act
    const shown = feed([OPEN_HAND, ...flipped])

    // Assert
    shown.slice(1, -1).forEach((reading) => expect(reading).toEqual(OPEN_HAND))
    expect(shown.at(-1)).toEqual(rolled(170))
  })

  it('takes a palm turned over at once when the last trusted reading is too old to judge by', () => {
    // Arrange
    const { tracks } = steadyCameraHands({}, withHand(OPEN_HAND), 0, SETTINGS)

    // Act
    const { frame } = steadyCameraHands(
      tracks,
      withHand(rolled(170)),
      CAMERA_HAND_TRACK_RESET_MILLISECONDS + 1,
      SETTINGS
    )

    // Assert
    expect(frame.handLandmarks.Left).toEqual(rolled(170))
  })
})
