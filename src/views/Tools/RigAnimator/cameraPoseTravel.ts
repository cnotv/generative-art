import * as THREE from 'three'
import { ikSolveTwoBoneChain, type HandSide, type Vector3Data } from '@webgamekit/rig'
import {
  CAMERA_BODY_POSITION_MIN_LANDMARKS,
  CAMERA_BONE_SMOOTHING_RESET_SECONDS,
  CAMERA_FOOT_PIN_MAX_STRETCH_SHARE,
  CAMERA_FOOT_PLANT_LIFT_SHARE,
  CAMERA_FOOT_PLANT_SPEED_SHARE,
  CAMERA_FOOT_RELEASE_LIFT_SHARE,
  CAMERA_FOOT_RELEASE_MILLISECONDS,
  CAMERA_FOOT_RELEASE_SPEED_SHARE,
  CAMERA_LANDMARK_VISIBILITY_THRESHOLD,
  CAMERA_TRAVEL_ANCHOR_MILLISECONDS,
  CAMERA_TRAVEL_SMOOTHING_MILLISECONDS
} from './config'
import {
  CAMERA_LANDMARK_INDEX,
  lowPassBlendFactor,
  smoothingCutoffHertz
} from './cameraPoseMapping'
import { isInsideFrame } from './cameraPoseFrame'
import type {
  CameraFootPin,
  CameraFootTracks,
  CameraImageSize,
  CameraLandmark,
  CameraRetargetRest,
  CameraTravel
} from './types'

const SIDES: HandSide[] = ['Left', 'Right']
const WORLD_UP = new THREE.Vector3(0, 1, 0)
/** A knee sitting closer than this share of the leg to the hip-ankle line shows no bend to keep. */
const STRAIGHT_LEG_BEND_SHARE = 0.01
/** Shoulders to toes: the face is left out, its landmarks sit off the body's own plane. */
const SIZING_LANDMARKS = Array.from(
  { length: CAMERA_LANDMARK_INDEX.rightFootIndex - CAMERA_LANDMARK_INDEX.leftShoulder + 1 },
  (_, offset) => CAMERA_LANDMARK_INDEX.leftShoulder + offset
)
const LEGS = [
  [CAMERA_LANDMARK_INDEX.leftHip, CAMERA_LANDMARK_INDEX.leftKnee, CAMERA_LANDMARK_INDEX.leftAnkle],
  [
    CAMERA_LANDMARK_INDEX.rightHip,
    CAMERA_LANDMARK_INDEX.rightKnee,
    CAMERA_LANDMARK_INDEX.rightAnkle
  ]
]

const isSeen = (landmark: CameraLandmark | undefined): landmark is CameraLandmark =>
  landmark !== undefined && landmark.visibility >= CAMERA_LANDMARK_VISIBILITY_THRESHOLD

/**
 * Where the performer's hip centre stands relative to the camera, read from how large and where
 * the body appears in the picture. World landmarks are metric but centred on the hips, so they
 * say how big the body is; the picture says how big it looks. Their ratio is the distance, the
 * weak to full perspective step GVHMR (SIGGRAPH Asia 2024) and WHAM (CVPR 2024) take from a
 * detected body to its place in front of the camera, with GVHMR's uncalibrated focal length: the
 * image diagonal, about 53° across it. Only landmarks inside the picture count, since BlazePose
 * still places a body part out of frame, and the hips must be in it to anchor the position.
 * @param worldLandmarks The body's world landmarks, metres from the hip centre
 * @param imageLandmarks The same landmarks, normalized to the picture
 * @param frameSize The picture's size in pixels
 * @returns The hip centre in metres, scene axes, or null when too little of the body is in view
 */
