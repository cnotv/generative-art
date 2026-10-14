import { IMPULSE_COOLDOWN_SECONDS, RAMP_HOP, ROUTE_EFFECTS } from '../config'
import { effectSpeedRatio, startEffect, tickEffect } from './routeAdvantage'
import type { LaneOutcome, Racer } from '../types'

type RacerStep = {
  baseSpeed: number
  deltaSeconds: number
  elapsedSeconds: number
  finishDistance: number
}

/**
 * A racer on the start line, with no effect, hop or finish.
 * @returns The racer.
 */
export const createRacer = (): Racer => ({
  distance: 0,
  effect: null,
  hopRemaining: 0,
  finishSeconds: null
})

/**
 * Rolls a ball on for one frame at its current speed, stopping it on the finish line.
 * @param racer The racer.
 * @returns The racer after the frame.
 */
export const stepRacer = (
  racer: Racer,
  { baseSpeed, deltaSeconds, elapsedSeconds, finishDistance }: RacerStep
): Racer => {
  if (racer.finishSeconds !== null) return racer
  const distance = Math.min(
    finishDistance,
    racer.distance + baseSpeed * effectSpeedRatio(racer.effect) * deltaSeconds
  )
  return {
    distance,
    effect: tickEffect(racer.effect, deltaSeconds),
    hopRemaining: Math.max(0, racer.hopRemaining - deltaSeconds),
    finishSeconds: distance >= finishDistance ? elapsedSeconds : null
  }
}

type RacerFollow = Omit<RacerStep, 'baseSpeed'>

/**
 * Keeps a racer in step with a ball that moves on its own, under physics: its distance is the
 * ball's, while its speed change still wears off and its finish is still recorded.
 * @param racer The racer.
 * @param ballDistance The physics ball's distance along the track.
 * @returns The racer after the frame.
 */
export const followRacer = (
  racer: Racer,
  ballDistance: number,
  { deltaSeconds, elapsedSeconds, finishDistance }: RacerFollow
): Racer => {
  if (racer.finishSeconds !== null) return racer
  const distance = Math.min(finishDistance, ballDistance)
  return {
    distance,
    effect: tickEffect(racer.effect, deltaSeconds),
    hopRemaining: Math.max(0, racer.hopRemaining - deltaSeconds),
    finishSeconds: distance >= finishDistance ? elapsedSeconds : null
  }
}

/**
 * The player's impulse: a burst of speed that wears off like any other change.
 * @param racer The racer.
 * @returns The racer with the impulse, unchanged once finished.
 */
export const applyImpulse = (racer: Racer): Racer =>
  racer.finishSeconds === null
    ? { ...racer, effect: { outcome: 'impulse', remaining: ROUTE_EFFECTS.impulse.seconds } }
    : racer

/**
 * How far the impulse has recharged, from 0 just used to 1 ready, given the seconds since.
 * @param secondsSince Seconds since the impulse was used.
 * @returns The charge, from 0 to 1.
 */
export const impulseCharge = (secondsSince: number): number =>
  Math.min(1, Math.max(0, secondsSince / IMPULSE_COOLDOWN_SECONDS))

/**
 * What a lane did to the ball: a new speed change, and a hop off a ramp.
 * @param racer The racer.
 * @param outcome What the lane does.
 * @returns The racer with the outcome applied.
 */
export const applyOutcome = (racer: Racer, outcome: LaneOutcome): Racer => ({
  ...racer,
  effect: startEffect(outcome) ?? racer.effect,
  hopRemaining: outcome === 'boost' ? RAMP_HOP.seconds : racer.hopRemaining
})

/**
 * How high a ball is off the deck: a single arc over the hop's seconds, flat once landed.
 * @param racer The racer.
 * @returns The height above the deck.
 */
export const hopHeight = (racer: Racer): number =>
  racer.hopRemaining > 0
    ? Math.sin(Math.PI * (1 - racer.hopRemaining / RAMP_HOP.seconds)) * RAMP_HOP.height
    : 0
