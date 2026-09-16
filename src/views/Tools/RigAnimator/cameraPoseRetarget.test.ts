import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import type { HandSide } from '@webgamekit/rig'
import {
  applyCameraPoseFrame,
  cameraFrameDrivenBoneNames,
  captureCameraRetargetRest
} from './cameraPoseRetarget'
import { mirrorCameraLandmarks } from './cameraPoseMapping'
import { faceMatrixToHeadRotation } from './cameraPoseFrame'
import {
  buildBodyLandmarks,
  buildHandLandmarks,
  buildMixamoRig
} from './fixtures/cameraPoseFixtures'
import danceClip from './fixtures/danceClipFrames.json'
import type { CameraLandmark, CameraPoseFrame, CameraPoseMappingOptions } from './types'

const DEFAULT_OPTIONS: CameraPoseMappingOptions = { includeDepth: true, groundFeet: false }
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

const degreesBetween = (a: THREE.Vector3, b: THREE.Vector3): number =>
  THREE.MathUtils.radToDeg(a.angleTo(b))

/** Which way a turn points something that faced the viewer. */
const facing = (turn: THREE.Quaternion): THREE.Vector3 =>
  new THREE.Vector3(0, 0, 1).applyQuaternion(turn)

const pitchDegrees = (direction: THREE.Vector3): number =>
  THREE.MathUtils.radToDeg(Math.asin(direction.y))

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
    const { bone } = poseRig({ bodyLandmarks }, { includeDepth: true, groundFeet: true })

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
    const grounded = poseRig({ bodyLandmarks }, { includeDepth: true, groundFeet: true })
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
      'points every visible limb segment where the dancer does at $time s',
      ({ poseFrame }) => {
        // Arrange
        const landmarks = poseFrame.bodyLandmarks
        const visibleSegments = LIMB_SEGMENTS.filter(
          ([, , from, to]) => landmarks[from].visibility >= 0.5 && landmarks[to].visibility >= 0.5
        )

        // Act
        const { segment } = poseRig(poseFrame)

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
      "bends the detected fingers where the dancer's point at $time s",
      ({ poseFrame }) => {
        // Arrange
        const [side, handLandmarks] = Object.entries(poseFrame.handLandmarks)[0]

        // Act
        const { segment } = poseRig(poseFrame)

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
