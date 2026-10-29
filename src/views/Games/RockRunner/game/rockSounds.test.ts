import { describe, it, expect } from 'vitest'
import { detectImpact, rollingLevel } from './rockSounds'
import type { MotionFrame } from '../types'

const frame = (overrides: Partial<MotionFrame>): MotionFrame => ({
  grounded: true,
  verticalSpeed: 0,
  horizontalSpeed: 10,
  ...overrides
})

describe('detectImpact', () => {
  it('reports nothing while the rock rolls steadily', () => {
    expect(detectImpact(frame({}), frame({}))).toBeNull()
  })

  it('reports a fall when the rock lands while moving down fast', () => {
    const impact = detectImpact(
      frame({ grounded: false, verticalSpeed: -20 }),
      frame({ grounded: true })
    )

    expect(impact?.kind).toBe('fall')
    expect(impact?.strength).toBeGreaterThan(0)
  })

  it('ignores a landing that is barely moving', () => {
    expect(
      detectImpact(frame({ grounded: false, verticalSpeed: -0.5 }), frame({ grounded: true }))
    ).toBeNull()
  })

  it('makes a harder landing stronger, capped at one', () => {
    const land = (verticalSpeed: number) =>
      detectImpact(frame({ grounded: false, verticalSpeed }), frame({ grounded: true }))

    expect(land(-40)!.strength).toBeGreaterThan(land(-10)!.strength)
    expect(land(-1000)!.strength).toBe(1)
  })

  it('reports a bump when horizontal speed drops sharply on the ground', () => {
    const impact = detectImpact(frame({ horizontalSpeed: 12 }), frame({ horizontalSpeed: 6 }))

    expect(impact?.kind).toBe('bump')
  })

  it('does not call a gentle slowdown a bump', () => {
    expect(
      detectImpact(frame({ horizontalSpeed: 12 }), frame({ horizontalSpeed: 11.8 }))
    ).toBeNull()
  })

  it('does not call a speed drop in the air a bump', () => {
    expect(
      detectImpact(
        frame({ grounded: false, horizontalSpeed: 12 }),
        frame({ grounded: false, horizontalSpeed: 4 })
      )
    ).toBeNull()
  })

  it('calls a landing that also slows the rock a fall, not a bump', () => {
    const impact = detectImpact(
      frame({ grounded: false, verticalSpeed: -20, horizontalSpeed: 12 }),
      frame({ grounded: true, horizontalSpeed: 5 })
    )

    expect(impact?.kind).toBe('fall')
  })
})

describe('rollingLevel', () => {
  it('is silent in the air', () => {
    expect(rollingLevel(frame({ grounded: false, horizontalSpeed: 20 }), 20)).toBe(0)
  })

  it('is silent when standing still', () => {
    expect(rollingLevel(frame({ horizontalSpeed: 0 }), 20)).toBe(0)
  })

  it('grows with speed and tops out at one', () => {
    const slow = rollingLevel(frame({ horizontalSpeed: 5 }), 20)
    const fast = rollingLevel(frame({ horizontalSpeed: 15 }), 20)

    expect(fast).toBeGreaterThan(slow)
    expect(rollingLevel(frame({ horizontalSpeed: 200 }), 20)).toBe(1)
  })
})
