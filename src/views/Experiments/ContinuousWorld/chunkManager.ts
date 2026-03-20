import * as THREE from 'three';
import type { ChunkKey, ChunkData, GeneratorConfig, WorldCase, HeightSampler } from './types';
import { createTerrainChunk, buildHeightSampler } from './terrainGenerator';
import { createGrassChunk } from './grassGenerator';
import { createTreesChunk } from './treeGenerator';

export const computeChunkKey = (chunkX: number, chunkZ: number): ChunkKey =>
  `${chunkX},${chunkZ}`;

export const parseChunkKey = (key: ChunkKey): [number, number] => {
  const [chunkX, chunkZ] = key.split(',').map(Number);
  return [chunkX, chunkZ];
};

export const computePlayerChunk = (
  position: THREE.Vector3,
  chunkSize: number
): [number, number] => [
  Math.floor(position.x / chunkSize),
  Math.floor(position.z / chunkSize),
];

export const computeRequiredChunks = (
  centerX: number,
  centerZ: number,
  radius: number
): ChunkKey[] =>
  Array.from({ length: (radius * 2 + 1) ** 2 }, (_, index) => {
    const offsetX = (index % (radius * 2 + 1)) - radius;
    const offsetZ = Math.floor(index / (radius * 2 + 1)) - radius;
    return computeChunkKey(centerX + offsetX, centerZ + offsetZ);
  });

export const computeChunksToLoad = (
  requiredChunks: ChunkKey[],
  activeChunks: Map<ChunkKey, ChunkData>
): ChunkKey[] =>
  requiredChunks.filter((key) => !activeChunks.has(key));

export const computeChunksToUnload = (
  activeChunks: Map<ChunkKey, ChunkData>,
  centerX: number,
  centerZ: number,
  unloadRadius: number
): ChunkKey[] =>
  [...activeChunks.keys()].filter((key) => {
    const [chunkX, chunkZ] = parseChunkKey(key);
    return (
      Math.abs(chunkX - centerX) > unloadRadius ||
      Math.abs(chunkZ - centerZ) > unloadRadius
    );
  });

const GROUND_Y_OFFSET = 0.01;

const createChunkGround = (
  chunkX: number,
  chunkZ: number,
  chunkSize: number,
  groundColor: number,
): THREE.Mesh => {
  const geometry = new THREE.PlaneGeometry(chunkSize, chunkSize);
  geometry.rotateX(-Math.PI / 2);
  const material = new THREE.MeshLambertMaterial({ color: groundColor });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(chunkX * chunkSize, GROUND_Y_OFFSET, chunkZ * chunkSize);
  mesh.receiveShadow = true;
  return mesh;
};

interface CreateChunkOptions {
  chunkX: number;
  chunkZ: number;
  scene: THREE.Scene;
  generatorConfig: GeneratorConfig;
  worldCase: WorldCase;
  sharedGrassGeometry: THREE.BufferGeometry;
  sharedGrassMaterial: THREE.Material;
  treesPerChunk: number;
  groundColor: number;
  terrainBaseColor?: number;
  terrainPeakColor?: number;
  treeSizeScale?: number;
  treeSizeVariation?: number;
  spawnId?: string;
  spawnVisibility?: Record<string, boolean>;
  terrainSpawnId?: string;
  treesSpawnId?: string;
  grassSpawnId?: string;
}

const tagSpawn = (object: THREE.Object3D | null, spawnId: string | undefined): void => {
  if (object && spawnId) object.userData.spawnId = spawnId;
};

const resolveVisibility = (
  typeSpawnId: string | undefined,
  spawnVisibility: Record<string, boolean> | undefined,
): boolean => {
  if (!typeSpawnId || !spawnVisibility || !(typeSpawnId in spawnVisibility)) return true;
  return spawnVisibility[typeSpawnId];
};

