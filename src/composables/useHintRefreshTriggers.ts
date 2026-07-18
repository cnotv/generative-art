import { onMounted, onUnmounted } from 'vue'
import type { HintRect } from './useMenuFocus'

/**
 * Converts a DOMRect into the plain hint rect stored in hint state.
 *
 * @param rect Bounding rect of the hint's anchor element
 * @returns Plain rect with top, left, width and height
 */
export const toHintRect = (rect: DOMRect): HintRect => ({
  top: rect.top,
  left: rect.left,
  width: rect.width,
  height: rect.height
})

/**
 * Whether two hint rects describe the same box, so hint state is only
 * rewritten when the anchor actually moved.
 *
 * @param first First rect
 * @param second Second rect
 * @returns True when all four measurements match
 */
export const hintRectsEqual = (first: HintRect, second: HintRect): boolean =>
  first.top === second.top &&
  first.left === second.left &&
  first.width === second.width &&
  first.height === second.height

/**
 * Re-runs `refresh` every animation frame so a fixed-position hint chip stays
 * glued to its anchor through any layout shift (images loading, rows swapping,
 * scrolling). `refresh` must early-return when no hint is visible and only
 * write state when the measured rect changed, so idle frames cost nothing.
 *
 * @param refresh Callback that re-measures the hint anchor
 */
export const useHintRefreshTriggers = (refresh: () => void): void => {
  let frameId = 0

  const tick = (): void => {
    refresh()
    frameId = requestAnimationFrame(tick)
  }

  onMounted(() => {
    frameId = requestAnimationFrame(tick)
  })

  onUnmounted(() => {
    cancelAnimationFrame(frameId)
  })
}
