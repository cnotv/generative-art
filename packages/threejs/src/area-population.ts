import type { CoordinateTuple, AreaConfig } from './types'

/**
 * Seeded random number generator using mulberry32 algorithm
 *
 * Why mulberry32 over Math.random():
 * - Reproducibility: Same seed always produces same sequence (critical for testing)
 * - Determinism: Math.random() cannot be seeded in JavaScript
 * - Consistency: Ensures identical layouts across different runs/browsers
 * - Testing: Allows unit tests to verify exact position generation
 * - Performance: Faster than crypto.getRandomValues() for non-security use
 *
 * Why mulberry32 specifically:
 * - Simple: Only 5 lines of code, easy to understand and maintain
 * - Fast: Uses only bitwise operations and multiplication
 * - Good distribution: Passes statistical quality tests
 * - Small state: Only 32 bits (4 bytes) of state
 * - Well-tested: Widely used in game development and simulations
 *
 * Source: https://github.com/bryc/code/blob/master/jshash/PRNGs.md
 * Research: Community-vetted PRNG implementations
 */
type SeededRandom = {
  state: number
}

/**
 * Generate next random number between 0 and 1 using mulberry32 algorithm
 *
 * Mulberry32 is a simple, fast pseudo-random number generator with good statistical properties.
 * It uses bitwise operations and multiplication to generate pseudo-random sequences.
 *
 * Magic numbers explanation:
 * - 0x6d2b79f5 (1831565813): Increment constant that ensures state progression
 * - 15, 7, 14: Bit shift amounts for XOR operations that mix bits
 * - 61: Multiplier for additional bit mixing
 * - 4294967296 (2^32): Converts 32-bit integer to [0, 1) range
 *
 * Algorithm steps:
 * 1. Add constant to state (ensures state changes even if input is 0)
 * 2. Apply XOR shifts and multiplication for bit mixing (avalanche effect)
 * 3. Final XOR and shift for output distribution
 * 4. Normalize to [0, 1) by dividing by 2^32
 *
 * Returns [newState, randomValue] where:
 * - newState: Updated generator state for next call
 * - randomValue: Pseudo-random number in range [0, 1)
 *
 * @see https://github.com/bryc/code/blob/master/jshash/PRNGs.md#mulberry32
 */
const nextRandom = (randomGenerator: SeededRandom): [SeededRandom, number] => {
  // Step 1: Ensure 32-bit integer and add increment constant
  let state = randomGenerator.state | 0
  state = (state + 0x6d2b79f5) | 0

  // Step 2-3: XOR shifts and multiplication for bit mixing
  let temporaryValue = Math.imul(state ^ (state >>> 15), 1 | state)
  temporaryValue = (temporaryValue + Math.imul(temporaryValue ^ (temporaryValue >>> 7), 61 | temporaryValue)) ^ temporaryValue

  // Step 4: Final XOR shift and normalize to [0, 1)
  const randomValue = ((temporaryValue ^ (temporaryValue >>> 14)) >>> 0) / 4294967296

  return [{ state }, randomValue]
}

/**
 * Generate random number in range [min, max)
 * Returns [newState, randomValue]
 */
const randomInRange = (
  randomGenerator: SeededRandom,
  minimumValue: number,
  maximumValue: number
): [SeededRandom, number] => {
  const [newRandomGenerator, normalizedValue] = nextRandom(randomGenerator)
  return [newRandomGenerator, minimumValue + normalizedValue * (maximumValue - minimumValue)]
}

/**
 * Calculate area bounds from center and size
 */
const calculateBoundsFromCenterAndSize = (
  centerPosition: CoordinateTuple,
  areaSize: CoordinateTuple
): { minimumBounds: CoordinateTuple; maximumBounds: CoordinateTuple } => {
  const halfSize: CoordinateTuple = [
    areaSize[0] / 2,
    areaSize[1] / 2,
    areaSize[2] / 2
  ]
  return {
    minimumBounds: [
      centerPosition[0] - halfSize[0],
      centerPosition[1] - halfSize[1],
      centerPosition[2] - halfSize[2]
    ],
    maximumBounds: [
      centerPosition[0] + halfSize[0],
      centerPosition[1] + halfSize[1],
      centerPosition[2] + halfSize[2]
    ]
  }
}

