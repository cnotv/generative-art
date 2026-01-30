import type { CoordinateTuple, AreaConfig } from './types'

/**
 * Seeded random number generator using mulberry32 algorithm
 * Provides reproducible random numbers for testing and consistent layouts
 */
type SeededRandom = {
  state: number
}

/**
 * Create a new seeded random generator
 */
const createSeededRandom = (seed: number): SeededRandom => ({
  state: seed
})

/**
 * Generate next random number between 0 and 1
 * Returns [newState, randomValue]
 */
const nextRandom = (rng: SeededRandom): [SeededRandom, number] => {
  let state = rng.state | 0
  state = (state + 0x6d2b79f5) | 0
  let t = Math.imul(state ^ (state >>> 15), 1 | state)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296
  return [{ state }, value]
}

/**
 * Generate random number in range [min, max)
 * Returns [newState, randomValue]
 */
const randomRange = (rng: SeededRandom, min: number, max: number): [SeededRandom, number] => {
  const [newRng, value] = nextRandom(rng)
  return [newRng, min + value * (max - min)]
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

  let rng = createSeededRandom(seed)
  const positions: CoordinateTuple[] = []

  if (pattern === 'random') {
    for (let i = 0; i < count; i++) {
      let x: number, y: number, z: number
      ;[rng, x] = randomRange(rng, minBounds[0], maxBounds[0])
      ;[rng, y] = randomRange(rng, minBounds[1], maxBounds[1])
      ;[rng, z] = randomRange(rng, minBounds[2], maxBounds[2])
      positions.push([x, y, z])
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

        let x: number, z: number, y: number
        if (pattern === 'grid-jitter') {
          let jitterX: number, jitterZ: number
          ;[rng, jitterX] = randomRange(rng, -cellWidth * 0.3, cellWidth * 0.3)
          ;[rng, jitterZ] = randomRange(rng, -cellDepth * 0.3, cellDepth * 0.3)
          ;[rng, y] = randomRange(rng, minBounds[1], maxBounds[1])
          x = baseX + jitterX
          z = baseZ + jitterZ
        } else {
          x = baseX
          z = baseZ
          y = (minBounds[1] + maxBounds[1]) / 2
        }

        positions.push([x, y, z])
        generated++
      }
    }
  }

  return positions
}
