import type { PoseKeyframe } from '@webgamekit/rig'

/**
 * Reposition a keyframe from one frame to another within a list, replacing whatever keyframe
 * already sat at the target frame, same as dropping a new one there would.
 * @param keyframes The current keyframe list
 * @param oldFrame The frame the dragged keyframe currently sits at
 * @param newFrame Where the drag wants it to land
 * @returns The updated list, or the same list unchanged when there was nothing to move
 */
export const moveKeyframeInList = (
  keyframes: PoseKeyframe[],
  oldFrame: number,
  newFrame: number
): PoseKeyframe[] => {
  if (oldFrame === newFrame) return keyframes
  const moving = keyframes.find((keyframe) => keyframe.frame === oldFrame)
  if (!moving) return keyframes
  const withoutMovedOrTarget = keyframes.filter(
    (keyframe) => keyframe.frame !== oldFrame && keyframe.frame !== newFrame
  )
  return [...withoutMovedOrTarget, { frame: newFrame, pose: moving.pose }]
}