export const cameraBodyPosition = (
  worldLandmarks: CameraLandmark[],
  imageLandmarks: CameraLandmark[],
  { width, height }: CameraImageSize
): Vector3Data | null => {
  const leftHip = imageLandmarks[CAMERA_LANDMARK_INDEX.leftHip]
  const rightHip = imageLandmarks[CAMERA_LANDMARK_INDEX.rightHip]
  if (!leftHip || !rightHip || !isInsideFrame(leftHip) || !isInsideFrame(rightHip)) return null
  const hipX = ((leftHip.x + rightHip.x) / 2) * width
  const hipY = ((leftHip.y + rightHip.y) / 2) * height
  const pairs = SIZING_LANDMARKS.flatMap((index) => {
    const image = imageLandmarks[index]
    const world = worldLandmarks[index]
    return image && isInsideFrame(image) && isSeen(world) ? [{ image, world }] : []
  })
  if (pairs.length < CAMERA_BODY_POSITION_MIN_LANDMARKS) return null
  const { alignment, spread } = pairs.reduce(
    (sums, { image, world }) => ({
      alignment:
        sums.alignment + (image.x * width - hipX) * world.x + (image.y * height - hipY) * world.y,
      spread: sums.spread + world.x ** 2 + world.y ** 2
    }),
    { alignment: 0, spread: 0 }
  )
  if (alignment <= 0) return null
  const focalPixels = Math.hypot(width, height)
  const depth = (focalPixels * spread) / alignment
  return {
    x: ((hipX - width / 2) * depth) / focalPixels,
    y: -((hipY - height / 2) * depth) / focalPixels,
    z: -depth
  }
}

/**
 * The performer's leg length, hip to knee to ankle, averaged over whichever legs are in view.
 * @param landmarks The body's world landmarks
 * @returns The length in metres, or null when neither leg is fully in view
 */
export const cameraLegLength = (landmarks: CameraLandmark[]): number | null => {
  const lengths = LEGS.flatMap(([hip, knee, ankle]) => {
    const points = [landmarks[hip], landmarks[knee], landmarks[ankle]]
    if (!points.every(isSeen)) return []
    const [hipPoint, kneePoint, anklePoint] = points.map(
      ({ x, y, z }) => new THREE.Vector3(x, y, z)
    )
    return [hipPoint.distanceTo(kneePoint) + kneePoint.distanceTo(anklePoint)]
  })
  return lengths.length > 0
    ? lengths.reduce((total, length) => total + length, 0) / lengths.length
    : null
}

const legBoneNames = (side: HandSide) => ({
  thigh: `mixamorig${side}UpLeg`,
  shin: `mixamorig${side}Leg`,
  foot: `mixamorig${side}Foot`,
  toe: `mixamorig${side}ToeBase`
})

/**
 * The rig's leg length at rest, thigh plus shin, averaged over both legs.
 * @param rest The rig's rest pose
 * @returns The length in world units, or null when the rig has no legs to measure
 */
export const rigLegLength = (rest: CameraRetargetRest): number | null => {
  const lengths = SIDES.flatMap((side) => {
    const names = legBoneNames(side)
    const [hip, knee, ankle] = [names.thigh, names.shin, names.foot].map((name) =>
      rest.worldPositions.get(name)
    )
    return hip && knee && ankle ? [hip.distanceTo(knee) + knee.distanceTo(ankle)] : []
  })
  return lengths.length > 0
    ? lengths.reduce((total, length) => total + length, 0) / lengths.length
    : null
}

/** Whether two readings are close enough in time to ease between rather than start afresh. */
const isContinuous = (elapsedSeconds: number): boolean =>
  elapsedSeconds > 0 && elapsedSeconds <= CAMERA_BONE_SMOOTHING_RESET_SECONDS

const median = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

/** Where a set of readings agree the performer stands, axis by axis, so one misread is outvoted. */
const medianPosition = (readings: Vector3Data[]): Vector3Data => ({
  x: median(readings.map(({ x }) => x)),
  y: median(readings.map(({ y }) => y)),
  z: median(readings.map(({ z }) => z))
})

