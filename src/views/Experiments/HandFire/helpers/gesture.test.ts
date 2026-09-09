import { describe, it, expect } from 'vitest'
import {
  handOpenness,
  handPalmCenter,
  handPointingTarget,
  createGestureTracker,
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

describe('handPalmCenter and handPointingTarget', () => {
  it('sits between the wrist and the middle knuckle, distinct from the pointing target', () => {
    const palm = handPalmCenter(fistLandmarks)
    const target = handPointingTarget(fistLandmarks)
    expect(palm.y).toBeCloseTo((WRIST.y + fistLandmarks[9].y) / 2)
    expect(target).toEqual(fistLandmarks[9])
  })
})

describe('createGestureTracker', () => {
  it('fires once when a fist opens, not again inside the cooldown, then again once it elapses', () => {
    const tracker = createGestureTracker()

    expect(tracker.update(handOpenness(fistLandmarks), 0, 500)).toBe(false)
    expect(tracker.update(handOpenness(openLandmarks), 10, 500)).toBe(true)
    expect(tracker.update(handOpenness(fistLandmarks), 20, 500)).toBe(false)
    expect(tracker.update(handOpenness(openLandmarks), 30, 500)).toBe(false)
    expect(tracker.update(handOpenness(fistLandmarks), 400, 500)).toBe(false)
    expect(tracker.update(handOpenness(openLandmarks), 600, 500)).toBe(true)
  })

  it('does not fire without first closing into a fist', () => {
    const tracker = createGestureTracker()

    expect(tracker.update(handOpenness(openLandmarks), 0, 500)).toBe(false)
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
