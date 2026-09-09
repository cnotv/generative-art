/** An inclusive frame range, always normalized so `start <= end` regardless of which end the
 * user actually dragged from. */
export interface FrameSelectionRange {
  start: number
  end: number
}

/**
 * Normalize a drag/shift-click/shift-arrow's two endpoints into an ordered range. Either
 * endpoint being `null` (nothing selected yet) means there is no active selection at all.
 * @param anchorFrame The end that stays fixed while the other one moves
 * @param activeFrame The end that is currently being dragged or extended
 * @returns The ordered range, or `null` when no selection is active
 */
export const computeSelectionRange = (
  anchorFrame: number | null,
  activeFrame: number | null
): FrameSelectionRange | null =>
  anchorFrame === null || activeFrame === null
    ? null
    : { start: Math.min(anchorFrame, activeFrame), end: Math.max(anchorFrame, activeFrame) }

/** Whether `frame` falls inside `range`, inclusive of both ends. */
export const frameIsSelected = (range: FrameSelectionRange | null, frame: number): boolean =>
  range !== null && frame >= range.start && frame <= range.end

/** Every keyframe frame from `keyframeFrames` that falls inside `range`. */
export const keyframesInRange = (
  range: FrameSelectionRange | null,
  keyframeFrames: number[]
): number[] =>
  range === null ? [] : keyframeFrames.filter((frame) => frameIsSelected(range, frame))
