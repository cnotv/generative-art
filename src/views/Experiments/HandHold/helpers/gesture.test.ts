import { describe, it, expect } from 'vitest'
import {
  handOpenness,
  handPalmCenter,
  handForwardTarget,
  handSpan,
  countExtendedFingers,
  createGripTracker,
  resolveHandSide,
  type HandLandmarkPoint
} from './gesture'
import { FIST_OPENNESS_THRESHOLD, OPEN_OPENNESS_THRESHOLD, OPEN_GRIP_DELAY_MS } from '../config'

const WRIST: HandLandmarkPoint = { x: 0.5, y: 0.8 }

const buildLandmarks = (overrides: Record<number, HandLandmarkPoint>): HandLandmarkPoint[] =>
  Array.from({ length: 21 }, (_, index) => overrides[index] ?? { x: 0, y: 0 })

const mcpPoint = (dy: number): HandLandmarkPoint => ({ x: 0.5, y: 0.8 - dy })
const tipPoint = (dy: number): HandLandmarkPoint => ({ x: 0.5, y: 0.8 - dy })

const fistLandmarks = buildLandmarks({
  0: WRIST,
  5: mcpPoint(0.12),
  9: mcpPoint(0.14),
  13: mcpPoint(0.12),
  17: mcpPoint(0.1),
  8: tipPoint(0.08),
  12: tipPoint(0.09),
  16: tipPoint(0.08),
  20: tipPoint(0.07)
})

const openLandmarks = buildLandmarks({
  0: WRIST,
  5: mcpPoint(0.12),
  9: mcpPoint(0.14),
  13: mcpPoint(0.12),
  17: mcpPoint(0.1),
  8: tipPoint(0.4),
  12: tipPoint(0.45),
  16: tipPoint(0.4),
  20: tipPoint(0.35)
})

describe('handOpenness', () => {
  it.each([
    ['a curled fist', fistLandmarks, FIST_OPENNESS_THRESHOLD, 'below'],
    ['a spread hand', openLandmarks, OPEN_OPENNESS_THRESHOLD, 'above']
  ] as const)('reads %s %s its threshold', (_label, landmarks, threshold, direction) => {
    const openness = handOpenness(landmarks)
    if (direction === 'below') expect(openness).toBeLessThan(threshold)
    else expect(openness).toBeGreaterThan(threshold)
  })
})

describe('handPalmCenter and handForwardTarget', () => {
  it('sits between the wrist and the middle knuckle, distinct from the forward target', () => {
    const palm = handPalmCenter(fistLandmarks)
    const target = handForwardTarget(fistLandmarks)
    expect(palm.y).toBeCloseTo((WRIST.y + fistLandmarks[9].y) / 2)
    expect(target).toEqual(fistLandmarks[9])
  })
})

describe('handSpan', () => {
  it('grows as the hand fills more of the frame, for the same grip', () => {
    const nearLandmarks = buildLandmarks({ 0: WRIST, 9: mcpPoint(0.28) })
    const farLandmarks = buildLandmarks({ 0: WRIST, 9: mcpPoint(0.07) })

    expect(handSpan(nearLandmarks)).toBeGreaterThan(handSpan(farLandmarks))
  })
})

describe('countExtendedFingers', () => {
  it('counts 0 for a fist and 4 for a fully open hand', () => {
    expect(countExtendedFingers(fistLandmarks)).toBe(0)
    expect(countExtendedFingers(openLandmarks)).toBe(4)
  })

  it('counts only the fingers held out, like counting to two', () => {
    const twoFingersLandmarks = buildLandmarks({
      0: WRIST,
      5: mcpPoint(0.12),
      9: mcpPoint(0.14),
      13: mcpPoint(0.12),
      17: mcpPoint(0.1),
      8: tipPoint(0.4),
      12: tipPoint(0.45),
      16: tipPoint(0.08),
      20: tipPoint(0.07)
    })

    expect(countExtendedFingers(twoFingersLandmarks)).toBe(2)
  })
})

describe('createGripTracker', () => {
  it('starts open and switches to fist immediately once openness drops below the threshold', () => {
    const tracker = createGripTracker()

    expect(tracker.update(handOpenness(openLandmarks), 0)).toBe('open')
    expect(tracker.update(handOpenness(fistLandmarks), 10)).toBe('fist')
  })

  it('holds the previous grip while openness sits between the two thresholds', () => {
    const tracker = createGripTracker()
    const betweenThresholds = (FIST_OPENNESS_THRESHOLD + OPEN_OPENNESS_THRESHOLD) / 2

    tracker.update(handOpenness(fistLandmarks), 0)
    expect(tracker.update(betweenThresholds, 10)).toBe('fist')

    const otherTracker = createGripTracker()
    otherTracker.update(handOpenness(openLandmarks), 0)
    expect(otherTracker.update(betweenThresholds, 10)).toBe('open')
  })

  it('does not open a fist until the open reading has held for the full delay', () => {
    const tracker = createGripTracker()
    tracker.update(handOpenness(fistLandmarks), 0)

    expect(tracker.update(handOpenness(openLandmarks), 100)).toBe('fist')
    expect(tracker.update(handOpenness(openLandmarks), 100 + OPEN_GRIP_DELAY_MS - 1)).toBe('fist')
    expect(tracker.update(handOpenness(openLandmarks), 100 + OPEN_GRIP_DELAY_MS)).toBe('open')
  })

  it('cancels a pending open, and restarts the delay, if the hand closes again first', () => {
    const tracker = createGripTracker()
    tracker.update(handOpenness(fistLandmarks), 0)
    tracker.update(handOpenness(openLandmarks), 100)
    expect(tracker.update(handOpenness(fistLandmarks), 150)).toBe('fist')

    // The delay counts from this second open reading, not from the first attempt at 100.
    tracker.update(handOpenness(openLandmarks), 200)
    expect(tracker.update(handOpenness(openLandmarks), 200 + OPEN_GRIP_DELAY_MS - 1)).toBe('fist')
    expect(tracker.update(handOpenness(openLandmarks), 200 + OPEN_GRIP_DELAY_MS)).toBe('open')
  })
})

describe('resolveHandSide', () => {
  it.each([
    ['Left', 'Left'],
    ['Right', 'Right'],
    ['', null],
    ['Unknown', null]
  ] as const)('resolves MediaPipe category %j to %j', (categoryName, expected) => {
    expect(resolveHandSide(categoryName)).toBe(expected)
  })
})
