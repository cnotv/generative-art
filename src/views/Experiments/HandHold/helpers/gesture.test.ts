import { describe, it, expect } from 'vitest'
import {
  handOpenness,
  handPalmCenter,
  handForwardTarget,
  handSpan,
  createGripTracker,
  resolveHandSide,
  type HandLandmarkPoint
} from './gesture'
import { FIST_OPENNESS_THRESHOLD, OPEN_OPENNESS_THRESHOLD } from '../config'

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

describe('createGripTracker', () => {
  it('starts open and switches to fist once openness drops below the threshold', () => {
    const tracker = createGripTracker()

    expect(tracker.update(handOpenness(openLandmarks))).toBe('open')
    expect(tracker.update(handOpenness(fistLandmarks))).toBe('fist')
  })

  it('holds the previous grip while openness sits between the two thresholds', () => {
    const tracker = createGripTracker()
    const betweenThresholds = (FIST_OPENNESS_THRESHOLD + OPEN_OPENNESS_THRESHOLD) / 2

    tracker.update(handOpenness(fistLandmarks))
    expect(tracker.update(betweenThresholds)).toBe('fist')

    const otherTracker = createGripTracker()
    otherTracker.update(handOpenness(openLandmarks))
    expect(otherTracker.update(betweenThresholds)).toBe('open')
  })

  it('switches back to open once openness rises above the threshold', () => {
    const tracker = createGripTracker()

    tracker.update(handOpenness(fistLandmarks))
    expect(tracker.update(handOpenness(openLandmarks))).toBe('open')
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
