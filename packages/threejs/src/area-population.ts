import type { CoordinateTuple } from './types'

export interface AreaConfig {
  center?: CoordinateTuple
  size?: CoordinateTuple
  min?: CoordinateTuple
  max?: CoordinateTuple
  count: number
  pattern?: 'random' | 'grid' | 'grid-jitter'
  seed?: number
}

/**
 * Seeded random number generator using mulberry32
 */
class SeededRandom {
  private state: number

  constructor(seed: number) {
    this.state = seed
  }

  next(): number {
    this.state |= 0
    this.state = (this.state + 0x6d2b79f5) | 0
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  range(min: number, max: number): number {
    return min + this.next() * (max - min)
  }
}

/**
 * Generate positions for elements within a defined area
 */
export function generateAreaPositions(config: AreaConfig): CoordinateTuple[] {
  const { count, pattern = 'random', seed = Date.now() } = config

  if (count === 0) return []

  // Determine bounds
  let minBounds: CoordinateTuple
  let maxBounds: CoordinateTuple

  if (config.min && config.max) {
    minBounds = config.min
    maxBounds = config.max
  } else if (config.center && config.size) {
    const halfSize: CoordinateTuple = [
      config.size[0] / 2,
      config.size[1] / 2,
      config.size[2] / 2
    ]
    minBounds = [
      config.center[0] - halfSize[0],
      config.center[1] - halfSize[1],
      config.center[2] - halfSize[2]
    ]
    maxBounds = [
      config.center[0] + halfSize[0],
      config.center[1] + halfSize[1],
      config.center[2] + halfSize[2]
    ]
  } else {
    throw new Error('Either (center + size) or (min + max) must be provided')
  }

  const rng = new SeededRandom(seed)
  const positions: CoordinateTuple[] = []

  if (pattern === 'random') {
    for (let i = 0; i < count; i++) {
      positions.push([
        rng.range(minBounds[0], maxBounds[0]),
        rng.range(minBounds[1], maxBounds[1]),
        rng.range(minBounds[2], maxBounds[2])
      ])
    }
  } else if (pattern === 'grid' || pattern === 'grid-jitter') {
    // Calculate grid dimensions
    const gridSize = Math.ceil(Math.sqrt(count))
    const areaWidth = maxBounds[0] - minBounds[0]
    const areaDepth = maxBounds[2] - minBounds[2]
    const cellWidth = areaWidth / gridSize
    const cellDepth = areaDepth / gridSize

    let generated = 0
    for (let row = 0; row < gridSize && generated < count; row++) {
      for (let col = 0; col < gridSize && generated < count; col++) {
        const baseX = minBounds[0] + col * cellWidth + cellWidth / 2
        const baseZ = minBounds[2] + row * cellDepth + cellDepth / 2

        const x = pattern === 'grid-jitter'
          ? baseX + rng.range(-cellWidth * 0.3, cellWidth * 0.3)
          : baseX
        const z = pattern === 'grid-jitter'
          ? baseZ + rng.range(-cellDepth * 0.3, cellDepth * 0.3)
          : baseZ

        const y = pattern === 'grid-jitter'
          ? rng.range(minBounds[1], maxBounds[1])
          : (minBounds[1] + maxBounds[1]) / 2

        positions.push([x, y, z])
        generated++
      }
    }
  }

  return positions
}
