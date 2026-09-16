import * as THREE from 'three'
import type { HandSide } from '@webgamekit/rig'
import {
  CAMERA_HEAD_PITCH_OFFSET_RADIANS,
  CAMERA_NECK_TURN_SHARE,
  CAMERA_PELVIS_LEAN_SHARE,
  CAMERA_TWIST_FULL_BEND_RADIANS,
  CAMERA_TWIST_MIN_BEND_RADIANS
} from './config'
import { CAMERA_LANDMARK_INDEX, CAMERA_LANDMARK_VISIBILITY_THRESHOLD } from './cameraPoseMapping'
import type {
  CameraHandLandmark,
  CameraLandmark,
  CameraPoseFrame,
  CameraPoseMappingOptions,
  CameraRetargetRest
} from './types'

const HIPS = 'mixamorigHips'
const NECK = 'mixamorigNeck'
const HEAD = 'mixamorigHead'
const RIG_SIDES: HandSide[] = ['Left', 'Right']
const DIRECTION_EPSILON = 1e-10
const WORLD_UP = new THREE.Vector3(0, 1, 0)
/** The Face Landmarker's identity pose looks along +z with the subject's left along +x. */
const CANONICAL_FACE_FORWARD = new THREE.Vector3(0, 0, 1)
const CANONICAL_FACE_LATERAL = new THREE.Vector3(1, 0, 0)

/** Every bone the body mapping cannot work without; spine, neck, fingers and toes are used when present. */
export const CAMERA_POSE_REQUIRED_BONES = [
  HIPS,
  'mixamorigLeftArm',
  'mixamorigRightArm',
  'mixamorigLeftForeArm',
  'mixamorigRightForeArm'
]

const ARM_LANDMARKS: Record<
  HandSide,
  { shoulder: number; elbow: number; wrist: number; pinky: number; index: number }
> = {
  Left: {
    shoulder: CAMERA_LANDMARK_INDEX.leftShoulder,
    elbow: CAMERA_LANDMARK_INDEX.leftElbow,
    wrist: CAMERA_LANDMARK_INDEX.leftWrist,
    pinky: CAMERA_LANDMARK_INDEX.leftPinky,
    index: CAMERA_LANDMARK_INDEX.leftIndex
  },
  Right: {
    shoulder: CAMERA_LANDMARK_INDEX.rightShoulder,
    elbow: CAMERA_LANDMARK_INDEX.rightElbow,
    wrist: CAMERA_LANDMARK_INDEX.rightWrist,
    pinky: CAMERA_LANDMARK_INDEX.rightPinky,
    index: CAMERA_LANDMARK_INDEX.rightIndex
  }
}

const LEG_LANDMARKS: Record<
  HandSide,
  { hip: number; knee: number; ankle: number; heel: number; toe: number }
> = {
  Left: {
    hip: CAMERA_LANDMARK_INDEX.leftHip,
    knee: CAMERA_LANDMARK_INDEX.leftKnee,
    ankle: CAMERA_LANDMARK_INDEX.leftAnkle,
    heel: CAMERA_LANDMARK_INDEX.leftHeel,
    toe: CAMERA_LANDMARK_INDEX.leftFootIndex
  },
  Right: {
    hip: CAMERA_LANDMARK_INDEX.rightHip,
    knee: CAMERA_LANDMARK_INDEX.rightKnee,
    ankle: CAMERA_LANDMARK_INDEX.rightAnkle,
    heel: CAMERA_LANDMARK_INDEX.rightHeel,
    toe: CAMERA_LANDMARK_INDEX.rightFootIndex
  }
}

/** Each finger's four hand landmarks from its first joint to its tip, the rig's joints 1 to 4. */
const FINGER_LANDMARKS: readonly (readonly [string, readonly number[]])[] = [
  ['Thumb', [1, 2, 3, 4]],
  ['Index', [5, 6, 7, 8]],
  ['Middle', [9, 10, 11, 12]],
  ['Ring', [13, 14, 15, 16]],
  ['Pinky', [17, 18, 19, 20]]
]
const FINGER_JOINTS = [1, 2, 3]
const HAND_WRIST = 0
const HAND_INDEX_KNUCKLE = 5
const HAND_MIDDLE_KNUCKLE = 9
const HAND_PINKY_KNUCKLE = 17
const FOOT_BONE_NAMES = [
  'mixamorigLeftToeBase',
  'mixamorigRightToeBase',
  'mixamorigLeftFoot',
  'mixamorigRightFoot'
]

