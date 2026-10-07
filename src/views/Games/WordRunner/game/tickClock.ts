import { MAX_FRAME_SECONDS } from '../config'

// Rapier's default rate. The step is kept fixed, since one long step under the ball's heavy
// gravity carries it straight through the deck.
const PHYSICS_STEPS_PER_SECOND = 60
const PHYSICS_STEP_SECONDS = 1 / PHYSICS_STEPS_PER_SECOND

/**
 * Seconds between the scene loop's ticks. The loop's own delta is the last animation frame
 * alone, which on a fast display is a fraction of the time a tick stands for, and its physics
 * step is a fixed sixtieth whatever the frame rate. Timing ticks directly, and stepping the world
 * as often as the tick lasted, keeps the player's physics ball, the bot and the clock on the same
 * time on any device.
 */
export const createTickClock = (now: () => number = () => performance.now()) => {
  let lastTick: number | null = null
  return (): number => {
    const tick = now()
    const seconds = lastTick === null ? PHYSICS_STEP_SECONDS : (tick - lastTick) / 1000
    lastTick = tick
    return Math.min(Math.max(seconds, 0), MAX_FRAME_SECONDS)
  }
}

/** The physics steps a tick needs on top of the one the scene loop already took. */
export const catchUpSteps = (tickSeconds: number): number =>
  Math.max(0, Math.round(tickSeconds * PHYSICS_STEPS_PER_SECOND) - 1)
