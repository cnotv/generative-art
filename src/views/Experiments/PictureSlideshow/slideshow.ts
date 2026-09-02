import type {
  CanvasRole,
  ExitConfig,
  FlightOffset,
  GesturePose,
  SlideDirection,
  SlideshowFrame,
  SlideshowState,
  SlideshowTiming
} from './types'

/**
 * How much of a phase's own progress is spent crossfading, at its start or its end.
 *
 * A rig driven by clips switches between a continuous hold loop and a one-shot push
 * gesture; cutting between them at full weight pops, so each switch fades over this
 * fraction of whichever phase it happens in rather than over a fixed number of seconds
 * — which is what lets it hold up whether release and arrive are tuned to a third of a
 * second or three.
 */
const GESTURE_CROSSFADE_FRACTION = 0.2

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
 * How far along its exit a released picture has travelled, from 0 to 1.
 *
 * Eased in rather than linear, so it leaves the hands slowly and is flung the rest of
 * the way. Reaches 1 by the end of the release and stays there through the arrival —
 * the picture is already gone by then, not still travelling.
 * @param frame - The current frame
 * @param timing - How long each phase lasts
 * @returns The fraction of the exit travelled
 */
export const exitAmountAt = (frame: SlideshowFrame, timing: SlideshowTiming): number => {
  const progress = Math.min(frame.leftSeconds, timing.release) / timing.release
  return progress * progress
}

/**
 * How much of its entrance an arriving picture still has left to make, from 1 to 0.
 *
 * The exact same eased shape as `exitAmountAt`, run backward across the arrival's own
 * duration instead of forward across the release's — the entrance is a reverse of the
 * exit, not a separately timed effect.
 * @param frame - The current frame, expected to be in the arrive phase
 * @returns The fraction of the entrance still to go
 */
export const entryAmountAt = (frame: SlideshowFrame): number => {
  const remaining = 1 - frame.phaseProgress
  return remaining * remaining
}

/**
 * Where a picture sits relative to the held position, partway through flying clear of
 * the hands or back into them.
 *
 * The same shape serves both directions: an arriving picture is placed by calling this
 * with the throw's direction flipped, so its path is a mirror of the departure's rather
 * than a curve authored separately.
 * @param direction - Which way the picture is travelling: the throw's own direction when
 * leaving, the opposite when arriving
 * @param amount - How far into the flight this is, from 0 at the hands to 1 fully away
 * @param exit - How far, how steeply and how hard the picture flies
 * @returns The offset to add to the held position
 */
export const flightOffset = (
  direction: SlideDirection,
  amount: number,
  exit: ExitConfig
): FlightOffset => ({
  x: direction * exit.distance * amount,
  y: -exit.drop * amount,
  rotationZ: -direction * exit.spin * amount
})

/**
 * How a clip-driven rig should blend between its hold loop, its throw and its catch.
 *
 * Release throws the old picture clear, playing the throw's own direction forward.
 * Arrive catches the new one, playing the *opposite* direction backward, since it is
 * entering from the side release just emptied, not the side it was thrown towards. The
 * hand-off between the two happens inside release's own last fifth, blending throw's
 * weight down to nothing as catch's blends up to full — a plain weighted average
 * between two clips posing the same bones swings the arm across from one extended
 * pose to the other, rather than cutting. Arrive then carries that catch weight
 * through its own length before crossfading into hold at the very end, mirroring how
 * hold first crossfades into release.
 * @param frame - The current frame
 * @returns The weight and scrub position for the hold loop and each push clip
 */
export const gesturePoseAt = (frame: SlideshowFrame): GesturePose => {
  if (frame.phase === 'hold') {
    return {
      holdWeight: 1,
      pushRightWeight: 0,
      pushRightProgress: 0,
      pushLeftWeight: 0,
      pushLeftProgress: 0
    }
  }

  const progress = frame.phaseProgress
  const fadeIn = Math.min(progress / GESTURE_CROSSFADE_FRACTION, 1)
  const fadeOut = Math.max(
    (progress - (1 - GESTURE_CROSSFADE_FRACTION)) / GESTURE_CROSSFADE_FRACTION,
    0
  )

  // `throw` is whichever side this whole change is travelling towards; `catch` is the
  // opposite side, where the arriving picture is. Release runs throw forward and, in
  // its own last fifth, swings across into catch; arrive just carries catch the rest
  // of the way and fades it into hold.
  const { holdWeight, throwWeight, throwProgress, catchWeight, catchProgress } =
    frame.phase === 'release'
      ? {
          holdWeight: 1 - fadeIn,
          throwWeight: fadeIn - fadeOut,
          throwProgress: progress,
          catchWeight: fadeOut,
          catchProgress: 1
        }
      : {
          holdWeight: fadeOut,
          throwWeight: 0,
          throwProgress: 0,
          catchWeight: 1 - fadeOut,
          catchProgress: 1 - progress
        }

  const throwsRight = frame.direction === 1
  return {
    holdWeight,
    pushRightWeight: throwsRight ? throwWeight : catchWeight,
    pushRightProgress: throwsRight ? throwProgress : catchProgress,
    pushLeftWeight: throwsRight ? catchWeight : throwWeight,
    pushLeftProgress: throwsRight ? catchProgress : throwProgress
  }
}

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