interface RetargetContext {
  bonesByName: Map<string, THREE.Bone>
  rest: CameraRetargetRest
  drivenBoneNames: Set<string>
  /** The rig's own left, and the way it faces, at rest. */
  restLateral: THREE.Vector3
  restForward: THREE.Vector3
}

/** Two directions that fix an orientation: one a segment runs along, one it leans toward. */
interface SegmentFrame {
  primary: THREE.Vector3
  lateral: THREE.Vector3
}

/** How far to roll a bone about its own length: until `rest`, carried along, meets `observed`. */
interface TwistCue {
  observed: THREE.Vector3
  rest: THREE.Vector3
  weight: number
}

interface TorsoRotations {
  pelvis: THREE.Quaternion
  chest: THREE.Quaternion
}

type BodyPointReader = (index: number) => THREE.Vector3 | null

const sideBone = (side: HandSide, part: string): string => `mixamorig${side}${part}`

/**
 * Snapshot every bone's world rotation and position in the rig's rest pose. Every rotation the
 * mapping applies is a change from this pose, so it has to be read while the rig still stands in
 * it rather than off whatever a previous frame left behind.
 * @param bones The rig's bones, at rest
 * @returns The rest pose in world space, keyed by bone name
 */
export const captureCameraRetargetRest = (bones: THREE.Bone[]): CameraRetargetRest => ({
  worldQuaternions: new Map(
    bones.map((bone) => [bone.name, bone.getWorldQuaternion(new THREE.Quaternion())])
  ),
  worldPositions: new Map(
    bones.map((bone) => [bone.name, bone.getWorldPosition(new THREE.Vector3())])
  )
})

/**
 * Which bones a frame drives, within `boneNamesInScope`. A frame with a body drives the whole
 * scope. One without, a hand or a face filmed on its own, drives only the fingers of the hand(s)
 * found and the neck and head: resetting the rest of the body on every such frame would snap a
 * pose the camera simply is not showing right now back to rest.
 * @param frame What the camera found this frame
 * @param boneNamesInScope The bones the Merge Target selection allows touching
 * @returns The bones to reset and drive this frame
 */
export const cameraFrameDrivenBoneNames = (
  frame: CameraPoseFrame,
  boneNamesInScope: Set<string>
): Set<string> => {
  if (frame.bodyLandmarks) return boneNamesInScope
  const handNames = RIG_SIDES.filter((side) => frame.handLandmarks[side]).map((side) =>
    sideBone(side, 'Hand')
  )
  const isFinger = (name: string): boolean =>
    handNames.some((handName) => name.startsWith(handName) && name !== handName)
  const isHead = (name: string): boolean =>
    frame.headRotation !== null && (name === NECK || name === HEAD)
  return new Set([...boneNamesInScope].filter((name) => isFinger(name) || isHead(name)))
}

/** MediaPipe's y grows downward and z away from the camera; the scene's y grows up and z toward the viewer. */
const landmarkToScene = (landmark: CameraHandLandmark, includeDepth = true): THREE.Vector3 =>
  new THREE.Vector3(landmark.x, -landmark.y, includeDepth ? -landmark.z : 0)

const readBodyPoints =
  (landmarks: CameraLandmark[] | null, includeDepth: boolean): BodyPointReader =>
  (index) => {
    const landmark = landmarks?.[index]
    return landmark && landmark.visibility >= CAMERA_LANDMARK_VISIBILITY_THRESHOLD
      ? landmarkToScene(landmark, includeDepth)
      : null
  }

const midpoint = (a: THREE.Vector3, b: THREE.Vector3): THREE.Vector3 =>
  a.clone().add(b).multiplyScalar(0.5)

const rejectFromAxis = (vector: THREE.Vector3, unitAxis: THREE.Vector3): THREE.Vector3 =>
  vector.clone().sub(unitAxis.clone().multiplyScalar(vector.dot(unitAxis)))

const restDirection = (
  rest: CameraRetargetRest,
  fromBoneName: string,
  toBoneName: string
): THREE.Vector3 | null => {
  const from = rest.worldPositions.get(fromBoneName)
  const to = rest.worldPositions.get(toBoneName)
  const direction = from && to ? to.clone().sub(from) : null
  return direction && direction.lengthSq() > DIRECTION_EPSILON ? direction.normalize() : null
}

