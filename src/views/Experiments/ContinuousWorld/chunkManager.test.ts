import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import {
  computeChunkKey,
  parseChunkKey,
  computePlayerChunk,
  computeRequiredChunks,
  computeChunksToLoad,
  computeChunksToUnload
} from './chunkManager'
import type { ChunkKey, ChunkData } from './types'

describe('chunkManager', () => {
  describe('computeChunkKey', () => {
    it.each([
      [0, 0, '0,0'],
      [1, 2, '1,2'],
      [-3, 5, '-3,5'],
      [-1, -1, '-1,-1']
    ])('returns "%s" for chunk (%i, %i)', (chunkX, chunkZ, expected) => {
      expect(computeChunkKey(chunkX, chunkZ)).toBe(expected)
    })
  })

  describe('parseChunkKey', () => {
    it.each([
      ['0,0' as ChunkKey, [0, 0]],
      ['1,2' as ChunkKey, [1, 2]],
      ['-3,5' as ChunkKey, [-3, 5]]
    ])('parses "%s" to [%i, %i]', (key, expected) => {
      expect(parseChunkKey(key)).toEqual(expected)
    })
  })

  describe('computePlayerChunk', () => {
    it.each([
      [new THREE.Vector3(0, 0, 0), 32, [0, 0]],
      [new THREE.Vector3(31, 0, 31), 32, [0, 0]],
      [new THREE.Vector3(32, 0, 32), 32, [1, 1]],
      [new THREE.Vector3(-1, 0, -1), 32, [-1, -1]],
      [new THREE.Vector3(64, 0, -32), 32, [2, -1]]
    ])('computes correct chunk for position %o with size %i', (position, chunkSize, expected) => {
      expect(computePlayerChunk(position, chunkSize)).toEqual(expected)
    })
  })

  describe('computeRequiredChunks', () => {
    it('returns correct count for radius 0', () => {
      const chunks = computeRequiredChunks(0, 0, 0)
      expect(chunks).toHaveLength(1)
      expect(chunks).toContain('0,0')
    })

    it('returns correct count for radius 1 (3x3 = 9)', () => {
      const chunks = computeRequiredChunks(0, 0, 1)
      expect(chunks).toHaveLength(9)
    })

    it('returns correct count for radius 2 (5x5 = 25)', () => {
      const chunks = computeRequiredChunks(0, 0, 2)
      expect(chunks).toHaveLength(25)
    })

    it('centers around player chunk', () => {
      const chunks = computeRequiredChunks(5, 3, 1)
      expect(chunks).toContain('5,3')
      expect(chunks).toContain('4,2')
      expect(chunks).toContain('6,4')
    })
  })

  describe('computeChunksToLoad', () => {
    it('returns all chunks when map is empty', () => {
      const required: ChunkKey[] = ['0,0', '1,0', '0,1']
      const active = new Map<ChunkKey, ChunkData>()
      expect(computeChunksToLoad(required, active)).toEqual(required)
    })

    it('excludes already loaded chunks', () => {
      const required: ChunkKey[] = ['0,0', '1,0', '0,1']
      const active = new Map<ChunkKey, ChunkData>([
        [
          '0,0',
          {
            key: '0,0',
            chunkX: 0,
            chunkZ: 0,
            terrain: null,
            heightSampler: null,
            elements: null,
            grass: null,
            trees: null,
            ground: null
          }
        ]
      ])
      const toLoad = computeChunksToLoad(required, active)
      expect(toLoad).toEqual(['1,0', '0,1'])
    })
  })

  describe('computeChunksToUnload', () => {
    it('returns chunks beyond unload radius', () => {
      const active = new Map<ChunkKey, ChunkData>([
        [
          '0,0',
          {
            key: '0,0',
            chunkX: 0,
            chunkZ: 0,
            terrain: null,
            heightSampler: null,
            elements: null,
            grass: null,
            trees: null,
            ground: null
          }
        ],
        [
          '5,0',
          {
            key: '5,0',
            chunkX: 5,
            chunkZ: 0,
            terrain: null,
            heightSampler: null,
            elements: null,
            grass: null,
            trees: null,
            ground: null
          }
        ],
        [
          '0,5',
          {
            key: '0,5',
            chunkX: 0,
            chunkZ: 5,
            terrain: null,
            heightSampler: null,
            elements: null,
            grass: null,
            trees: null,
            ground: null
          }
        ]
      ])
      const toUnload = computeChunksToUnload(active, 0, 0, 3)
      expect(toUnload).toContain('5,0')
      expect(toUnload).toContain('0,5')
      expect(toUnload).not.toContain('0,0')
    })

    it('returns empty when all chunks are within radius', () => {
      const active = new Map<ChunkKey, ChunkData>([
        [
          '0,0',
          {
            key: '0,0',
            chunkX: 0,
            chunkZ: 0,
            terrain: null,
            heightSampler: null,
            elements: null,
            grass: null,
            trees: null,
            ground: null
          }
        ],
        [
          '1,1',
          {
            key: '1,1',
            chunkX: 1,
            chunkZ: 1,
            terrain: null,
            heightSampler: null,
            elements: null,
            grass: null,
            trees: null,
            ground: null
          }
        ]
      ])
      const toUnload = computeChunksToUnload(active, 0, 0, 3)
      expect(toUnload).toHaveLength(0)
    })
  })
})
