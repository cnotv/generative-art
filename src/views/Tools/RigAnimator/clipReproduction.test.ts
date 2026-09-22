import { describe, it, expect } from 'vitest'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import * as THREE from 'three'
import { fbxLoader } from '@webgamekit/threejs'
import { poseBuildClip, poseCapture, type Pose } from '@webgamekit/rig'
import {
  applyCameraPoseFrame,
  cameraBoneMaxTurnRadians,
  cameraBoneSmoothingShare,
  cameraFrameDrivenBoneNames,
  captureBoneTransforms,
  captureCameraRetargetRest,
  easeBonesFromTransforms
} from './cameraPoseRetarget'
import { faceMatrixToHeadRotation, smoothCameraPoseFrame } from './cameraPoseFrame'
import { sampleClipAsPoseKeyframes } from './presets'
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
  CAMERA_LANDMARK_MAX_JUMP_METERS,
  DEFAULT_FPS
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
const BENDS: [string, [number, number, number]][] = [
  ['left elbow', [0, 1, 2]],
  ['right elbow', [3, 4, 5]],
  ['left knee', [6, 7, 8]],
  ['right knee', [9, 10, 11]]
]
/** How finely the recording is slid along the looping clip to find where it started. */
const OFFSET_STEPS_PER_SECOND = 120

/** The Config panel's defaults, as the Rig Animator starts: a capture nobody has tuned. */
const PANEL_OPTIONS = buildMappingOptions({
  groundFeet: true,
  maxBoneTurnRadiansPerSecond: THREE.MathUtils.degToRad(CAMERA_BONE_MAX_TURN_DEGREES_PER_SECOND)
})
const PANEL_SMOOTHING = buildSmoothingSettings({ maxJump: CAMERA_LANDMARK_MAX_JUMP_METERS })

const RUNNING_PRESET_PATH = resolve(process.cwd(), 'public/animations/running.fbx')

const recordedFrames = runningClip.frames.map((frame) => ({
  time: frame.time,
  poseFrame: {
    bodyLandmarks: frame.bodyLandmarks,
    handLandmarks: {},
    headRotation: frame.faceMatrix ? faceMatrixToHeadRotation(frame.faceMatrix) : null
  } satisfies CameraPoseFrame
}))

const rigRoot = (bones: THREE.Bone[]): THREE.Object3D =>
  bones.find((bone) => !(bone.parent instanceof THREE.Bone))!.parent!

/** Where the compared joints are, and every bone's rotation, so a frame can also be rendered. */
interface RigFrame {
  joints: THREE.Vector3[]
  pose: Pose
}

const readRigFrame = (bones: THREE.Bone[]): RigFrame => {
  rigRoot(bones).updateMatrixWorld(true)
  return {
    joints: JOINTS.map(([name]) =>
      bones.find((bone) => bone.name === `mixamorig${name}`)!.getWorldPosition(new THREE.Vector3())
    ),
    pose: poseCapture(bones)
  }
}

/** MediaPipe's y grows downward and z away from the camera; the scene's y up and z toward it. */
const readLandmarkJoints = (landmarks: CameraLandmark[]): THREE.Vector3[] =>
  JOINTS.map(
    ([, index]) => new THREE.Vector3(landmarks[index].x, -landmarks[index].y, -landmarks[index].z)
  )

/**
 * Replay the recording through the same steps `useRigCameraPose` takes for a live frame: smooth
 * the reading against the last one, reset the bones it drives to rest, pose them, then ease them
 * from where the previous frame left them.
 */