export const createChunk = ({
  chunkX,
  chunkZ,
  scene,
  generatorConfig: config,
  worldCase,
  sharedGrassGeometry,
  sharedGrassMaterial,
  treesPerChunk,
  groundColor,
  terrainBaseColor,
  terrainPeakColor,
  treeSizeScale,
  treeSizeVariation,
  spawnId,
  spawnVisibility,
  terrainSpawnId,
  treesSpawnId,
  grassSpawnId,
}: CreateChunkOptions): ChunkData => {
  const key = computeChunkKey(chunkX, chunkZ);
  const { chunkSize, noiseConfig, grassPerChunk } = config;

  // Case 'terrain' / 'all': procedural terrain heightmap
  const terrain = (worldCase === 'terrain' || worldCase === 'all')
    ? createTerrainChunk(chunkX, chunkZ, chunkSize, noiseConfig, terrainBaseColor, terrainPeakColor)
    : null;
  tagSpawn(terrain, spawnId);
  if (terrain) {
    terrain.visible = resolveVisibility(terrainSpawnId, spawnVisibility);
    scene.add(terrain);
  }

  // Build height sampler from terrain vertex data — reused by trees and grass
  // to avoid redundant fractalNoise calls per instance.
  const heightSampler: HeightSampler | null = terrain
    ? buildHeightSampler(terrain, chunkX, chunkZ, chunkSize)
    : null;

  // Flat ground plane for trees and grass cases
  const ground = (worldCase === 'trees' || worldCase === 'grass')
    ? createChunkGround(chunkX, chunkZ, chunkSize, groundColor)
    : null;
  tagSpawn(ground, spawnId);
  if (ground) {
    const groundVisible =
      resolveVisibility(treesSpawnId, spawnVisibility) ||
      resolveVisibility(grassSpawnId, spawnVisibility);
    ground.visible = groundVisible;
    scene.add(ground);
  }

  // Case 'trees': textured billboards on flat ground
  // Case 'all': billboards placed at terrain height via sampler
  const trees = (worldCase === 'trees' || worldCase === 'all')
    ? createTreesChunk(chunkX, chunkZ, chunkSize, treesPerChunk, heightSampler ?? undefined, treeSizeScale, treeSizeVariation)
    : null;
  tagSpawn(trees, spawnId);
  if (trees) {
    trees.visible = resolveVisibility(treesSpawnId, spawnVisibility);
    scene.add(trees);
  }

  // Case 'grass' / 'all': instanced grass blades at terrain height via sampler
  const grass = (worldCase === 'grass' || worldCase === 'all')
    ? createGrassChunk(
        chunkX, chunkZ, chunkSize, grassPerChunk,
        sharedGrassGeometry, sharedGrassMaterial,
        heightSampler ?? undefined
      )
    : null;
  if (grass && heightSampler) grass.userData.hasTerrainHeight = true;
  tagSpawn(grass, spawnId);
  if (grass) {
    grass.visible = resolveVisibility(grassSpawnId, spawnVisibility);
    scene.add(grass);
  }

  return { key, chunkX, chunkZ, terrain, heightSampler, elements: null, grass, trees, ground };
};

const disposeGroupChildren = (group: THREE.Group, scene: THREE.Scene): void => {
  group.children.forEach((child) => {
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose();
      if (Array.isArray(child.material)) {
        child.material.forEach((material) => material.dispose());
      } else {
        child.material.dispose();
      }
    }
  });
  scene.remove(group);
};

const disposeObject = (object: THREE.Object3D, scene: THREE.Scene): void => {
  scene.remove(object);
  if (object instanceof THREE.Mesh || object instanceof THREE.InstancedMesh) {
    object.geometry.dispose();
    if (Array.isArray(object.material)) {
      object.material.forEach((material) => material.dispose());
    } else {
      object.material.dispose();
    }
  }
};

export const disposeChunk = (chunk: ChunkData, scene: THREE.Scene): void => {
  if (chunk.terrain) disposeObject(chunk.terrain, scene);
  if (chunk.trees) scene.remove(chunk.trees); // shared geometry/materials — don't dispose per chunk
  if (chunk.ground) disposeObject(chunk.ground, scene);
  if (chunk.grass) scene.remove(chunk.grass); // shared geometry/material — don't dispose per chunk
};

interface UpdateChunksOptions {
  playerPosition: THREE.Vector3;
  activeChunks: Map<ChunkKey, ChunkData>;
  scene: THREE.Scene;
  generatorConfig: GeneratorConfig;
  worldCase: WorldCase;
  viewRadius: number;
  unloadRadius: number;
  /** Chunk offset applied to the load/unload center on the Z axis (negative = forward in world space). */
  viewZOffset?: number;
  /** Maximum number of new chunks to create per call. Defaults to all. */
  maxChunksPerUpdate?: number;
  sharedGrassGeometry: THREE.BufferGeometry;
  sharedGrassMaterial: THREE.Material;
  treesPerChunk: number;
  groundColor: number;
  terrainBaseColor?: number;
  terrainPeakColor?: number;
  treeSizeScale?: number;
  treeSizeVariation?: number;
  spawnId?: string;
  spawnVisibility?: Record<string, boolean>;
  terrainSpawnId?: string;
  treesSpawnId?: string;
  grassSpawnId?: string;
}

/**
 * Updates chunks around the player position.
 * Loads new chunks within viewRadius, unloads chunks beyond unloadRadius.
 */
