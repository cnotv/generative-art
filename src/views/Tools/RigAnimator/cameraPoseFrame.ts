import * as THREE from 'three'
import type { HandSide, QuaternionData } from '@webgamekit/rig'
import {
  CAMERA_CROP_MIN_SIZE_PIXELS,
  CAMERA_HAND_FLIP_CONFIRM_READINGS,
  CAMERA_HAND_TRACK_RESET_MILLISECONDS,
  CAMERA_HAND_WRIST_MATCH_DISTANCE
} from './config'
import {
  CAMERA_LANDMARK_INDEX,
  filterCameraLandmarks,
  lowPassBlendFactor,
  mirrorCameraLandmarks,
  smoothingCutoffHertz
} from './cameraPoseMapping'
import { mirrorCameraHandLandmarks } from './cameraHandPoseMapping'
import { cameraHandOrientation } from './cameraPoseRetarget'
import type {
  CameraCropSquare,
  CameraHandLandmark,
  CameraHandTrack,
  CameraHandTracks,
  CameraLandmark,
  CameraPoseFrame,
  CameraSmoothingSettings
} from './types'

interface ImagePoint {
  x: number
  y: number
}

interface CropRequest {
  /** The landmark to centre on, normalized [0,1] to the source image. */
  center: ImagePoint
  /** Both detected shoulders, normalized, whose span sizes the crop to the body in view. */
  shoulders: [ImagePoint, ImagePoint]
  frameWidth: number
  frameHeight: number
  spanMultiplier: number
}

/**
 * A square region of the source image centred on one landmark and sized to the body in view, for
 * re-running a close-range detector on just that part of a wide shot. The Face and Hand
 * Landmarkers are trained on close-ups: on a full-body clip the face never registered on the
 * whole frame and hands only in one frame in six, while the same frames cropped around the pose's
 * own nose found the face in most of them. Sizing off the shoulder span keeps the crop the same
 * share of the body whether the subject stands near or far.
 * @param request Where to centre, how large the body is, and how much of it to take
 * @returns The crop, in source pixels; it may reach past the image edge
 */
export const cropSquareAroundLandmark = ({
  center,
  shoulders: [shoulderA, shoulderB],
  frameWidth,
  frameHeight,
  spanMultiplier
}: CropRequest): CameraCropSquare => {
  const shoulderSpan = Math.hypot(
    (shoulderA.x - shoulderB.x) * frameWidth,
    (shoulderA.y - shoulderB.y) * frameHeight
  )
  const size = Math.max(CAMERA_CROP_MIN_SIZE_PIXELS, shoulderSpan * spanMultiplier)
  return { left: center.x * frameWidth - size / 2, top: center.y * frameHeight - size / 2, size }
}

/**
 * Whether a normalized image point lies inside the image.
 * @param point A point normalized [0,1] to the image
 * @returns True when inside the image, edges included
 */
export const isInsideFrame = (point: ImagePoint): boolean =>
  point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1

/**
 * Hide every body landmark the pose detector placed outside the image. BlazePose still reports a
 * position, often with a confident visibility, for a part of the body out of frame, the legs
 * below a webcam framed on the upper body say: that is a guess, not a detection. Hidden, the
 * bones it would have driven stay at their rest pose instead of following the guess.
 * @param worldLandmarks The body's world landmarks
 * @param imageLandmarks The same landmarks, normalized to the image
 * @returns The world landmarks, with every one outside the image marked invisible
 */
export const hideLandmarksOutsideFrame = <T extends { visibility: number }>(
  worldLandmarks: T[],
  imageLandmarks: ImagePoint[]
): T[] =>
  worldLandmarks.map((landmark, index) => {
    const imageLandmark = imageLandmarks[index]
    return imageLandmark && isInsideFrame(imageLandmark) ? landmark : { ...landmark, visibility: 0 }
  })

/**
 * Decide which side each hand the Hand Landmarker found belongs to. A hand within reach of one of
 * the body's visible wrists belongs to the nearer one, and two hands claiming the same wrist are
 * split so the closer keeps it: on a full-body clip the detector's own left/right label disagreed
 * with the nearest wrist about half the time. A hand with no wrist in reach, a close-up with no
 * body in view, keeps its label.
 * @param handWrists Each hand's wrist, normalized to the image
 * @param labelledSides Each hand's side by the detector's own label, null when unrecognised
 * @param bodyWrists The body's wrists, normalized, null for one not visible in frame
 * @returns Each hand's side in the same order, null when it cannot be told
 */