/**
 * Carry the rig across the floor to where the performer now stands, measured from where they
 * stood when the source started and scaled by the two leg lengths, so a performer's stride is the
 * rig's stride. Only the level part is taken: height is grounding's job. The start is where the
 * readings of the first `CAMERA_TRAVEL_ANCHOR_MILLISECONDS` agree the performer stood, and the rig
 * stays put while it is read, so the misread first frame of a video neither slides the rig nor
 * offsets the take. The rig then eases toward each new spot over
 * `CAMERA_TRAVEL_SMOOTHING_MILLISECONDS`; after a gap in the readings, a paused or seeked video, it
 * lands straight on it, still measured from the same start, so a clip seeked or replayed puts the
 * rig where the performer is at that moment.
 * @param previous The travel so far, or null for the first reading of a source
 * @param reading Where the performer stands and how long their legs are, this frame
 * @param rigLegLengthUnits The rig's own leg length, from `rigLegLength`
 * @param elapsedSeconds Time since the previous reading, on the capture's own clock
 * @returns The new travel
 */
export const advanceCameraTravel = (
  previous: CameraTravel | null,
  reading: { bodyPosition: Vector3Data; performerLegLength: number },
  rigLegLengthUnits: number,
  elapsedSeconds: number
): CameraTravel => {
  if (!previous) {
    return {
      origin: reading.bodyPosition,
      performerLegLength: reading.performerLegLength,
      offset: { x: 0, y: 0, z: 0 },
      sourceSeconds: 0,
      startReadings: [reading.bodyPosition]
    }
  }
  const share = isContinuous(elapsedSeconds)
    ? lowPassBlendFactor(smoothingCutoffHertz(CAMERA_TRAVEL_SMOOTHING_MILLISECONDS), elapsedSeconds)
    : 1
  const sourceSeconds = previous.sourceSeconds + (isContinuous(elapsedSeconds) ? elapsedSeconds : 0)
  if (
    previous.startReadings.length > 0 &&
    sourceSeconds < CAMERA_TRAVEL_ANCHOR_MILLISECONDS / 1000
  ) {
    const startReadings = [...previous.startReadings, reading.bodyPosition]
    return {
      ...previous,
      origin: medianPosition(startReadings),
      performerLegLength: THREE.MathUtils.lerp(
        previous.performerLegLength,
        reading.performerLegLength,
        share
      ),
      sourceSeconds,
      startReadings
    }
  }
  const performerLegLength = THREE.MathUtils.lerp(
    previous.performerLegLength,
    reading.performerLegLength,
    share
  )
  const unitsPerMetre = rigLegLengthUnits / performerLegLength
  const toward = (axis: 'x' | 'z'): number =>
    THREE.MathUtils.lerp(
      previous.offset[axis],
      (reading.bodyPosition[axis] - previous.origin[axis]) * unitsPerMetre,
      share
    )
  return {
    origin: previous.origin,
    performerLegLength,
    offset: { x: toward('x'), y: 0, z: toward('z') },
    sourceSeconds,
    startReadings: []
  }
}

/**
 * Move a bone by an offset given in world space, whatever its parent's own transform.
 * @param bone The bone to move
 * @param offset How far to move it, in world units
 */
export const offsetBoneInWorld = (bone: THREE.Bone, offset: Vector3Data): void => {
  const moved = bone.getWorldPosition(new THREE.Vector3()).add(offset)
  bone.position.copy(bone.parent ? bone.parent.worldToLocal(moved) : moved)
}

interface Leg {
  side: HandSide
  thigh: THREE.Bone
  shin: THREE.Bone
  foot: THREE.Bone
  /** How far the foot has risen above where it stands at rest, its heel or its toe, whichever is lower. */
  rise: number
}

const findLegs = (
  bones: THREE.Bone[],
  rest: CameraRetargetRest,
  drivenBoneNames: Set<string>
): Leg[] => {
  const bonesByName = new Map(bones.map((bone) => [bone.name, bone]))
  const riseOf = (name: string): number | null => {
    const bone = bonesByName.get(name)
    const restPosition = rest.worldPositions.get(name)
    return bone && restPosition
      ? bone.getWorldPosition(new THREE.Vector3()).y - restPosition.y
      : null
  }
  return SIDES.flatMap((side) => {
    const names = legBoneNames(side)
    const [thigh, shin, foot] = [names.thigh, names.shin, names.foot].map((name) =>
      bonesByName.get(name)
    )
    const rises = [riseOf(names.foot), riseOf(names.toe)].filter(
      (rise): rise is number => rise !== null
    )
    return thigh && shin && foot && drivenBoneNames.has(names.thigh) && rises.length > 0
      ? [{ side, thigh, shin, foot, rise: Math.min(...rises) }]
      : []
  })
}