/** The rotation whose y axis runs along `primary` and whose x axis leans toward `lateral`. */
const frameRotation = (frame: SegmentFrame): THREE.Quaternion | null => {
  const axisY = frame.primary.clone().normalize()
  const axisZ = new THREE.Vector3().crossVectors(frame.lateral.clone().normalize(), axisY)
  if (axisY.lengthSq() < DIRECTION_EPSILON || axisZ.lengthSq() < 1e-6) return null
  axisZ.normalize()
  const axisX = new THREE.Vector3().crossVectors(axisY, axisZ)
  return new THREE.Quaternion().setFromRotationMatrix(
    new THREE.Matrix4().makeBasis(axisX, axisY, axisZ)
  )
}

/** The world rotation carrying a rest frame onto an observed one, both built from matching directions. */
const frameChange = (observed: SegmentFrame, rest: SegmentFrame): THREE.Quaternion | null => {
  const observedRotation = frameRotation(observed)
  const restRotation = frameRotation(rest)
  return observedRotation && restRotation ? observedRotation.multiply(restRotation.invert()) : null
}

const setBoneWorldQuaternion = (bone: THREE.Bone, worldQuaternion: THREE.Quaternion): void => {
  const parentWorldQuaternion =
    bone.parent?.getWorldQuaternion(new THREE.Quaternion()) ?? new THREE.Quaternion()
  bone.quaternion.copy(parentWorldQuaternion.invert().multiply(worldQuaternion))
}

const drivenBone = (
  context: RetargetContext,
  boneName: string
): { bone: THREE.Bone; restQuaternion: THREE.Quaternion } | null => {
  const bone = context.bonesByName.get(boneName)
  const restQuaternion = context.rest.worldQuaternions.get(boneName)
  return bone && restQuaternion && context.drivenBoneNames.has(boneName)
    ? { bone, restQuaternion }
    : null
}

/** Turn a bone away from its own rest orientation by a world-space `change`. */
const rotateFromRest = (
  context: RetargetContext,
  boneName: string,
  change: THREE.Quaternion
): void => {
  const driven = drivenBone(context, boneName)
  if (driven) setBoneWorldQuaternion(driven.bone, change.clone().multiply(driven.restQuaternion))
}

/** Roll a world-space change about `unitAxis` until the twist cue's rest direction meets the observed one. */
const rollToward = (
  change: THREE.Quaternion,
  unitAxis: THREE.Vector3,
  twist: TwistCue
): THREE.Quaternion => {
  const carried = rejectFromAxis(twist.rest.clone().applyQuaternion(change), unitAxis)
  const observed = rejectFromAxis(twist.observed, unitAxis)
  if (carried.lengthSq() < DIRECTION_EPSILON || observed.lengthSq() < DIRECTION_EPSILON) {
    return change
  }
  const angle = Math.atan2(
    new THREE.Vector3().crossVectors(carried, observed).dot(unitAxis),
    carried.dot(observed)
  )
  return new THREE.Quaternion().setFromAxisAngle(unitAxis, angle * twist.weight).multiply(change)
}

/**
 * Swing a bone so the segment to its next joint points along `observedDirection`, starting from
 * wherever its already-posed parent carried it, then optionally roll it about that segment. The
 * swing is the smallest rotation that works, so a bone keeps whatever roll its parent gave it
 * unless a twist cue says otherwise; nothing here moves a joint, so a segment never stretches.
 * @returns Whether the bone was driven
 */
const aimBone = (
  context: RetargetContext,
  boneName: string,
  nextBoneName: string,
  observedDirection: THREE.Vector3,
  twist?: TwistCue
): boolean => {
  const driven = drivenBone(context, boneName)
  // A skin only lists bones that deform something, so a fingertip or toe-tip end bone is often
  // missing; the last joint then aims along the segment leading into it instead.
  const restAim =
    restDirection(context.rest, boneName, nextBoneName) ??
    restDirection(context.rest, driven?.bone.parent?.name ?? '', boneName)
  if (!driven || !restAim || observedDirection.lengthSq() < DIRECTION_EPSILON) return false
  const target = observedDirection.clone().normalize()
  const restToCurrent = driven.bone
    .getWorldQuaternion(new THREE.Quaternion())
    .multiply(driven.restQuaternion.clone().invert())
  const swung = new THREE.Quaternion()
    .setFromUnitVectors(restAim.applyQuaternion(restToCurrent), target)
    .multiply(restToCurrent)
  const turned = twist ? rollToward(swung, target, twist) : swung
  setBoneWorldQuaternion(driven.bone, turned.multiply(driven.restQuaternion))
  return true
}

