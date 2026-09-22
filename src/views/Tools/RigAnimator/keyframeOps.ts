import * as THREE from 'three'
import type { Pose, PoseKeyframe, QuaternionData } from '@webgamekit/rig'
import { isBoneRollFlip } from './boneRollTracking'
import { CAMERA_ROLL_FLIP_DEGREES } from './config'

const ROLL_FLIP_RADIANS = THREE.MathUtils.degToRad(CAMERA_ROLL_FLIP_DEGREES)

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

/**
 * Swap every keyframe from `fromFrame` to `toFrame`, both included, for `replacements`, leaving
 * keyframes outside that range as they were.
 * @param keyframes The current keyframe list
 * @param fromFrame The first frame of the range
 * @param toFrame The last frame of the range
 * @param replacements The keyframes to put in its place
 * @returns The updated list
 */
export const replaceKeyframesInRange = (
  keyframes: PoseKeyframe[],
  fromFrame: number,
  toFrame: number,
  replacements: PoseKeyframe[]
): PoseKeyframe[] => [
  ...keyframes.filter((keyframe) => keyframe.frame < fromFrame || keyframe.frame > toFrame),
  ...replacements
]

const toQuaternion = ({ x, y, z, w }: QuaternionData): THREE.Quaternion =>
  new THREE.Quaternion(x, y, z, w)

/**
 * One rotation standing for several samples of the same bone. Three or more keep the sample
 * closest to all the others, which drops a single misread one outright rather than averaging it
 * in; two, too few to tell which is wrong, meet halfway.
 */
const filterRotationSamples = (rotations: QuaternionData[]): QuaternionData => {
  if (rotations.length === 1) return rotations[0]
  const quaternions = rotations.map(toQuaternion)
  const filtered =
    quaternions.length === 2
      ? quaternions[0].clone().slerp(quaternions[1], 0.5)
      : quaternions.reduce((best, candidate) => {
          const spread = (quaternion: THREE.Quaternion): number =>
            quaternions.reduce((sum, other) => sum + quaternion.angleTo(other), 0)
          return spread(candidate) < spread(best) ? candidate : best
        })
  return { x: filtered.x, y: filtered.y, z: filtered.z, w: filtered.w }
}

/**
 * Turn the poses Record Motion sampled between frames into one keyframe per frame. Each frame
 * takes every sample within half a frame of it, so at two samples per frame a frame is decided by
 * the sample on it and the two either side, see `filterRotationSamples`. A frame with no sample
 * near it gets no keyframe and is interpolated like any other gap.
 * @param samples Poses at fractional frames, in any order
 * @returns One filtered keyframe per frame that had samples, in frame order
 */
export const filterRecordedSamples = (samples: PoseKeyframe[]): PoseKeyframe[] => {
  const byFrame = samples.reduce((groups, sample) => {
    const frames = Array.from(
      { length: Math.floor(sample.frame + 0.5) - Math.ceil(sample.frame - 0.5) + 1 },
      (_, offset) => Math.ceil(sample.frame - 0.5) + offset
    )
    frames.forEach((frame) => groups.set(frame, [...(groups.get(frame) ?? []), sample.pose]))
    return groups
  }, new Map<number, Pose[]>())
  return [...byFrame.entries()]
    .sort(([a], [b]) => a - b)
    .map(([frame, poses]) => ({
      frame,
      pose: Object.fromEntries(
        [...new Set(poses.flatMap((pose) => Object.keys(pose)))].map((boneName) => [
          boneName,
          filterRotationSamples(poses.flatMap((pose) => (pose[boneName] ? [pose[boneName]] : [])))
        ])
      )
    }))
}

const toQuaternionData = ({ x, y, z, w }: THREE.Quaternion): QuaternionData => ({ x, y, z, w })

/** The keyframes in `frames`, in frame order, with each one's index in that order. */
const scopedKeyframes = (keyframes: PoseKeyframe[], frames: number[]): PoseKeyframe[] => {
  const scope = new Set(frames)
  return keyframes
    .filter((keyframe) => scope.has(keyframe.frame))
    .sort((first, second) => first.frame - second.frame)
}

/**
 * One bone's rotation at a keyframe, filtered against the keyframes either side of it. A keyframe
 * that only differs from its neighbours by having spun the bone about its own length is dropped
 * for their midpoint rather than eased toward: that is a flipped twist cue rather than a
 * movement, see `isBoneRollFlip`, and easing halfway to it drags the clean keyframes over too.
 */
const filterBoneBetweenNeighbours = (
  previous: QuaternionData,
  current: QuaternionData,
  next: QuaternionData
): QuaternionData => {
  const between = toQuaternion(previous).slerp(toQuaternion(next), 0.5)
  if (isBoneRollFlip(between, toQuaternion(current), ROLL_FLIP_RADIANS)) {
    return toQuaternionData(between)
  }
  const outvoted = toQuaternion(filterRotationSamples([previous, current, next]))
  return toQuaternionData(between.slerp(outvoted, 0.5))
}

/**
 * Smooth the keyframes in `frames` one pass further. Each keyframe between the first and last of
 * them first drops a spike, keeping whichever of itself and its two neighbours is closest to the
 * other two, then eases halfway toward the midpoint of those neighbours, which softens jitter. A
 * steady movement is left where it is, since its middle keyframe already sits between the other
 * two. The first and last keyframes stay put, so the clip still starts and ends where it did.
 * @param keyframes The current keyframe list
 * @param frames The frames of the keyframes to filter
 * @returns The updated list, or the same list when fewer than three keyframes are in scope
 */
export const filterKeyframesInList = (
  keyframes: PoseKeyframe[],
  frames: number[]
): PoseKeyframe[] => {
  const scoped = scopedKeyframes(keyframes, frames)
  if (scoped.length < 3) return keyframes
  const filtered = new Map(
    scoped.slice(1, -1).map((keyframe, index) => {
      const previous = scoped[index].pose
      const next = scoped[index + 2].pose
      const pose = Object.fromEntries(
        Object.entries(keyframe.pose).map(([boneName, rotation]) => [
          boneName,
          previous[boneName] && next[boneName]
            ? filterBoneBetweenNeighbours(previous[boneName], rotation, next[boneName])
            : rotation
        ])
      )
      return [keyframe.frame, pose] as const
    })
  )
  return keyframes.map((keyframe) => {
    const pose = filtered.get(keyframe.frame)
    return pose ? { ...keyframe, pose } : keyframe
  })
}

/**
 * Halve the keyframes in `frames`: every second one between the first and the last is removed,
 * and interpolation fills the gap. The first and last always stay, so the clip keeps its length.
 * @param keyframes The current keyframe list
 * @param frames The frames of the keyframes to thin out
 * @returns The updated list, or the same list when nothing in scope can be removed
 */
export const reduceKeyframesInList = (
  keyframes: PoseKeyframe[],
  frames: number[]
): PoseKeyframe[] => {
  const scoped = scopedKeyframes(keyframes, frames)
  if (scoped.length < 3) return keyframes
  const removed = new Set(
    scoped
      .slice(1, -1)
      .filter((_, index) => index % 2 === 0)
      .map((keyframe) => keyframe.frame)
  )
  return keyframes.filter((keyframe) => !removed.has(keyframe.frame))
}