/** How much weaker a let-go foot's hold gets over this frame. */
const releaseStep = (elapsedSeconds: number): number =>
  isContinuous(elapsedSeconds) ? elapsedSeconds / (CAMERA_FOOT_RELEASE_MILLISECONDS / 1000) : 1

/**
 * Keep a held position within reach of where the leg puts the ankle, dragging it along the level
 * floor when the body has moved further than that: the foot then creeps as fast as the capture
 * and the travel disagree, instead of holding until it snaps back all at once.
 */
const withinReach = (
  position: Vector3Data,
  ankle: THREE.Vector3,
  legLength: number
): Vector3Data => {
  const away = new THREE.Vector3(position.x - ankle.x, 0, position.z - ankle.z)
  const reach = CAMERA_FOOT_PIN_MAX_STRETCH_SHARE * legLength
  if (away.length() <= reach) return position
  const held = ankle.clone().add(away.setLength(reach))
  return { x: held.x, y: position.y, z: held.z }
}

/** How one foot sits this frame, relative to the rig's leg length. */
interface FootReading {
  /** How far it has risen above the lower foot. */
  liftShare: number
  /** How fast the capture moved it across the floor since the last frame, per second. */
  speedShare: number
}

/**
 * What to hold one foot to this frame. A foot low and still on the floor is taken as planted where
 * it is and held there, within the leg's reach; one that rises or moves off is let go and eases
 * back over `CAMERA_FOOT_RELEASE_MILLISECONDS` rather than snapping.
 */
const nextFootPin = (
  previous: CameraFootPin | null,
  ankle: THREE.Vector3,
  { liftShare, speedShare }: FootReading,
  legLength: number,
  elapsedSeconds: number
): CameraFootPin | null => {
  const letGo =
    previous &&
    (previous.releasing ||
      liftShare > CAMERA_FOOT_RELEASE_LIFT_SHARE ||
      speedShare > CAMERA_FOOT_RELEASE_SPEED_SHARE)
  if (previous && !letGo) {
    return { ...previous, position: withinReach(previous.position, ankle, legLength) }
  }
  const weight = previous ? previous.weight - releaseStep(elapsedSeconds) : 0
  if (previous && weight > 0) return { ...previous, weight, releasing: true }
  return liftShare < CAMERA_FOOT_PLANT_LIFT_SHARE && speedShare < CAMERA_FOOT_PLANT_SPEED_SHARE
    ? { position: { x: ankle.x, y: ankle.y, z: ankle.z }, weight: 1, releasing: false }
    : null
}

/** How fast the capture moved a foot across the floor, per second; 0 with nothing to compare. */
const footSpeedShare = (
  previousAnkle: Vector3Data | undefined,
  ankle: THREE.Vector3,
  legLength: number,
  elapsedSeconds: number
): number =>
  previousAnkle && isContinuous(elapsedSeconds) && elapsedSeconds > 0
    ? Math.hypot(ankle.x - previousAnkle.x, ankle.z - previousAnkle.z) / legLength / elapsedSeconds
    : 0

