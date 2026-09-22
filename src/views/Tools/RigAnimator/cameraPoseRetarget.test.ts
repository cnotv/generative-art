import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import type { HandSide } from '@webgamekit/rig'
import {
  applyCameraPoseFrame,
  cameraBoneMaxTurnRadians,
  cameraBoneSmoothingShare,
  cameraFrameDrivenBoneNames,
  captureBoneTransforms,
  captureCameraRetargetRest,
  easeBonesFromTransforms
} from './cameraPoseRetarget'
import { mirrorCameraLandmarks } from './cameraPoseMapping'
import { faceMatrixToHeadRotation, mirrorCameraPoseFrame } from './cameraPoseFrame'
import {
  buildBodyLandmarks,
  buildHandLandmarks,
  buildMappingOptions,
  buildMixamoRig
} from './fixtures/cameraPoseFixtures'
import danceClip from './fixtures/danceClipFrames.json'
import { CAMERA_JOINT_LIMITS_DEGREES } from './config'
import type { CameraLandmark, CameraPoseFrame } from './types'

const DEFAULT_OPTIONS = buildMappingOptions()
/** Copies the detection exactly, however far past a human joint it reads. */
const UNLIMITED_OPTIONS = buildMappingOptions({ limitJoints: false })
const WORLD_UP = new THREE.Vector3(0, 1, 0)

const poseRig = (frame: Partial<CameraPoseFrame>, options = DEFAULT_OPTIONS) => {
  const bones = buildMixamoRig()
  const rest = captureCameraRetargetRest(bones)
  const fullFrame: CameraPoseFrame = {
    bodyLandmarks: null,
    handLandmarks: {},
    headRotation: null,
    ...frame
  }
  const allBoneNames = new Set(bones.map((bone) => bone.name))
  applyCameraPoseFrame(
    bones,
    rest,
    fullFrame,
    options,
    cameraFrameDrivenBoneNames(fullFrame, allBoneNames)
  )
  const bone = (name: string): THREE.Bone => bones.find((candidate) => candidate.name === name)!
  const position = (name: string): THREE.Vector3 =>
    bone(`mixamorig${name}`).getWorldPosition(new THREE.Vector3())
  const segment = (from: string, to: string): THREE.Vector3 =>
    position(to).sub(position(from)).normalize()
  /** How far a bone has turned from its own rest orientation, in world space. */
  const turnFromRest = (name: string): THREE.Quaternion =>
    bone(`mixamorig${name}`)
      .getWorldQuaternion(new THREE.Quaternion())
      .multiply(rest.worldQuaternions.get(`mixamorig${name}`)!.clone().invert())
  return { bones, rest, bone, position, segment, turnFromRest }
}

/** The direction between two landmarks, in scene axes: y up and z toward the viewer. */
const landmarkDirection = (
  landmarks: { x: number; y: number; z: number }[],
  from: number,
  to: number
): THREE.Vector3 =>
  new THREE.Vector3(
    landmarks[to].x - landmarks[from].x,
    -(landmarks[to].y - landmarks[from].y),
    -(landmarks[to].z - landmarks[from].z)
  ).normalize()

const mirrorIf = (mirrored: boolean, frame: CameraPoseFrame): CameraPoseFrame =>
  mirrored ? mirrorCameraPoseFrame(frame) : frame

const degreesBetween = (a: THREE.Vector3, b: THREE.Vector3): number =>
  THREE.MathUtils.radToDeg(a.angleTo(b))

/** Which way a turn points something that faced the viewer. */
const facing = (turn: THREE.Quaternion): THREE.Vector3 =>
  new THREE.Vector3(0, 0, 1).applyQuaternion(turn)

const pitchDegrees = (direction: THREE.Vector3): number =>
  THREE.MathUtils.radToDeg(Math.asin(direction.y))

/** A bone's local turn from its rest pose, in the hemisphere with w >= 0. */
const localTurnFromRest = (bone: THREE.Bone, restBone: THREE.Bone): THREE.Quaternion => {
  const turn = restBone.quaternion.clone().invert().multiply(bone.quaternion)
  return turn.w < 0 ? new THREE.Quaternion(-turn.x, -turn.y, -turn.z, -turn.w) : turn
}

/** How far a local turn rolls about an axis, in degrees. */
const degreesAbout = (turn: THREE.Quaternion, axis: 'x' | 'y'): number =>
  THREE.MathUtils.radToDeg(2 * Math.atan2(turn[axis], turn.w))

const yawDegrees = (direction: THREE.Vector3): number =>
  THREE.MathUtils.radToDeg(Math.atan2(direction.x, direction.z))

/** Every limb segment the body landmarks describe: rig bone pair, then landmark pair. */
const LIMB_SEGMENTS: [string, string, number, number][] = [
  ['LeftArm', 'LeftForeArm', 11, 13],
  ['LeftForeArm', 'LeftHand', 13, 15],
  ['RightArm', 'RightForeArm', 12, 14],
  ['RightForeArm', 'RightHand', 14, 16],
  ['LeftUpLeg', 'LeftLeg', 23, 25],
  ['LeftLeg', 'LeftFoot', 25, 27],
  ['LeftFoot', 'LeftToeBase', 27, 31],
  ['RightUpLeg', 'RightLeg', 24, 26],
  ['RightLeg', 'RightFoot', 26, 28],
  ['RightFoot', 'RightToeBase', 28, 32]
]

