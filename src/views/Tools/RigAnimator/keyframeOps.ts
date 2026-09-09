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

/**
 * Cut the frames from `startFrame` to `endFrame` (inclusive) out of the timeline entirely — a
 * ripple delete, not just clearing the poses inside the range: every keyframe after the cut
 * shifts left by the span removed, so it keeps the same spacing to whatever follows it instead
 * of leaving a gap behind.
 * @param keyframes The current keyframe list
 * @param startFrame The first frame of the range to remove
 * @param endFrame The last frame of the range to remove, inclusive
 * @returns The updated list, or the same list unchanged when the range is empty or inverted
 */
export const removeFrameRangeFromList = (
  keyframes: PoseKeyframe[],
  startFrame: number,
  endFrame: number
): PoseKeyframe[] => {
  const span = endFrame - startFrame + 1
  if (span <= 0) return keyframes
  return keyframes
    .filter((keyframe) => keyframe.frame < startFrame || keyframe.frame > endFrame)
    .map((keyframe) =>
      keyframe.frame > endFrame ? { ...keyframe, frame: keyframe.frame - span } : keyframe
    )
}

/**
 * Open up `span` blank frames starting at `atFrame` — a ripple insert: every keyframe already
 * at or past that frame shifts later by `span` to make room, rather than anything being
 * overwritten the way dropping a single keyframe there would.
 * @param keyframes The current keyframe list
 * @param atFrame Where the new blank space starts
 * @param span How many frames of room to open up
 * @returns The updated list, or the same list unchanged when `span` isn't positive
 */
export const insertFrameRangeIntoList = (
  keyframes: PoseKeyframe[],
  atFrame: number,
  span: number
): PoseKeyframe[] => {
  if (span <= 0) return keyframes
  return keyframes.map((keyframe) =>
    keyframe.frame >= atFrame ? { ...keyframe, frame: keyframe.frame + span } : keyframe
  )
}