/** Which way the knee should bend: the way it already does, or the way the hips face if the leg is straight. */
const kneePole = (leg: Leg, rest: CameraRetargetRest, legLength: number): THREE.Vector3 => {
  const hip = leg.thigh.getWorldPosition(new THREE.Vector3())
  const knee = leg.shin.getWorldPosition(new THREE.Vector3())
  const ankle = leg.foot.getWorldPosition(new THREE.Vector3())
  const line = new THREE.Line3(hip, ankle)
  const bend = knee.clone().sub(line.closestPointToPoint(knee, false, new THREE.Vector3()))
  if (bend.length() > legLength * STRAIGHT_LEG_BEND_SHARE)
    return knee.add(bend.setLength(legLength))
  const restLeft = rest.worldPositions.get(legBoneNames('Left').thigh)
  const restRight = rest.worldPositions.get(legBoneNames('Right').thigh)
  const restHips = leg.thigh.parent instanceof THREE.Bone ? leg.thigh.parent : null
  const restHipsQuaternion = restHips ? rest.worldQuaternions.get(restHips.name) : undefined
  if (!restLeft || !restRight || !restHips || !restHipsQuaternion) return knee
  const turn = restHips
    .getWorldQuaternion(new THREE.Quaternion())
    .multiply(restHipsQuaternion.clone().invert())
  const facing = new THREE.Vector3()
    .crossVectors(restLeft.clone().sub(restRight), WORLD_UP)
    .normalize()
    .applyQuaternion(turn)
  return knee.add(facing.multiplyScalar(legLength))
}

/** Bend the leg so its ankle reaches the pin, keeping the foot turned the way the capture put it. */
const holdFoot = (
  leg: Leg,
  pin: CameraFootPin,
  rest: CameraRetargetRest,
  legLength: number
): void => {
  const free = leg.foot.getWorldPosition(new THREE.Vector3())
  const target = free
    .clone()
    .lerp(new THREE.Vector3(pin.position.x, free.y, pin.position.z), pin.weight)
  const footQuaternion = leg.foot.getWorldQuaternion(new THREE.Quaternion())
  ikSolveTwoBoneChain(
    { root: leg.thigh, mid: leg.shin, end: leg.foot },
    target,
    kneePole(leg, rest, legLength)
  )
  leg.foot.quaternion.copy(
    leg.shin.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(footQuaternion)
  )
  leg.thigh.updateMatrixWorld(true)
}

/**
 * Hold each planted foot where it landed while the body moves over it, the footskate cleanup
 * GVHMR (SIGGRAPH Asia 2024) runs after placing the body: joints it judges stationary are held
 * still and the legs are solved to reach them. A foot is judged planted the way contact labels
 * are, low and still: the lower of the two, measured by how far each has risen from where it
 * stands at rest so the rule is the same on any floor the rig is grounded to, and moving across the
 * floor slower than a foot sweeping under a body that runs in place. Only the level position is
 * held; height stays the capture's own.
 * @param bones The rig's bones, posed for this frame with the body already moved
 * @param rest The rig's rest pose
 * @param tracks Each foot after the previous frame; `{}` to start
 * @param elapsedSeconds Time since the previous frame, on the capture's own clock
 * @param drivenBoneNames The bones this frame drives; a leg outside them is left alone
 * @returns Each foot after this frame, to hand back in next time
 */
export const pinPlantedFeet = (
  bones: THREE.Bone[],
  rest: CameraRetargetRest,
  tracks: CameraFootTracks,
  elapsedSeconds: number,
  drivenBoneNames: Set<string> = new Set(bones.map((bone) => bone.name))
): CameraFootTracks => {
  const legLength = rigLegLength(rest)
  const legs = findLegs(bones, rest, drivenBoneNames)
  if (!legLength || legs.length === 0) return {}
  const lowestRise = Math.min(...legs.map((leg) => leg.rise))
  const carried = isContinuous(elapsedSeconds) ? tracks : {}
  return Object.fromEntries(
    legs.map((leg) => {
      const ankle = leg.foot.getWorldPosition(new THREE.Vector3())
      const previous = carried[leg.side]
      const pin = nextFootPin(
        previous?.pin ?? null,
        ankle,
        {
          liftShare: (leg.rise - lowestRise) / legLength,
          speedShare: footSpeedShare(previous?.freeAnkle, ankle, legLength, elapsedSeconds)
        },
        legLength,
        elapsedSeconds
      )
      if (pin) holdFoot(leg, pin, rest, legLength)
      return [leg.side, { freeAnkle: { x: ankle.x, y: ankle.y, z: ankle.z }, pin }]
    })
  )
}
