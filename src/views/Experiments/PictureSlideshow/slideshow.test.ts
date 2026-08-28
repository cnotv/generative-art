import { describe, it, expect } from 'vitest'
import { canvasRoleAt, fallDropAt, fallTumbleAt, liftAmountAt, slideshowFrameAt } from './slideshow'

const TIMING = { hold: 3, drop: 1, lift: 1 }
const CYCLE = TIMING.hold + TIMING.drop + TIMING.lift
const SLIDE_COUNT = 6

describe('slideshowFrameAt', () => {
  it.each([
    ['the first hold', 0, 'hold', 0],
    ['mid hold', 1.5, 'hold', 0.5],
    ['the drop opening', 3, 'drop', 0],
    ['mid drop', 3.5, 'drop', 0.5],
    ['the lift opening', 4, 'lift', 0],
    ['mid lift', 4.5, 'lift', 0.5],
    ['the second hold', 5, 'hold', 0]
  ])('reports %s', (_label, elapsed, phase, phaseProgress) => {
    const frame = slideshowFrameAt(elapsed as number, TIMING, SLIDE_COUNT)

    expect(frame.phase).toBe(phase)
    expect(frame.phaseProgress).toBeCloseTo(phaseProgress as number)
  })

  it('holds a picture during hold, nothing during the drop, and the next one on the lift', () => {
    const hold = slideshowFrameAt(1, TIMING, SLIDE_COUNT)
    const drop = slideshowFrameAt(3.5, TIMING, SLIDE_COUNT)
    const lift = slideshowFrameAt(4.5, TIMING, SLIDE_COUNT)

    expect(hold.heldIndex).toBe(0)
    expect(drop.heldIndex).toBeNull()
    expect(lift.heldIndex).toBe(1)
  })

  it('carries the lifted picture into the next hold', () => {
    const nextHold = slideshowFrameAt(CYCLE + 1, TIMING, SLIDE_COUNT)

    expect(nextHold.heldIndex).toBe(1)
  })

  it('reveals the following picture at the waiting spot as the lift starts', () => {
    const hold = slideshowFrameAt(1, TIMING, SLIDE_COUNT)
    const drop = slideshowFrameAt(3.5, TIMING, SLIDE_COUNT)
    const lift = slideshowFrameAt(4.5, TIMING, SLIDE_COUNT)

    expect(hold.waitingIndex).toBe(1)
    expect(drop.waitingIndex).toBe(1)
    expect(lift.waitingIndex).toBe(2)
  })

  it('drops nothing while holding, and keeps the released picture falling through the lift', () => {
    const hold = slideshowFrameAt(1, TIMING, SLIDE_COUNT)
    const drop = slideshowFrameAt(3.5, TIMING, SLIDE_COUNT)
    const lift = slideshowFrameAt(4.5, TIMING, SLIDE_COUNT)

    expect(hold.fallingIndex).toBeNull()
    expect(drop.fallingIndex).toBe(0)
    expect(lift.fallingIndex).toBe(0)
    expect(drop.fallSeconds).toBeCloseTo(0.5)
    expect(lift.fallSeconds).toBeCloseTo(1.5)
  })

  it('never gives one picture two roles in the same frame', () => {
    const samples = Array.from({ length: 200 }, (_, step) => step * 0.05)

    samples.forEach((elapsed) => {
      const { heldIndex, waitingIndex, fallingIndex } = slideshowFrameAt(
        elapsed,
        TIMING,
        SLIDE_COUNT
      )
      const claimed = [heldIndex, waitingIndex, fallingIndex].filter(
        (index): index is number => index !== null
      )

      expect(new Set(claimed).size).toBe(claimed.length)
    })
  })

  it('wraps every index back around the picture list', () => {
    const frame = slideshowFrameAt(CYCLE * SLIDE_COUNT + 1, TIMING, SLIDE_COUNT)

    expect(frame.heldIndex).toBe(0)
    expect(frame.waitingIndex).toBe(1)
  })
})

describe('liftAmountAt', () => {
  it.each([
    ['stays raised through the hold', 1, 1],
    ['is fully raised as the drop opens', 3, 1],
    ['is fully lowered as the drop closes', 3.999, 0],
    ['is fully lowered as the lift opens', 4.001, 0],
    ['is fully raised again as the lift closes', CYCLE - 0.001, 1]
  ])('%s', (_label, elapsed, expected) => {
    const amount = liftAmountAt(slideshowFrameAt(elapsed as number, TIMING, SLIDE_COUNT))

    expect(amount).toBeCloseTo(expected as number, 2)
  })

  it('falls monotonically through the drop and rises monotonically through the lift', () => {
    const amountAt = (elapsed: number) =>
      liftAmountAt(slideshowFrameAt(elapsed, TIMING, SLIDE_COUNT))
    const dropSamples = Array.from({ length: 20 }, (_, step) => amountAt(3 + step * 0.05))
    const liftSamples = Array.from({ length: 20 }, (_, step) => amountAt(4 + step * 0.05))

    expect(
      dropSamples.every((value, index) => index === 0 || value <= dropSamples[index - 1])
    ).toBe(true)
    expect(
      liftSamples.every((value, index) => index === 0 || value >= liftSamples[index - 1])
    ).toBe(true)
  })
})

describe('fallDropAt', () => {
  it('starts where the canvas was released', () => {
    expect(fallDropAt(0, 9.81)).toBe(0)
  })

  it('accelerates rather than travelling at a constant rate', () => {
    const firstHalf = fallDropAt(0.5, 9.81)
    const second = fallDropAt(1, 9.81)

    expect(second).toBeGreaterThan(firstHalf * 2)
  })
})

describe('fallTumbleAt', () => {
  it('turns at a steady rate from the moment of release', () => {
    expect(fallTumbleAt(0, 4)).toBe(0)
    expect(fallTumbleAt(2, 4)).toBeCloseTo(8)
  })
})

describe('canvasRoleAt', () => {
  const frame = slideshowFrameAt(4.5, TIMING, SLIDE_COUNT)

  it.each([
    ['held', 1, 'held'],
    ['waiting', 2, 'waiting'],
    ['falling', 0, 'falling'],
    ['hidden', 4, 'hidden']
  ])('reads picture %s', (_label, index, role) => {
    expect(canvasRoleAt(frame, index as number)).toBe(role)
  })
})
