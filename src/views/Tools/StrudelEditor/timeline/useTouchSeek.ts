import type { Ref } from 'vue'
import { STRUDEL_TIMELINE_SEEK_STEP, STRUDEL_TIMELINE_TAP_SLOP } from '../config'
import type { TimelineTouchGesture } from '../types'
import { cycleAtClientX, movedBeyondSlop } from './touchSeek'

/**
 * Touch handling for the timeline, kept away from the slider entirely. Chromium captures a
 * touch to the element it lands on by itself, and the slider takes any captured move as a drag,
 * so a swipe meant to scroll would drag the playhead. Here a touch on the playhead's grip drags
 * it, a tap anywhere seeks, and any other touch is left to the browser to scroll with.
 * @param trackElement The element the slider spans, to map a point to a cycle.
 * @param readTimelineBars The number of cycles the track shows.
 * @param seek Called with the cycle to move the playhead to.
 * @returns Capture-phase pointer handlers for the track element.
 */
export const useTouchSeek = (
  trackElement: Ref<HTMLElement | null>,
  readTimelineBars: () => number,
  seek: (cycle: number) => void
) => {
  let gesture: TimelineTouchGesture | null = null

  const seekToClientX = (clientX: number): void => {
    const track = trackElement.value
    if (track === null) {
      return
    }
    const { left, width } = track.getBoundingClientRect()
    seek(
      cycleAtClientX({
        clientX,
        trackLeft: left,
        trackWidth: width,
        timelineBars: readTimelineBars(),
        seekStep: STRUDEL_TIMELINE_SEEK_STEP
      })
    )
  }

  const isOwnTouch = (event: PointerEvent): boolean => gesture?.pointerId === event.pointerId

  const onPointerDown = (event: PointerEvent): void => {
    if (event.pointerType !== 'touch') {
      return
    }
    event.stopPropagation()
    const onPlayhead =
      event.target instanceof Element && event.target.closest('[role="slider"]') !== null
    gesture = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      kind: onPlayhead ? 'drag' : 'tap'
    }
  }

  const onPointerMove = (event: PointerEvent): void => {
    if (!isOwnTouch(event)) {
      return
    }
    event.stopPropagation()
    if (gesture?.kind === 'drag') {
      seekToClientX(event.clientX)
    }
  }

  const onPointerUp = (event: PointerEvent): void => {
    const finished = gesture
    if (finished === null || !isOwnTouch(event)) {
      return
    }
    gesture = null
    event.stopPropagation()
    if (finished.kind === 'drag' || !movedBeyondSlop(finished, event, STRUDEL_TIMELINE_TAP_SLOP)) {
      seekToClientX(event.clientX)
    }
  }

  const onPointerCancel = (event: PointerEvent): void => {
    if (!isOwnTouch(event)) {
      return
    }
    gesture = null
    event.stopPropagation()
  }

  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel }
}
