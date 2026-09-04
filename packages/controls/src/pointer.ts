import type { ControlHandlers, ControlMapping, PointerGesture } from './types'

export interface PointerController {
  bind: (target: HTMLElement) => void
  unbind: (target: HTMLElement) => void
  /**
   * How far a press in progress has travelled, signed and relative to the target's own
   * width: 0 while idle, growing towards 1 (right) or -1 (left) as the press nears the far
   * edge. Read every frame by anything that wants a gesture to drive an animation as it
   * happens rather than only once the press ends.
   */
  getDragProgress: () => number
}

/** How far a pointer travels before a press counts as a swipe rather than a tap. */
export const DEFAULT_SWIPE_THRESHOLD_PIXELS = 40

/**
 * Reads a press and release as one gesture.
 *
 * Travel decides first, on whichever axis moved furthest: past the threshold it is a
 * swipe in that direction. Only a press that stayed put on both axes falls through to a
 * tap, which is read horizontally and named by the half of the target it landed in. A
 * target with no width cannot name a half, so a tap on one is no gesture at all rather
 * than a guess.
 * @param start - Where the press began, in pixels from the target's top left corner
 * @param end - Where it was released, in the same coordinates
 * @param targetWidth - The target's width in pixels
 * @param swipeThresholdPixels - Travel at or past which the press is a swipe
 * @returns The gesture, or null when the target is too small to read one
 */
export const resolvePointerGesture = (
  start: { x: number; y: number },
  end: { x: number; y: number },
  targetWidth: number,
  swipeThresholdPixels: number = DEFAULT_SWIPE_THRESHOLD_PIXELS
): PointerGesture | null => {
  if (targetWidth <= 0) return null
  const travelX = end.x - start.x
  const travelY = end.y - start.y
  if (Math.abs(travelY) > Math.abs(travelX) && Math.abs(travelY) >= swipeThresholdPixels) {
    return travelY > 0 ? 'swipe-down' : 'swipe-up'
  }
  if (Math.abs(travelX) >= swipeThresholdPixels) {
    return travelX > 0 ? 'swipe-right' : 'swipe-left'
  }
  return end.x < targetWidth / 2 ? 'tap-left' : 'tap-right'
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
  let startY = 0
  let targetWidth = 0
  let dragProgress = 0

  const onPointerDown = (event: PointerEvent, target: HTMLElement) => {
    if (activePointerId !== null) return
    activePointerId = event.pointerId
    startX = event.clientX
    startY = event.clientY
    targetWidth = target.getBoundingClientRect().width
    dragProgress = 0
  }

  const onPointerMove = (event: PointerEvent) => {
    if (activePointerId !== event.pointerId || targetWidth <= 0) return
    dragProgress = Math.min(Math.max((event.clientX - startX) / targetWidth, -1), 1)
  }

  const finish = (event: PointerEvent, target: HTMLElement) => {
    if (activePointerId !== event.pointerId) return
    activePointerId = null
    const bounds = target.getBoundingClientRect()
    const gesture = resolvePointerGesture(
      { x: startX - bounds.left, y: startY - bounds.top },
      { x: event.clientX - bounds.left, y: event.clientY - bounds.top },
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

  let boundDown: ((event: PointerEvent) => void) | null = null
  let boundMove: ((event: PointerEvent) => void) | null = null
  let boundUp: ((event: PointerEvent) => void) | null = null

  function bind(target: HTMLElement) {
    boundDown = (event: PointerEvent) => onPointerDown(event, target)
    boundMove = onPointerMove
    boundUp = (event: PointerEvent) => finish(event, target)
    target.addEventListener('pointerdown', boundDown)
    target.addEventListener('pointermove', boundMove)
    target.addEventListener('pointerup', boundUp)
    target.addEventListener('pointercancel', onPointerCancel)
  }

  function unbind(target: HTMLElement) {
    if (boundDown) target.removeEventListener('pointerdown', boundDown)
    if (boundMove) target.removeEventListener('pointermove', boundMove)
    if (boundUp) target.removeEventListener('pointerup', boundUp)
    target.removeEventListener('pointercancel', onPointerCancel)
    boundDown = null
    boundMove = null
    boundUp = null
    activePointerId = null
  }

  const getDragProgress = () => (activePointerId !== null ? dragProgress : 0)

  return { bind, unbind, getDragProgress }
}
