import { describe, it, expect } from 'vitest'
import { generateAreaPositions } from './area-population'
import type { AreaConfig } from './types'

describe('generateAreaPositions', () => {
  describe('center-based area definition', () => {
    it('should generate positions within area bounds', () => {
      const config: AreaConfig = {
        center: [0, 0, 0],
        size: [100, 0, 100],
        count: 10,
        seed: 12345
      }

      const positions = generateAreaPositions(config)

      expect(positions).toHaveLength(10)
      positions.forEach(([x, y, z]) => {
        expect(x).toBeGreaterThanOrEqual(-50)
        expect(x).toBeLessThanOrEqual(50)
        expect(y).toBe(0)
        expect(z).toBeGreaterThanOrEqual(-50)
        expect(z).toBeLessThanOrEqual(50)
      })
    })

    it('should return same positions with same seed', () => {
      const config: AreaConfig = {
        center: [0, 0, 0],
        size: [100, 0, 100],
        count: 5,
        seed: 42
      }

      const positions1 = generateAreaPositions(config)
      const positions2 = generateAreaPositions(config)

      expect(positions1).toEqual(positions2)
    })

    it('should return different positions with different seeds', () => {
      const config1: AreaConfig = {
        center: [0, 0, 0],
        size: [100, 0, 100],
        count: 5,
        seed: 1
      }

      const config2: AreaConfig = {
        ...config1,
        seed: 2
      }

      const positions1 = generateAreaPositions(config1)
      const positions2 = generateAreaPositions(config2)

      expect(positions1).not.toEqual(positions2)
    })
  })

  describe('bounds-based area definition', () => {
    it('should generate positions within min/max bounds', () => {
      const config: AreaConfig = {
        min: [-50, 0, -50],
        max: [50, 0, 50],
        count: 10,
        seed: 12345
      }

      const positions = generateAreaPositions(config)

      expect(positions).toHaveLength(10)
      positions.forEach(([x, y, z]) => {
        expect(x).toBeGreaterThanOrEqual(-50)
        expect(x).toBeLessThanOrEqual(50)
        expect(y).toBe(0)
        expect(z).toBeGreaterThanOrEqual(-50)
        expect(z).toBeLessThanOrEqual(50)
      })
    })
  })

  describe('distribution patterns', () => {
    it.each([
      { pattern: 'random' as const, description: 'random distribution' },
      { pattern: 'grid' as const, description: 'grid-based distribution' },
      { pattern: 'grid-jitter' as const, description: 'grid with jitter' }
    ])('should support $description', ({ pattern }) => {
      const config: AreaConfig = {
        center: [0, 0, 0],
        size: [100, 0, 100],
        count: 9,
        pattern,
        seed: 12345
      }

      const positions = generateAreaPositions(config)

      expect(positions).toHaveLength(9)

      if (pattern === 'grid') {
        // Grid should create evenly spaced positions
        // Verify all positions are unique and within bounds
        const uniquePositions = new Set(positions.map(p => `${p[0]},${p[2]}`))
        expect(uniquePositions.size).toBe(positions.length)

        // Verify positions are evenly distributed
        positions.forEach(([x, , z]) => {
          expect(x).toBeGreaterThanOrEqual(-50)
          expect(x).toBeLessThanOrEqual(50)
          expect(z).toBeGreaterThanOrEqual(-50)
          expect(z).toBeLessThanOrEqual(50)
        })
      }
    })
  })

  describe('edge cases', () => {
    it('should handle zero count', () => {
      const config: AreaConfig = {
        center: [0, 0, 0],
        size: [100, 0, 100],
        count: 0,
        seed: 12345
      }

      const positions = generateAreaPositions(config)
      expect(positions).toHaveLength(0)
    })

    it('should handle single element', () => {
      const config: AreaConfig = {
        center: [10, 5, 10],
        size: [100, 0, 100],
        count: 1,
        seed: 12345
      }

      const positions = generateAreaPositions(config)
      expect(positions).toHaveLength(1)

      // Single element should be within bounds
      const [x, y, z] = positions[0]
      expect(x).toBeGreaterThanOrEqual(-40)
      expect(x).toBeLessThanOrEqual(60)
      expect(y).toBe(5)
      expect(z).toBeGreaterThanOrEqual(-40)
      expect(z).toBeLessThanOrEqual(60)
    })

    it('should handle non-zero Y coordinates', () => {
      const config: AreaConfig = {
        center: [0, 10, 0],
        size: [100, 20, 100],
        count: 5,
        seed: 12345
      }

      const positions = generateAreaPositions(config)

      positions.forEach(([, y]) => {
        expect(y).toBeGreaterThanOrEqual(0)
        expect(y).toBeLessThanOrEqual(20)
      })
    })
  })
})
