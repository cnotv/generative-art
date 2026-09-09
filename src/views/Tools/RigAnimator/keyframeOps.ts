import type { PoseKeyframe } from '@webgamekit/rig'

/**
 * Shift every keyframe in `frames` by the same `deltaFrames`, preserving their spacing — a
 * single dragged keyframe is just a one-frame list, and a multi-select drag moves the whole
 * block together the same way. Replaces whatever keyframe already sat at a landing frame, the
 * same as dropping a new one there would.
 * @param keyframes The current keyframe list
 * @param frames The frames of every keyframe being dragged
 * @param deltaFrames How far the block is moving, positive or negative
 * @returns The updated list, or the same list unchanged when there was nothing to move
 */
export const moveKeyframesInList = (
  keyframes: PoseKeyframe[],
  frames: number[],
  deltaFrames: number
): PoseKeyframe[] => {
  if (deltaFrames === 0 || frames.length === 0) return keyframes
  const movingFrames = new Set(frames)
  const moving = keyframes.filter((keyframe) => movingFrames.has(keyframe.frame))
  if (moving.length === 0) return keyframes
  const moved = moving.map((keyframe) => ({ ...keyframe, frame: keyframe.frame + deltaFrames }))
  const movedFrames = new Set(moved.map((keyframe) => keyframe.frame))
  const untouched = keyframes.filter(
    (keyframe) => !movingFrames.has(keyframe.frame) && !movedFrames.has(keyframe.frame)
  )
  return [...untouched, ...moved]
}