/** How far a limb's bend can be trusted to show its roll: not at all when straight, fully once clearly bent. */
const bendTwistWeight = (upper: THREE.Vector3, lower: THREE.Vector3): number =>
  THREE.MathUtils.clamp(
    (upper.angleTo(lower) - CAMERA_TWIST_MIN_BEND_RADIANS) /
      (CAMERA_TWIST_FULL_BEND_RADIANS - CAMERA_TWIST_MIN_BEND_RADIANS),
    0,
    1
  )

const observeHips = (context: RetargetContext, point: BodyPointReader) => {
  const leftHip = point(CAMERA_LANDMARK_INDEX.leftHip)
  const rightHip = point(CAMERA_LANDMARK_INDEX.rightHip)
  const restLeftHip = context.rest.worldPositions.get('mixamorigLeftUpLeg')
  const restRightHip = context.rest.worldPositions.get('mixamorigRightUpLeg')
  if (!leftHip || !rightHip || !restLeftHip || !restRightHip) return null
  return {
    center: midpoint(leftHip, rightHip),
    lateral: leftHip.clone().sub(rightHip),
    restCenter: midpoint(restLeftHip, restRightHip),
    restLateral: restLeftHip.clone().sub(restRightHip)
  }
}

/**
 * How the pelvis and the chest are turned. The chest faces square to the shoulder line and leans
 * along the spine from hip centre to shoulder centre. The pelvis faces square to the hip line but
 * takes only part of that lean, the way a real pelvis tips a little and the back bends the rest.
 * With the hips out of frame, a webcam framed on the upper body, the pelvis stays put and the
 * chest turns about the vertical alone.
 */
const observeTorso = (context: RetargetContext, point: BodyPointReader): TorsoRotations | null => {
  const leftShoulder = point(CAMERA_LANDMARK_INDEX.leftShoulder)
  const rightShoulder = point(CAMERA_LANDMARK_INDEX.rightShoulder)
  const restLeftArm = context.rest.worldPositions.get('mixamorigLeftArm')
  const restRightArm = context.rest.worldPositions.get('mixamorigRightArm')
  if (!leftShoulder || !rightShoulder || !restLeftArm || !restRightArm) return null
  const shoulderLateral = leftShoulder.clone().sub(rightShoulder)
  const restShoulderLateral = restLeftArm.clone().sub(restRightArm)
  const hips = observeHips(context, point)
  if (!hips) {
    const chest = frameChange(
      { primary: WORLD_UP, lateral: shoulderLateral },
      { primary: WORLD_UP, lateral: restShoulderLateral }
    )
    return chest ? { pelvis: new THREE.Quaternion(), chest } : null
  }
  const torsoUp = midpoint(leftShoulder, rightShoulder).sub(hips.center)
  const restTorsoUp = midpoint(restLeftArm, restRightArm).sub(hips.restCenter)
  const pelvisUp = WORLD_UP.clone().lerp(torsoUp.clone().normalize(), CAMERA_PELVIS_LEAN_SHARE)
  const chest = frameChange(
    { primary: torsoUp, lateral: shoulderLateral },
    { primary: restTorsoUp, lateral: restShoulderLateral }
  )
  const pelvis = frameChange(
    { primary: pelvisUp, lateral: hips.lateral },
    { primary: restTorsoUp, lateral: hips.restLateral }
  )
  return chest && pelvis ? { pelvis, chest } : null
}

/** Every bone strictly between the hips and the neck, lowest first. */
const spineBoneNames = (context: RetargetContext): string[] => {
  const top = (context.bonesByName.get(NECK) ?? context.bonesByName.get('mixamorigLeftShoulder'))
    ?.parent
  const collect = (node: THREE.Object3D | null | undefined): string[] =>
    node instanceof THREE.Bone && node.name !== HIPS ? [...collect(node.parent), node.name] : []
  return collect(top)
}

/** Turn the pelvis, then spread the rest of the way to the chest evenly up the spine, so a back bends rather than hinging at one joint. */
const applyTorso = (context: RetargetContext, torso: TorsoRotations): void => {
  rotateFromRest(context, HIPS, torso.pelvis)
  const spineNames = spineBoneNames(context)
  const bend = torso.chest.clone().multiply(torso.pelvis.clone().invert())
  spineNames.forEach((boneName, index) => {
    const share = (index + 1) / spineNames.length
    rotateFromRest(
      context,
      boneName,
      new THREE.Quaternion().slerp(bend, share).multiply(torso.pelvis)
    )
  })
}

