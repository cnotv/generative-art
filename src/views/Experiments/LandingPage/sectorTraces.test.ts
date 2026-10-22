import { describe, it, expect } from 'vitest'
import { buildSectorTraces, roundedPath } from './sectorTraces'
import type { TraceCell, TraceSpacing } from './types'

const SPACING: TraceSpacing = {
  busTop: 10,
  busStep: 5,
  laneGap: 8,
  laneStep: 4,
  runAbove: 3,
  cornerRadius: 6
}

const cell = (left: number, top: number): TraceCell => ({
  left,
  top,
  width: 100,
  iconTop: top + 30
})

const turnHeight = (path: string): number => Number(path.split(' ')[5])

describe('roundedPath', () => {
  it('rounds a corner without leaving the corner points', () => {
    // Arrange
    const points = [
      { x: 0, y: 0 },
      { x: 0, y: 20 },
      { x: 20, y: 20 }
    ]

    // Act
    const path = roundedPath(points, 5)

    // Assert
    expect(path).toBe('M 0 0 L 0 15 Q 0 20 5 20 L 20 20')
  })
})

describe('buildSectorTraces', () => {
  it('ends every trace at the top of its icon, in the middle of its cell', () => {
    // Arrange
    const cells = [cell(0, 100), cell(120, 100), cell(0, 200)]

    // Act
    const traces = buildSectorTraces({ x: 110, y: -50 }, cells, SPACING)

    // Assert
    expect(traces.map(({ end }) => end)).toEqual([
      { x: 50, y: 130 },
      { x: 170, y: 130 },
      { x: 50, y: 230 }
    ])
    traces.forEach(({ path }) => expect(path.startsWith('M 110 -50')).toBe(true))
  })

  it('turns the trace that heads furthest out off highest', () => {
    // Arrange
    const cells = [cell(0, 100), cell(0, 200), cell(120, 100)]

    // Act
    const [upper, lower, near] = buildSectorTraces({ x: 110, y: -50 }, cells, SPACING)

    // Assert
    expect(turnHeight(lower.path)).toBeLessThan(turnHeight(upper.path))
    expect(turnHeight(upper.path)).toBeLessThan(turnHeight(near.path))
  })
})
