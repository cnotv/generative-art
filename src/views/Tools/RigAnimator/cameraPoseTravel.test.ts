import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import {
  advanceCameraTravel,
  cameraBodyPosition,
  cameraLegLength,
  pinPlantedFeet,
  rigLegLength
} from './cameraPoseTravel'
import { captureCameraRetargetRest } from './cameraPoseRetarget'
import { captureRestPoses, resetAllBonesToRest } from './boneDragTarget'
import { buildBodyLandmarks, buildMixamoRig } from './fixtures/cameraPoseFixtures'
import {
  CAMERA_FOOT_PIN_MAX_STRETCH_SHARE,
  CAMERA_FOOT_RELEASE_MILLISECONDS,
  CAMERA_FOOT_RELEASE_SPEED_SHARE,
  CAMERA_TRAVEL_ANCHOR_MILLISECONDS,
  CAMERA_TRAVEL_SMOOTHING_MILLISECONDS
} from './config'
import type { CameraFootTracks, CameraLandmark, CameraTravel } from './types'

const FRAME_SIZE = { width: 1080, height: 1920 }
const FOCAL_PIXELS = Math.hypot(FRAME_SIZE.width, FRAME_SIZE.height)
const FRAME_SECONDS = 1 / 30

/**
 * Photograph world landmarks through a pinhole camera whose focal length is the image diagonal,
 * with the hip centre `depth` metres away and `sideways`/`down` metres off the lens axis.
 */
const photograph = (
  world: CameraLandmark[],
  { depth, sideways = 0, down = 0 }: { depth: number; sideways?: number; down?: number }
): CameraLandmark[] =>
  world.map((landmark) => {
    const distance = depth + landmark.z
    return {
      ...landmark,
      x:
        (FRAME_SIZE.width / 2 + (FOCAL_PIXELS * (sideways + landmark.x)) / distance) /
        FRAME_SIZE.width,
      y:
        (FRAME_SIZE.height / 2 + (FOCAL_PIXELS * (down + landmark.y)) / distance) /
        FRAME_SIZE.height
    }
  })

describe('cameraBodyPosition', () => {
  const standing = buildBodyLandmarks()

  it.each([
    { depth: 2, sideways: 0, down: 0 },
    { depth: 4, sideways: 0, down: 0 },
    { depth: 3, sideways: 0.6, down: 0.2 },
    { depth: 2.5, sideways: -0.4, down: -0.1 }
  ])(
    'places a body $depth m away, $sideways m right and $down m down, in scene axes',
    (placement) => {
      // Arrange
      const image = photograph(standing, placement)

      // Act
      const position = cameraBodyPosition(standing, image, FRAME_SIZE)

      // Assert
      expect(position?.z).toBeCloseTo(-placement.depth, 1)
      expect(position?.x).toBeCloseTo(placement.sideways, 1)
      expect(position?.y).toBeCloseTo(-placement.down, 1)
    }
  )

  it('ignores landmarks placed outside the image when fitting the size', () => {
    // Arrange: the feet photographed well below the frame, where BlazePose still guesses them
    const image = photograph(standing, { depth: 2 }).map((landmark, index) =>
      index >= 27 ? { ...landmark, y: landmark.y + 0.5 } : landmark
    )

    // Act
    const position = cameraBodyPosition(standing, image, FRAME_SIZE)

    // Assert
    expect(position?.z).toBeCloseTo(-2, 1)
  })

  it('has no position when the hips are outside the image', () => {
    // Arrange
    const image = photograph(standing, { depth: 2, down: 1.5 })

    // Act
    const position = cameraBodyPosition(standing, image, FRAME_SIZE)

    // Assert
    expect(position).toBeNull()
  })
})

describe('cameraLegLength', () => {
  it('averages hip to knee to ankle over both legs', () => {
    // Arrange
    const standing = buildBodyLandmarks()

    // Act
    const length = cameraLegLength(standing)

    // Assert
    expect(length).toBeCloseTo(0.84)
  })

  it('has no length when neither leg is in view', () => {
    // Arrange
    const upperBody = buildBodyLandmarks().map((landmark, index) =>
      index >= 25 ? { ...landmark, visibility: 0 } : landmark
    )

    // Act
    const length = cameraLegLength(upperBody)

    // Assert
    expect(length).toBeNull()
  })
})

