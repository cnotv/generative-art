import * as THREE from 'three';
import type { NoiseConfig } from './types';
import { fractalNoise } from './noise';

const TERRAIN_SEGMENTS = 16;
const TERRAIN_BASE_COLOR = new THREE.Color(0x4a7c3f);
const TERRAIN_PEAK_COLOR = new THREE.Color(0x8b7355);
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
  noiseConfig: NoiseConfig
): THREE.Mesh => {
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
    const vertexColor = TERRAIN_BASE_COLOR.clone().lerp(TERRAIN_PEAK_COLOR, blendFactor);

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