export const updateChunks = ({
  playerPosition,
  activeChunks,
  scene,
  generatorConfig: config,
  worldCase,
  viewRadius,
  unloadRadius,
  viewZOffset = 0,
  maxChunksPerUpdate,
  sharedGrassGeometry,
  sharedGrassMaterial,
  treesPerChunk,
  groundColor,
  terrainBaseColor,
  terrainPeakColor,
  treeSizeScale,
  treeSizeVariation,
  spawnId,
  spawnVisibility,
  terrainSpawnId,
  treesSpawnId,
  grassSpawnId,
}: UpdateChunksOptions): void => {
  const [playerChunkX, playerChunkZ] = computePlayerChunk(
    playerPosition,
    config.chunkSize
  );

  const centerZ = playerChunkZ + viewZOffset;
  const requiredChunks = computeRequiredChunks(playerChunkX, centerZ, viewRadius);
  const chunksToUnload = computeChunksToUnload(activeChunks, playerChunkX, centerZ, unloadRadius);

  chunksToUnload.forEach((key) => {
    const chunk = activeChunks.get(key);
    if (chunk) {
      disposeChunk(chunk, scene);
      activeChunks.delete(key);
    }
  });

  const allChunksToLoad = computeChunksToLoad(requiredChunks, activeChunks)
    .sort((a, b) => {
      const [ax, az] = parseChunkKey(a);
      const [bx, bz] = parseChunkKey(b);
      const distributionA = (ax - playerChunkX) ** 2 + (az - playerChunkZ) ** 2;
      const distributionB = (bx - playerChunkX) ** 2 + (bz - playerChunkZ) ** 2;
      return distributionA - distributionB;
    });

  const chunksToLoad = maxChunksPerUpdate !== undefined
    ? allChunksToLoad.slice(0, maxChunksPerUpdate)
    : allChunksToLoad;

  chunksToLoad.forEach((key) => {
    const [chunkX, chunkZ] = parseChunkKey(key);
    const chunk = createChunk({
      chunkX,
      chunkZ,
      scene,
      generatorConfig: config,
      worldCase,
      sharedGrassGeometry,
      sharedGrassMaterial,
      treesPerChunk,
      groundColor,
      terrainBaseColor,
      terrainPeakColor,
      treeSizeScale,
      treeSizeVariation,
      spawnId,
      spawnVisibility,
      terrainSpawnId,
      treesSpawnId,
      grassSpawnId,
    });
    activeChunks.set(key, chunk);
  });
};

interface RebuildAllChunksOptions {
  activeChunks: Map<ChunkKey, ChunkData>;
  scene: THREE.Scene;
  generatorConfig: GeneratorConfig;
  worldCase: WorldCase;
  sharedGrassGeometry: THREE.BufferGeometry;
  sharedGrassMaterial: THREE.Material;
  treesPerChunk: number;
  groundColor: number;
  terrainBaseColor?: number;
  terrainPeakColor?: number;
  treeSizeScale?: number;
  treeSizeVariation?: number;
  spawnId?: string;
}

export const rebuildAllChunks = ({
  activeChunks,
  scene,
  generatorConfig: config,
  worldCase,
  sharedGrassGeometry,
  sharedGrassMaterial,
  treesPerChunk,
  groundColor,
  terrainBaseColor,
  terrainPeakColor,
  treeSizeScale,
  treeSizeVariation,
  spawnId,
}: RebuildAllChunksOptions): void => {
  const keys = [...activeChunks.keys()];

  keys.forEach((key) => {
    const chunk = activeChunks.get(key);
    if (chunk) {
      disposeChunk(chunk, scene);
      activeChunks.delete(key);
    }
  });

  keys.forEach((key) => {
    const [chunkX, chunkZ] = parseChunkKey(key);
    const chunk = createChunk({
      chunkX,
      chunkZ,
      scene,
      generatorConfig: config,
      worldCase,
      sharedGrassGeometry,
      sharedGrassMaterial,
      treesPerChunk,
      groundColor,
      terrainBaseColor,
      terrainPeakColor,
      treeSizeScale,
      treeSizeVariation,
      spawnId,
    });
    activeChunks.set(key, chunk);
  });
};

interface ApplyWorldCaseOptions {
  scene: THREE.Scene;
  generatorConfig: GeneratorConfig;
  worldCase: WorldCase;
  sharedGrassGeometry: THREE.BufferGeometry;
  sharedGrassMaterial: THREE.Material;
  treesPerChunk: number;
  groundColor: number;
  terrainBaseColor?: number;
  terrainPeakColor?: number;
  treeSizeScale?: number;
  treeSizeVariation?: number;
  spawnId?: string;
}