/**
 * How the head is turned: straight from the Face Landmarker when it found the face, otherwise
 * from the ears and nose. BlazePose places the nose below the ear line, so that reading is tipped
 * back up by the offset measured between the two on the same clip.
 */
const observeHead = (
  context: RetargetContext,
  frame: CameraPoseFrame,
  point: BodyPointReader
): THREE.Quaternion | null => {
  const restFacing = { primary: context.restForward, lateral: context.restLateral }
  if (frame.headRotation) {
    const { x, y, z, w } = frame.headRotation
    const canonicalToRest = frameChange(restFacing, {
      primary: CANONICAL_FACE_FORWARD,
      lateral: CANONICAL_FACE_LATERAL
    })
    return canonicalToRest
      ? new THREE.Quaternion(x, y, z, w).multiply(canonicalToRest.invert())
      : null
  }
  const leftEar = point(CAMERA_LANDMARK_INDEX.leftEar)
  const rightEar = point(CAMERA_LANDMARK_INDEX.rightEar)
  const nose = point(CAMERA_LANDMARK_INDEX.nose)
  if (!leftEar || !rightEar || !nose) return null
  const lateral = leftEar.clone().sub(rightEar).normalize()
  const forward = rejectFromAxis(nose.clone().sub(midpoint(leftEar, rightEar)), lateral)
    .normalize()
    .applyAxisAngle(lateral, -CAMERA_HEAD_PITCH_OFFSET_RADIANS)
  return frameChange({ primary: forward, lateral }, restFacing)
}

/** Split the head's turn away from the chest between the neck and the head. */
const applyHead = (
  context: RetargetContext,
  head: THREE.Quaternion,
  chest: THREE.Quaternion
): void => {
  const turn = head.clone().multiply(chest.clone().invert())
  rotateFromRest(
    context,
    NECK,
    new THREE.Quaternion().slerp(turn, CAMERA_NECK_TURN_SHARE).multiply(chest)
  )
  rotateFromRest(context, HEAD, head)
}

const handFrameFromLandmarks = (landmarks: CameraHandLandmark[]): SegmentFrame => {
  const point = (index: number): THREE.Vector3 => landmarkToScene(landmarks[index])
  return {
    primary: point(HAND_MIDDLE_KNUCKLE).sub(point(HAND_WRIST)),
    lateral: point(HAND_INDEX_KNUCKLE).sub(point(HAND_PINKY_KNUCKLE))
  }
}

const handFrameFromBody = (
  point: BodyPointReader,
  indices: (typeof ARM_LANDMARKS)[HandSide]
): SegmentFrame | null => {
  const wrist = point(indices.wrist)
  const pinky = point(indices.pinky)
  const index = point(indices.index)
  return wrist && pinky && index
    ? { primary: midpoint(pinky, index).sub(wrist), lateral: index.clone().sub(pinky) }
    : null
}

const restHandFrame = (rest: CameraRetargetRest, side: HandSide): SegmentFrame | null => {
  const primary = restDirection(rest, sideBone(side, 'Hand'), sideBone(side, 'HandMiddle1'))
  const lateral = restDirection(rest, sideBone(side, 'HandPinky1'), sideBone(side, 'HandIndex1'))
  return primary && lateral ? { primary, lateral } : null
}

/**
 * Aim the upper arm at the elbow and the forearm at the wrist, then turn the hand to the detected
 * palm. The upper arm's roll comes from which way the forearm swings off it, since an elbow only
 * bends one way; the forearm's roll comes from the palm, the only thing that shows it.
 */