const STRETCH_POSE = {
  13: [0.2, -0.8, 0],
  14: [-0.2, -0.8, 0],
  15: [0.22, -1.05, 0],
  16: [-0.22, -1.05, 0],
  17: [0.23, -1.12, 0.03],
  18: [-0.23, -1.12, 0.03],
  19: [0.23, -1.12, -0.03],
  20: [-0.23, -1.12, -0.03]
} satisfies Record<number, [number, number, number]>

describe('applyCameraPoseFrame', () => {
  describe('limbs copy directions, so proportions never bend a straight limb', () => {
    it.each([
      ['T-pose', {}],
      ['stretch overhead', STRETCH_POSE]
    ])('points every limb segment where the performer does in a %s', (_, overrides) => {
      // Arrange
      const bodyLandmarks = buildBodyLandmarks(overrides)

      // Act
      const { segment } = poseRig({ bodyLandmarks })

      // Assert
      LIMB_SEGMENTS.forEach(([from, to, fromLandmark, toLandmark]) => {
        const expected = landmarkDirection(bodyLandmarks, fromLandmark, toLandmark)
        expect(degreesBetween(segment(from, to), expected)).toBeLessThan(1)
      })
    })

    it.each(['Left', 'Right'])(
      'keeps the %s arm fully straight in a T-pose and overhead',
      (side) => {
        // Arrange, Act
        const tPose = poseRig({ bodyLandmarks: buildBodyLandmarks() })
        const stretch = poseRig({ bodyLandmarks: buildBodyLandmarks(STRETCH_POSE) })

        // Assert
        const bend = (rig: ReturnType<typeof poseRig>): number =>
          degreesBetween(
            rig.segment(`${side}Arm`, `${side}ForeArm`),
            rig.segment(`${side}ForeArm`, `${side}Hand`)
          )
        expect(bend(tPose)).toBeLessThan(1)
        expect(bend(stretch)).toBeLessThan(10)
        expect(stretch.segment(`${side}Arm`, `${side}ForeArm`).y).toBeGreaterThan(0.9)
      }
    )
  })

  it('bends the back progressively up the spine rather than hinging at the hips', () => {
    // Arrange: the shoulders and head lean toward the camera, about 23.5° off vertical.
    const bodyLandmarks = buildBodyLandmarks({
      0: [0, -0.536, -0.3],
      7: [0.07, -0.57, -0.2],
      8: [-0.07, -0.57, -0.2],
      11: [0.18, -0.46, -0.2],
      12: [-0.18, -0.46, -0.2]
    })

    // Act
    const { segment } = poseRig({ bodyLandmarks })

    // Assert
    const lean = (from: string, to: string): number => degreesBetween(segment(from, to), WORLD_UP)
    const spineLeans = [lean('Spine', 'Spine1'), lean('Spine1', 'Spine2'), lean('Spine2', 'Neck')]
    expect(spineLeans[0]).toBeGreaterThan(5)
    expect(spineLeans[1]).toBeGreaterThan(spineLeans[0])
    expect(spineLeans[2]).toBeGreaterThan(spineLeans[1])
    expect(spineLeans[2]).toBeCloseTo(23.5, -0.5)
    expect(segment('Spine2', 'Neck').z).toBeGreaterThan(0)
  })

  it('keeps the legs at their rest pose when the camera does not see them', () => {
    // Arrange: a webcam framed on the upper body, the legs hidden as out of frame.
    const legLandmarks = [25, 26, 27, 28, 29, 30, 31, 32]
    const bodyLandmarks = buildBodyLandmarks({ 25: [0.3, 0.2, -0.4] }).map((landmark, index) =>
      legLandmarks.includes(index) ? { ...landmark, visibility: 0 } : landmark
    )
    const untouched = buildMixamoRig()

    // Act
    const { bone } = poseRig({ bodyLandmarks }, buildMappingOptions({ groundFeet: true }))

    // Assert
    ;['LeftUpLeg', 'LeftLeg', 'LeftFoot', 'RightUpLeg', 'RightLeg', 'RightFoot'].forEach((name) => {
      const restQuaternion = untouched.find((candidate) => candidate.name === `mixamorig${name}`)!
      expect(bone(`mixamorig${name}`).quaternion.equals(restQuaternion.quaternion)).toBe(true)
    })
  })

  it('turns the whole body around when the performer shows their back', () => {
    // Arrange: every landmark half a turn about the vertical, left still the performer's left.
    const bodyLandmarks = buildBodyLandmarks().map(
      (landmark): CameraLandmark => ({ ...landmark, x: -landmark.x, z: -landmark.z })
    )

    // Act
    const { position } = poseRig({ bodyLandmarks })

    // Assert
    const hipLine = position('LeftUpLeg').sub(position('RightUpLeg'))
    const forward = new THREE.Vector3().crossVectors(hipLine, WORLD_UP).normalize()
    expect(forward.z).toBeLessThan(-0.99)
  })

  describe('head and neck', () => {
    it('turns the head to the Face Landmarker rotation and lets the neck take half the turn', () => {
      // Arrange
      const yaw = new THREE.Quaternion().setFromAxisAngle(WORLD_UP, THREE.MathUtils.degToRad(40))

      // Act
      const { turnFromRest } = poseRig({
        bodyLandmarks: buildBodyLandmarks(),
        headRotation: { x: yaw.x, y: yaw.y, z: yaw.z, w: yaw.w }
      })

      // Assert
      expect(yawDegrees(facing(turnFromRest('Head')))).toBeCloseTo(40, 0)
      expect(yawDegrees(facing(turnFromRest('Neck')))).toBeCloseTo(20, 0)
    })

    it('reads a level gaze from the ears and nose as level, not tipped down', () => {
      // Arrange, Act
      const { turnFromRest } = poseRig({ bodyLandmarks: buildBodyLandmarks() })

      // Assert
      expect(Math.abs(pitchDegrees(facing(turnFromRest('Head'))))).toBeLessThan(2)
    })

    it('bends the neck along with a nod read from the ears and nose', () => {
      // Arrange: the nose drops well below the ear line.
      const bodyLandmarks = buildBodyLandmarks({ 0: [0, -0.5, -0.08] })

      // Act
      const { turnFromRest } = poseRig({ bodyLandmarks })

      // Assert
      const headPitch = pitchDegrees(facing(turnFromRest('Head')))
      expect(headPitch).toBeLessThan(-20)
      expect(pitchDegrees(facing(turnFromRest('Neck')))).toBeCloseTo(headPitch / 2, -0.5)
    })
  })

  describe('hands and fingers', () => {
    const FINGERS = ['Index', 'Middle', 'Ring', 'Pinky']

    it.each(['Left', 'Right'] as HandSide[])(
      'curls every %s finger into a fist and keeps an open hand straight, with no body in view',
      (side) => {
        // Arrange, Act
        const fist = poseRig({ handLandmarks: { [side]: buildHandLandmarks(side, 'fist') } })
        const open = poseRig({ handLandmarks: { [side]: buildHandLandmarks(side, 'open') } })

        // Assert
        const fingerFold = (rig: ReturnType<typeof poseRig>, finger: string): number =>
          degreesBetween(
            rig.segment(`${side}Hand${finger}1`, `${side}Hand${finger}2`),
            rig.segment(`${side}Hand${finger}2`, `${side}Hand${finger}3`)
          )
        FINGERS.forEach((finger) => {
          expect(fingerFold(fist, finger)).toBeGreaterThan(45)
          expect(fingerFold(open, finger)).toBeLessThan(5)
        })
      }
    )

    it('curls a finger’s middle and last joints only about their hinge, never sideways', () => {
      // Arrange: the index finger's last two joints read bent sideways, across the palm's width.
      const handLandmarks = buildHandLandmarks('Left', 'fist').map((landmark, index) =>
        index === 7 || index === 8 ? { ...landmark, z: landmark.z - 0.015 * (index - 6) } : landmark
      )
      const restRig = buildMixamoRig()

      // Act
      const limited = poseRig({ handLandmarks: { Left: handLandmarks } })
      const unlimited = poseRig({ handLandmarks: { Left: handLandmarks } }, UNLIMITED_OPTIONS)

      // Assert
      const sideways = (rig: ReturnType<typeof poseRig>, name: string): number => {
        const turn = localTurnFromRest(
          rig.bone(name),
          restRig.find((candidate) => candidate.name === name)!
        )
        return Math.hypot(turn.y, turn.z)
      }
      ;['mixamorigLeftHandIndex2', 'mixamorigLeftHandIndex3'].forEach((name) => {
        expect(sideways(limited, name)).toBeLessThan(1e-6)
      })
      expect(sideways(unlimited, 'mixamorigLeftHandIndex2')).toBeGreaterThan(0.01)
    })

    it('leaves the arm alone when only a hand is in view', () => {
      // Arrange, Act
      const { bone } = poseRig({ handLandmarks: { Left: buildHandLandmarks('Left', 'fist') } })
      const untouched = buildMixamoRig()

      // Assert
      ;['mixamorigLeftArm', 'mixamorigLeftForeArm', 'mixamorigLeftHand'].forEach((name) => {
        const restQuaternion = untouched.find((candidate) => candidate.name === name)!.quaternion
        expect(bone(name).quaternion.angleTo(restQuaternion)).toBeCloseTo(0)
      })
    })

    it.each(['down', 'up'] as const)('turns the hand and forearm to a palm facing %s', (palm) => {
      // Arrange
      const handLandmarks = buildHandLandmarks('Left', 'open', palm)

      // Act
      const { segment } = poseRig({
        bodyLandmarks: buildBodyLandmarks(),
        handLandmarks: { Left: handLandmarks }
      })

      // Assert
      expect(
        degreesBetween(
          segment('LeftHandPinky1', 'LeftHandIndex1'),
          landmarkDirection(handLandmarks, 17, 5)
        )
      ).toBeLessThan(15)
      expect(
        degreesBetween(
          segment('LeftHand', 'LeftHandMiddle1'),
          landmarkDirection(handLandmarks, 0, 9)
        )
      ).toBeLessThan(15)
    })
  })

  it.each([
    ['as detected', false],
    ['mirrored for a self view', true]
  ])('turns the head the same way from the face tracker as from the ears, %s', (_, mirrored) => {
    // Arrange: the head turned 35° about the vertical, read both by the face tracker and by
    // BlazePose's own ears and nose. Built in scene axes, then flipped into MediaPipe's.
    const turn = new THREE.Quaternion().setFromAxisAngle(WORLD_UP, THREE.MathUtils.degToRad(35))
    const earCentre = new THREE.Vector3(0, 0.62, 0)
    const headPoint = (scenePoint: THREE.Vector3): [number, number, number] => {
      const turned = scenePoint.clone().sub(earCentre).applyQuaternion(turn).add(earCentre)
      return [turned.x, -turned.y, -turned.z]
    }
    const bodyLandmarks = buildBodyLandmarks({
      0: headPoint(new THREE.Vector3(0, 0.586, 0.1)),
      7: headPoint(new THREE.Vector3(0.07, 0.62, 0)),
      8: headPoint(new THREE.Vector3(-0.07, 0.62, 0))
    })
    const faceFrame = mirrorIf(mirrored, {
      bodyLandmarks,
      handLandmarks: {},
      headRotation: { x: turn.x, y: turn.y, z: turn.z, w: turn.w }
    })
    const earFrame = { ...faceFrame, headRotation: null }

    // Act
    const fromFace = poseRig(faceFrame).turnFromRest('Head')
    const fromEars = poseRig(earFrame).turnFromRest('Head')

    // Assert
    expect(yawDegrees(facing(fromFace))).toBeCloseTo(mirrored ? -35 : 35, 0)
    expect(yawDegrees(facing(fromEars))).toBeCloseTo(yawDegrees(facing(fromFace)), -0.5)
  })

  it('raises the rig arm on the same screen side as a mirrored self-view preview', () => {
    // Arrange: the performer raises their own right arm; the live feed is mirrored.
    const bodyLandmarks = mirrorCameraLandmarks(
      buildBodyLandmarks({ 14: [-0.2, -0.8, 0], 16: [-0.22, -1.05, 0] })
    )

    // Act
    const { segment } = poseRig({ bodyLandmarks })

    // Assert
    expect(segment('LeftArm', 'LeftForeArm').y).toBeGreaterThan(0.9)
    expect(Math.abs(segment('RightArm', 'RightForeArm').y)).toBeLessThan(0.1)
  })

  it('keeps the lowest foot on the floor through a crouch only when grounding is on', () => {
    // Arrange
    const bodyLandmarks = buildBodyLandmarks({
      25: [0.1, 0.3, -0.25],
      26: [-0.1, 0.3, -0.25],
      27: [0.1, 0.62, 0],
      28: [-0.1, 0.62, 0],
      29: [0.1, 0.66, 0.05],
      30: [-0.1, 0.66, 0.05],
      31: [0.1, 0.68, -0.12],
      32: [-0.1, 0.68, -0.12]
    })
    const lowestFoot = (rig: ReturnType<typeof poseRig>): number =>
      Math.min(
        ...['LeftToeBase', 'RightToeBase', 'LeftFoot', 'RightFoot'].map(
          (name) => rig.position(name).y
        )
      )

    // Act
    const grounded = poseRig({ bodyLandmarks }, buildMappingOptions({ groundFeet: true }))
    const floating = poseRig({ bodyLandmarks }, DEFAULT_OPTIONS)

    // Assert
    const restLowest = Math.min(
      ...['LeftToeBase', 'RightToeBase', 'LeftFoot', 'RightFoot'].map(
        (name) => grounded.rest.worldPositions.get(`mixamorig${name}`)!.y
      )
    )
    expect(lowestFoot(grounded)).toBeCloseTo(restLowest, 3)
    expect(lowestFoot(floating)).toBeGreaterThan(restLowest + 1)
  })

  describe('the attached dance clip, detected by MediaPipe', () => {
    const frames = danceClip.frames.map((frame) => ({
      time: frame.time,
      poseFrame: {
        bodyLandmarks: frame.bodyLandmarks,
        handLandmarks: frame.handLandmarks,
        headRotation: frame.faceMatrix ? faceMatrixToHeadRotation(frame.faceMatrix) : null
      } satisfies CameraPoseFrame
    }))

    it.each(frames)(
      'points every visible limb segment where the dancer does at $time s, with joint limits off',
      ({ poseFrame }) => {
        // Arrange
        const landmarks = poseFrame.bodyLandmarks
        const visibleSegments = LIMB_SEGMENTS.filter(
          ([, , from, to]) => landmarks[from].visibility >= 0.5 && landmarks[to].visibility >= 0.5
        )

        // Act
        const { segment } = poseRig(poseFrame, UNLIMITED_OPTIONS)

        // Assert
        expect(visibleSegments.length).toBeGreaterThan(0)
        visibleSegments.forEach(([from, to, fromLandmark, toLandmark]) => {
          expect(
            degreesBetween(
              segment(from, to),
              landmarkDirection(landmarks, fromLandmark, toLandmark)
            )
          ).toBeLessThan(1)
        })
      }
    )

    it.each(frames.filter(({ poseFrame }) => poseFrame.headRotation))(
      'turns the head exactly as the Face Landmarker read it at $time s',
      ({ poseFrame }) => {
        // Arrange
        const { x, y, z, w } = poseFrame.headRotation!

        // Act
        const { turnFromRest } = poseRig(poseFrame)

        // Assert
        expect(turnFromRest('Head').angleTo(new THREE.Quaternion(x, y, z, w))).toBeLessThan(0.01)
      }
    )

    it.each(frames)("faces the rig the way the dancer's hips face at $time s", ({ poseFrame }) => {
      // Arrange
      const landmarks = poseFrame.bodyLandmarks
      const hipLine = landmarkDirection(landmarks, 24, 23).setY(0).normalize()

      // Act
      const { position } = poseRig(poseFrame)

      // Assert
      const rigHipLine = position('LeftUpLeg').sub(position('RightUpLeg')).setY(0).normalize()
      expect(degreesBetween(rigHipLine, hipLine)).toBeLessThan(8)
    })

    it.each(frames.filter(({ poseFrame }) => Object.keys(poseFrame.handLandmarks).length > 0))(
      "bends the detected fingers where the dancer's point at $time s, with joint limits off",
      ({ poseFrame }) => {
        // Arrange
        const [side, handLandmarks] = Object.entries(poseFrame.handLandmarks)[0]

        // Act
        const { segment } = poseRig(poseFrame, UNLIMITED_OPTIONS)

        // Assert
        ;[
          ['Index1', 'Index2', 5, 6],
          ['Middle2', 'Middle3', 10, 11],
          ['Thumb1', 'Thumb2', 1, 2]
        ].forEach(([from, to, fromLandmark, toLandmark]) => {
          expect(
            degreesBetween(
              segment(`${side}Hand${from}`, `${side}Hand${to}`),
              landmarkDirection(handLandmarks, Number(fromLandmark), Number(toLandmark))
            )
          ).toBeLessThan(2)
        })
      }
    )

    it.each(frames)('keeps every joint inside its human range at $time s', ({ poseFrame }) => {
      // Arrange
      const restRig = buildMixamoRig()
      const limbRolls = [
        ['LeftUpLeg', 'UpLeg'],
        ['RightUpLeg', 'UpLeg'],
        ['LeftForeArm', 'ForeArm'],
        ['RightForeArm', 'ForeArm'],
        ['LeftHand', 'Hand'],
        ['RightHand', 'Hand']
      ] as const
      const fingerHinges = ['Left', 'Right'].flatMap((side) =>
        ['Index', 'Middle', 'Ring', 'Pinky'].flatMap((finger) =>
          [2, 3].map((joint) => `${side}Hand${finger}${joint}`)
        )
      )

      // Act
      const { bone } = poseRig(poseFrame)

      // Assert
      const turn = (name: string): THREE.Quaternion =>
        localTurnFromRest(
          bone(`mixamorig${name}`),
          restRig.find((candidate) => candidate.name === `mixamorig${name}`)!
        )
      limbRolls.forEach(([name, joint]) => {
        const limit = CAMERA_JOINT_LIMITS_DEGREES[joint]
        const maxTwist = 'twist' in limit ? limit.twist : 0
        expect(Math.abs(degreesAbout(turn(name), 'y'))).toBeLessThanOrEqual(maxTwist + 0.5)
      })
      fingerHinges.forEach((name) => {
        expect(Math.abs(turn(name).y)).toBeLessThan(1e-6)
        expect(Math.abs(turn(name).z)).toBeLessThan(1e-6)
      })
    })

    it('rolls a thigh read twisted past a human hip only as far as a hip turns', () => {
      // Arrange: at 5 s the detection has both thighs rolled more than 100° from rest.
      const { poseFrame } = frames.find(({ time }) => time === 5)!
      const restThigh = buildMixamoRig().find(({ name }) => name === 'mixamorigRightUpLeg')!

      // Act
      const limited = poseRig(poseFrame).bone('mixamorigRightUpLeg')
      const unlimited = poseRig(poseFrame, UNLIMITED_OPTIONS).bone('mixamorigRightUpLeg')

      // Assert
      const roll = (thigh: THREE.Bone): number =>
        Math.abs(degreesAbout(localTurnFromRest(thigh, restThigh), 'y'))
      expect(roll(unlimited)).toBeGreaterThan(90)
      expect(roll(limited)).toBeLessThanOrEqual(50.5)
    })
  })
})

