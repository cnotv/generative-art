import * as THREE from 'three';

const ELEMENT_COLORS = [0x8b4513, 0x228b22, 0x696969, 0x556b2f, 0xa0522d];
const ELEMENT_MIN_HEIGHT = 1;
const ELEMENT_MAX_HEIGHT = 4;
const ELEMENT_MIN_WIDTH = 0.5;
const ELEMENT_MAX_WIDTH = 1.5;

/**
 * Simple seeded random number generator (mulberry32).
 * Returns a function that produces deterministic values in [0, 1).
 */
const createSeededRandom = (seed: number): (() => number) => {
  let state = seed | 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let intermediate = Math.imul(state ^ (state >>> 15), 1 | state);
    intermediate = (intermediate + Math.imul(intermediate ^ (intermediate >>> 7), 61 | intermediate)) ^ intermediate;
    return ((intermediate ^ (intermediate >>> 14)) >>> 0) / 4294967296;
  };
};

/**
 * Computes a deterministic seed for a chunk based on its coordinates.
 */
const computeChunkSeed = (chunkX: number, chunkZ: number): number =>
  (chunkX * 73856093) ^ (chunkZ * 19349663);

/**
 * Creates a group of scattered geometric elements (cubes and cones) for a chunk.
 * Positions and sizes are deterministic based on chunk coordinates.
 */
export const createElementsChunk = (
  chunkX: number,
  chunkZ: number,
  chunkSize: number,
  elementsPerChunk: number
): THREE.Group => {
  const group = new THREE.Group();
  group.name = `elements-${chunkX},${chunkZ}`;

  const chunkSeed = computeChunkSeed(chunkX, chunkZ);
  const random = createSeededRandom(chunkSeed);

  const worldOffsetX = chunkX * chunkSize;
  const worldOffsetZ = chunkZ * chunkSize;
  const halfChunk = chunkSize / 2;

  Array.from({ length: elementsPerChunk }).forEach(() => {
    const positionX = worldOffsetX + (random() - 0.5) * chunkSize;
    const positionZ = worldOffsetZ + (random() - 0.5) * chunkSize;
    const height = ELEMENT_MIN_HEIGHT + random() * (ELEMENT_MAX_HEIGHT - ELEMENT_MIN_HEIGHT);
    const width = ELEMENT_MIN_WIDTH + random() * (ELEMENT_MAX_WIDTH - ELEMENT_MIN_WIDTH);
    const colorIndex = Math.floor(random() * ELEMENT_COLORS.length);
    const isCone = random() > 0.5;

    const geometry = isCone
      ? new THREE.ConeGeometry(width, height, 6)
      : new THREE.BoxGeometry(width, height, width);

    const material = new THREE.MeshStandardMaterial({
      color: ELEMENT_COLORS[colorIndex],
      flatShading: true,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(positionX, height / 2, positionZ);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    group.add(mesh);
  });

  return group;
};
