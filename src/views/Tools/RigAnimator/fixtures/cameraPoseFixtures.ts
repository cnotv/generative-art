import * as THREE from 'three'
import type { HandSide } from '@webgamekit/rig'
import skeleton from './mixamoCharacterSkeleton.json'
import {
  CAMERA_LANDMARK_VISIBILITY_THRESHOLD,
  CAMERA_SMOOTHING_MILLISECONDS,
  CAMERA_SMOOTHING_SPEED_CUTOFF_HERTZ,
  CAMERA_SMOOTHING_SPEED_RESPONSE,
  CAMERA_SMOOTHING_TURN_RESPONSE,
  CAMERA_TWIST_FULL_BEND_DEGREES,
  CAMERA_TWIST_MIN_BEND_DEGREES
} from '../config'
import type {
  CameraHandLandmark,
  CameraLandmark,
  CameraPoseMappingOptions,
  CameraSmoothingSettings
} from '../types'

/**
 * Every bone rule switched on, the Config panel's default, with any switched as given.
 * @param overrides Rules to set differently
 * @returns The mapping options
 */
export const buildMappingOptions = (
  overrides: Partial<CameraPoseMappingOptions> = {}
): CameraPoseMappingOptions => ({
  includeDepth: true,
  groundFeet: false,
  turnHips: true,
  bendSpine: true,
  turnHead: true,
  correctHeadPitch: true,
  limitHeadTurn: true,
  aimArms: true,
  rollUpperArmsFromElbows: true,
  rollForearmsToPalms: true,
  aimLegs: true,
  rollThighsFromKneesAndFeet: true,
  aimFeet: true,
  visibilityThreshold: CAMERA_LANDMARK_VISIBILITY_THRESHOLD,
  twistMinBendRadians: THREE.MathUtils.degToRad(CAMERA_TWIST_MIN_BEND_DEGREES),
  twistFullBendRadians: THREE.MathUtils.degToRad(CAMERA_TWIST_FULL_BEND_DEGREES),
  boneSmoothingMilliseconds: 0,
  ...overrides
})

/**
 * The Config panel's default smoothing, with any slider moved as given.
 * @param overrides Sliders to set differently
 * @returns The smoothing settings
 */
export const buildSmoothingSettings = (
  overrides: Partial<CameraSmoothingSettings> = {}
): CameraSmoothingSettings => ({
  smoothingMilliseconds: CAMERA_SMOOTHING_MILLISECONDS,
  maxJump: 10,
  speedResponse: CAMERA_SMOOTHING_SPEED_RESPONSE,
  turnResponse: CAMERA_SMOOTHING_TURN_RESPONSE,
  speedCutoffHertz: CAMERA_SMOOTHING_SPEED_CUTOFF_HERTZ,
  ...overrides
})

type Point = [number, number, number]

/**
 * The bundled default character's real Mixamo skeleton, rebuilt bone for bone at its rest pose:
 * real Mixamo bones carry rest rotations of their own (an arm's local axis runs along the arm,
 * not along the world), which a generated test skeleton with identity rotations never exercises.
 * @returns The rig's bones, parented under a plain root with world matrices up to date
 */
export const buildMixamoRig = (): THREE.Bone[] => {
  const bones = skeleton.bones.map(({ name, position, quaternion }) => {
    const bone = new THREE.Bone()
    bone.name = name
    bone.position.fromArray(position)
    // Rounded when captured, so renormalized: comparing two copies must read as no turn at all.
    bone.quaternion.fromArray(quaternion).normalize()
    return bone
  })
  const bonesByName = new Map(bones.map((bone) => [bone.name, bone]))
  const root = new THREE.Group()
  skeleton.bones.forEach(({ name, parent }) => {
    const bone = bonesByName.get(name)
    const parentBone = parent ? bonesByName.get(parent) : undefined
    if (bone) (parentBone ?? root).add(bone)
  })
  root.updateMatrixWorld(true)
  return bones
}

/**
 * A person facing the camera in a T-pose, in MediaPipe's world landmark convention: metres from
 * the hip centre, x toward the subject's own left, y down, z away from the camera. The nose sits
 * below the ear line by the same margin BlazePose reports for a level gaze.
 */
