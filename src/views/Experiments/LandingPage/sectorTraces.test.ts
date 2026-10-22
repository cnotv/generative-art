import { describe, it, expect } from 'vitest'
import { buildSectorTraces } from './sectorTraces'

describe('buildSectorTraces', () => {
  it('runs one curve from the origin to just above each avatar', () => {
    // Arrange
    const targets = [
      { x: 20, y: 100 },
      { x: 180, y: 200 }
    ]

    // Act
    const traces = buildSectorTraces({ x: 100, y: 0 }, targets, 10)

    // Assert
    expect(traces.map(({ end }) => end)).toEqual([
      { x: 20, y: 90 },
      { x: 180, y: 190 }
    ])
    traces.forEach(({ path }) => expect(path.startsWith('M 100 0 C 100 ')).toBe(true))
  })

  it('arrives straight down, so it drops into its avatar from above', () => {
    // Act
    const [trace] = buildSectorTraces({ x: 0, y: 0 }, [{ x: 50, y: 110 }], 10)

    // Assert
    const [, , , , , , controlX, , endX] = trace.path.split(' ')
    expect(controlX).toBe(endX)
  })
})
