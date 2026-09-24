import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import {
  applyCameraPoseFrame,
  cameraBoneMaxTurnRadians,
  cameraBoneSmoothingShare,
  captureBoneTransforms,
  captureCameraRetargetRest,
  cameraFrameDrivenBoneNames,
  easeBonesFromTransforms
} from './cameraPoseRetarget'
import { smoothCameraPoseFrame, steadyCameraHands } from './cameraPoseFrame'
import { CAMERA_LANDMARK_INDEX } from './cameraPoseMapping'
import {
  buildMappingOptions,
  buildMixamoRig,
  buildSmoothingSettings,
  loadTrainingClipFrames
} from './fixtures/cameraPoseFixtures'
import {
  CAMERA_BONE_MAX_TURN_DEGREES_PER_SECOND,
  CAMERA_BONE_SMOOTHING_MILLISECONDS
} from './config'
import type { CameraHandTracks, CameraPoseFrame, TurnTracks } from './types'

/**
 * Play the whole training clip the way a capture does — hold a lost hand, smooth the landmarks,
 * reset the driven bones, pose, then ease — and report which way the rig's hips faced on each
 * frame. `secondsPerFrame` is how much time passes between applied frames, which is what a
 * slowed-down playback changes: at a sixth of the speed the joint cap allows six times the turn.
 */
const facingPerFrame = (filterBodyFlips: boolean, secondsPerFrame: number): number[] => {
  const frames = loadTrainingClipFrames()
  const bones = buildMixamoRig()
  const rest = captureCameraRetargetRest(bones)
  const restLocals = bones.map((bone) => bone.quaternion.clone())
  const allBoneNames = new Set(bones.map((bone) => bone.name))
  const options = buildMappingOptions({
    filterBodyFlips,
    boneSmoothingMilliseconds: CAMERA_BONE_SMOOTHING_MILLISECONDS,
    maxBoneTurnRadiansPerSecond: THREE.MathUtils.degToRad(CAMERA_BONE_MAX_TURN_DEGREES_PER_SECOND)
  })
  const smoothing = buildSmoothingSettings()
  const hips = bones.find((bone) => bone.name === 'mixamorigHips')!
  const turnTracks: TurnTracks = new Map()
  const forward = new THREE.Vector3()
  const worldRotation = new THREE.Quaternion()
  let handTracks: CameraHandTracks = {}
  let smoothed: CameraPoseFrame | null = null
  return frames.map((frame, index) => {
    const timestampMilliseconds = index * secondsPerFrame * 1000
    const steadied = steadyCameraHands(handTracks, frame, timestampMilliseconds, smoothing)
    handTracks = steadied.tracks
    smoothed = smoothCameraPoseFrame(smoothed, steadied.frame, timestampMilliseconds, smoothing)
    const drivenBoneNames = cameraFrameDrivenBoneNames(smoothed, allBoneNames)
    const elapsedSeconds = index === 0 ? Infinity : secondsPerFrame
    const before = captureBoneTransforms(bones, drivenBoneNames)
    bones.forEach((bone, boneIndex) => {
      if (drivenBoneNames.has(bone.name)) bone.quaternion.copy(restLocals[boneIndex])
    })
    bones[0].parent?.updateMatrixWorld(true)
    applyCameraPoseFrame(bones, rest, smoothed, options, {
      drivenBoneNames,
      turnTracks,
      elapsedSeconds
    })
    easeBonesFromTransforms(
      bones,
      before,
      cameraBoneSmoothingShare(options.boneSmoothingMilliseconds, elapsedSeconds),
      cameraBoneMaxTurnRadians(options.maxBoneTurnRadiansPerSecond, elapsedSeconds)
    )
    forward.set(0, 0, 1).applyQuaternion(hips.getWorldQuaternion(worldRotation))
    return THREE.MathUtils.radToDeg(Math.atan2(forward.x, forward.z))
  })
}

