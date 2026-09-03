import type {
  CanvasRole,
  SlideDirection,
  SlideshowFrame,
  SlideshowState,
  SlideshowTiming
} from './types'

/**
 * Smoothstep, so an arm starts and stops moving rather than snapping into and
 * out of full speed at the ends of a phase.
 * @param progress - How far through the phase, from 0 to 1
 * @returns The eased position, still from 0 to 1
 */
const ease = (progress: number): number => progress * progress * (3 - 2 * progress)

/** Wrap into [0, count), which `%` alone does not do for a step to the left. */
const wrapIndex = (index: number, slideCount: number): number =>
  ((index % slideCount) + slideCount) % slideCount

/**
 * A slideshow sitting on its first picture, with nothing yet in motion.
 * @returns The opening state
 */
export const createSlideshowState = (): SlideshowState => ({
  index: 0,
  leavingIndex: 0,
  direction: 1,
  changeSeconds: null,
  holdSeconds: 0
})

/**
 * Sends the held picture away and brings its neighbour in behind it.
 *
 * A change already running is left alone rather than restarted: a second swipe
 * arriving mid-flight would otherwise strand the picture halfway out of frame
 * and skip whichever one was on its way in.
 * @param state - Where the slideshow is now
 * @param direction - 1 to send the held picture out to the right, -1 to the left
 * @param slideCount - How many pictures the slideshow cycles through
 * @returns The state with the change started, or the same state if one is running
 */
export const startChange = (
  state: SlideshowState,
  direction: SlideDirection,
  slideCount: number
): SlideshowState => {
  if (state.changeSeconds !== null) return state
  return {
    index: wrapIndex(state.index + direction, slideCount),
    leavingIndex: state.index,
    direction,
    changeSeconds: 0,
    holdSeconds: 0
  }
}

/**
 * Moves the slideshow on by one frame.
 *
 * Holding is what runs the clock towards the automatic advance; a change runs
 * to its own end and cannot be interrupted, so the hold timer only restarts
 * once a picture is settled and actually being looked at.
 * @param state - Where the slideshow is now
 * @param deltaSeconds - Seconds since the previous frame
 * @param timing - How long each phase lasts
 * @param slideCount - How many pictures the slideshow cycles through
 * @returns The state one frame later
 */
export const advanceSlideshow = (
  state: SlideshowState,
  deltaSeconds: number,
  timing: SlideshowTiming,
  slideCount: number
): SlideshowState => {
  if (state.changeSeconds !== null) {
    const changeSeconds = state.changeSeconds + deltaSeconds
    if (changeSeconds < timing.release + timing.arrive) return { ...state, changeSeconds }
    return { ...state, changeSeconds: null, holdSeconds: 0 }
  }
  const holdSeconds = state.holdSeconds + deltaSeconds
  if (holdSeconds < timing.hold) return { ...state, holdSeconds }
  return startChange(state, 1, slideCount)
}

/**
 * Reads the state as the phase, progress and roles the scene draws from.
 * @param state - Where the slideshow is now
 * @param timing - How long each phase lasts
 * @returns Everything one frame needs
 */
export const slideshowFrame = (state: SlideshowState, timing: SlideshowTiming): SlideshowFrame => {
  const { changeSeconds, direction, index, leavingIndex } = state
  if (changeSeconds === null) {
    return {
      phase: 'hold',
      phaseProgress: Math.min(state.holdSeconds / timing.hold, 1),
      direction,
      heldIndex: index,
      leavingIndex: null,
      leftSeconds: 0
    }
  }
  if (changeSeconds < timing.release) {
    return {
      phase: 'release',
      phaseProgress: changeSeconds / timing.release,
      direction,
      heldIndex: null,
      leavingIndex,
      leftSeconds: changeSeconds
    }
  }
  return {
    phase: 'arrive',
    phaseProgress: (changeSeconds - timing.release) / timing.arrive,
    direction,
    heldIndex: index,
    leavingIndex,
    leftSeconds: changeSeconds
  }
}

/**
 * How far the hands are up at the display pose, from 0 empty and lowered to 1 holding.
 *
 * The arriving picture reads the same scalar for its own travel, which is what
 * keeps it in the hands at the end of a change rather than merely near them.
 * @param frame - The current frame
 * @returns The eased amount, from 0 to 1
 */
export const holdAmountAt = ({ phase, phaseProgress }: SlideshowFrame): number => {
  if (phase === 'hold') return 1
  if (phase === 'release') return 1 - ease(phaseProgress)
  return ease(phaseProgress)
}

/**
 * How far a released picture has faded out, from 0 to 1.
 *
 * The picture never leaves the hands any more — the clip's own drop and pick motion
 * carries the hands themselves — so this is what shows a change is happening instead of
 * a travelled distance. Reaches 1 by the end of the release and stays there through the
 * arrival, since the picture is already gone by then rather than still fading.
 * @param frame - The current frame
 * @param timing - How long each phase lasts
 * @returns The fraction faded out
 */
export const exitAmountAt = (frame: SlideshowFrame, timing: SlideshowTiming): number => {
  const progress = Math.min(frame.leftSeconds, timing.release) / timing.release
  return ease(progress)
}

/**
 * How much of its fade-in an arriving picture still has left to make, from 1 to 0.
 *
 * The exact same eased shape as `exitAmountAt`, run backward across the arrival's own
 * duration instead of forward across the release's — the entrance is a reverse of the
 * exit, not a separately timed effect.
 * @param frame - The current frame, expected to be in the arrive phase
 * @returns The fraction of the fade-in still to go
 */
export const entryAmountAt = (frame: SlideshowFrame): number => ease(1 - frame.phaseProgress)

/**
 * What one picture is doing this frame, so the scene can place it or hide it.
 * @param frame - The current frame
 * @param slideIndex - The picture being asked about
 * @returns Its role, or 'hidden' when it has none
 */
export const canvasRoleAt = (frame: SlideshowFrame, slideIndex: number): CanvasRole => {
  if (slideIndex === frame.leavingIndex) return 'leaving'
  if (slideIndex === frame.heldIndex) return frame.phase === 'hold' ? 'held' : 'arriving'
  return 'hidden'
}