const applyArm = (
  context: RetargetContext,
  side: HandSide,
  point: BodyPointReader,
  handLandmarks: CameraHandLandmark[] | undefined
): void => {
  const indices = ARM_LANDMARKS[side]
  const shoulder = point(indices.shoulder)
  const elbow = point(indices.elbow)
  const wrist = point(indices.wrist)
  if (!shoulder || !elbow) return
  const upper = elbow.clone().sub(shoulder)
  // A wrist that drops out of view, the dancer's own arm crossing behind her in the attached
  // clip, still leaves the upper arm to follow; only the forearm and hand wait for it.
  const lower = wrist?.clone().sub(elbow)
  const elbowTwist = lower && {
    observed: rejectFromAxis(lower, upper.clone().normalize()),
    rest: context.restForward,
    weight: bendTwistWeight(upper, lower)
  }
  aimBone(context, sideBone(side, 'Arm'), sideBone(side, 'ForeArm'), upper, elbowTwist)
  if (!lower) return
  const observedHand = handLandmarks
    ? handFrameFromLandmarks(handLandmarks)
    : handFrameFromBody(point, indices)
  const restHand = restHandFrame(context.rest, side)
  const forearmTwist =
    observedHand && restHand
      ? { observed: observedHand.lateral, rest: restHand.lateral, weight: 1 }
      : undefined
  const forearmDriven = aimBone(
    context,
    sideBone(side, 'ForeArm'),
    sideBone(side, 'Hand'),
    lower,
    forearmTwist
  )
  const handChange =
    forearmDriven && observedHand && restHand ? frameChange(observedHand, restHand) : null
  if (handChange) rotateFromRest(context, sideBone(side, 'Hand'), handChange)
}

/**
 * Bend every finger joint to point where the detected one does. Directions are read relative to
 * the detected palm and re-expressed relative to wherever the rig's own hand is right now, so a
 * hand filmed on its own, with no arm in view to place it, still curls and spreads its fingers
 * correctly on a rig whose arm stays at rest.
 */
const applyFingers = (
  context: RetargetContext,
  side: HandSide,
  landmarks: CameraHandLandmark[]
): void => {
  const handName = sideBone(side, 'Hand')
  const hand = context.bonesByName.get(handName)
  const handRest = context.rest.worldQuaternions.get(handName)
  const restHand = restHandFrame(context.rest, side)
  const observedChange = restHand ? frameChange(handFrameFromLandmarks(landmarks), restHand) : null
  if (!hand || !handRest || !observedChange) return
  const observedToRig = hand
    .getWorldQuaternion(new THREE.Quaternion())
    .multiply(handRest.clone().invert())
    .multiply(observedChange.invert())
  FINGER_LANDMARKS.forEach(([finger, indices]) =>
    FINGER_JOINTS.forEach((joint) => {
      const direction = landmarkToScene(landmarks[indices[joint]])
        .sub(landmarkToScene(landmarks[indices[joint - 1]]))
        .applyQuaternion(observedToRig)
      aimBone(
        context,
        `${handName}${finger}${joint}`,
        `${handName}${finger}${joint + 1}`,
        direction
      )
    })
  )
}

/**
 * Which way the thigh is rolled: a bent knee points the opposite way from the shin's swing, while
 * a straight leg shows it only through where the foot points. Blending the two by how bent the
 * knee is keeps the roll from snapping as the leg straightens.
 */
const legTwistCue = (
  context: RetargetContext,
  thigh: THREE.Vector3,
  shin: THREE.Vector3 | undefined,
  footForward: THREE.Vector3 | null
): TwistCue | undefined => {
  const thighAxis = thigh.clone().normalize()
  const kneeForward = shin ? rejectFromAxis(shin, thighAxis).negate().normalize() : null
  const bendWeight = shin ? bendTwistWeight(thigh, shin) : 0
  const footDirection = footForward ? rejectFromAxis(footForward, thighAxis).normalize() : null
  if (!footDirection) {
    return kneeForward
      ? { observed: kneeForward, rest: context.restForward, weight: bendWeight }
      : undefined
  }
  const kneeShare = kneeForward ? kneeForward.multiplyScalar(bendWeight) : new THREE.Vector3()
  return {
    observed: kneeShare.add(footDirection.multiplyScalar(1 - bendWeight)),
    rest: context.restForward,
    weight: 1
  }
}

/** Aim the thigh at the knee, the shin at the ankle and the foot at the toes, as far as each is in view. */
const applyLeg = (context: RetargetContext, side: HandSide, point: BodyPointReader): boolean => {
  const indices = LEG_LANDMARKS[side]
  const hip = point(indices.hip)
  const knee = point(indices.knee)
  if (!hip || !knee) return false
  const ankle = point(indices.ankle)
  const heel = point(indices.heel)
  const toe = point(indices.toe)
  const thigh = knee.clone().sub(hip)
  const shin = ankle?.clone().sub(knee)
  const footForward = ankle && heel && toe ? toe.clone().sub(heel) : null
  const thighDriven = aimBone(
    context,
    sideBone(side, 'UpLeg'),
    sideBone(side, 'Leg'),
    thigh,
    legTwistCue(context, thigh, shin, footForward)
  )
  if (!ankle || !shin) return thighDriven
  aimBone(context, sideBone(side, 'Leg'), sideBone(side, 'Foot'), shin)
  if (toe) aimBone(context, sideBone(side, 'Foot'), sideBone(side, 'ToeBase'), toe.sub(ankle))
  return thighDriven
}