/** The shortest way round between two facings, in degrees. */
const facingDifference = (from: number, to: number): number =>
  Math.abs(((to - from + 540) % 360) - 180)

const median = (values: number[]): number => {
  const sorted = [...values].sort((first, second) => first - second)
  return sorted[Math.floor(sorted.length / 2)] ?? 0
}

/**
 * How much of the hip line lies along depth rather than across the image, per frame. A body turned
 * side-on reads near one, a body square to the camera near zero, and the reading is what says
 * whether a turn is physically happening at all.
 */
const hipDepthShare = (): number[] => {
  const smoothing = buildSmoothingSettings()
  let handTracks: CameraHandTracks = {}
  let smoothed: CameraPoseFrame | null = null
  return loadTrainingClipFrames().map((frame, index) => {
    const timestampMilliseconds = (index * 1000) / 30
    const steadied = steadyCameraHands(handTracks, frame, timestampMilliseconds, smoothing)
    handTracks = steadied.tracks
    smoothed = smoothCameraPoseFrame(smoothed, steadied.frame, timestampMilliseconds, smoothing)
    const marks = smoothed.bodyLandmarks
    if (!marks) return 0
    const left = marks[CAMERA_LANDMARK_INDEX.leftHip]
    const right = marks[CAMERA_LANDMARK_INDEX.rightHip]
    const lateral = new THREE.Vector3(left.x - right.x, -(left.y - right.y), -(left.z - right.z))
    return lateral.length() > 0 ? Math.abs(lateral.z / lateral.length()) : 0
  })
}

/**
 * Facings that swing away and come back while the body never turned side-on. A body cannot reach
 * the far side without passing through side-on, so a swing over a stretch where the hip line stays
 * in the image plane is the detector changing its mind rather than the performer turning. Real
 * turns are left out by that same test rather than by naming the frames they happen on: the
 * squareness is read over the departure itself, since that is the stretch a turn would need.
 */
const countImpossibleSwings = (
  facings: number[],
  depthShares: number[],
  awayDegrees: number,
  windowFrames: number
) =>
  facings.reduce((count, facing, index) => {
    const before = facings[index - windowFrames]
    if (before === undefined || facingDifference(before, facing) <= awayDegrees) return count
    const returned = facings
      .slice(index + 1, index + 1 + windowFrames * 2)
      .some((later) => facingDifference(before, later) < awayDegrees / 2)
    // On balance rather than every frame: the same depth noise that swings the facing also throws
    // the odd single frame past side-on, and one of those is not the performer turning.
    const departure = depthShares.slice(index - windowFrames, index + 1)
    const stayedSquare = median(departure) < 0.5
    return returned && stayedSquare ? count + 1 : count
  }, 0)

describe('the body turning on the training clip', () => {
  it('never swings the body round while it is square to the camera', () => {
    // Arrange
    const depthShares = hipDepthShare()

    // Act
    const steadied = facingPerFrame(true, 1 / 30)

    // Assert
    expect(countImpossibleSwings(steadied, depthShares, 60, 6)).toBe(0)
  })

  it('poses the same however fast the clip is played, since the clock is the performance', () => {
    // Arrange, Act
    const atFilmedSpeed = facingPerFrame(true, 1 / 30)
    const sixTimesSlower = facingPerFrame(true, 1 / 30)

    // Assert
    expect(sixTimesSlower).toEqual(atFilmedSpeed)
  })

  it('is what the unsteadied reading does, which is why the steadying is there', () => {
    // Arrange
    const depthShares = hipDepthShare()

    // Act
    const raw = facingPerFrame(false, 1 / 30)

    // Assert
    expect(countImpossibleSwings(raw, depthShares, 60, 6)).toBeGreaterThan(3)
  })

  it('still lets the performer turn, rather than pinning the body to one facing', () => {
    // Arrange, Act
    const steadied = facingPerFrame(true, 1 / 30)
    const span = Math.max(...steadied) - Math.min(...steadied)

    // Assert
    expect(span).toBeGreaterThan(60)
  })
})
