import { describe, it, expect } from 'vitest'
import { RR_ROCK_CONTROLS } from './rockPanel'
import {
  BASE_MAX_SPEED,
  FORWARD_IMPULSE,
  JUMP_COOLDOWN_SECONDS,
  JUMP_IMPULSE,
  MAX_LATERAL_SPEED,
  MAX_SPEED_CEILING,
  ROCK_ANGULAR_DAMPING,
  ROCK_FRICTION,
  ROCK_GRAVITY_SCALE,
  ROCK_LINEAR_DAMPING,
  ROCK_RADIUS,
  ROCK_RESTITUTION,
  SPEED_RAMP_DISTANCE,
  STEER_IMPULSE
} from './config'

type Control = { min?: number; max?: number; step?: number; label: string; color?: boolean }

const controls = RR_ROCK_CONTROLS as Record<string, Control>

const defaults: Record<string, number> = {
  forwardImpulse: FORWARD_IMPULSE,
  baseMaxSpeed: BASE_MAX_SPEED,
  maxSpeedCeiling: MAX_SPEED_CEILING,
  speedRampDistance: SPEED_RAMP_DISTANCE,
  steerImpulse: STEER_IMPULSE,
  maxLateralSpeed: MAX_LATERAL_SPEED,
  jumpImpulse: JUMP_IMPULSE,
  jumpCooldown: JUMP_COOLDOWN_SECONDS,
  radius: ROCK_RADIUS,
  gravityScale: ROCK_GRAVITY_SCALE,
  friction: ROCK_FRICTION,
  restitution: ROCK_RESTITUTION,
  linearDamping: ROCK_LINEAR_DAMPING,
  angularDamping: ROCK_ANGULAR_DAMPING
}

describe('RR_ROCK_CONTROLS', () => {
  it('exposes the three the run is driven by alongside the rest', () => {
    expect(Object.keys(controls)).toEqual(
      expect.arrayContaining(['forwardImpulse', 'jumpImpulse', 'steerImpulse'])
    )
  })

  it('gives every control a label so no row reads as a bare key', () => {
    Object.values(controls).forEach((control) => expect(control.label).toBeTruthy())
  })

  it.each(Object.entries(defaults))(
    'leaves %s adjustable in both directions from its shipped value',
    (name, value) => {
      const control = controls[name]

      expect(control.min).toBeLessThanOrEqual(value)
      expect(control.max).toBeGreaterThanOrEqual(value)
      expect(control.min).toBeLessThan(control.max as number)
    }
  )

  it.each(Object.keys(defaults))('gives %s a step it can actually be nudged by', (name) => {
    const control = controls[name]

    expect(control.step).toBeGreaterThan(0)
    expect(control.step).toBeLessThanOrEqual((control.max as number) - (control.min as number))
  })

  // A rock that returns none of an impact still skips off a seam; absorbing it
  // is what reads as heavy stone, so the slider has to reach below zero.
  it('lets bounce go negative, which is where the rock is tuned', () => {
    expect(controls.restitution.min).toBeLessThan(0)
    expect(ROCK_RESTITUTION).toBeLessThan(0)
  })

  it('drives the tint from a colour picker rather than a slider', () => {
    expect(controls.tint.color).toBe(true)
    expect(controls.tint.min).toBeUndefined()
  })

  // Sliders cannot be allowed to stop the rock dead or pin it in place, so the
  // forces bottom out at zero while the caps and the size never reach it.
  it.each(['baseMaxSpeed', 'maxSpeedCeiling', 'maxLateralSpeed', 'radius', 'gravityScale'])(
    'keeps %s above zero',
    (name) => {
      expect(controls[name].min).toBeGreaterThan(0)
    }
  )
})
