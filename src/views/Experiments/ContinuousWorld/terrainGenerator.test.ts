import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { createTerrainChunk } from './terrainGenerator'
import type { NoiseConfig } from './types'

const defaultNoiseConfig: NoiseConfig = {
  seed: 42,
  octaves: 4,
  frequency: 0.02,
  amplitude: 8,
  lacunarity: 2,
  persistence: 0.5
}

describe('createTerrainChunk', () => {
  describe('mesh properties', () => {
    it.each([
      { chunkX: 0, chunkZ: 0 },
      { chunkX: 1, chunkZ: -1 },
      { chunkX: -3, chunkZ: 5 }
    ])('creates a named mesh for chunk ($chunkX, $chunkZ)', ({ chunkX, chunkZ }) => {
      const mesh = createTerrainChunk(chunkX, chunkZ, 32, { noiseConfig: defaultNoiseConfig })

      expect(mesh).toBeInstanceOf(THREE.Mesh)
      expect(mesh.name).toBe(`terrain-${chunkX},${chunkZ}`)
    })

    it('positions mesh at world-space chunk origin', () => {
      const chunkSize = 32
      const mesh = createTerrainChunk(2, 3, chunkSize, { noiseConfig: defaultNoiseConfig })

      expect(mesh.position.x).toBe(2 * chunkSize)
      expect(mesh.position.y).toBe(0)
      expect(mesh.position.z).toBe(3 * chunkSize)
    })

    it('enables receiveShadow', () => {
      const mesh = createTerrainChunk(0, 0, 32, { noiseConfig: defaultNoiseConfig })
      expect(mesh.receiveShadow).toBe(true)
    })
  })

  describe('geometry', () => {
    it('creates PlaneGeometry with correct dimensions', () => {
      const chunkSize = 32
      const mesh = createTerrainChunk(0, 0, chunkSize, { noiseConfig: defaultNoiseConfig })
      const geometry = mesh.geometry

      expect(geometry).toBeInstanceOf(THREE.PlaneGeometry)

      const positionAttribute = geometry.getAttribute('position')
      // 16 segments = 17 vertices per side = 17 * 17 = 289
      expect(positionAttribute.count).toBe(289)
    })

    it('displaces vertex Y positions using noise (not all flat)', () => {
      const mesh = createTerrainChunk(0, 0, 32, { noiseConfig: defaultNoiseConfig })
      const positionAttribute = mesh.geometry.getAttribute('position')

      const yValues = Array.from({ length: positionAttribute.count }, (_, index) =>
        positionAttribute.getY(index)
      )
      const uniqueYValues = new Set(yValues.map((y) => y.toFixed(4)))

      expect(uniqueYValues.size).toBeGreaterThan(1)
    })

    it('has vertex colors attribute', () => {
      const mesh = createTerrainChunk(0, 0, 32, { noiseConfig: defaultNoiseConfig })
      const colorAttribute = mesh.geometry.getAttribute('color')

      expect(colorAttribute).toBeDefined()
      expect(colorAttribute.count).toBe(289)
      expect(colorAttribute.itemSize).toBe(3)
    })
  })

  describe('determinism', () => {
    it('produces identical meshes for the same inputs', () => {
      const meshA = createTerrainChunk(1, 2, 32, { noiseConfig: defaultNoiseConfig })
      const meshB = createTerrainChunk(1, 2, 32, { noiseConfig: defaultNoiseConfig })

      const positionsA = meshA.geometry.getAttribute('position')
      const positionsB = meshB.geometry.getAttribute('position')

      Array.from({ length: positionsA.count }).forEach((_, index) => {
        expect(positionsA.getY(index)).toBe(positionsB.getY(index))
      })
    })

    it('produces different meshes for different chunk coordinates', () => {
      const meshA = createTerrainChunk(0, 0, 32, { noiseConfig: defaultNoiseConfig })
      const meshB = createTerrainChunk(5, 5, 32, { noiseConfig: defaultNoiseConfig })

      const positionsA = meshA.geometry.getAttribute('position')
      const positionsB = meshB.geometry.getAttribute('position')

      const hasDifference = Array.from({ length: positionsA.count }).some(
        (_, index) => positionsA.getY(index) !== positionsB.getY(index)
      )
      expect(hasDifference).toBe(true)
    })

    it('produces different meshes for different seeds', () => {
      const meshA = createTerrainChunk(0, 0, 32, { noiseConfig: defaultNoiseConfig })
      const meshB = createTerrainChunk(0, 0, 32, {
        noiseConfig: { ...defaultNoiseConfig, seed: 99 }
      })

      const positionsA = meshA.geometry.getAttribute('position')
      const positionsB = meshB.geometry.getAttribute('position')

      const hasDifference = Array.from({ length: positionsA.count }).some(
        (_, index) => positionsA.getY(index) !== positionsB.getY(index)
      )
      expect(hasDifference).toBe(true)
    })
  })

  describe('seamless edges', () => {
    it('shared edge vertices between adjacent chunks have matching heights', () => {
      const chunkSize = 32
      const meshLeft = createTerrainChunk(0, 0, chunkSize, { noiseConfig: defaultNoiseConfig })
      const meshRight = createTerrainChunk(1, 0, chunkSize, { noiseConfig: defaultNoiseConfig })

      const positionsLeft = meshLeft.geometry.getAttribute('position')
      const positionsRight = meshRight.geometry.getAttribute('position')

      // Collect right-edge vertices of left chunk (local X = chunkSize/2)
      const rightEdgeHeights = new Map<number, number>()
      Array.from({ length: positionsLeft.count }).forEach((_, index) => {
        const localX = positionsLeft.getX(index)
        if (Math.abs(localX - chunkSize / 2) < 0.01) {
          const localZ = positionsLeft.getZ(index)
          rightEdgeHeights.set(Math.round(localZ * 100), positionsLeft.getY(index))
        }
      })

      // Collect left-edge vertices of right chunk (local X = -chunkSize/2)
      const leftEdgeHeights = new Map<number, number>()
      Array.from({ length: positionsRight.count }).forEach((_, index) => {
        const localX = positionsRight.getX(index)
        if (Math.abs(localX + chunkSize / 2) < 0.01) {
          const localZ = positionsRight.getZ(index)
          leftEdgeHeights.set(Math.round(localZ * 100), positionsRight.getY(index))
        }
      })

      expect(rightEdgeHeights.size).toBeGreaterThan(0)

      rightEdgeHeights.forEach((height, zKey) => {
        const matchingHeight = leftEdgeHeights.get(zKey)
        expect(matchingHeight).toBeDefined()
        expect(height).toBeCloseTo(matchingHeight!, 5)
      })
    })
  })

  describe('material', () => {
    it('uses vertex colors with flat shading', () => {
      const mesh = createTerrainChunk(0, 0, 32, { noiseConfig: defaultNoiseConfig })
      const material = mesh.material as THREE.MeshStandardMaterial

      expect(material.vertexColors).toBe(true)
      expect(material.flatShading).toBe(true)
    })
  })
})
