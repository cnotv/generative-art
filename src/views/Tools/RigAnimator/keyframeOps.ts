import type { Pose, PoseKeyframe } from '@webgamekit/rig'

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

const posePickingBones = (pose: Pose, isInScope: (boneName: string) => boolean): Pose =>
  Object.fromEntries(Object.entries(pose).filter(([boneName]) => isInScope(boneName)))

/**
 * Merge a source's sampled keyframes into the existing timeline, touching only the bones in
 * `boneNamesInScope`. Every existing keyframe first has its in-scope bones stripped out
 * (dropping a keyframe left with none), so a group already posed from an earlier source is
 * replaced rather than mixed with the new one; the sampled keyframes' own in-scope bones are
 * then merged in at their own frames, alongside whatever an existing keyframe there still
 * carries for other bones. Every bone in scope, the case when nothing is actually being
 * narrowed down, degenerates to a full replace: every existing keyframe ends up empty and
 * dropped, leaving only the sampled keyframes.
 * @param existingKeyframes The timeline's current keyframes
 * @param sampledKeyframes The new source's own keyframes, at its own frame numbers
 * @param boneNamesInScope Which bones this source is allowed to touch
 * @returns The merged keyframe list
 */
export const mergeSampledKeyframesIntoScope = (
  existingKeyframes: PoseKeyframe[],
  sampledKeyframes: PoseKeyframe[],
  boneNamesInScope: Set<string>
): PoseKeyframe[] => {
  const isInScope = (boneName: string): boolean => boneNamesInScope.has(boneName)
  const isOutOfScope = (boneName: string): boolean => !isInScope(boneName)

  const withoutScope = existingKeyframes
    .map((keyframe) => ({
      frame: keyframe.frame,
      pose: posePickingBones(keyframe.pose, isOutOfScope)
    }))
    .filter((keyframe) => Object.keys(keyframe.pose).length > 0)

  const scopedSampled = sampledKeyframes
    .map((keyframe) => ({
      frame: keyframe.frame,
      pose: posePickingBones(keyframe.pose, isInScope)
    }))
    .filter((keyframe) => Object.keys(keyframe.pose).length > 0)

  return scopedSampled.reduce<PoseKeyframe[]>((merged, scopedKeyframe) => {
    const existingAtFrame = merged.find((keyframe) => keyframe.frame === scopedKeyframe.frame)
    if (!existingAtFrame) return [...merged, scopedKeyframe]
    return merged.map((keyframe) =>
      keyframe.frame === scopedKeyframe.frame
        ? { frame: keyframe.frame, pose: { ...keyframe.pose, ...scopedKeyframe.pose } }
        : keyframe
    )
  }, withoutScope)
}