describe('each bone rule switches off on its own', () => {
  const HEAD_YAW = new THREE.Quaternion().setFromAxisAngle(WORLD_UP, THREE.MathUtils.degToRad(30))
  /** Leaning, hips turned, head turned, elbows and knees bent: every rule has something to do. */
  const ACTIVE_FRAME: Partial<CameraPoseFrame> = {
    bodyLandmarks: buildBodyLandmarks({
      11: [0.18, -0.46, -0.2],
      12: [-0.18, -0.46, -0.2],
      13: [0.4, -0.3, -0.1],
      14: [-0.4, -0.3, -0.1],
      15: [0.45, -0.3, -0.35],
      16: [-0.45, -0.3, -0.35],
      17: [0.47, -0.3, -0.43],
      18: [-0.47, -0.3, -0.43],
      19: [0.43, -0.3, -0.44],
      20: [-0.43, -0.3, -0.44],
      23: [0.1, 0, 0.05],
      24: [-0.1, 0, -0.05],
      25: [0.12, 0.4, -0.15],
      26: [-0.12, 0.4, -0.15],
      27: [0.1, 0.8, 0],
      28: [-0.1, 0.8, 0]
    }),
    headRotation: { x: HEAD_YAW.x, y: HEAD_YAW.y, z: HEAD_YAW.z, w: HEAD_YAW.w }
  }
  const restRig = buildMixamoRig()
  const restQuaternion = (name: string): THREE.Quaternion =>
    restRig.find((candidate) => candidate.name === `mixamorig${name}`)!.quaternion

  it.each([
    ['turnHips', ['Hips']],
    ['bendSpine', ['Spine', 'Spine1', 'Spine2']],
    ['turnHead', ['Neck', 'Head']],
    ['aimArms', ['LeftArm', 'LeftForeArm', 'RightArm', 'RightForeArm']],
    ['aimLegs', ['LeftUpLeg', 'LeftLeg', 'LeftFoot', 'RightUpLeg', 'RightLeg', 'RightFoot']],
    ['aimFeet', ['LeftFoot', 'RightFoot']]
  ] as const)('leaves the bones %s drives at rest when it is off: %j', (rule, boneNames) => {
    // Arrange, Act
    const on = poseRig(ACTIVE_FRAME, buildMappingOptions())
    const off = poseRig(ACTIVE_FRAME, buildMappingOptions({ [rule]: false }))

    // Assert
    const turned = (rig: ReturnType<typeof poseRig>, name: string): number =>
      rig.bone(`mixamorig${name}`).quaternion.angleTo(restQuaternion(name))
    boneNames.forEach((name) => expect(turned(off, name)).toBeLessThan(1e-6))
    expect(Math.max(...boneNames.map((name) => turned(on, name)))).toBeGreaterThan(0.01)
  })

  it.each([
    ['rollUpperArmsFromElbows', 'LeftArm', 'LeftForeArm'],
    ['rollForearmsToPalms', 'LeftForeArm', 'LeftHand'],
    ['rollThighsFromKneesAndFeet', 'LeftUpLeg', 'LeftLeg']
  ] as const)('changes only the roll, not the aim, of %s when it is off', (rule, from, to) => {
    // Arrange: the frame has no hand, so the palm comes from the body's own landmarks.
    const withBodyPalms = { palmsFromBodyLandmarks: true }

    // Act
    const on = poseRig(ACTIVE_FRAME, buildMappingOptions(withBodyPalms))
    const off = poseRig(ACTIVE_FRAME, buildMappingOptions({ ...withBodyPalms, [rule]: false }))

    // Assert
    expect(degreesBetween(on.segment(from, to), off.segment(from, to))).toBeLessThan(1)
    expect(
      on.bone(`mixamorig${from}`).quaternion.angleTo(off.bone(`mixamorig${from}`).quaternion)
    ).toBeGreaterThan(0.01)
  })

  it('turns the forearm and hand only to a palm the Hand Landmarker found, unless palms from body is on', () => {
    // Arrange: ACTIVE_FRAME has no hand, only the body's own wrist, pinky and index.
    const noPalmRoll = buildMappingOptions({ rollForearmsToPalms: false })

    // Act
    const handOnly = poseRig(ACTIVE_FRAME, buildMappingOptions())
    const fromBody = poseRig(ACTIVE_FRAME, buildMappingOptions({ palmsFromBodyLandmarks: true }))
    const unrolled = poseRig(ACTIVE_FRAME, noPalmRoll)

    // Assert
    const turn = (rig: ReturnType<typeof poseRig>): THREE.Quaternion =>
      rig.bone('mixamorigLeftHand').getWorldQuaternion(new THREE.Quaternion())
    expect(turn(handOnly).angleTo(turn(unrolled))).toBeLessThan(1e-6)
    expect(turn(fromBody).angleTo(turn(unrolled))).toBeGreaterThan(0.01)
  })

  it.each([
    ['on, the ears decide', true, 0],
    ['off, the flipped reading goes through', false, 150]
  ])('with the impossible head turn limit %s', (_, limitHeadTurn, expectedYaw) => {
    // Arrange: a face reading flipped round by 150° on a body facing the camera.
    const flipped = new THREE.Quaternion().setFromAxisAngle(WORLD_UP, THREE.MathUtils.degToRad(150))

    // Act
    const { turnFromRest } = poseRig(
      {
        bodyLandmarks: buildBodyLandmarks(),
        headRotation: { x: flipped.x, y: flipped.y, z: flipped.z, w: flipped.w }
      },
      buildMappingOptions({ limitHeadTurn, limitJoints: false })
    )

    // Assert
    expect(yawDegrees(facing(turnFromRest('Head')))).toBeCloseTo(expectedYaw, -1)
  })

  it('reads a level gaze as tipped down by BlazePose’s nose offset when the pitch correction is off', () => {
    // Arrange, Act
    const { turnFromRest } = poseRig(
      { bodyLandmarks: buildBodyLandmarks() },
      buildMappingOptions({ correctHeadPitch: false })
    )

    // Assert
    expect(pitchDegrees(facing(turnFromRest('Head')))).toBeLessThan(-15)
  })
})

