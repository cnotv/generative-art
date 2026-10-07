import { IMPULSE_COOLDOWN_SECONDS, RAMP_HOP, ROUTE_EFFECTS } from '../config'
import { effectSpeedRatio, startEffect, tickEffect } from './routeAdvantage'
import type { LaneOutcome, Racer } from '../types'

type RacerStep = {
  baseSpeed: number
  deltaSeconds: number
  elapsedSeconds: number
  finishDistance: number
}

export const createRacer = (): Racer => ({
  distance: 0,
  effect: null,
  hopRemaining: 0,
  finishSeconds: null
})

/** Rolls a ball on for one frame at its current speed, stopping it on the finish line. */
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

/** The player's impulse: a burst of speed that wears off like any other change. */
export const applyImpulse = (racer: Racer): Racer =>
  racer.finishSeconds === null
    ? { ...racer, effect: { outcome: 'impulse', remaining: ROUTE_EFFECTS.impulse.seconds } }
    : racer

/** How far the impulse has recharged, from 0 just used to 1 ready, given the seconds since. */
export const impulseCharge = (secondsSince: number): number =>
  Math.min(1, Math.max(0, secondsSince / IMPULSE_COOLDOWN_SECONDS))

/** What a lane did to the ball: a new speed change, and a hop off a ramp. */
export const applyOutcome = (racer: Racer, outcome: LaneOutcome): Racer => ({
  ...racer,
  effect: startEffect(outcome) ?? racer.effect,
  hopRemaining: outcome === 'boost' ? RAMP_HOP.seconds : racer.hopRemaining
})

/** How high a ball is off the deck: a single arc over the hop's seconds, flat once landed. */
export const hopHeight = (racer: Racer): number =>
  racer.hopRemaining > 0
    ? Math.sin(Math.PI * (1 - racer.hopRemaining / RAMP_HOP.seconds)) * RAMP_HOP.height
    : 0
