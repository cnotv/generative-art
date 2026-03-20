import type * as THREE from 'three';

export type WorldCase = 'terrain' | 'trees' | 'grass' | 'all';

export type ChunkKey = `${number},${number}`;

/** Bilinear height lookup built from a terrain mesh's vertex buffer. */
export type HeightSampler = (worldX: number, worldZ: number) => number;

export interface ChunkData {
  key: ChunkKey;
  chunkX: number;
  chunkZ: number;
  terrain: THREE.Mesh | null;
  heightSampler: HeightSampler | null;
  elements: THREE.Group | null;
  grass: THREE.InstancedMesh | null;
  trees: THREE.Group | null;
  ground: THREE.Mesh | null;
}

export interface NoiseConfig {
  seed: number;
  octaves: number;
  frequency: number;
  amplitude: number;
  lacunarity: number;
  persistence: number;
}

export interface GeneratorConfig {
  chunkSize: number;
  elementsPerChunk: number;
  grassPerChunk: number;
  noiseConfig: NoiseConfig;
}
