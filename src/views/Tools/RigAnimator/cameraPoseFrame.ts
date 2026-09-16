import * as THREE from 'three'
import type { HandSide, QuaternionData } from '@webgamekit/rig'
import { CAMERA_CROP_MIN_SIZE_PIXELS, CAMERA_HAND_WRIST_MATCH_DISTANCE } from './config'
import {
  filterCameraLandmarks,
  lowPassBlendFactor,
  mirrorCameraLandmarks,
  smoothingCutoffHertz
} from './cameraPoseMapping'
import { mirrorCameraHandLandmarks } from './cameraHandPoseMapping'
import type {
  CameraCropSquare,
  CameraHandLandmark,
  CameraLandmarkVelocity,
  CameraPoseFilterState,
  CameraPoseFrame,
  CameraSmoothingSettings,
  FilteredCameraLandmarks
} from './types'

const RIG_SIDES: HandSide[] = ['Left', 'Right']

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
 * Filter every part of a new reading against the previous state, body and hands through
 * `filterCameraLandmarks` and the head through `smoothHeadRotation`. A part missing from either
 * reading is taken as-is, so something reappearing after a dropout is not blended against a stale
 * position.
 * @param previous The state the previous reading left, or null for a first reading
 * @param next This reading's detection
 * @param timestampMilliseconds When this reading was taken
 * @param settings The smoothing length and the jump limit
 * @returns The new state, whose `frame` is what to apply to the rig
 */
export const smoothCameraPoseFrame = (
  previous: CameraPoseFilterState | null,
  next: CameraPoseFrame,
  timestampMilliseconds: number,
  settings: CameraSmoothingSettings
): CameraPoseFilterState => {
  const elapsedSeconds = previous
    ? (timestampMilliseconds - previous.timestampMilliseconds) / 1000
    : 0
  const filterPart = <T extends CameraHandLandmark>(
    landmarks: T[],
    previousLandmarks: T[] | null | undefined,
    previousVelocities: CameraLandmarkVelocity[] | null | undefined
  ): FilteredCameraLandmarks<T> =>
    filterCameraLandmarks(
      previousLandmarks && previousVelocities
        ? { landmarks: previousLandmarks, velocities: previousVelocities }
        : null,
      landmarks,
      elapsedSeconds,
      settings
    )
  const body = next.bodyLandmarks
    ? filterPart(next.bodyLandmarks, previous?.frame.bodyLandmarks, previous?.bodyVelocities)
    : null
  const hands = RIG_SIDES.flatMap(
    (side): [HandSide, FilteredCameraLandmarks<CameraHandLandmark>][] => {
      const landmarks = next.handLandmarks[side]
      if (!landmarks) return []
      const previousHand = previous?.frame.handLandmarks[side]
      return [[side, filterPart(landmarks, previousHand, previous?.handVelocities[side])]]
    }
  )
  return {
    frame: {
      bodyLandmarks: body?.landmarks ?? null,
      handLandmarks: Object.fromEntries(hands.map(([side, hand]) => [side, hand.landmarks])),
      headRotation: next.headRotation
        ? smoothHeadRotation(
            previous?.frame.headRotation ?? null,
            next.headRotation,
            elapsedSeconds,
            settings
          )
        : null
    },
    bodyVelocities: body?.velocities ?? null,
    handVelocities: Object.fromEntries(hands.map(([side, hand]) => [side, hand.velocities])),
    timestampMilliseconds
  }
}