export const assignHandSides = (
  handWrists: ImagePoint[],
  labelledSides: (HandSide | null)[],
  bodyWrists: Record<HandSide, ImagePoint | null>
): (HandSide | null)[] => {
  const distanceToWrist = (hand: ImagePoint, side: HandSide): number => {
    const wrist = bodyWrists[side]
    return wrist ? Math.hypot(hand.x - wrist.x, hand.y - wrist.y) : Infinity
  }
  const sides = handWrists.map((hand, index): HandSide | null => {
    const nearest =
      distanceToWrist(hand, 'Left') <= distanceToWrist(hand, 'Right') ? 'Left' : 'Right'
    return distanceToWrist(hand, nearest) <= CAMERA_HAND_WRIST_MATCH_DISTANCE
      ? nearest
      : (labelledSides[index] ?? null)
  })
  const [first, second] = sides
  if (sides.length !== 2 || first === null || first !== second) return sides
  const otherSide: HandSide = first === 'Left' ? 'Right' : 'Left'
  return distanceToWrist(handWrists[0], first) <= distanceToWrist(handWrists[1], first)
    ? [first, otherSide]
    : [otherSide, first]
}

/**
 * Re-express landmarks a detector found inside a crop as normalized coordinates of the whole
 * source image, so the preview overlay draws them over the right spot.
 * @param landmarks Landmarks normalized to the crop
 * @param crop The crop they were found in
 * @param frameWidth The source image's width in pixels
 * @param frameHeight The source image's height in pixels
 * @returns The same landmarks, normalized to the whole image
 */
export const cropLandmarksToFrame = <T extends ImagePoint>(
  landmarks: T[],
  crop: CameraCropSquare,
  frameWidth: number,
  frameHeight: number
): T[] =>
  landmarks.map((landmark) => ({
    ...landmark,
    x: (crop.left + landmark.x * crop.size) / frameWidth,
    y: (crop.top + landmark.y * crop.size) / frameHeight
  }))

/**
 * Read the head's rotation out of a Face Landmarker facial transformation matrix. MediaPipe's
 * metric face space has x toward the image's right, y up and z toward the camera, the same axes
 * the scene uses for a rig facing its viewer, so the rotation carries over with no axis change:
 * a face looking straight into the lens comes out as the identity. Confirmed against a real clip,
 * where the yaw it reported agreed in sign with the yaw read from the pose's own ears and nose.
 * @param matrixData The matrix's 16 values, column-major as MediaPipe packs them
 * @returns The head's rotation as plain quaternion data
 */
export const faceMatrixToHeadRotation = (matrixData: number[]): QuaternionData => {
  const rotation = new THREE.Quaternion()
  new THREE.Matrix4()
    .fromArray(matrixData)
    .decompose(new THREE.Vector3(), rotation, new THREE.Vector3())
  return { x: rotation.x, y: rotation.y, z: rotation.z, w: rotation.w }
}

/**
 * Reflect a head rotation across the vertical axis, matching `mirrorCameraLandmarks`: a turn or a
 * tilt toward one side becomes the same toward the other, while a nod is unchanged.
 * @param rotation The head rotation as detected
 * @returns The mirrored head rotation
 */
export const mirrorHeadRotation = ({ x, y, z, w }: QuaternionData): QuaternionData => ({
  x,
  y: -y,
  z: -z,
  w
})

/**
 * Turn the previous smoothed head rotation toward a new reading, the rotation counterpart of
 * `filterCameraLandmarks`: held still it settles over `settings.smoothingMilliseconds`, and the
 * faster the head is turning the less it is held back, by `settings.turnResponse`.
 * @param previous The previous smoothed rotation, or null for a first reading
 * @param next This reading's rotation
 * @param elapsedSeconds Time since the previous reading
 * @param settings The smoothing length and how much turning loosens it
 * @returns The smoothed rotation
 */
export const smoothHeadRotation = (
  previous: QuaternionData | null,
  next: QuaternionData,
  elapsedSeconds: number,
  settings: CameraSmoothingSettings
): QuaternionData => {
  if (!previous || elapsedSeconds <= 0) return next
  const from = new THREE.Quaternion(previous.x, previous.y, previous.z, previous.w)
  const to = new THREE.Quaternion(next.x, next.y, next.z, next.w)
  const turnSpeed = from.angleTo(to) / elapsedSeconds
  const cutoffHertz =
    smoothingCutoffHertz(settings.smoothingMilliseconds) + settings.turnResponse * turnSpeed
  const blended = from.slerp(to, lowPassBlendFactor(cutoffHertz, elapsedSeconds))
  return { x: blended.x, y: blended.y, z: blended.z, w: blended.w }
}