describe('advanceCameraTravel', () => {
  const RIG_LEG = 84
  const PERFORMER_LEG = 0.84
  const reading = (x: number, z: number) => ({
    bodyPosition: { x, y: 0, z },
    performerLegLength: PERFORMER_LEG
  })
  /** Feed the same reading for `seconds`, one frame at a time, as a live capture would. */
  const settle = (start: CameraTravel, next: ReturnType<typeof reading>, seconds: number) =>
    Array.from({ length: Math.round(seconds / FRAME_SECONDS) }).reduce<CameraTravel>(
      (travel) => advanceCameraTravel(travel, next, RIG_LEG, FRAME_SECONDS),
      start
    )
  /** A source whose performer stood three metres away for as long as the start is taken over. */
  const standingStart = (): CameraTravel =>
    settle(
      advanceCameraTravel(null, reading(0, -3), RIG_LEG, Infinity),
      reading(0, -3),
      CAMERA_TRAVEL_ANCHOR_MILLISECONDS / 1000
    )

  it('starts where the performer first stands', () => {
    // Act
    const travel = advanceCameraTravel(null, reading(0.4, -3), RIG_LEG, Infinity)

    // Assert
    expect(travel.offset).toEqual({ x: 0, y: 0, z: 0 })
  })

  it('takes the start from the first readings together, so one misread first reading moves nothing', () => {
    // Arrange: the very first reading, a fresh detection, puts the performer 20 cm too close
    const misread = advanceCameraTravel(null, reading(0, -2.8), RIG_LEG, Infinity)

    // Act: the performer actually stands still three metres away throughout
    const travel = settle(misread, reading(0, -3), 2)

    // Assert
    expect(travel.offset.z).toBeCloseTo(0, 0)
  })

  it.each([
    { label: 'toward the camera', x: 0, z: -2, expected: { x: 0, z: 100 } },
    { label: 'away from the camera', x: 0, z: -3.5, expected: { x: 0, z: -50 } },
    { label: 'to the right', x: 0.5, z: -3, expected: { x: 50, z: 0 } }
  ])('carries the rig $label, in rig units scaled by leg length', ({ x, z, expected }) => {
    // Arrange
    const start = standingStart()

    // Act
    const travel = settle(start, reading(x, z), (CAMERA_TRAVEL_SMOOTHING_MILLISECONDS / 1000) * 12)

    // Assert
    expect(travel.offset.x).toBeCloseTo(expected.x, 0)
    expect(travel.offset.z).toBeCloseTo(expected.z, 0)
    expect(travel.offset.y).toBe(0)
  })

  it('eases toward a new position rather than jumping to it', () => {
    // Arrange
    const start = standingStart()

    // Act
    const travel = advanceCameraTravel(start, reading(0, -2), RIG_LEG, FRAME_SECONDS)

    // Assert
    expect(travel.offset.z).toBeGreaterThan(0)
    expect(travel.offset.z).toBeLessThan(50)
  })

  it.each([
    { label: 'a pause', elapsedSeconds: 5 },
    { label: 'a seek back', elapsedSeconds: -4 }
  ])(
    'lands straight on where the performer is after $label, measured from the same start',
    ({ elapsedSeconds }) => {
      // Arrange
      const start = standingStart()
      const walked = settle(start, reading(0, -2), 3)

      // Act
      const resumed = advanceCameraTravel(walked, reading(0, -2.5), RIG_LEG, elapsedSeconds)

      // Assert
      expect(resumed.offset.z).toBeCloseTo(50)
    }
  )
})

describe('rigLegLength', () => {
  it('measures thigh plus shin at rest', () => {
    // Arrange
    const rest = captureCameraRetargetRest(buildMixamoRig())

    // Act
    const length = rigLegLength(rest)

    // Assert
    expect(length).toBeGreaterThan(80)
    expect(length).toBeLessThan(85)
  })
})

