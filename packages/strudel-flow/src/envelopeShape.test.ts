import { describe, expect, it } from 'vitest'
import { getEnvelopePoints } from './envelopeShape'

describe('getEnvelopePoints', () => {
  it('rises to 1, falls to sustain, holds, then releases to 0 across the full width', () => {
    // Arrange
    const envelope = { attack: 0.5, decay: 0.5, sustain: 0.4, release: 1 }

    // Act
    const points = getEnvelopePoints(envelope)

    // Assert
    expect(points.map(({ y }) => y)).toEqual([0, 1, 0.4, 0.4, 0])
    expect(points[0].x).toBe(0)
    expect(points[4].x).toBe(1)
    expect(points[1].x).toBeCloseTo(0.5 / 2.5)
  })

  it('keeps a plateau when every stage is zero', () => {
    // Arrange / Act
    const points = getEnvelopePoints({ attack: 0, decay: 0, sustain: 1, release: 0 })

    // Assert
    expect(points[3].x).toBe(1)
    expect(points.every(({ x }) => Number.isFinite(x))).toBe(true)
  })
})
