import { describe, it, expect } from 'vitest'
import { shallowRef } from 'vue'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import * as THREE from 'three'
import { fbxLoader } from '@webgamekit/threejs'
import { poseBuildClip, poseCapture, type Pose, type PoseKeyframe } from '@webgamekit/rig'
import { useRigCameraPose } from './useRigCameraPose'
import { captureRestPoses, resetAllBonesToRest } from './boneDragTarget'
import { CAMERA_HIPS_BONE } from './cameraPoseRetarget'
import { cameraBodyPosition } from './cameraPoseTravel'
import {
  continuesPreviousReading,
  faceMatrixToHeadRotation,
  hideLandmarksOutsideFrame,
  smoothCameraPoseFrame
} from './cameraPoseFrame'
import { sampleClipAsPoseKeyframes } from './presets'
import { cleanUpRecordedTake } from './keyframeOps'
import { RIG_BODY_PART_GROUPS } from './bodyPartGroups'
import {
  bestVerticalTurn,
  jointBendDegrees,
  meanJointError,
  meanSegmentAngleDegrees,
  normalizeSkeleton,
  pearsonCorrelation,
  percentCorrectKeypoints,
  turnAboutVertical
} from './poseSimilarity'
import {
  buildMappingOptions,
  buildMixamoRig,
  buildSmoothingSettings
} from './fixtures/cameraPoseFixtures'
import runningClip from './fixtures/runningClipFrames.json'
import {
  CAMERA_BONE_MAX_TURN_DEGREES_PER_SECOND,
  CAMERA_BONE_SMOOTHING_MILLISECONDS,
  CAMERA_LANDMARK_MAX_JUMP_METERS,
  DEFAULT_FPS,
  RECORDING_HALVING_PASSES,
  RECORDING_SMOOTHING_PASSES
} from './config'
import type { CameraLandmark, CameraPoseFrame } from './types'

/** Each compared joint, as the rig bone that sits on it and the BlazePose landmark for it. */
const JOINTS: [string, number][] = [
  ['LeftArm', 11],
  ['LeftForeArm', 13],
  ['LeftHand', 15],
  ['RightArm', 12],
  ['RightForeArm', 14],
  ['RightHand', 16],
  ['LeftUpLeg', 23],
  ['LeftLeg', 25],
  ['LeftFoot', 27],
  ['RightUpLeg', 24],
  ['RightLeg', 26],
  ['RightFoot', 28]
]
const TORSO = { leftShoulder: 0, rightShoulder: 3, leftHip: 6, rightHip: 9 }
const LIMB_SEGMENTS: [number, number][] = [
  [0, 1],
  [1, 2],
  [3, 4],
  [4, 5],
  [6, 7],
  [7, 8],
  [9, 10],
  [10, 11]
]
const FAR_ARM = LIMB_SEGMENTS.slice(0, 2)
const NEAR_ARM = LIMB_SEGMENTS.slice(2, 4)
const LEGS = LIMB_SEGMENTS.slice(4)
const KNEES: [string, [number, number, number]][] = [
  ['left knee', [6, 7, 8]],
  ['right knee', [9, 10, 11]]
]
/** How finely the recording is slid along the looping clip to find where it started. */
const OFFSET_STEPS_PER_SECOND = 120

/** The Config panel's defaults, as the Rig Animator starts: a capture nobody has tuned. */
const PANEL_OPTIONS = buildMappingOptions({
  groundFeet: true,
  filterBodyFlips: true,
  boneSmoothingMilliseconds: CAMERA_BONE_SMOOTHING_MILLISECONDS,
  maxBoneTurnRadiansPerSecond: THREE.MathUtils.degToRad(CAMERA_BONE_MAX_TURN_DEGREES_PER_SECOND),
  followTravel: true,
  pinPlantedFeet: true
})
const PANEL_SMOOTHING = buildSmoothingSettings({ maxJump: CAMERA_LANDMARK_MAX_JUMP_METERS })
const ALL_GROUPS = new Set(RIG_BODY_PART_GROUPS)

const RUNNING_PRESET_PATH = resolve(process.cwd(), 'public/animations/running.fbx')

/** A fixture frame as `detectCameraPose` turns the detector's reading into a frame to apply. */
const toPoseFrame = (frame: (typeof runningClip.frames)[number]): CameraPoseFrame => {
  const world: CameraLandmark[] = frame.bodyLandmarks
  const image: CameraLandmark[] = frame.imageLandmarks
  const bodyPosition = cameraBodyPosition(world, image, runningClip.imageSize)
  return {
    bodyLandmarks: hideLandmarksOutsideFrame(world, image),
    handLandmarks: {},
    headRotation: frame.faceMatrix ? faceMatrixToHeadRotation(frame.faceMatrix) : null,
    ...(bodyPosition ? { bodyPosition } : {})
  }
}

