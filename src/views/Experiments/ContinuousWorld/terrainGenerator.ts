import * as THREE from 'three';
import type { NoiseConfig } from './types';
import { fractalNoise } from './noise';

const TERRAIN_SEGMENTS = 16;
const DEFAULT_TERRAIN_BASE_COLOR = 0x4a7c3f;
const DEFAULT_TERRAIN_PEAK_COLOR = 0x8b7355;
const HEIGHT_COLOR_THRESHOLD = 0.6;

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
  peakColor = DEFAULT_TERRAIN_PEAK_COLOR,
): THREE.Mesh => {
  const terrainBaseColor = new THREE.Color(baseColor);
  const terrainPeakColor = new THREE.Color(peakColor);
  const geometry = new THREE.PlaneGeometry(
    chunkSize, chunkSize,
    TERRAIN_SEGMENTS, TERRAIN_SEGMENTS
  );
  geometry.rotateX(-Math.PI / 2);

  const positionAttribute = geometry.getAttribute('position');
  const vertexCount = positionAttribute.count;
  const colors = new Float32Array(vertexCount * 3);

  const worldOffsetX = chunkX * chunkSize;
  const worldOffsetZ = chunkZ * chunkSize;

  let maxHeight = 0;

  Array.from({ length: vertexCount }).forEach((_, vertexIndex) => {
    const localX = positionAttribute.getX(vertexIndex);
    const localZ = positionAttribute.getZ(vertexIndex);

    const worldX = localX + worldOffsetX;
    const worldZ = localZ + worldOffsetZ;

    const height = fractalNoise(worldX, worldZ, noiseConfig);
    positionAttribute.setY(vertexIndex, height);

    maxHeight = Math.max(maxHeight, Math.abs(height));
  });

  const normalizedMax = maxHeight || 1;

  Array.from({ length: vertexCount }).forEach((_, vertexIndex) => {
    const height = positionAttribute.getY(vertexIndex);
    const heightNormalized = Math.abs(height) / normalizedMax;
    const blendFactor = Math.min(heightNormalized / HEIGHT_COLOR_THRESHOLD, 1);
    const vertexColor = terrainBaseColor.clone().lerp(terrainPeakColor, blendFactor);

    colors[vertexIndex * 3] = vertexColor.r;
    colors[vertexIndex * 3 + 1] = vertexColor.g;
    colors[vertexIndex * 3 + 2] = vertexColor.b;
  });

  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();

  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    flatShading: true,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(
    worldOffsetX,
    0,
    worldOffsetZ
  );
  mesh.receiveShadow = true;
  mesh.name = `terrain-${chunkX},${chunkZ}`;

  return mesh;
};