/**
 * Lift or lower the whole rig so its lowest foot sits where it does at rest. World landmarks are
 * centred on the hips, so nothing in them says how high the body is: without this a crouch folds
 * the legs up off the floor instead of bringing the hips down.
 */
const groundFeet = (context: RetargetContext): void => {
  const hips = drivenBone(context, HIPS)
  const footBones = FOOT_BONE_NAMES.flatMap((name) => {
    const bone = context.bonesByName.get(name)
    const restPosition = context.rest.worldPositions.get(name)
    return bone && restPosition ? [{ bone, restPosition }] : []
  })
  if (!hips || footBones.length === 0) return
  const lowestAtRest = Math.min(...footBones.map(({ restPosition }) => restPosition.y))
  const lowestNow = Math.min(
    ...footBones.map(({ bone }) => bone.getWorldPosition(new THREE.Vector3()).y)
  )
  const groundedWorldPosition = hips.bone
    .getWorldPosition(new THREE.Vector3())
    .add(new THREE.Vector3(0, lowestAtRest - lowestNow, 0))
  hips.bone.position.copy(
    hips.bone.parent ? hips.bone.parent.worldToLocal(groundedWorldPosition) : groundedWorldPosition
  )
}

const createRetargetContext = (
  bones: THREE.Bone[],
  rest: CameraRetargetRest,
  drivenBoneNames: Set<string>
): RetargetContext | null => {
  const restLeftArm = rest.worldPositions.get('mixamorigLeftArm')
  const restRightArm = rest.worldPositions.get('mixamorigRightArm')
  if (!restLeftArm || !restRightArm) return null
  const restLateral = restLeftArm.clone().sub(restRightArm).normalize()
  return {
    bonesByName: new Map(bones.map((bone) => [bone.name, bone])),
    rest,
    drivenBoneNames,
    restLateral,
    restForward: new THREE.Vector3().crossVectors(restLateral, WORLD_UP).normalize()
  }
}

/**
 * Pose the rig from one detected frame by rotating bones, never by placing joints: every limb
 * segment turns to point where the matching body segment points, the torso and head turn to face
 * where the detected shoulders, hips and face do, and fingers bend joint by joint. Only directions
 * are copied, so a rig whose proportions differ from the performer's still stretches fully
 * straight in a T-pose and reaches overhead in a stretch. Parents are posed before children, so
 * each bone only adds its own turn on top of what the bone above it already did.
 * @param bones The rig's bones, with every bone in `drivenBoneNames` already reset to rest
 * @param rest The rig's rest pose, from `captureCameraRetargetRest`
 * @param frame What the camera found this frame, oriented and smoothed
 * @param options Depth flattening and foot grounding
 * @param drivenBoneNames The bones this frame may change, from `cameraFrameDrivenBoneNames`
 */
export const applyCameraPoseFrame = (
  bones: THREE.Bone[],
  rest: CameraRetargetRest,
  frame: CameraPoseFrame,
  options: CameraPoseMappingOptions,
  drivenBoneNames: Set<string>
): void => {
  const context = createRetargetContext(bones, rest, drivenBoneNames)
  if (!context) return
  const point = readBodyPoints(frame.bodyLandmarks, options.includeDepth)
  const torso = observeTorso(context, point)
  if (torso) applyTorso(context, torso)
  const head = observeHead(context, frame, point)
  if (head) applyHead(context, head, torso?.chest ?? new THREE.Quaternion())
  RIG_SIDES.forEach((side) => {
    const handLandmarks = frame.handLandmarks[side]
    applyArm(context, side, point, handLandmarks)
    if (handLandmarks) applyFingers(context, side, handLandmarks)
  })
  const legsDriven = RIG_SIDES.map((side) => applyLeg(context, side, point)).some(Boolean)
  if (options.groundFeet && legsDriven) groundFeet(context)
}