const STANDING_BODY: Record<number, Point> = {
  0: [0, -0.586, -0.1],
  7: [0.07, -0.62, 0],
  8: [-0.07, -0.62, 0],
  11: [0.18, -0.5, 0],
  12: [-0.18, -0.5, 0],
  13: [0.45, -0.5, 0],
  14: [-0.45, -0.5, 0],
  15: [0.7, -0.5, 0],
  16: [-0.7, -0.5, 0],
  17: [0.78, -0.5, 0.03],
  18: [-0.78, -0.5, 0.03],
  19: [0.78, -0.5, -0.03],
  20: [-0.78, -0.5, -0.03],
  23: [0.1, 0, 0],
  24: [-0.1, 0, 0],
  25: [0.1, 0.42, 0],
  26: [-0.1, 0.42, 0],
  27: [0.1, 0.84, 0],
  28: [-0.1, 0.84, 0],
  29: [0.1, 0.88, 0.05],
  30: [-0.1, 0.88, 0.05],
  31: [0.1, 0.9, -0.12],
  32: [-0.1, 0.9, -0.12]
}

/**
 * BlazePose world landmarks for the standing T-pose, with any landmarks replaced.
 * @param overrides Landmark positions to use instead, keyed by BlazePose index
 * @returns All 33 landmarks; any the pose does not place are reported invisible
 */
export const buildBodyLandmarks = (overrides: Record<number, Point> = {}): CameraLandmark[] =>
  Array.from({ length: 33 }, (_, index) => {
    const point = overrides[index] ?? STANDING_BODY[index]
    return point
      ? { x: point[0], y: point[1], z: point[2], visibility: 1 }
      : { x: 0, y: 0, z: 0, visibility: 0 }
  })

/** A left hand held out to the subject's left, palm down, fingers straight. */
const OPEN_LEFT_HAND: Point[] = [
  [0, 0, 0],
  [0.02, 0, -0.03],
  [0.045, 0, -0.045],
  [0.07, 0, -0.055],
  [0.09, 0, -0.06],
  [0.09, 0, -0.025],
  [0.13, 0, -0.025],
  [0.155, 0, -0.025],
  [0.175, 0, -0.025],
  [0.095, 0, 0],
  [0.14, 0, 0],
  [0.165, 0, 0],
  [0.185, 0, 0],
  [0.09, 0, 0.02],
  [0.13, 0, 0.02],
  [0.152, 0, 0.02],
  [0.17, 0, 0.02],
  [0.08, 0, 0.04],
  [0.11, 0, 0.04],
  [0.13, 0, 0.04],
  [0.145, 0, 0.04]
]

const offset = ([x, y, z]: Point, [dx, dy, dz]: Point): Point => [x + dx, y + dy, z + dz]

/** Fold one finger's joints down toward the palm, which faces the floor (MediaPipe's +y). */
const curlFinger = (knuckle: Point): Point[] => {
  const middleJoint = offset(knuckle, [0.03, 0.025, 0])
  const lastJoint = offset(middleJoint, [-0.01, 0.025, 0])
  return [knuckle, middleJoint, lastJoint, offset(lastJoint, [-0.02, 0.005, 0])]
}

/**
 * Hand Landmarker world landmarks for an open hand or a fist, palm down or palm up. A right hand
 * is the left one reflected, the same relation a mirror gives.
 * @param side Which hand
 * @param shape Fingers straight, or curled into a fist
 * @param palm Which way the palm faces
 * @returns The 21 landmarks
 */
export const buildHandLandmarks = (
  side: HandSide,
  shape: 'open' | 'fist',
  palm: 'down' | 'up' = 'down'
): CameraHandLandmark[] => {
  const points =
    shape === 'open'
      ? OPEN_LEFT_HAND
      : [
          ...OPEN_LEFT_HAND.slice(0, 5),
          ...[5, 9, 13, 17].flatMap((knuckle) => curlFinger(OPEN_LEFT_HAND[knuckle]))
        ]
  // Palm up is palm down turned half a turn about the fingers' own length.
  const turned = palm === 'down' ? points : points.map(([x, y, z]): Point => [x, -y, -z])
  return turned.map(([x, y, z]) => ({ x: side === 'Left' ? x : -x, y, z }))
}