/**
 * The landmark each one hangs off, toward the hips: the joint it is carried around by. A landmark
 * the detector loses is held where it was last seen, shifted by however far this joint has moved
 * since, so an arm the camera stops seeing travels with the shoulder it hangs from instead of
 * staying behind in midair. Both hips are left out, being what world landmarks are centred on.
 */
const LANDMARK_ANCHOR: Record<number, number> = {
  [CAMERA_LANDMARK_INDEX.nose]: CAMERA_LANDMARK_INDEX.leftShoulder,
  [CAMERA_LANDMARK_INDEX.leftEar]: CAMERA_LANDMARK_INDEX.leftShoulder,
  [CAMERA_LANDMARK_INDEX.rightEar]: CAMERA_LANDMARK_INDEX.rightShoulder,
  [CAMERA_LANDMARK_INDEX.leftShoulder]: CAMERA_LANDMARK_INDEX.leftHip,
  [CAMERA_LANDMARK_INDEX.rightShoulder]: CAMERA_LANDMARK_INDEX.rightHip,
  [CAMERA_LANDMARK_INDEX.leftElbow]: CAMERA_LANDMARK_INDEX.leftShoulder,
  [CAMERA_LANDMARK_INDEX.rightElbow]: CAMERA_LANDMARK_INDEX.rightShoulder,
  [CAMERA_LANDMARK_INDEX.leftWrist]: CAMERA_LANDMARK_INDEX.leftElbow,
  [CAMERA_LANDMARK_INDEX.rightWrist]: CAMERA_LANDMARK_INDEX.rightElbow,
  [CAMERA_LANDMARK_INDEX.leftPinky]: CAMERA_LANDMARK_INDEX.leftWrist,
  [CAMERA_LANDMARK_INDEX.rightPinky]: CAMERA_LANDMARK_INDEX.rightWrist,
  [CAMERA_LANDMARK_INDEX.leftIndex]: CAMERA_LANDMARK_INDEX.leftWrist,
  [CAMERA_LANDMARK_INDEX.rightIndex]: CAMERA_LANDMARK_INDEX.rightWrist,
  [CAMERA_LANDMARK_INDEX.leftKnee]: CAMERA_LANDMARK_INDEX.leftHip,
  [CAMERA_LANDMARK_INDEX.rightKnee]: CAMERA_LANDMARK_INDEX.rightHip,
  [CAMERA_LANDMARK_INDEX.leftAnkle]: CAMERA_LANDMARK_INDEX.leftKnee,
  [CAMERA_LANDMARK_INDEX.rightAnkle]: CAMERA_LANDMARK_INDEX.rightKnee,
  [CAMERA_LANDMARK_INDEX.leftHeel]: CAMERA_LANDMARK_INDEX.leftAnkle,
  [CAMERA_LANDMARK_INDEX.rightHeel]: CAMERA_LANDMARK_INDEX.rightAnkle,
  [CAMERA_LANDMARK_INDEX.leftFootIndex]: CAMERA_LANDMARK_INDEX.leftAnkle,
  [CAMERA_LANDMARK_INDEX.rightFootIndex]: CAMERA_LANDMARK_INDEX.rightAnkle
}

const NO_SHIFT = { x: 0, y: 0, z: 0 }

const isDetected = (
  landmark: CameraLandmark | undefined,
  visibilityThreshold: number
): landmark is CameraLandmark =>
  landmark !== undefined && landmark.visibility >= visibilityThreshold

/**
 * How far the nearest joint above a landmark has moved since the last reading, walking up the
 * anchor chain past any joint that is itself undetected in either reading.
 */
const anchorShift = (
  previous: CameraLandmark[],
  next: CameraLandmark[],
  index: number,
  visibilityThreshold: number
): { x: number; y: number; z: number } => {
  const anchor = LANDMARK_ANCHOR[index]
  if (anchor === undefined) return NO_SHIFT
  const from = previous[anchor]
  const to = next[anchor]
  return isDetected(from, visibilityThreshold) && isDetected(to, visibilityThreshold)
    ? { x: to.x - from.x, y: to.y - from.y, z: to.z - from.z }
    : anchorShift(previous, next, anchor, visibilityThreshold)
}

/**
 * Keep every landmark the detector has stopped seeing at the position it was last seen in, carried
 * along by whichever joint above it is still detected (see `LANDMARK_ANCHOR`). Left to drop out,
 * a landmark takes its bone back to the rest pose, which snaps a limb the camera simply cannot
 * make out right now to a pose nobody performed; a held one keeps the last pose that was really
 * detected and follows the body around while it waits to be seen again.
 * @param previous The previous reading's landmarks
 * @param next This reading's landmarks
 * @param visibilityThreshold How confident a landmark must be to count as detected
 * @returns This reading's landmarks, with every undetected one held and shifted
 */
