import type { HandSide } from '@webgamekit/rig'
import type { CameraHandLandmark } from './types'

/**
 * Resolve MediaPipe's own handedness label to the side it actually belongs to on the rig: no
 * swap, a direct passthrough. An earlier version of this swapped the label, reasoning from
 * MediaPipe's own documented caveat that Hand Landmarker assumes a mirrored ("selfie") input;
 * a real camera session immediately surfaced the opposite arm and hand moving as if they
 * belonged to each other, meaning that reasoning did not hold for this pipeline. Only read when
 * no body is in view: with one, each hand is found in a crop around that side's own wrist, since
 * on a full-body clip this label disagreed with the nearest wrist about half the time.
 * @param categoryName MediaPipe's own "Left"/"Right" handedness label for one detected hand
 * @returns The subject's actual side, or null for an unrecognised label
 */
export const resolveCameraHandSide = (categoryName: string): HandSide | null => {
  if (categoryName === 'Left') return 'Left'
  if (categoryName === 'Right') return 'Right'
  return null
}

/**
 * Mirror every detected hand the way `mirrorCameraLandmarks` mirrors the body: negate each
 * landmark's x and file the hand under the opposite side. A reflected left hand is a genuine
 * right hand, so the rig's right fingers read it with no side-specific handling of their own.
 * @param handLandmarks The detected hands, keyed by each hand's own unmirrored side
 * @returns The same hands reflected across the vertical axis, keyed by the opposite side
 */
export const mirrorCameraHandLandmarks = (
  handLandmarks: Partial<Record<HandSide, CameraHandLandmark[]>>
): Partial<Record<HandSide, CameraHandLandmark[]>> => {
  const reflect = (landmarks: CameraHandLandmark[]): CameraHandLandmark[] =>
    landmarks.map((landmark) => ({ ...landmark, x: -landmark.x }))
  return {
    ...(handLandmarks.Left ? { Right: reflect(handLandmarks.Left) } : {}),
    ...(handLandmarks.Right ? { Left: reflect(handLandmarks.Right) } : {})
  }
}
