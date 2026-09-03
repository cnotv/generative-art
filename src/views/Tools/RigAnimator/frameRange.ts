import { FRAME_MAX_MIN } from './config'

/**
 * Clamp a requested frame range so the rig timeline never shrinks past whichever is furthest
 * out: the current frame, the last keyframe, or the configured floor.
 * @param nextFrameMax The frame range a resize drag is asking for
 * @param currentFrame The panel's current frame, which must always stay visible
 * @param keyframeFrames Every frame a pose keyframe already exists at
 * @returns The frame range to actually use
 */
export const clampFrameMax = (
  nextFrameMax: number,
  currentFrame: number,
  keyframeFrames: number[]
): number => {
  const floor = Math.max(FRAME_MAX_MIN, currentFrame, ...keyframeFrames)
  return Math.max(floor, Math.round(nextFrameMax))
}