describe('tuning what counts as jitter', () => {
  it.each([
    ['drives', 0.5, false],
    ['ignores', 0.7, true]
  ])(
    '%s an arm seen at 0.6 confidence with the threshold at %s',
    (_, visibilityThreshold, staysAtRest) => {
      // Arrange: the left arm raised, detected at 0.6 confidence.
      const bodyLandmarks = buildBodyLandmarks({ 13: [0.2, -0.8, 0], 15: [0.22, -1.05, 0] }).map(
        (landmark, index) =>
          [11, 13, 15].includes(index) ? { ...landmark, visibility: 0.6 } : landmark
      )
      const restArm = buildMixamoRig().find((bone) => bone.name === 'mixamorigLeftArm')!.quaternion

      // Act
      const { bone } = poseRig({ bodyLandmarks }, buildMappingOptions({ visibilityThreshold }))

      // Assert
      expect(bone('mixamorigLeftArm').quaternion.angleTo(restArm) < 1e-6).toBe(staysAtRest)
    }
  )

  it('takes no roll from an elbow bent less than the roll start angle', () => {
    // Arrange: elbows bent forward about 50°, below a roll start raised to 90°.
    const bodyLandmarks = buildBodyLandmarks({
      13: [0.4, -0.5, 0],
      15: [0.55, -0.5, -0.2]
    })
    const noRollCue = buildMappingOptions({
      twistMinBendRadians: Math.PI / 2,
      twistFullBendRadians: Math.PI
    })

    // Act
    const raisedStart = poseRig({ bodyLandmarks }, noRollCue)
    const rollOff = poseRig(
      { bodyLandmarks },
      buildMappingOptions({ rollUpperArmsFromElbows: false })
    )

    // Assert
    expect(
      raisedStart
        .bone('mixamorigLeftArm')
        .quaternion.angleTo(rollOff.bone('mixamorigLeftArm').quaternion)
    ).toBeLessThan(1e-6)
  })
})

