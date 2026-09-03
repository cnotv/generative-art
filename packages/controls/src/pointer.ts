import type { ControlHandlers, ControlMapping, PointerGesture } from './types'

export interface PointerController {
  bind: (target: HTMLElement) => void
  unbind: (target: HTMLElement) => void
}

/** How far a pointer travels before a press counts as a swipe rather than a tap. */
export const DEFAULT_SWIPE_THRESHOLD_PIXELS = 40

/**
 * Reads a press and release as one of four horizontal gestures.
 *
 * Travel decides first: past the threshold it is a swipe, whichever half of the
 * target it happened in. Only a press that stayed put falls through to a tap,
 * which is then named by the half it landed in. A target with no width cannot
 * name a half, so a tap on one is no gesture at all rather than a guess.
 * @param startX - Where the press began, in pixels from the target's left edge
 * @param endX - Where it was released, in the same coordinates
 * @param targetWidth - The target's width in pixels
 * @param swipeThresholdPixels - Travel at or past which the press is a swipe
 * @returns The gesture, or null when the target is too small to read one
 */
export const resolvePointerGesture = (
  startX: number,
  endX: number,
  targetWidth: number,
  swipeThresholdPixels: number = DEFAULT_SWIPE_THRESHOLD_PIXELS
): PointerGesture | null => {
  if (targetWidth <= 0) return null
  const travel = endX - startX
  if (Math.abs(travel) >= swipeThresholdPixels) {
    return travel > 0 ? 'swipe-right' : 'swipe-left'
  }
  return endX < targetWidth / 2 ? 'tap-left' : 'tap-right'
}

/**
 * Horizontal tap and swipe gestures, over mouse, touch and pen alike.
 *
 * Pointer events are one stream for all three, so a page does not need a
 * separate touch path and a mouse path that can disagree. Only the press that
 * opened the gesture is followed, so a second finger landing mid-swipe cannot
 * end it somewhere the first one never went.
 * @param mappingReference - The live mapping, read at the moment a gesture completes
 * @param mappingReference.current - The mapping itself
 * @param handlers - Where a resolved gesture is reported
 * @param swipeThresholdPixels - Travel at or past which a press is a swipe
 * @returns The controller, to bind against the element gestures are read from
 */
export function createPointerController(
  mappingReference: { current: ControlMapping },
  handlers: ControlHandlers,
  swipeThresholdPixels: number = DEFAULT_SWIPE_THRESHOLD_PIXELS
): PointerController {
  let activePointerId: number | null = null
  let startX = 0

  const onPointerDown = (event: PointerEvent) => {
    if (activePointerId !== null) return
    activePointerId = event.pointerId
    startX = event.clientX
  }

  const finish = (event: PointerEvent, target: HTMLElement) => {
    if (activePointerId !== event.pointerId) return
    activePointerId = null
    const bounds = target.getBoundingClientRect()
    const gesture = resolvePointerGesture(
      startX - bounds.left,
      event.clientX - bounds.left,
      bounds.width,
      swipeThresholdPixels
    )
    if (!gesture) return
    const action = mappingReference.current.pointer?.[gesture]
    if (!action) return
    handlers.onAction(action, gesture, 'pointer')
    handlers.onRelease(action, gesture, 'pointer')
  }

  const onPointerCancel = (event: PointerEvent) => {
    if (activePointerId === event.pointerId) activePointerId = null
  }

  let boundUp: ((event: PointerEvent) => void) | null = null

  function bind(target: HTMLElement) {
    boundUp = (event: PointerEvent) => finish(event, target)
    target.addEventListener('pointerdown', onPointerDown)
    target.addEventListener('pointerup', boundUp)
    target.addEventListener('pointercancel', onPointerCancel)
  }

  function unbind(target: HTMLElement) {
    target.removeEventListener('pointerdown', onPointerDown)
    if (boundUp) target.removeEventListener('pointerup', boundUp)
    target.removeEventListener('pointercancel', onPointerCancel)
    boundUp = null
    activePointerId = null
  }

  return { bind, unbind }
}