describe('pinPlantedFeet', () => {
  const buildRig = () => {
    const bones = buildMixamoRig()
    const rest = captureCameraRetargetRest(bones)
    const restPoses = captureRestPoses(bones)
    const bone = (name: string) => bones.find((candidate) => candidate.name === name)!
    const hips = bone('mixamorigHips')
    const legLength = rigLegLength(rest)!
    const ankle = (side: 'Left' | 'Right') =>
      bone(`mixamorig${side}Foot`).getWorldPosition(new THREE.Vector3())
    /**
     * Pose one frame the way the capture does: every bone back to its free pose, the hips moved by
     * `sideways` leg lengths, and `lift` raising the left foot by bending its knee, then pinning.
     */
    const frame = (
      pins: CameraFootTracks,
      { sideways, liftLeftFoot = false }: { sideways: number; liftLeftFoot?: boolean },
      elapsedSeconds = FRAME_SECONDS
    ): CameraFootTracks => {
      resetAllBonesToRest(bones, restPoses)
      hips.position.x = restPoses.get('mixamorigHips')!.position.x + sideways * legLength
      if (liftLeftFoot) bone('mixamorigLeftLeg').rotateX(-Math.PI / 2)
      hips.updateMatrixWorld(true)
      return pinPlantedFeet(bones, rest, pins, elapsedSeconds)
    }
    /** Carry the hips `sideways` leg lengths over frames at a walking pace, a tenth of a leg each. */
    const walk = (pins: CameraFootTracks, sideways: number): CameraFootTracks =>
      Array.from({ length: Math.round(sideways / WALKING_STEP) }).reduce<CameraFootTracks>(
        (tracks, _, step) => frame(tracks, { sideways: (step + 1) * WALKING_STEP }),
        pins
      )
    return { frame, walk, ankle, legLength }
  }
  const WALKING_STEP = 0.02

  it('holds a planted foot where it landed while the hips move over it', () => {
    // Arrange
    const { frame, walk, ankle, legLength } = buildRig()
    const pins = frame({}, { sideways: 0 })
    const planted = ankle('Left')

    // Act
    walk(pins, 0.1)

    // Assert
    expect(ankle('Left').x).toBeCloseTo(planted.x, 0)
    expect(ankle('Left').z).toBeCloseTo(planted.z, 0)
    expect(Math.abs(ankle('Left').x - planted.x)).toBeLessThan(legLength * 0.01)
  })

  it('lets a lifted foot travel with the body', () => {
    // Arrange
    const { frame, ankle, legLength } = buildRig()
    const pins = frame({}, { sideways: 0, liftLeftFoot: true })
    const lifted = ankle('Left')

    // Act
    frame(pins, { sideways: 0.1, liftLeftFoot: true })

    // Assert
    expect(ankle('Left').x - lifted.x).toBeCloseTo(0.1 * legLength, 0)
  })

  it('drags a planted foot along at the leg’s reach once the body moves further than that', () => {
    // Arrange
    const { frame, walk, ankle, legLength } = buildRig()
    const pins = frame({}, { sideways: 0 })
    const planted = ankle('Left')
    const tooFar = CAMERA_FOOT_PIN_MAX_STRETCH_SHARE * 2

    // Act
    walk(pins, tooFar)

    // Assert
    expect(ankle('Left').x - planted.x).toBeCloseTo(
      (tooFar - CAMERA_FOOT_PIN_MAX_STRETCH_SHARE) * legLength,
      0
    )
  })

  it('holds no foot that sweeps across the floor, the way a body running in place moves it', () => {
    // Arrange: the capture carries the feet with the hips, faster than a planted foot moves
    const { frame, ankle, legLength } = buildRig()
    const sweep = CAMERA_FOOT_RELEASE_SPEED_SHARE * 1.5 * FRAME_SECONDS
    const steps = 6

    // Act
    Array.from({ length: steps }).reduce<CameraFootTracks>(
      (tracks, _, step) => frame(tracks, { sideways: (step + 1) * sweep }),
      frame({}, { sideways: 0 })
    )
    const swept = ankle('Left')

    // Assert: exactly where the leg alone puts the foot
    frame({}, { sideways: steps * sweep }, Infinity)
    expect(swept.distanceTo(ankle('Left'))).toBeLessThan(legLength * 0.001)
  })

  it('lets go of a foot that lifts, easing it out rather than snapping', () => {
    // Arrange
    const { frame, ankle, legLength } = buildRig()
    const pins = frame({}, { sideways: 0 })
    const planted = ankle('Left')
    const sideways = 0.1

    // Act
    const releasing = frame(pins, { sideways, liftLeftFoot: true })
    const firstStep = ankle('Left')
    frame(
      releasing,
      { sideways, liftLeftFoot: true },
      (CAMERA_FOOT_RELEASE_MILLISECONDS / 1000) * 2
    )
    const released = ankle('Left')
    frame({}, { sideways, liftLeftFoot: true })
    const free = ankle('Left')

    // Assert
    const shareOfTheWay = (firstStep.x - planted.x) / (free.x - planted.x)
    expect(shareOfTheWay).toBeGreaterThan(0.1)
    expect(shareOfTheWay).toBeLessThan(0.9)
    expect(released.distanceTo(free)).toBeLessThan(legLength * 0.001)
  })
})
