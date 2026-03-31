import * as THREE from 'three'
import type { NoiseConfig, HeightSampler } from './types'
import { fractalNoise } from './noise'

const TERRAIN_SEGMENTS = 16
const DEFAULT_TERRAIN_BASE_COLOR = 0x4a7c3f
const DEFAULT_TERRAIN_PEAK_COLOR = 0x8b7355
const HEIGHT_COLOR_THRESHOLD = 0.6

/**
 * Creates a terrain mesh for a single chunk using noise-displaced PlaneGeometry.
 * Vertices are displaced in Y based on fractal noise using world-space coordinates
 * for seamless edges between adjacent chunks.
 */
export const createTerrainChunk = (
  chunkX: number,
  chunkZ: number,
  chunkSize: number,
  noiseConfig: NoiseConfig,
  baseColor = DEFAULT_TERRAIN_BASE_COLOR,
  peakColor = DEFAULT_TERRAIN_PEAK_COLOR
): THREE.Mesh => {
  const terrainBaseColor = new THREE.Color(baseColor)
  const terrainPeakColor = new THREE.Color(peakColor)
  const geometry = new THREE.PlaneGeometry(chunkSize, chunkSize, TERRAIN_SEGMENTS, TERRAIN_SEGMENTS)
  geometry.rotateX(-Math.PI / 2)

  const positionAttribute = geometry.getAttribute('position')
  const vertexCount = positionAttribute.count
  const colors = new Float32Array(vertexCount * 3)

  const worldOffsetX = chunkX * chunkSize
  const worldOffsetZ = chunkZ * chunkSize

  let maxHeight = 0

  Array.from({ length: vertexCount }).forEach((_, vertexIndex) => {
    const localX = positionAttribute.getX(vertexIndex)
    const localZ = positionAttribute.getZ(vertexIndex)

    const worldX = localX + worldOffsetX
    const worldZ = localZ + worldOffsetZ

    const height = fractalNoise(worldX, worldZ, noiseConfig)
    positionAttribute.setY(vertexIndex, height)

    maxHeight = Math.max(maxHeight, Math.abs(height))
  })

  const normalizedMax = maxHeight || 1

  Array.from({ length: vertexCount }).forEach((_, vertexIndex) => {
    const height = positionAttribute.getY(vertexIndex)
    const heightNormalized = Math.abs(height) / normalizedMax
    const blendFactor = Math.min(heightNormalized / HEIGHT_COLOR_THRESHOLD, 1)
    const vertexColor = terrainBaseColor.clone().lerp(terrainPeakColor, blendFactor)

    colors[vertexIndex * 3] = vertexColor.r
    colors[vertexIndex * 3 + 1] = vertexColor.g
    colors[vertexIndex * 3 + 2] = vertexColor.b
  })

  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geometry.computeVertexNormals()

  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    flatShading: true
  })

  const mesh = new THREE.Mesh(geometry, material)
  mesh.position.set(worldOffsetX, 0, worldOffsetZ)
  mesh.receiveShadow = true
  mesh.name = `terrain-${chunkX},${chunkZ}`

  return mesh
}

/**
 * Builds a bilinear height sampler from an existing terrain mesh's vertex buffer.
 * Reading directly from the geometry avoids redundant fractalNoise calls when
 * placing grass blades or trees on the same chunk.
 */
export const buildHeightSampler = (
  terrain: THREE.Mesh,
  chunkX: number,
  chunkZ: number,
  chunkSize: number
): HeightSampler => {
  const gridSize = TERRAIN_SEGMENTS + 1
  const positionAttribute = terrain.geometry.getAttribute('position')
  const heights = new Float32Array(gridSize * gridSize)
  Array.from({ length: gridSize * gridSize }).forEach((_, index) => {
    heights[index] = positionAttribute.getY(index)
  })

  const worldOffsetX = chunkX * chunkSize
  const worldOffsetZ = chunkZ * chunkSize
  const halfSize = chunkSize / 2

  return (worldX: number, worldZ: number): number => {
    const u = Math.max(0, Math.min(1, (worldX - worldOffsetX + halfSize) / chunkSize))
    const v = Math.max(0, Math.min(1, (worldZ - worldOffsetZ + halfSize) / chunkSize))
    const gx = u * TERRAIN_SEGMENTS
    const gz = v * TERRAIN_SEGMENTS
    const col0 = Math.floor(gx)
    const row0 = Math.floor(gz)
    const col1 = Math.min(col0 + 1, TERRAIN_SEGMENTS)
    const row1 = Math.min(row0 + 1, TERRAIN_SEGMENTS)
    const fx = gx - col0
    const fz = gz - row0
    const h00 = heights[row0 * gridSize + col0]
    const h10 = heights[row0 * gridSize + col1]
    const h01 = heights[row1 * gridSize + col0]
    const h11 = heights[row1 * gridSize + col1]
    return h00 * (1 - fx) * (1 - fz) + h10 * fx * (1 - fz) + h01 * (1 - fx) * fz + h11 * fx * fz
  }
}