/** Only the readings the live detection loop applies: the first one only primes the tracker. */
const recordedFrames = runningClip.frames
  .filter((frame, index) =>
    continuesPreviousReading(index === 0 ? null : runningClip.frames[index - 1].time, frame.time)
  )
  .map((frame) => ({ time: frame.time, poseFrame: toPoseFrame(frame) }))

const rigRoot = (bones: THREE.Bone[]): THREE.Object3D =>
  bones.find((bone) => !(bone.parent instanceof THREE.Bone))!.parent!

/** Where the compared joints are, and the sample Record Motion would key for the frame. */
interface RigFrame {
  joints: THREE.Vector3[]
  sample: Omit<PoseKeyframe, 'frame'>
}

const readRigFrame = (bones: THREE.Bone[]): RigFrame => {
  rigRoot(bones).updateMatrixWorld(true)
  const hips = bones.find((bone) => bone.name === CAMERA_HIPS_BONE)!
  const pose: Pose = poseCapture(bones)
  return {
    joints: JOINTS.map(([name]) =>
      bones.find((bone) => bone.name === `mixamorig${name}`)!.getWorldPosition(new THREE.Vector3())
    ),
    sample: {
      pose,
      positions: { [hips.name]: { x: hips.position.x, y: hips.position.y, z: hips.position.z } }
    }
  }
}

/** MediaPipe's y grows downward and z away from the camera; the scene's y up and z toward it. */
const readLandmarkJoints = (landmarks: CameraLandmark[]): THREE.Vector3[] =>
  JOINTS.map(
    ([, index]) => new THREE.Vector3(landmarks[index].x, -landmarks[index].y, -landmarks[index].z)
  )

/**
 * Replay the recording through the capture the Rig Animator itself runs, `useRigCameraPose` wired
 * to the default character: each reading smoothed against the last one, then applied at the
 * video's own time, travel and planted feet included.
 */
const replayCapture = (): RigFrame[] => {
  const bones = buildMixamoRig()
  const restPoses = captureRestPoses(bones)
  const { applyCameraPose } = useRigCameraPose(shallowRef(bones), (exclude) =>
    resetAllBonesToRest(bones, restPoses, exclude)
  )
  return recordedFrames.reduce<{ previous: CameraPoseFrame | null; rigFrames: RigFrame[] }>(
    ({ previous, rigFrames }, { time, poseFrame }) => {
      const smoothed = smoothCameraPoseFrame(previous, poseFrame, time * 1000, PANEL_SMOOTHING)
      applyCameraPose(smoothed, PANEL_OPTIONS, ALL_GROUPS, time * 1000)
      return { previous: smoothed, rigFrames: [...rigFrames, readRigFrame(bones)] }
    },
    { previous: null, rigFrames: [] }
  ).rigFrames
}

/**
 * The Running preset exactly as the Rig Animator plays it on the default character: the FBX
 * sampled into keyframes by `sampleClipAsPoseKeyframes`, rebuilt into a looping clip by
 * `poseBuildClip`, and read back at any time.
 */
const loadRunningPreset = () => {
  const fileBuffer = readFileSync(RUNNING_PRESET_PATH)
  const fbx = fbxLoader.parse(
    fileBuffer.buffer.slice(fileBuffer.byteOffset, fileBuffer.byteOffset + fileBuffer.byteLength),
    ''
  )
  const bones = buildMixamoRig()
  const clip = poseBuildClip(
    sampleClipAsPoseKeyframes(fbx.animations[0], DEFAULT_FPS),
    bones.map((bone) => bone.name),
    DEFAULT_FPS
  )
  const mixer = new THREE.AnimationMixer(rigRoot(bones))
  mixer.clipAction(clip).play()
  const frameAt = (seconds: number): RigFrame => {
    mixer.setTime(seconds % clip.duration)
    return readRigFrame(bones)
  }
  return { duration: clip.duration, frameAt }
}

/**
 * The capture as Record Motion leaves it on the timeline: one keyframe per frame, cleaned up with
 * the default passes, then played back with the interpolation the timeline uses between them.
 */
const playRecordedTake = (rigFrames: RigFrame[]): RigFrame[] => {
  const keyframes = cleanUpRecordedTake(
    rigFrames.map(({ sample }, frame) => ({ frame, ...sample })),
    { smoothingPasses: RECORDING_SMOOTHING_PASSES, halvingPasses: RECORDING_HALVING_PASSES }
  )
  const bones = buildMixamoRig()
  const mixer = new THREE.AnimationMixer(rigRoot(bones))
  mixer
    .clipAction(
      poseBuildClip(
        keyframes,
        bones.map((bone) => bone.name),
        DEFAULT_FPS
      )
    )
    .play()
  return rigFrames.map((_, frame) => {
    mixer.setTime(frame / DEFAULT_FPS)
    return readRigFrame(bones)
  })
}

