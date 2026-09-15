import * as THREE from 'three'
import type { QuaternionData } from '@webgamekit/rig'
import {
  CAMERA_LANDMARK_VISIBILITY_THRESHOLD,
  LANDMARK_INDEX,
  type CameraLandmark
} from './cameraPoseMapping'
import type { BodyRotations, OrientationBaselines } from './types'

/** Below this, a direction is too short to normalize. */
const MINIMUM_LENGTH = 1e-6
const WORLD_UP = new THREE.Vector3(0, 1, 0)

/** A detected landmark through the same flips the limb mapping applies (scene y grows up and z
 * toward the camera), so a rotation read here turns the rig the way the mapped hands already land. */
const scenePoint = (landmarks: CameraLandmark[], index: number): THREE.Vector3 | null => {
  const landmark = landmarks[index]
  return landmark !== undefined && landmark.visibility >= CAMERA_LANDMARK_VISIBILITY_THRESHOLD
    ? new THREE.Vector3(landmark.x, -landmark.y, -landmark.z)
    : null
}

const midpoint = (a: THREE.Vector3, b: THREE.Vector3): THREE.Vector3 =>
  new THREE.Vector3().addVectors(a, b).divideScalar(2)

const unitOrNull = (direction: THREE.Vector3): THREE.Vector3 | null =>
  direction.length() < MINIMUM_LENGTH ? null : direction.clone().normalize()

/** `direction` with its part along the unit `axis` removed, normalized. */
const perpendicularUnit = (direction: THREE.Vector3, axis: THREE.Vector3): THREE.Vector3 | null =>
  unitOrNull(direction.clone().addScaledVector(axis, -direction.dot(axis)))

const rotationFromBasis = (
  x: THREE.Vector3,
  y: THREE.Vector3,
  z: THREE.Vector3
): THREE.Quaternion =>
  new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z))

const fromQuaternionData = ({ x, y, z, w }: QuaternionData): THREE.Quaternion =>
  new THREE.Quaternion(x, y, z, w)

/**
 * The torso's orientation in scene space: identity for upright and square-on, in MediaPipe's
 * convention of the subject's left side at the larger x. Up runs from the hip midpoint to the
 * shoulder midpoint, across along the shoulder line. Without both hips there is nothing to lean or
 * bend against, so up is taken as world up and only the twist is read.
 * @param landmarks World landmarks, mirrored for a live camera
 * @returns The orientation, or null without both shoulders
 */
export const measureTorsoOrientation = (landmarks: CameraLandmark[]): THREE.Quaternion | null => {
  const leftShoulder = scenePoint(landmarks, LANDMARK_INDEX.leftShoulder)
  const rightShoulder = scenePoint(landmarks, LANDMARK_INDEX.rightShoulder)
  if (!leftShoulder || !rightShoulder) return null
  const leftHip = scenePoint(landmarks, LANDMARK_INDEX.leftHip)
  const rightHip = scenePoint(landmarks, LANDMARK_INDEX.rightHip)
  const up =
    leftHip && rightHip
      ? unitOrNull(midpoint(leftShoulder, rightShoulder).sub(midpoint(leftHip, rightHip)))
      : WORLD_UP
  const across = up && perpendicularUnit(leftShoulder.clone().sub(rightShoulder), up)
  return up && across
    ? rotationFromBasis(across, up, new THREE.Vector3().crossVectors(across, up))
    : null
}

/**
 * The head's orientation in scene space, identity when facing the camera level. Across runs along
 * the ear line, forward from the ear midpoint toward the eye midpoint: the eyes sit level with the
 * ears on a head held straight, where the nose sits lower and would read as a constant nod.
 * @param landmarks World landmarks, mirrored for a live camera
 * @returns The orientation, or null without both ears and both eyes
 */
export const measureHeadOrientation = (landmarks: CameraLandmark[]): THREE.Quaternion | null => {
  const leftEar = scenePoint(landmarks, LANDMARK_INDEX.leftEar)
  const rightEar = scenePoint(landmarks, LANDMARK_INDEX.rightEar)
  const leftEye = scenePoint(landmarks, LANDMARK_INDEX.leftEye)
  const rightEye = scenePoint(landmarks, LANDMARK_INDEX.rightEye)
  if (!leftEar || !rightEar || !leftEye || !rightEye) return null
  const across = unitOrNull(leftEar.clone().sub(rightEar))
  const forward =
    across &&
    perpendicularUnit(midpoint(leftEye, rightEye).sub(midpoint(leftEar, rightEar)), across)
  return across && forward
    ? rotationFromBasis(across, new THREE.Vector3().crossVectors(forward, across), forward)
    : null
}

/** How the head sits on the torso, in the torso's own frame. */
const headOnTorso = (torso: THREE.Quaternion, head: THREE.Quaternion): THREE.Quaternion =>
  torso.clone().invert().multiply(head)

/**
 * The torso's rotation and the neck's, both in the body's own frame rather than the camera's, so
 * a lean still reads as a lean when the person calibrated standing at an angle to the camera.
 * @param landmarks World landmarks, mirrored for a live camera
 * @param baselines The front T-pose's orientations, or null to read against upright and square-on
 * @returns The torso rotation and the head's rotation on the torso, each null when not detected
 */
export const computeBodyRotations = (
  landmarks: CameraLandmark[],
  baselines: OrientationBaselines | null
): BodyRotations => {
  const torso = measureTorsoOrientation(landmarks)
  if (!torso) return { torso: null, neck: null }
  const head = measureHeadOrientation(landmarks)
  const torsoBaseline = baselines
    ? fromQuaternionData(baselines.torsoOrientation)
    : new THREE.Quaternion()
  // A T-pose that missed the head counts it as having sat square on the torso.
  const headBaseline = baselines?.headOrientation
    ? fromQuaternionData(baselines.headOrientation)
    : torsoBaseline
  return {
    torso: torsoBaseline.clone().invert().multiply(torso),
    neck: head
      ? headOnTorso(torsoBaseline, headBaseline).invert().multiply(headOnTorso(torso, head))
      : null
  }
}