export const holdUndetectedLandmarks = (
  previous: CameraLandmark[],
  next: CameraLandmark[],
  visibilityThreshold: number
): CameraLandmark[] =>
  next.map((landmark, index) => {
    const held = previous[index]
    if (isDetected(landmark, visibilityThreshold) || !isDetected(held, visibilityThreshold)) {
      return landmark
    }
    const shift = anchorShift(previous, next, index, visibilityThreshold)
    return { ...held, x: held.x + shift.x, y: held.y + shift.y, z: held.z + shift.z }
  })

/**
 * Hold everything this reading has lost at what the last one found: undetected body landmarks
 * through `holdUndetectedLandmarks`, a face the tracker missed at its last rotation, and a hand
 * it missed for longer than `steadyCameraHands` holds one. Nothing is ever replaced by a default
 * or a rest pose, only by the last thing actually detected.
 * @param previous The previous smoothed frame, or null for a first reading
 * @param next This reading's detection
 * @param visibilityThreshold How confident a body landmark must be to count as detected
 * @returns The frame with every lost part held
 */
export const holdUndetectedCameraPoseFrame = (
  previous: CameraPoseFrame | null,
  next: CameraPoseFrame,
  visibilityThreshold: number
): CameraPoseFrame => {
  if (!previous) return next
  return {
    ...next,
    bodyLandmarks:
      previous.bodyLandmarks && next.bodyLandmarks
        ? holdUndetectedLandmarks(previous.bodyLandmarks, next.bodyLandmarks, visibilityThreshold)
        : next.bodyLandmarks,
    handLandmarks: { ...previous.handLandmarks, ...next.handLandmarks },
    headRotation: next.headRotation ?? previous.headRotation
  }
}

/**
 * Whether a frame found anything at all worth applying.
 * @param frame One detection
 * @returns True when it holds a body, a hand or a head
 */
export const hasCameraPoseContent = (frame: CameraPoseFrame): boolean =>
  frame.bodyLandmarks !== null ||
  frame.headRotation !== null ||
  Object.keys(frame.handLandmarks).length > 0

/**
 * Mirror every part of a frame together, for a self-view source: body, hands and head must all
 * agree on which side is which, or a hand ends up curling the fingers of the wrong arm.
 * @param frame One detection, as the camera saw it
 * @returns The same detection, reflected across the vertical axis
 */
export const mirrorCameraPoseFrame = (frame: CameraPoseFrame): CameraPoseFrame => ({
  bodyLandmarks: frame.bodyLandmarks ? mirrorCameraLandmarks(frame.bodyLandmarks) : null,
  handLandmarks: mirrorCameraHandLandmarks(frame.handLandmarks),
  headRotation: frame.headRotation ? mirrorHeadRotation(frame.headRotation) : null
})

/**
 * Smooth every part of a new reading against the previous smoothed frame, body and hands through
 * `filterCameraLandmarks` and the head through `smoothHeadRotation`. A part missing from either
 * reading is taken as-is, so something reappearing after a dropout is not blended against a stale
 * position.
 * @param previous The previous smoothed frame, or null for a first reading
 * @param next This reading's detection
 * @param timestampMilliseconds When this reading was taken
 * @param settings The Config panel's smoothing sliders
 * @returns The smoothed frame, stamped with its time, to apply and to hand back in next time
 */
export const smoothCameraPoseFrame = (
  previous: CameraPoseFrame | null,
  next: CameraPoseFrame,
  timestampMilliseconds: number,
  settings: CameraSmoothingSettings
): CameraPoseFrame => {
  const elapsedSeconds =
    previous?.timestampMilliseconds === undefined
      ? 0
      : (timestampMilliseconds - previous.timestampMilliseconds) / 1000
  const smooth = <T extends CameraHandLandmark>(last: T[] | null | undefined, landmarks: T[]) =>
    filterCameraLandmarks(last ?? null, landmarks, elapsedSeconds, settings)
  const smoothHand = (side: HandSide) => {
    const landmarks = next.handLandmarks[side]
    return landmarks ? { [side]: smooth(previous?.handLandmarks[side], landmarks) } : {}
  }
  return {
    bodyLandmarks: next.bodyLandmarks && smooth(previous?.bodyLandmarks, next.bodyLandmarks),
    handLandmarks: { ...smoothHand('Left'), ...smoothHand('Right') },
    headRotation:
      next.headRotation &&
      smoothHeadRotation(
        previous?.headRotation ?? null,
        next.headRotation,
        elapsedSeconds,
        settings
      ),
    timestampMilliseconds
  }
}