describe('bone smoothing', () => {
  it.each([
    ['takes the whole new pose with bone smoothing off', 0, 1 / 30, 1],
    ['takes the whole new pose when the last one was applied long ago', 150, 2, 1]
  ])('%s', (_, smoothingMilliseconds, elapsedSeconds, expected) => {
    expect(cameraBoneSmoothingShare(smoothingMilliseconds, elapsedSeconds)).toBe(expected)
  })

  it('takes only part of the new pose one frame later, less of it the longer the smoothing', () => {
    const light = cameraBoneSmoothingShare(50, 1 / 30)
    const heavy = cameraBoneSmoothingShare(300, 1 / 30)
    expect(light).toBeLessThan(1)
    expect(heavy).toBeGreaterThan(0)
    expect(heavy).toBeLessThan(light)
  })

  it('eases each snapshotted bone the given share of the way to its new transform', () => {
    // Arrange
    const [bone] = buildMixamoRig()
    const before = captureBoneTransforms([bone], new Set([bone.name]))
    const turned = before
      .get(bone.name)!
      .quaternion.clone()
      .premultiply(new THREE.Quaternion().setFromAxisAngle(WORLD_UP, 1))
    bone.quaternion.copy(turned)

    // Act
    easeBonesFromTransforms([bone], before, 0.5, Infinity)

    // Assert
    expect(bone.quaternion.angleTo(before.get(bone.name)!.quaternion)).toBeCloseTo(0.5)
  })

  it.each([
    ['no cap when it is off', 0, 1 / 30, Infinity],
    ['no cap when the last pose was applied long ago', Math.PI * 4, 2, Infinity],
    ['the speed times the time since the last pose', Math.PI * 4, 1 / 30, (Math.PI * 4) / 30]
  ])('allows %s', (_, maxRadiansPerSecond, elapsedSeconds, expected) => {
    expect(cameraBoneMaxTurnRadians(maxRadiansPerSecond, elapsedSeconds)).toBeCloseTo(expected)
  })

  it('turns a bone that flipped half round in one reading no further than the cap', () => {
    // Arrange
    const [bone] = buildMixamoRig()
    const before = captureBoneTransforms([bone], new Set([bone.name]))
    bone.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(WORLD_UP, Math.PI))

    // Act
    easeBonesFromTransforms([bone], before, 1, 0.4)

    // Assert
    expect(bone.quaternion.angleTo(before.get(bone.name)!.quaternion)).toBeCloseTo(0.4)
  })
})