const replayCapture = (
  frames: typeof recordedFrames,
  options = PANEL_OPTIONS,
  smoothing = PANEL_SMOOTHING
): RigFrame[] => {
  const bones = buildMixamoRig()
  const rest = captureCameraRetargetRest(bones)
  const allBoneNames = new Set(bones.map((bone) => bone.name))
  const restTransforms = captureBoneTransforms(bones, allBoneNames)
  const frameSeconds = 1 / DEFAULT_FPS
  return frames.reduce<{ previous: CameraPoseFrame | null; rigFrames: RigFrame[] }>(
    ({ previous, rigFrames }, { time, poseFrame }, index) => {
      const smoothed = smoothCameraPoseFrame(previous, poseFrame, time * 1000, smoothing)
      const driven = cameraFrameDrivenBoneNames(smoothed, allBoneNames)
      const before = captureBoneTransforms(bones, driven)
      bones
        .filter((bone) => driven.has(bone.name))
        .forEach((bone) => {
          bone.quaternion.copy(restTransforms.get(bone.name)!.quaternion)
          bone.position.copy(restTransforms.get(bone.name)!.position)
        })
      rigRoot(bones).updateMatrixWorld(true)
      applyCameraPoseFrame(bones, rest, smoothed, options, driven)
      const elapsedSeconds = index === 0 ? Infinity : frameSeconds
      easeBonesFromTransforms(
        bones,
        before,
        cameraBoneSmoothingShare(options.boneSmoothingMilliseconds, elapsedSeconds),
        cameraBoneMaxTurnRadians(options.maxBoneTurnRadiansPerSecond, elapsedSeconds)
      )
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

describe('reproducing a screen recording of the Running preset through camera capture', () => {
  const detected = normalizeAll(
    recordedFrames.map(({ poseFrame }) => readLandmarkJoints(poseFrame.bodyLandmarks!))
  )
  const presetFrames = alignPresetToRecording(loadRunningPreset(), detected)
  const captureFrames = replayCapture(recordedFrames)
  const truth = normalizeAll(presetFrames)
  const captured = normalizeAll(captureFrames)
  const capturedFacingTruth = turnAboutVertical(captured, bestVerticalTurn(truth, captured))

  it.each([
    { limb: 'legs', segments: LIMB_SEGMENTS.slice(4), maxDegrees: 15 },
    { limb: 'near arm', segments: LIMB_SEGMENTS.slice(2, 4), maxDegrees: 25 }
  ])(
    'points the $limb within $maxDegrees° of the preset on average',
    ({ segments, maxDegrees }) => {
      // Arrange, Act
      const degrees = meanSegmentAngleDegrees(truth, capturedFacingTruth, segments)

      // Assert
      expect(degrees).toBeLessThan(maxDegrees)
    }
  )

  it.each(BENDS.filter(([name]) => name.endsWith('knee')))(
    'bends the %s in step with the preset, stride for stride',
    (_, chain) => {
      // Arrange
      const bendOver = (frames: THREE.Vector3[][]): number[] =>
        frames.map((joints) => jointBendDegrees(joints, chain))

      // Act
      const correlation = pearsonCorrelation(bendOver(truth), bendOver(capturedFacingTruth))

      // Assert
      expect(correlation).toBeGreaterThan(0.65)
    }
  )

  it('lands half the joints within a fifth of a torso of the preset, seen from the recording camera', () => {
    // Arrange
    const expected = inRecordingView(truth, detected)

    // Act
    const correct = percentCorrectKeypoints(expected, inRecordingView(captured, detected), 0.2)

    // Assert
    expect(correct).toBeGreaterThan(0.5)
  })

  // The detector reads the arm on the far side of the body at 0.2 to 0.6 visibility, under the
  // 0.5 cut-off, so on most frames the capture drops it back to rest: a T-pose arm in a run.
  // Read at any visibility it follows the detection within 7°. Holding a lost limb is #301.
  it.fails(
    'points the far arm, the one the detector is unsure of, within 40° of the preset',
    () => {
      // Arrange, Act
      const degrees = meanSegmentAngleDegrees(truth, capturedFacingTruth, LIMB_SEGMENTS.slice(0, 2))

      // Assert
      expect(degrees).toBeLessThan(40)
    }
  )

  // Only on request: the frames a side by side comparison video is rendered from, see
  // `scripts/render-clip-comparison.mjs`.
  it.runIf(process.env.CLIP_COMPARISON_OUTPUT)(
    'writes both rigs, frame by frame, for a comparison video',
    () => {
      // Arrange
      const outputPath = process.env.CLIP_COMPARISON_OUTPUT!
      const comparison = {
        framesPerSecond: DEFAULT_FPS,
        captureTurn: bestVerticalTurn(detected, captured),
        presetTurn: bestVerticalTurn(detected, truth),
        frames: recordedFrames.map(({ time }, index) => ({
          time,
          capture: captureFrames[index].pose,
          preset: presetFrames[index].pose,
          limbAngleDegrees: meanSegmentAngleDegrees(
            [truth[index]],
            [capturedFacingTruth[index]],
            LIMB_SEGMENTS
          )
        }))
      }

      // Act
      writeFileSync(outputPath, JSON.stringify(comparison))

      // Assert
      expect(readFileSync(outputPath, 'utf8').length).toBeGreaterThan(0)
    }
  )
})
