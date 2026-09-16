import { CAMERA_LANDMARK_VISIBILITY_THRESHOLD } from './config'
import type {
  CameraLandmark,
  CameraLandmarkVelocity,
  CameraSmoothingSettings,
  FilteredCameraLandmarks
} from './types'

/** The minimal shape `clampLandmarkJump` needs: any landmark-like point. */
interface LandmarkPoint {
  x: number
  y: number
  z: number
}

/**
 * Clamp how far `candidate` has moved from `previous`, in straight-line distance, to at most
 * `maxJump`: a single misdetected frame that puts a landmark somewhere far from where it just
 * was reads as a sudden, physically implausible snap rather than motion, and a real fast
 * movement still gets there, just over a couple of extra frames instead of one. Preserves every
 * other field `candidate` carries (a `CameraLandmark`'s `visibility`, say).
 * @param previous Where this landmark was last frame
 * @param candidate Where this frame's (possibly already-blended) landmark wants to move to
 * @param maxJump The furthest `candidate` may move from `previous` in one call, in the same
 *   units as the landmarks themselves (metres, for world landmarks)
 * @returns `candidate` unchanged if within reach, otherwise pulled back to `maxJump` away
 */
export const clampLandmarkJump = <T extends LandmarkPoint>(
  previous: LandmarkPoint,
  candidate: T,
  maxJump: number
): T => {
  const dx = candidate.x - previous.x
  const dy = candidate.y - previous.y
  const dz = candidate.z - previous.z
  const distance = Math.hypot(dx, dy, dz)
  if (maxJump <= 0 || distance <= maxJump) return candidate
  const scale = maxJump / distance
  return {
    ...candidate,
    x: previous.x + dx * scale,
    y: previous.y + dy * scale,
    z: previous.z + dz * scale
  }
}

/**
 * The share of a new reading a low-pass filter takes, given its cutoff and the time since the
 * last reading. Working from elapsed time rather than a fixed share per frame keeps the smoothing
 * the same length whether detection manages 15 readings a second or 60.
 * @param cutoffHertz The filter's cutoff; higher follows faster, and Infinity follows exactly
 * @param elapsedSeconds Time since the previous reading
 * @returns A share from 0 (keep the old value) to 1 (take the new one)
 */
export const lowPassBlendFactor = (cutoffHertz: number, elapsedSeconds: number): number =>
  1 / (1 + 1 / (2 * Math.PI * cutoffHertz * elapsedSeconds))

/**
 * The low-pass cutoff whose time constant is a given number of milliseconds.
 * @param smoothingMilliseconds How long a held-still value takes to settle; 0 means no smoothing
 * @returns The cutoff in hertz, Infinity for no smoothing
 */
export const smoothingCutoffHertz = (smoothingMilliseconds: number): number =>
  smoothingMilliseconds > 0 ? 1000 / (2 * Math.PI * smoothingMilliseconds) : Infinity

const STILL: CameraLandmarkVelocity = { x: 0, y: 0, z: 0 }
const AXES = ['x', 'y', 'z'] as const

/**
 * Smooth a new reading against the previous filtered one with a One Euro filter (Casiez, Roussel
 * and Vogel, 2012): a low-pass filter whose cutoff rises with how fast each landmark moves. A
 * landmark held still, where jiggle shows most, is smoothed over the full `smoothingMilliseconds`;
 * a fast one, where lag shows most, is let through close to as detected. A fixed blend per frame
 * cannot do both: enough of it to still the jiggle leaves a fast arm swing trailing visibly behind.
 * The jump clamp still catches a single wild misdetection on top. Every field besides position,
 * visibility say, comes from the new reading, so a landmark leaving view is not held half-visible.
 * @param previous The previous filtered landmarks and velocities, or null for a first reading
 * @param next This reading's landmarks
 * @param elapsedSeconds Time since the previous reading
 * @param settings The smoothing length and the jump limit
 * @returns The filtered landmarks and velocities, to hand back in as `previous` next time
 */
export const filterCameraLandmarks = <T extends LandmarkPoint>(
  previous: FilteredCameraLandmarks<T> | null,
  next: T[],
  elapsedSeconds: number,
  settings: CameraSmoothingSettings
): FilteredCameraLandmarks<T> => {
  const minimumCutoffHertz = smoothingCutoffHertz(settings.smoothingMilliseconds)
  const velocityShare = lowPassBlendFactor(settings.speedCutoffHertz, elapsedSeconds)
  const filtered = next.map((landmark, index) => {
    const previousLandmark = previous?.landmarks[index]
    const previousVelocity = previous?.velocities[index]
    if (!previousLandmark || !previousVelocity || elapsedSeconds <= 0) {
      return { landmark, velocity: STILL }
    }
    const [x, y, z] = AXES.map(
      (axis) =>
        previousVelocity[axis] +
        ((landmark[axis] - previousLandmark[axis]) / elapsedSeconds - previousVelocity[axis]) *
          velocityShare
    )
    const cutoffHertz = minimumCutoffHertz + settings.speedResponse * Math.hypot(x, y, z)
    const share = lowPassBlendFactor(cutoffHertz, elapsedSeconds)
    const [blendedX, blendedY, blendedZ] = AXES.map(
      (axis) => previousLandmark[axis] + (landmark[axis] - previousLandmark[axis]) * share
    )
    const blended = { ...landmark, x: blendedX, y: blendedY, z: blendedZ }
    return {
      landmark: clampLandmarkJump(previousLandmark, blended, settings.maxJump),
      velocity: { x, y, z }
    }
  })
  return {
    landmarks: filtered.map(({ landmark }) => landmark),
    velocities: filtered.map(({ velocity }) => velocity)
  }
}