describe('reach fitted to the model rather than the performer', () => {
  /** Hands clasped together on the midline, in front of the chest, elbows out and down. */
  const CLASPED_HANDS = {
    13: [0.3, -0.35, -0.1],
    14: [-0.3, -0.35, -0.1],
    15: [0, -0.45, -0.25],
    16: [0, -0.45, -0.25],
    17: [0.02, -0.47, -0.28],
    18: [-0.02, -0.47, -0.28],
    19: [0.02, -0.43, -0.28],
    20: [-0.02, -0.43, -0.28]
  } satisfies Record<number, [number, number, number]>

  const topmost = (node: THREE.Object3D): THREE.Object3D =>
    node.parent ? topmost(node.parent) : node

  /** The standard rig with both arms scaled, posed from the clasped-hands frame. */
  const poseWithArms = (armLengthScale: number, fitLimbReach: boolean) => {
    const bones = buildMixamoRig()
    const bone = (name: string): THREE.Bone => bones.find((candidate) => candidate.name === name)!
    ;['Left', 'Right'].forEach((side) => {
      bone(`mixamorig${side}ForeArm`).position.multiplyScalar(armLengthScale)
      bone(`mixamorig${side}Hand`).position.multiplyScalar(armLengthScale)
    })
    topmost(bones[0]).updateMatrixWorld(true)

    const rest = captureCameraRetargetRest(bones)
    const frame: CameraPoseFrame = {
      bodyLandmarks: buildBodyLandmarks(CLASPED_HANDS),
      handLandmarks: {},
      headRotation: null
    }
    applyCameraPoseFrame(
      bones,
      rest,
      frame,
      buildMappingOptions({ fitLimbReach }),
      cameraFrameDrivenBoneNames(frame, new Set(bones.map((candidate) => candidate.name)))
    )
    const at = (name: string): THREE.Vector3 => bone(name).getWorldPosition(new THREE.Vector3())
    return {
      shoulderSpan: at('mixamorigLeftArm').distanceTo(at('mixamorigRightArm')),
      handGap: at('mixamorigLeftHand').distanceTo(at('mixamorigRightHand')),
      leftElbow: at('mixamorigLeftForeArm')
    }
  }

  it.each([
    ['its own', 1],
    ['half again as long', 1.5],
    ['noticeably shorter', 0.6]
  ])('lands both hands on the contact when the rig has %s arms', (_, armLengthScale) => {
    // Arrange, Act
    const copied = poseWithArms(armLengthScale, false)
    const fitted = poseWithArms(armLengthScale, true)

    // Assert: copying directions leaves the hands a good part of a shoulder span apart,
    // whichever way the arm length is wrong; fitting the reach closes it.
    expect(copied.handGap).toBeGreaterThan(0.2 * copied.shoulderSpan)
    expect(fitted.handGap).toBeLessThan(0.01 * fitted.shoulderSpan)
  })

  it('keeps the elbow bent the way the performer bent it', () => {
    // Arrange, Act
    const fitted = poseWithArms(1, true)

    // Assert: the performer's own left elbow is out to their left, and so is the rig's.
    expect(fitted.leftElbow.x).toBeGreaterThan(0)
  })

  it('reaches as far as it can toward a contact the rig is too short to make', () => {
    // Arrange, Act
    const copied = poseWithArms(0.3, false)
    const fitted = poseWithArms(0.3, true)

    // Assert: the limb extends toward the target instead of stretching to it.
    expect(fitted.handGap).toBeLessThan(copied.handGap / 2)
    expect(fitted.handGap).toBeGreaterThan(0)
  })
})

describe('cameraFrameDrivenBoneNames', () => {
  const scope = new Set([
    'mixamorigHips',
    'mixamorigNeck',
    'mixamorigHead',
    'mixamorigLeftArm',
    'mixamorigLeftHand',
    'mixamorigLeftHandIndex1',
    'mixamorigRightHandIndex1'
  ])

  it.each([
    ['a body drives the whole scope', { bodyLandmarks: buildBodyLandmarks() }, [...scope]],
    [
      'a hand alone drives only that hand’s fingers',
      { handLandmarks: { Left: buildHandLandmarks('Left', 'open') } },
      ['mixamorigLeftHandIndex1']
    ],
    [
      'a face alone drives only the neck and head',
      { headRotation: { x: 0, y: 0, z: 0, w: 1 } },
      ['mixamorigNeck', 'mixamorigHead']
    ]
  ])('%s', (_, frame, expected) => {
    // Arrange
    const fullFrame: CameraPoseFrame = {
      bodyLandmarks: null,
      handLandmarks: {},
      headRotation: null,
      ...frame
    }

    // Act
    const driven = cameraFrameDrivenBoneNames(fullFrame, scope)

    // Assert
    expect([...driven].sort()).toEqual([...expected].sort())
  })
})