const setChunkWorldCaseVisibility = (
  chunk: ChunkData,
  options: ApplyWorldCaseOptions,
): void => {
  const { scene, generatorConfig, worldCase, sharedGrassGeometry, sharedGrassMaterial, treesPerChunk, groundColor, terrainBaseColor, terrainPeakColor, treeSizeScale, treeSizeVariation, spawnId } = options;
  const { chunkSize, noiseConfig, grassPerChunk } = generatorConfig;

  if (chunk.terrain) chunk.terrain.visible = false;
  if (chunk.trees) chunk.trees.visible = false;
  if (chunk.grass) chunk.grass.visible = false;
  if (chunk.ground) chunk.ground.visible = false;

  const ensureTerrain = (): void => {
    if (!chunk.terrain) {
      chunk.terrain = createTerrainChunk(chunk.chunkX, chunk.chunkZ, chunkSize, noiseConfig, terrainBaseColor, terrainPeakColor);
      if (spawnId) chunk.terrain.userData.spawnId = spawnId;
      scene.add(chunk.terrain);
    }
    if (!chunk.heightSampler && chunk.terrain) {
      chunk.heightSampler = buildHeightSampler(chunk.terrain, chunk.chunkX, chunk.chunkZ, chunkSize);
    }
  };

  if (worldCase === 'terrain') {
    ensureTerrain();
    chunk.terrain!.visible = true;
  } else if (worldCase === 'all') {
    ensureTerrain();
    chunk.terrain!.visible = true;

    // Recreate trees if they were placed at flat height (from 'trees' case)
    if (chunk.trees && !chunk.trees.userData.hasTerrainHeight) {
      scene.remove(chunk.trees);
      chunk.trees = null;
    }
    if (!chunk.trees) {
      chunk.trees = createTreesChunk(chunk.chunkX, chunk.chunkZ, chunkSize, treesPerChunk, chunk.heightSampler ?? undefined, treeSizeScale, treeSizeVariation);
      chunk.trees.userData.hasTerrainHeight = true;
      if (spawnId) chunk.trees.userData.spawnId = spawnId;
      scene.add(chunk.trees);
    }
    chunk.trees.visible = true;

    if (chunk.grass && !chunk.grass.userData.hasTerrainHeight) {
      scene.remove(chunk.grass);
      chunk.grass = null;
    }
    if (!chunk.grass) {
      chunk.grass = createGrassChunk(
        chunk.chunkX, chunk.chunkZ, chunkSize, grassPerChunk,
        sharedGrassGeometry, sharedGrassMaterial, chunk.heightSampler ?? undefined
      );
      chunk.grass.userData.hasTerrainHeight = true;
      if (spawnId) chunk.grass.userData.spawnId = spawnId;
      scene.add(chunk.grass);
    }
    chunk.grass.visible = true;
  } else if (worldCase === 'trees') {
    if (!chunk.ground) {
      chunk.ground = createChunkGround(chunk.chunkX, chunk.chunkZ, chunkSize, groundColor);
      if (spawnId) chunk.ground.userData.spawnId = spawnId;
      scene.add(chunk.ground);
    } else {
      (chunk.ground.material as THREE.MeshLambertMaterial).color.set(groundColor);
    }
    chunk.ground.visible = true;

    // Recreate trees if they were placed at terrain height (from 'all' case)
    if (chunk.trees && chunk.trees.userData.hasTerrainHeight) {
      scene.remove(chunk.trees);
      chunk.trees = null;
    }
    if (!chunk.trees) {
      chunk.trees = createTreesChunk(chunk.chunkX, chunk.chunkZ, chunkSize, treesPerChunk, undefined, treeSizeScale, treeSizeVariation);
      if (spawnId) chunk.trees.userData.spawnId = spawnId;
      scene.add(chunk.trees);
    }
    chunk.trees.visible = true;
  } else if (worldCase === 'grass') {
    if (!chunk.ground) {
      chunk.ground = createChunkGround(chunk.chunkX, chunk.chunkZ, chunkSize, groundColor);
      if (spawnId) chunk.ground.userData.spawnId = spawnId;
      scene.add(chunk.ground);
    } else {
      (chunk.ground.material as THREE.MeshLambertMaterial).color.set(groundColor);
    }
    chunk.ground.visible = true;

    if (!chunk.grass) {
      chunk.grass = createGrassChunk(
        chunk.chunkX, chunk.chunkZ, chunkSize, grassPerChunk,
        sharedGrassGeometry, sharedGrassMaterial
      );
      if (spawnId) chunk.grass.userData.spawnId = spawnId;
      scene.add(chunk.grass);
    }
    chunk.grass.visible = true;
  }
};

export const applyWorldCaseToAllChunks = (
  activeChunks: Map<ChunkKey, ChunkData>,
  options: ApplyWorldCaseOptions,
): void => {
  activeChunks.forEach(chunk => setChunkWorldCaseVisibility(chunk, options));
};
