/** The three phases one picture change is made of, in the order they run. */
export type SlidePhase = 'hold' | 'drop' | 'lift'

/** What one picture is doing this frame, and therefore where it is drawn. */
export type CanvasRole = 'held' | 'waiting' | 'falling' | 'hidden'

/** How long each phase of a single picture change lasts, in seconds. */
export interface SlideshowTiming {
  hold: number
  drop: number
  lift: number
}

/** Everything the scene needs to place every picture and both arms for one frame. */
export interface SlideshowFrame {
  phase: SlidePhase
  /** How far through its own phase this frame is, from 0 to 1. */
  phaseProgress: number
  /** The picture in the stickman's hands, or null while both hands are empty. */
  heldIndex: number | null
  /** The picture standing on the floor, waiting its turn. */
  waitingIndex: number
  /** The released picture on its way out of frame, or null while nothing is falling. */
  fallingIndex: number | null
  /** Seconds since the falling picture was let go, for integrating its fall. */
  fallSeconds: number
}
