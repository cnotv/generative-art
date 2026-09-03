/** The three phases one picture change is made of, in the order they run. */
export type SlidePhase = 'hold' | 'release' | 'arrive'

/** Which way a change travels: 1 carries the old picture out to the right, -1 to the left. */
export type SlideDirection = 1 | -1

/** What one picture is doing this frame, and therefore where it is drawn. */
export type CanvasRole = 'held' | 'leaving' | 'arriving' | 'hidden'

/** How long each phase of a single picture change lasts, in seconds. */
export interface SlideshowTiming {
  hold: number
  release: number
  arrive: number
  /**
   * Where, as a fraction of its own phase, a leaving or arriving picture's fade begins
   * and ends. Both default to the full 0 to 1 span; narrowing them holds a picture fully
   * opaque or fully gone for part of the phase instead of fading across the whole thing.
   */
  fadeStart: number
  fadeEnd: number
}

/**
 * Where the slideshow has got to.
 *
 * `index` is the picture arriving or already on display, so it is correct the
 * moment a change starts rather than at the end of one; `leavingIndex` is the
 * picture it replaced, and only means anything while a change is running.
 */
export interface SlideshowState {
  index: number
  leavingIndex: number
  direction: SlideDirection
  /** Seconds into the running change, or null while simply holding. */
  changeSeconds: number | null
  /** Seconds held since the last change, which is what the automatic advance watches. */
  holdSeconds: number
}

/** Everything the scene needs to place every picture and both arms for one frame. */
export interface SlideshowFrame {
  phase: SlidePhase
  /** How far through its own phase this frame is, from 0 to 1. */
  phaseProgress: number
  direction: SlideDirection
  /** The picture in the stickman's hands, or null while both hands are empty. */
  heldIndex: number | null
  /** The picture on its way out of frame, or null while nothing is leaving. */
  leavingIndex: number | null
  /** Seconds since the leaving picture was let go, for fading it out. */
  leftSeconds: number
}

/**
 * One character the slideshow can run, whichever rig it happens to be.
 *
 * `pose` receives the full frame so either kind of rig can read whatever it needs from
 * it: a rig the slideshow drives itself works out its own hold amount, and a clip-driven
 * rig reads the phase to know when a click or swipe has fired and its clip should play.
 * `heldPoint` is the one thing every rig must answer: where the picture hangs this frame.
 */
export interface SlideshowCharacter {
  model: import('three').Object3D
  mixer: import('three').AnimationMixer | null
  pose: (frame: SlideshowFrame) => void
  heldPoint: (target: import('three').Vector3) => void
}