/**
 * Every one of BlazePose's 33 landmark indices that swaps with another under a left/right
 * mirror; the nose (0) is the only unpaired, on-the-midline point.
 */
const MIRRORED_LANDMARK_PAIRS: readonly (readonly [number, number])[] = [
  [1, 4],
  [2, 5],
  [3, 6],
  [7, 8],
  [9, 10],
  [11, 12],
  [13, 14],
  [15, 16],
  [17, 18],
  [19, 20],
  [21, 22],
  [23, 24],
  [25, 26],
  [27, 28],
  [29, 30],
  [31, 32]
]

/**
 * Mirror a full set of detected landmarks across the vertical axis, the reflection a real mirror
 * gives: negate every point's x, and swap each left/right pair so the array's own "left" slot
 * still holds whichever side now reads as left after the reflection. Applied once, right where
 * MediaPipe's own landmarks are first read, so every downstream reader, the rig retargeting and
 * the camera yaw estimate alike, sees a consistently mirrored pose without needing its own
 * left/right handling changed: without this, a rig facing its own viewing camera the same way the
 * subject faces their webcam moved the subject's real right arm on the screen side an actual
 * mirror would show as the subject's left, the opposite of the mirrored live preview right next
 * to it. The preview itself needs no matching change: it is already mirrored by a CSS transform
 * on the video element, entirely separate from this landmark data.
 * @param landmarks This frame's freshly detected landmarks, in MediaPipe's own point order
 * @returns The same landmarks, reflected across the vertical axis
 */
export const mirrorCameraLandmarks = (landmarks: CameraLandmark[]): CameraLandmark[] => {
  const mirrored = landmarks.map((landmark) => ({ ...landmark, x: -landmark.x }))
  MIRRORED_LANDMARK_PAIRS.forEach(([a, b]) => {
    const landmarkA = mirrored[a]
    const landmarkB = mirrored[b]
    if (landmarkA && landmarkB) {
      mirrored[a] = landmarkB
      mirrored[b] = landmarkA
    }
  })
  return mirrored
}

/** BlazePose's landmark indices the rig mapping reads, by body part. */
export const CAMERA_LANDMARK_INDEX = {
  nose: 0,
  leftEar: 7,
  rightEar: 8,
  leftShoulder: 11,
  rightShoulder: 12,
  leftElbow: 13,
  rightElbow: 14,
  leftWrist: 15,
  rightWrist: 16,
  leftPinky: 17,
  rightPinky: 18,
  leftIndex: 19,
  rightIndex: 20,
  leftHip: 23,
  rightHip: 24,
  leftKnee: 25,
  rightKnee: 26,
  leftAnkle: 27,
  rightAnkle: 28,
  leftHeel: 29,
  rightHeel: 30,
  leftFootIndex: 31,
  rightFootIndex: 32
} as const

/**
 * Estimate how far the subject is turned from square-to-camera, from the shoulder line's own
 * rotation in the horizontal plane. Facing the camera straight on, both shoulders sit at the
 * same depth, so the shoulder-to-shoulder vector points straight along x with no z component;
 * turning the body moves one shoulder closer to the camera than the other, tilting that vector
 * by exactly the angle turned. This is the one camera-relative angle a single photo's body
 * landmarks can actually support: not a full camera pose (MediaPipe's world landmarks are
 * already normalized to a real-world body scale, so they carry no cue at all about how far away
 * or how zoomed in the original camera was), just which way the subject is facing.
 * @param landmarks The detected person's world landmarks
 * @returns The estimated yaw in radians, matching `frameCameraOnModel`'s own convention (0 is
 *   square-on), or null when the shoulders aren't both confidently detected
 */
export const estimateCameraYaw = (landmarks: CameraLandmark[]): number | null => {
  const leftShoulder = landmarks[CAMERA_LANDMARK_INDEX.leftShoulder]
  const rightShoulder = landmarks[CAMERA_LANDMARK_INDEX.rightShoulder]
  if (
    !leftShoulder ||
    !rightShoulder ||
    leftShoulder.visibility < CAMERA_LANDMARK_VISIBILITY_THRESHOLD ||
    rightShoulder.visibility < CAMERA_LANDMARK_VISIBILITY_THRESHOLD
  ) {
    return null
  }
  // MediaPipe's own landmark space puts the left shoulder at a larger x than the right (x
  // grows toward the subject's own left), so the square-on reference vector points along
  // negative x; negating it here is what makes 0 mean square-on instead of a half turn.
  const dx = -(rightShoulder.x - leftShoulder.x)
  // Scene z grows toward the viewer where landmark z grows away from it, the same flip the rig
  // retargeting applies to every landmark it reads.
  const dz = -(rightShoulder.z - leftShoulder.z)
  return Math.atan2(dz, dx)
}