/**
 * Determine area bounds from config
 */
const determineAreaBounds = (
  configuration: AreaConfig
): { minimumBounds: CoordinateTuple; maximumBounds: CoordinateTuple } => {
  if (configuration.min && configuration.max) {
    return {
      minimumBounds: configuration.min,
      maximumBounds: configuration.max
    }
  }

  if (configuration.center && configuration.size) {
    return calculateBoundsFromCenterAndSize(configuration.center, configuration.size)
  }

  throw new Error('Either (center + size) or (min + max) must be provided')
}

/**
 * Generate a single random position within bounds
 * Returns [newState, position]
 */
const generateRandomPosition = (
  randomGenerator: SeededRandom,
  minimumBounds: CoordinateTuple,
  maximumBounds: CoordinateTuple
): [SeededRandom, CoordinateTuple] => {
  const [rng1, xCoordinate] = randomInRange(randomGenerator, minimumBounds[0], maximumBounds[0])
  const [rng2, yCoordinate] = randomInRange(rng1, minimumBounds[1], maximumBounds[1])
  const [rng3, zCoordinate] = randomInRange(rng2, minimumBounds[2], maximumBounds[2])
  return [rng3, [xCoordinate, yCoordinate, zCoordinate]]
}

/**
 * Generate N random positions
 */
const generateRandomPositions = (
  elementCount: number,
  minimumBounds: CoordinateTuple,
  maximumBounds: CoordinateTuple,
  randomSeed: number
): CoordinateTuple[] => {
  const elementIndices = Array.from({ length: elementCount }, (_, index) => index)

  const { positions } = elementIndices.reduce(
    (accumulator) => {
      const [newRandomGenerator, position] = generateRandomPosition(
        accumulator.randomGenerator,
        minimumBounds,
        maximumBounds
      )
      return {
        randomGenerator: newRandomGenerator,
        positions: [...accumulator.positions, position]
      }
    },
    { randomGenerator: { state: randomSeed }, positions: [] as CoordinateTuple[] }
  )

  return positions
}

/**
 * Calculate grid dimensions for a given count
 */
const calculateGridDimensions = (elementCount: number) => ({
  gridSize: Math.ceil(Math.sqrt(elementCount))
})

/**
 * Calculate cell dimensions based on area and grid size
 */
const calculateCellDimensions = (
  minimumBounds: CoordinateTuple,
  maximumBounds: CoordinateTuple,
  gridSize: number
) => {
  const areaWidth = maximumBounds[0] - minimumBounds[0]
  const areaDepth = maximumBounds[2] - minimumBounds[2]
  return {
    cellWidth: areaWidth / gridSize,
    cellDepth: areaDepth / gridSize
  }
}

/**
 * Generate grid position for a specific row and column
 */
const generateGridPosition = (
  rowIndex: number,
  columnIndex: number,
  minimumBounds: CoordinateTuple,
  maximumBounds: CoordinateTuple,
  cellWidth: number,
  cellDepth: number
): CoordinateTuple => {
  const baseXCoordinate = minimumBounds[0] + columnIndex * cellWidth + cellWidth / 2
  const baseZCoordinate = minimumBounds[2] + rowIndex * cellDepth + cellDepth / 2
  const yCoordinate = (minimumBounds[1] + maximumBounds[1]) / 2
  return [baseXCoordinate, yCoordinate, baseZCoordinate]
}

/**
 * Apply jitter to a grid position
 * Returns [newState, jitteredPosition]
 */
