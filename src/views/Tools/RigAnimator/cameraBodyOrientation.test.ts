import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import type { QuaternionData } from '@webgamekit/rig'
import { computeBodyRotations } from './cameraBodyOrientation'
import { LANDMARK_INDEX, type CameraLandmark } from './cameraPoseMapping'

type BodyPoint =
  | 'leftShoulder'
  | 'rightShoulder'
  | 'leftHip'
  | 'rightHip'
  | 'leftEar'
  | 'rightEar'
  | 'leftEye'
  | 'rightEye'
type PointTuple = [number, number, number]
type BodyPoints = Partial<Record<BodyPoint, PointTuple>>

const X_AXIS = new THREE.Vector3(1, 0, 0)
const Y_AXIS = new THREE.Vector3(0, 1, 0)
const Z_AXIS = new THREE.Vector3(0, 0, 1)

/** An upright torso square-on to the camera, in scene space (x right, y up, z toward the camera)
 * and MediaPipe's real convention of the subject's left side at the larger x. */
const TORSO_POINTS: BodyPoints = {
  leftShoulder: [0.2, 0, 0],
  rightShoulder: [-0.2, 0, 0],
  leftHip: [0.1, -0.5, 0],
  rightHip: [-0.1, -0.5, 0]
}

/** A head facing the camera, eyes level with the ears. */
const HEAD_POINTS: BodyPoints = {
  leftEar: [0.08, 0.25, 0],
  rightEar: [-0.08, 0.25, 0],
  leftEye: [0.03, 0.25, 0.08],
  rightEye: [-0.03, 0.25, 0.08]
}

interface BodyPlacement {
  torso?: THREE.Quaternion
  head?: THREE.Quaternion
  hidden?: BodyPoint[]
}

/** World landmarks for a body whose torso and head are turned by the given world rotations; the
 * head follows the torso unless given its own. */
const bodyLandmarks = ({
  torso = new THREE.Quaternion(),
  head = torso,
  hidden = []
}: BodyPlacement = {}): CameraLandmark[] => {
  const place = (points: BodyPoints, turn: THREE.Quaternion): [number, CameraLandmark][] =>
    (Object.entries(points) as [BodyPoint, PointTuple][]).map(([name, point]) => {
      const scene = new THREE.Vector3(...point).applyQuaternion(turn)
      return [
        LANDMARK_INDEX[name],
        { x: scene.x, y: -scene.y, z: -scene.z, visibility: hidden.includes(name) ? 0 : 1 }
      ]
    })
  const placed = new Map([...place(TORSO_POINTS, torso), ...place(HEAD_POINTS, head)])
  return Array.from(
    { length: 33 },
    (_, index) => placed.get(index) ?? { x: 0, y: 0, z: 0, visibility: 0 }
  )
}

const rotation = (axis: THREE.Vector3, angle: number): THREE.Quaternion =>
  new THREE.Quaternion().setFromAxisAngle(axis, angle)

const toData = ({ x, y, z, w }: THREE.Quaternion): QuaternionData => ({ x, y, z, w })

describe('computeBodyRotations, torso', () => {
  it.each([
    ['a twist', Y_AXIS, 0.5],
    ['a lean toward the camera', X_AXIS, 0.4],
    ['a side bend', Z_AXIS, 0.3]
  ])('reads %s against upright and square-on while uncalibrated', (_, axis, angle) => {
    const torso = rotation(axis, angle)

    const rotations = computeBodyRotations(bodyLandmarks({ torso }), null)

    expect(rotations.torso?.angleTo(torso)).toBeCloseTo(0)
  })

  it('reads only the twist while the hips are out of frame', () => {
    const twist = rotation(Y_AXIS, 0.5)
    const torso = twist.clone().multiply(rotation(X_AXIS, 0.4))

    const rotations = computeBodyRotations(
      bodyLandmarks({ torso, hidden: ['leftHip', 'rightHip'] }),
      null
    )

    expect(rotations.torso?.angleTo(twist)).toBeCloseTo(0)
  })

  it('reads nothing without both shoulders detected', () => {
    const rotations = computeBodyRotations(bodyLandmarks({ hidden: ['rightShoulder'] }), null)

    expect(rotations).toEqual({ torso: null, neck: null })
  })
})

describe('computeBodyRotations, neck', () => {
  it.each([
    ['a head turn', Y_AXIS, 0.6],
    ['a nod', X_AXIS, 0.4],
    ['a tilt', Z_AXIS, 0.3]
  ])('reads %s relative to a twisted torso', (_, axis, angle) => {
    const torso = rotation(Y_AXIS, 0.35)
    const neck = rotation(axis, angle)

    const rotations = computeBodyRotations(
      bodyLandmarks({ torso, head: torso.clone().multiply(neck) }),
      null
    )

    expect(rotations.neck?.angleTo(neck)).toBeCloseTo(0)
  })

  it.each([
    ['an ear', 'leftEar'],
    ['an eye', 'rightEye']
  ] as const)('reads no neck rotation without %s detected', (_, hiddenPoint) => {
    const rotations = computeBodyRotations(bodyLandmarks({ hidden: [hiddenPoint] }), null)

    expect(rotations.neck).toBeNull()
  })
})

describe('computeBodyRotations, calibrated', () => {
  it('reads torso and neck in the calibrated body own frame, even calibrated turned away', () => {
    const calibratedTurn = rotation(Y_AXIS, 0.6)
    const baselines = {
      torsoOrientation: toData(calibratedTurn),
      headOrientation: toData(calibratedTurn)
    }
    const lean = rotation(X_AXIS, 0.4)
    const nod = rotation(X_AXIS, 0.3)
    const torso = calibratedTurn.clone().multiply(lean)

    const rotations = computeBodyRotations(
      bodyLandmarks({ torso, head: torso.clone().multiply(nod) }),
      baselines
    )

    expect(rotations.torso?.angleTo(lean)).toBeCloseTo(0)
    expect(rotations.neck?.angleTo(nod)).toBeCloseTo(0)
  })

  it('measures the neck against the torso when the T-pose recorded no head', () => {
    const baselines = { torsoOrientation: toData(new THREE.Quaternion()), headOrientation: null }
    const nod = rotation(X_AXIS, 0.3)

    const rotations = computeBodyRotations(bodyLandmarks({ head: nod }), baselines)

    expect(rotations.neck?.angleTo(nod)).toBeCloseTo(0)
  })
})