const RIG_SIDES: HandSide[] = ['Left', 'Right']

const toQuaternion = ({ x, y, z, w }: QuaternionData): THREE.Quaternion =>
  new THREE.Quaternion(x, y, z, w)

const acceptHandReading = (
  landmarks: CameraHandLandmark[],
  orientation: THREE.Quaternion,
  timestampMilliseconds: number
): CameraHandTrack => ({
  landmarks,
  orientation: { x: orientation.x, y: orientation.y, z: orientation.z, w: orientation.w },
  acceptedAtMilliseconds: timestampMilliseconds,
  pendingOrientation: null,
  pendingReadings: 0
})

interface SteadiedHand {
  landmarks: CameraHandLandmark[] | undefined
  track: CameraHandTrack | undefined
}

/** A side with no reading this time: held while recent, and remembered a little longer to judge the next reading by. */
const steadyMissingHand = (
  track: CameraHandTrack | undefined,
  age: number,
  settings: CameraSmoothingSettings
): SteadiedHand => {
  if (age <= settings.handHoldMilliseconds) return { landmarks: track?.landmarks, track }
  return {
    landmarks: undefined,
    track: age <= CAMERA_HAND_TRACK_RESET_MILLISECONDS ? track : undefined
  }
}

/** How many readings in a row, this one included, agree on the turn still waiting to be confirmed. */
const pendingTurnReadings = (
  track: CameraHandTrack,
  orientation: THREE.Quaternion,
  settings: CameraSmoothingSettings
): number =>
  track.pendingOrientation &&
  orientation.angleTo(toQuaternion(track.pendingOrientation)) <= settings.handFlipRadians
    ? track.pendingReadings + 1
    : 1

/** What one side shows this reading, and what to remember about it for the next. */
const steadyHand = (
  track: CameraHandTrack | undefined,
  reading: CameraHandLandmark[] | undefined,
  timestampMilliseconds: number,
  settings: CameraSmoothingSettings
): SteadiedHand => {
  const age = track ? timestampMilliseconds - track.acceptedAtMilliseconds : Infinity
  if (!reading) return steadyMissingHand(track, age, settings)
  const orientation = cameraHandOrientation(reading)
  if (!orientation) return { landmarks: reading, track }
  const accepted = {
    landmarks: reading,
    track: acceptHandReading(reading, orientation, timestampMilliseconds)
  }
  if (
    !track ||
    age > CAMERA_HAND_TRACK_RESET_MILLISECONDS ||
    orientation.angleTo(toQuaternion(track.orientation)) <= settings.handFlipRadians
  ) {
    return accepted
  }
  const pendingReadings = pendingTurnReadings(track, orientation, settings)
  if (pendingReadings >= CAMERA_HAND_FLIP_CONFIRM_READINGS) return accepted
  const { x, y, z, w } = orientation
  return {
    landmarks: track.landmarks,
    track: { ...track, pendingOrientation: { x, y, z, w }, pendingReadings }
  }
}

/**
 * Keep each detected hand steady against the Hand Landmarker's own misreadings, before any
 * smoothing. A hand lost for a moment keeps its last reading for `settings.handHoldMilliseconds`
 * rather than dropping out, and a palm turned further than `settings.handFlipRadians` from the last
 * trusted reading is ignored until `CAMERA_HAND_FLIP_CONFIRM_READINGS` readings in a row agree on
 * it: no wrist turns that far between two frames, while the detector does turn a palm over for a
 * frame or two. See the camera motion retargeting journey doc for the clip this was measured on.
 * @param tracks What each side last trusted, from the previous call; `{}` to start
 * @param frame This reading's detection
 * @param timestampMilliseconds When this reading was taken
 * @param settings The Config panel's smoothing sliders
 * @returns The frame with each hand steadied, and the tracks to hand back in next time
 */
export const steadyCameraHands = (
  tracks: CameraHandTracks,
  frame: CameraPoseFrame,
  timestampMilliseconds: number,
  settings: CameraSmoothingSettings
): { frame: CameraPoseFrame; tracks: CameraHandTracks } => {
  const steadied = RIG_SIDES.map(
    (side) =>
      [
        side,
        steadyHand(tracks[side], frame.handLandmarks[side], timestampMilliseconds, settings)
      ] as const
  )
  return {
    frame: {
      ...frame,
      handLandmarks: Object.fromEntries(
        steadied.flatMap(([side, { landmarks }]) => (landmarks ? [[side, landmarks]] : []))
      )
    },
    tracks: Object.fromEntries(
      steadied.flatMap(([side, { track }]) => (track ? [[side, track]] : []))
    )
  }
}