const applyJitterToGridPosition = (
  randomGenerator: SeededRandom,
  basePosition: CoordinateTuple,
  minimumBounds: CoordinateTuple,
  maximumBounds: CoordinateTuple,
  cellWidth: number,
  cellDepth: number
): [SeededRandom, CoordinateTuple] => {
  const [rng1, xJitter] = randomInRange(randomGenerator, -cellWidth * 0.3, cellWidth * 0.3)
  const [rng2, zJitter] = randomInRange(rng1, -cellDepth * 0.3, cellDepth * 0.3)
  const [rng3, yCoordinate] = randomInRange(rng2, minimumBounds[1], maximumBounds[1])

  return [
    rng3,
    [
      basePosition[0] + xJitter,
      yCoordinate,
      basePosition[2] + zJitter
    ]
  ]
}

/**
 * Generate all grid cell positions (row, col pairs) up to elementCount
 */
const generateGridCellIndices = (gridSize: number, elementCount: number): Array<[number, number]> =>
  Array.from({ length: gridSize }, (_, rowIndex) => rowIndex)
    .flatMap(rowIndex =>
      Array.from({ length: gridSize }, (_, columnIndex) => [rowIndex, columnIndex] as [number, number])
    )
    .slice(0, elementCount)

/**
 * Generate grid positions without jitter
 */
const generateGridPositions = (
  elementCount: number,
  minimumBounds: CoordinateTuple,
  maximumBounds: CoordinateTuple
): CoordinateTuple[] => {
  const { gridSize } = calculateGridDimensions(elementCount)
  const { cellWidth, cellDepth } = calculateCellDimensions(minimumBounds, maximumBounds, gridSize)
  const gridCellIndices = generateGridCellIndices(gridSize, elementCount)

  return gridCellIndices.map(([rowIndex, columnIndex]) =>
    generateGridPosition(rowIndex, columnIndex, minimumBounds, maximumBounds, cellWidth, cellDepth)
  )
}

/**
 * Generate grid positions with jitter
 */
const generateGridJitterPositions = (
  elementCount: number,
  minimumBounds: CoordinateTuple,
  maximumBounds: CoordinateTuple,
  randomSeed: number
): CoordinateTuple[] => {
  const { gridSize } = calculateGridDimensions(elementCount)
  const { cellWidth, cellDepth } = calculateCellDimensions(minimumBounds, maximumBounds, gridSize)
  const gridCellIndices = generateGridCellIndices(gridSize, elementCount)

  const { positions } = gridCellIndices.reduce(
    (accumulator, [rowIndex, columnIndex]) => {
      const basePosition = generateGridPosition(
        rowIndex,
        columnIndex,
        minimumBounds,
        maximumBounds,
        cellWidth,
        cellDepth
      )
      const [newRandomGenerator, jitteredPosition] = applyJitterToGridPosition(
        accumulator.randomGenerator,
        basePosition,
        minimumBounds,
        maximumBounds,
        cellWidth,
        cellDepth
      )
      return {
        randomGenerator: newRandomGenerator,
        positions: [...accumulator.positions, jitteredPosition]
      }
    },
    { randomGenerator: { state: randomSeed }, positions: [] as CoordinateTuple[] }
  )

  return positions
}

/**
 * Generate positions for elements within a defined area
 */
export function generateAreaPositions(configuration: AreaConfig): CoordinateTuple[] {
  const { count: elementCount, pattern: distributionPattern = 'random', seed: randomSeed = Date.now() } = configuration

  if (elementCount === 0) return []

  const { minimumBounds, maximumBounds } = determineAreaBounds(configuration)

  if (distributionPattern === 'random') {
    return generateRandomPositions(elementCount, minimumBounds, maximumBounds, randomSeed)
  }

  if (distributionPattern === 'grid') {
    return generateGridPositions(elementCount, minimumBounds, maximumBounds)
  }

  if (distributionPattern === 'grid-jitter') {
    return generateGridJitterPositions(elementCount, minimumBounds, maximumBounds, randomSeed)
  }

  return []
}