const normalizeAll = (frames: RigFrame[] | THREE.Vector3[][]): THREE.Vector3[][] =>
  frames.map((frame) => normalizeSkeleton(Array.isArray(frame) ? frame : frame.joints, TORSO))

/**
 * The recording starts wherever the loop happened to be, so the preset is slid along its own loop
 * to the start that best fits what the detector read, the way unsynchronised captures are aligned.
 * Aligned to the detection rather than to the capture, so a worse capture cannot shift the
 * reference it is judged against.
 */
const alignPresetToRecording = (
  preset: ReturnType<typeof loadRunningPreset>,
  detection: THREE.Vector3[][]
): RigFrame[] => {
  const offsets = Array.from(
    { length: Math.ceil(preset.duration * OFFSET_STEPS_PER_SECOND) },
    (_, step) => step / OFFSET_STEPS_PER_SECOND
  )
  const presetAt = (offset: number): RigFrame[] =>
    recordedFrames.map(({ time }) => preset.frameAt(time + offset))
  const errors = offsets.map((offset) => {
    const reference = normalizeAll(presetAt(offset))
    return meanJointError(
      reference,
      turnAboutVertical(detection, bestVerticalTurn(reference, detection))
    )
  })
  return presetAt(offsets[errors.indexOf(Math.min(...errors))])
}

/**
 * Turn every frame to face the recording camera the way the detection does, and drop the depth:
 * what is left is the picture the recording shows, seen through a camera without perspective.
 */
const inRecordingView = (
  frames: THREE.Vector3[][],
  detection: THREE.Vector3[][]
): THREE.Vector3[][] =>
  turnAboutVertical(frames, bestVerticalTurn(detection, frames)).map((joints) =>
    joints.map((joint) => new THREE.Vector3(joint.x, joint.y, 0))
  )

const facing = (truth: THREE.Vector3[][], frames: THREE.Vector3[][]): THREE.Vector3[][] =>
  turnAboutVertical(frames, bestVerticalTurn(truth, frames))

const kneeBends = (frames: THREE.Vector3[][], chain: [number, number, number]): number[] =>
  frames.map((joints) => jointBendDegrees(joints, chain))

describe('reproducing a screen recording of the Running preset through camera capture', () => {
  const detected = normalizeAll(
    recordedFrames.map(({ poseFrame }) => readLandmarkJoints(poseFrame.bodyLandmarks!))
  )
  const truth = normalizeAll(alignPresetToRecording(loadRunningPreset(), detected))
  const captureFrames = replayCapture()
  const captured = facing(truth, normalizeAll(captureFrames))

  it.each([
    { limb: 'legs', segments: LEGS, maxDegrees: 15 },
    { limb: 'near arm', segments: NEAR_ARM, maxDegrees: 25 },
    // The detector reads the far arm at 0.2 to 0.6 visibility, under the 0.5 cut-off: reset to rest
    // on those frames it was 68° off, a T-pose arm in a run, and held it lands under 40°.
    { limb: 'far arm', segments: FAR_ARM, maxDegrees: 42 }
  ])(
    'points the $limb within $maxDegrees° of the preset on average',
    ({ segments, maxDegrees }) => {
      // Act
      const degrees = meanSegmentAngleDegrees(truth, captured, segments)

      // Assert
      expect(degrees).toBeLessThan(maxDegrees)
    }
  )

  it.each(KNEES)('bends the %s in step with the preset, stride for stride', (_, chain) => {
    // Act
    const correlation = pearsonCorrelation(kneeBends(truth, chain), kneeBends(captured, chain))

    // Assert
    expect(correlation).toBeGreaterThan(0.65)
  })

  it('lands half the joints within a fifth of a torso of the preset, seen from the recording camera', () => {
    // Arrange
    const expected = inRecordingView(truth, detected)

    // Act
    const correct = percentCorrectKeypoints(expected, inRecordingView(captured, detected), 0.2)

    // Assert
    expect(correct).toBeGreaterThan(0.5)
  })

  it('keeps the legs and the stride once Record Motion smooths and thins the take', () => {
    // Arrange
    const recorded = facing(truth, normalizeAll(playRecordedTake(captureFrames)))

    // Act
    const legDegrees = meanSegmentAngleDegrees(truth, recorded, LEGS)
    const kneeCorrelations = KNEES.map(([, chain]) =>
      pearsonCorrelation(kneeBends(truth, chain), kneeBends(recorded, chain))
    )

    // Assert
    expect(legDegrees).toBeLessThan(15)
    kneeCorrelations.forEach((correlation) => expect(correlation).toBeGreaterThan(0.65))
  })
})
