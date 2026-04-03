import * as THREE from 'three'
import type { ChunkKey, ChunkData, GeneratorConfig, WorldCase, HeightSampler } from './types'
import { createTerrainChunk, buildHeightSampler } from './terrainGenerator'
import { createGrassChunk } from './grassGenerator'
import { createTreesChunk } from './treeGenerator'

export const computeChunkKey = (chunkX: number, chunkZ: number): ChunkKey => `${chunkX},${chunkZ}`

export const parseChunkKey = (key: ChunkKey): [number, number] => {
  const [chunkX, chunkZ] = key.split(',').map(Number)
  return [chunkX, chunkZ]
}

export const computePlayerChunk = (
  position: THREE.Vector3,
  chunkSize: number
): [number, number] => [Math.floor(position.x / chunkSize), Math.floor(position.z / chunkSize)]

export const computeRequiredChunks = (
  centerX: number,
  centerZ: number,
  radius: number
): ChunkKey[] =>
  Array.from({ length: (radius * 2 + 1) ** 2 }, (_, index) => {
    const offsetX = (index % (radius * 2 + 1)) - radius
    const offsetZ = Math.floor(index / (radius * 2 + 1)) - radius
    return computeChunkKey(centerX + offsetX, centerZ + offsetZ)
  })

export const computeChunksToLoad = (
  requiredChunks: ChunkKey[],
  activeChunks: Map<ChunkKey, ChunkData>
): ChunkKey[] => requiredChunks.filter((key) => !activeChunks.has(key))

export const computeChunksToUnload = (
  activeChunks: Map<ChunkKey, ChunkData>,
  centerX: number,
  centerZ: number,
  unloadRadius: number
): ChunkKey[] =>
  [...activeChunks.keys()].filter((key) => {
    const [chunkX, chunkZ] = parseChunkKey(key)
    return Math.abs(chunkX - centerX) > unloadRadius || Math.abs(chunkZ - centerZ) > unloadRadius
  })

const GROUND_Y_OFFSET = 0.01

const createChunkGround = (
  chunkX: number,
  chunkZ: number,
  chunkSize: number,
  groundColor: number
): THREE.Mesh => {
  const geometry = new THREE.PlaneGeometry(chunkSize, chunkSize)
  geometry.rotateX(-Math.PI / 2)
  const material = new THREE.MeshLambertMaterial({ color: groundColor })
  const mesh = new THREE.Mesh(geometry, material)
  mesh.position.set(chunkX * chunkSize, GROUND_Y_OFFSET, chunkZ * chunkSize)
  mesh.receiveShadow = true
  return mesh
}

interface CreateChunkOptions {
  chunkX: number
  chunkZ: number
  scene: THREE.Scene
  generatorConfig: GeneratorConfig
  worldCase: WorldCase
  sharedGrassGeometry: THREE.BufferGeometry
  sharedGrassMaterial: THREE.Material
  treesPerChunk: number
  groundColor: number
  terrainBaseColor?: number
  terrainPeakColor?: number
  treeSizeScale?: number
  treeSizeVariation?: number
  spawnId?: string
  spawnVisibility?: Record<string, boolean>
  terrainSpawnId?: string
  treesSpawnId?: string
  grassSpawnId?: string
}

const tagSpawn = (object: THREE.Object3D | null, spawnId: string | undefined): void => {
  if (object && spawnId) object.userData.spawnId = spawnId
}

const resolveVisibility = (
  typeSpawnId: string | undefined,
  spawnVisibility: Record<string, boolean> | undefined
): boolean => {
  if (!typeSpawnId || !spawnVisibility || !(typeSpawnId in spawnVisibility)) return true
  return spawnVisibility[typeSpawnId]
}

interface ChunkLayerContext {
  chunkX: number
  chunkZ: number
  chunkSize: number
  worldCase: WorldCase
  scene: THREE.Scene
  spawnId?: string
  spawnVisibility?: Record<string, boolean>
}

const buildTerrainLayer = (
  ctx: ChunkLayerContext,
  noiseConfig: GeneratorConfig['noiseConfig'],
  terrainBaseColor: number | undefined,
  terrainPeakColor: number | undefined,
  terrainSpawnId: string | undefined
): { terrain: THREE.Mesh | null; heightSampler: HeightSampler | null } => {
  const { chunkX, chunkZ, chunkSize, worldCase, scene, spawnId, spawnVisibility } = ctx
  const terrain =
    worldCase === 'terrain' || worldCase === 'all'
      ? createTerrainChunk(chunkX, chunkZ, chunkSize, {
          noiseConfig,
          baseColor: terrainBaseColor,
          peakColor: terrainPeakColor
        })
      : null
  tagSpawn(terrain, spawnId)
  if (terrain) {
    terrain.visible = resolveVisibility(terrainSpawnId, spawnVisibility)
    scene.add(terrain)
  }
  const heightSampler: HeightSampler | null = terrain
    ? buildHeightSampler(terrain, chunkX, chunkZ, chunkSize)
    : null
  return { terrain, heightSampler }
}

const buildGroundLayer = (
  ctx: ChunkLayerContext,
  groundColor: number,
  treesSpawnId: string | undefined,
  grassSpawnId: string | undefined
): THREE.Mesh | null => {
  const { chunkX, chunkZ, chunkSize, worldCase, scene, spawnId, spawnVisibility } = ctx
  const ground =
    worldCase === 'trees' || worldCase === 'grass'
      ? createChunkGround(chunkX, chunkZ, chunkSize, groundColor)
      : null
  tagSpawn(ground, spawnId)
  if (ground) {
    ground.visible =
      resolveVisibility(treesSpawnId, spawnVisibility) ||
      resolveVisibility(grassSpawnId, spawnVisibility)
    scene.add(ground)
  }
  return ground
}

interface TreeLayerOptions {
  treesPerChunk: number
  heightSampler: HeightSampler | null
  treeSizeScale?: number
  treeSizeVariation?: number
  treesSpawnId?: string
}

const buildTreeLayer = (ctx: ChunkLayerContext, options: TreeLayerOptions): THREE.Group | null => {
  const { chunkX, chunkZ, chunkSize, worldCase, scene, spawnId, spawnVisibility } = ctx
  const { treesPerChunk, heightSampler, treeSizeScale, treeSizeVariation, treesSpawnId } = options
  const trees =
    worldCase === 'trees' || worldCase === 'all'
      ? createTreesChunk(chunkX, chunkZ, chunkSize, {
          treesPerChunk,
          heightSampler: heightSampler ?? undefined,
          sizeScale: treeSizeScale,
          sizeVariation: treeSizeVariation
        })
      : null
  tagSpawn(trees, spawnId)
  if (trees) {
    trees.visible = resolveVisibility(treesSpawnId, spawnVisibility)
    scene.add(trees)
  }
  return trees
}

interface GrassLayerOptions {
  grassPerChunk: number
  sharedGrassGeometry: THREE.BufferGeometry
  sharedGrassMaterial: THREE.Material
  heightSampler: HeightSampler | null
  grassSpawnId?: string
}

const buildGrassLayer = (
  ctx: ChunkLayerContext,
  options: GrassLayerOptions
): THREE.InstancedMesh | null => {
  const { chunkX, chunkZ, chunkSize, worldCase, scene, spawnId, spawnVisibility } = ctx
  const { grassPerChunk, sharedGrassGeometry, sharedGrassMaterial, heightSampler, grassSpawnId } =
    options
  const grass =
    worldCase === 'grass' || worldCase === 'all'
      ? createGrassChunk(chunkX, chunkZ, chunkSize, {
          grassPerChunk,
          sharedGeometry: sharedGrassGeometry,
          sharedMaterial: sharedGrassMaterial,
          heightSampler: heightSampler ?? undefined
        })
      : null
  if (grass && heightSampler) grass.userData.hasTerrainHeight = true
  tagSpawn(grass, spawnId)
  if (grass) {
    grass.visible = resolveVisibility(grassSpawnId, spawnVisibility)
    scene.add(grass)
  }
  return grass
}

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
  grassSpawnId
}: CreateChunkOptions): ChunkData => {
  const key = computeChunkKey(chunkX, chunkZ)
  const { chunkSize, noiseConfig, grassPerChunk } = config
  const ctx: ChunkLayerContext = {
    chunkX,
    chunkZ,
    chunkSize,
    worldCase,
    scene,
    spawnId,
    spawnVisibility
  }

  const { terrain, heightSampler } = buildTerrainLayer(
    ctx,
    noiseConfig,
    terrainBaseColor,
    terrainPeakColor,
    terrainSpawnId
  )
  const ground = buildGroundLayer(ctx, groundColor, treesSpawnId, grassSpawnId)
  const trees = buildTreeLayer(ctx, {
    treesPerChunk,
    heightSampler,
    treeSizeScale,
    treeSizeVariation,
    treesSpawnId
  })
  const grass = buildGrassLayer(ctx, {
    grassPerChunk,
    sharedGrassGeometry,
    sharedGrassMaterial,
    heightSampler,
    grassSpawnId
  })

  return { key, chunkX, chunkZ, terrain, heightSampler, elements: null, grass, trees, ground }
}

const disposeObject = (object: THREE.Object3D, scene: THREE.Scene): void => {
  scene.remove(object)
  if (object instanceof THREE.Mesh || object instanceof THREE.InstancedMesh) {
    object.geometry.dispose()
    if (Array.isArray(object.material)) {
      object.material.forEach((material) => material.dispose())
    } else {
      object.material.dispose()
    }
  }
}

export const disposeChunk = (chunk: ChunkData, scene: THREE.Scene): void => {
  if (chunk.terrain) disposeObject(chunk.terrain, scene)
  if (chunk.trees) scene.remove(chunk.trees) // shared geometry/materials — don't dispose per chunk
  if (chunk.ground) disposeObject(chunk.ground, scene)
  if (chunk.grass) scene.remove(chunk.grass) // shared geometry/material — don't dispose per chunk
}

interface UpdateChunksOptions {
  playerPosition: THREE.Vector3
  activeChunks: Map<ChunkKey, ChunkData>
  scene: THREE.Scene
  generatorConfig: GeneratorConfig
  worldCase: WorldCase
  viewRadius: number
  unloadRadius: number
  /** Chunk offset applied to the load/unload center on the Z axis (negative = forward in world space). */
  viewZOffset?: number
  /** Maximum number of new chunks to create per call. Defaults to all. */
  maxChunksPerUpdate?: number
  sharedGrassGeometry: THREE.BufferGeometry
  sharedGrassMaterial: THREE.Material
  treesPerChunk: number
  groundColor: number
  terrainBaseColor?: number
  terrainPeakColor?: number
  treeSizeScale?: number
  treeSizeVariation?: number
  spawnId?: string
  spawnVisibility?: Record<string, boolean>
  terrainSpawnId?: string
  treesSpawnId?: string
  grassSpawnId?: string
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
  grassSpawnId
}: UpdateChunksOptions): void => {
  const [playerChunkX, playerChunkZ] = computePlayerChunk(playerPosition, config.chunkSize)

  const centerZ = playerChunkZ + viewZOffset
  const requiredChunks = computeRequiredChunks(playerChunkX, centerZ, viewRadius)
  const chunksToUnload = computeChunksToUnload(activeChunks, playerChunkX, centerZ, unloadRadius)

  chunksToUnload.forEach((key) => {
    const chunk = activeChunks.get(key)
    if (chunk) {
      disposeChunk(chunk, scene)
      activeChunks.delete(key)
    }
  })

  const allChunksToLoad = computeChunksToLoad(requiredChunks, activeChunks).sort((a, b) => {
    const [ax, az] = parseChunkKey(a)
    const [bx, bz] = parseChunkKey(b)
    const distributionA = (ax - playerChunkX) ** 2 + (az - playerChunkZ) ** 2
    const distributionB = (bx - playerChunkX) ** 2 + (bz - playerChunkZ) ** 2
    return distributionA - distributionB
  })

  const chunksToLoad =
    maxChunksPerUpdate !== undefined
      ? allChunksToLoad.slice(0, maxChunksPerUpdate)
      : allChunksToLoad

  chunksToLoad.forEach((key) => {
    const [chunkX, chunkZ] = parseChunkKey(key)
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
      grassSpawnId
    })
    activeChunks.set(key, chunk)
  })
}

interface RebuildAllChunksOptions {
  activeChunks: Map<ChunkKey, ChunkData>
  scene: THREE.Scene
  generatorConfig: GeneratorConfig
  worldCase: WorldCase
  sharedGrassGeometry: THREE.BufferGeometry
  sharedGrassMaterial: THREE.Material
  treesPerChunk: number
  groundColor: number
  terrainBaseColor?: number
  terrainPeakColor?: number
  treeSizeScale?: number
  treeSizeVariation?: number
  spawnId?: string
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
  spawnId
}: RebuildAllChunksOptions): void => {
  const keys = [...activeChunks.keys()]

  keys.forEach((key) => {
    const chunk = activeChunks.get(key)
    if (chunk) {
      disposeChunk(chunk, scene)
      activeChunks.delete(key)
    }
  })

  keys.forEach((key) => {
    const [chunkX, chunkZ] = parseChunkKey(key)
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
      spawnId
    })
    activeChunks.set(key, chunk)
  })
}

interface ApplyWorldCaseOptions {
  scene: THREE.Scene
  generatorConfig: GeneratorConfig
  worldCase: WorldCase
  sharedGrassGeometry: THREE.BufferGeometry
  sharedGrassMaterial: THREE.Material
  treesPerChunk: number
  groundColor: number
  terrainBaseColor?: number
  terrainPeakColor?: number
  treeSizeScale?: number
  treeSizeVariation?: number
  spawnId?: string
}

interface ChunkMutationContext {
  chunk: ChunkData
  scene: THREE.Scene
  chunkSize: number
  noiseConfig: GeneratorConfig['noiseConfig']
  grassPerChunk: number
  treesPerChunk: number
  groundColor: number
  terrainBaseColor?: number
  terrainPeakColor?: number
  treeSizeScale?: number
  treeSizeVariation?: number
  sharedGrassGeometry: THREE.BufferGeometry
  sharedGrassMaterial: THREE.Material
  spawnId?: string
}

const ensureTerrainAndSampler = (ctx: ChunkMutationContext): void => {
  const { chunk, scene, chunkSize, noiseConfig, terrainBaseColor, terrainPeakColor, spawnId } = ctx
  if (!chunk.terrain) {
    chunk.terrain = createTerrainChunk(chunk.chunkX, chunk.chunkZ, chunkSize, {
      noiseConfig,
      baseColor: terrainBaseColor,
      peakColor: terrainPeakColor
    })
    if (spawnId) chunk.terrain.userData.spawnId = spawnId
    scene.add(chunk.terrain)
  }
  if (!chunk.heightSampler && chunk.terrain) {
    chunk.heightSampler = buildHeightSampler(chunk.terrain, chunk.chunkX, chunk.chunkZ, chunkSize)
  }
}

const ensureGround = (ctx: ChunkMutationContext): void => {
  const { chunk, scene, chunkSize, groundColor, spawnId } = ctx
  if (!chunk.ground) {
    chunk.ground = createChunkGround(chunk.chunkX, chunk.chunkZ, chunkSize, groundColor)
    if (spawnId) chunk.ground.userData.spawnId = spawnId
    scene.add(chunk.ground)
  } else {
    ;(chunk.ground.material as THREE.MeshLambertMaterial).color.set(groundColor)
  }
  chunk.ground.visible = true
}

const ensureTrees = (
  ctx: ChunkMutationContext,
  heightSampler: ChunkData['heightSampler'],
  requireTerrainHeight: boolean
): void => {
  const { chunk, scene, chunkSize, treesPerChunk, treeSizeScale, treeSizeVariation, spawnId } = ctx
  if (chunk.trees && chunk.trees.userData.hasTerrainHeight !== requireTerrainHeight) {
    scene.remove(chunk.trees)
    chunk.trees = null
  }
  if (!chunk.trees) {
    chunk.trees = createTreesChunk(chunk.chunkX, chunk.chunkZ, chunkSize, {
      treesPerChunk,
      heightSampler: requireTerrainHeight ? (heightSampler ?? undefined) : undefined,
      sizeScale: treeSizeScale,
      sizeVariation: treeSizeVariation
    })
    chunk.trees.userData.hasTerrainHeight = requireTerrainHeight
    if (spawnId) chunk.trees.userData.spawnId = spawnId
    scene.add(chunk.trees)
  }
  chunk.trees.visible = true
}

const ensureGrass = (
  ctx: ChunkMutationContext,
  heightSampler: ChunkData['heightSampler'],
  requireTerrainHeight: boolean
): void => {
  const {
    chunk,
    scene,
    chunkSize,
    grassPerChunk,
    sharedGrassGeometry,
    sharedGrassMaterial,
    spawnId
  } = ctx
  if (chunk.grass && chunk.grass.userData.hasTerrainHeight !== requireTerrainHeight) {
    scene.remove(chunk.grass)
    chunk.grass = null
  }
  if (!chunk.grass) {
    chunk.grass = createGrassChunk(chunk.chunkX, chunk.chunkZ, chunkSize, {
      grassPerChunk,
      sharedGeometry: sharedGrassGeometry,
      sharedMaterial: sharedGrassMaterial,
      heightSampler: requireTerrainHeight ? (heightSampler ?? undefined) : undefined
    })
    chunk.grass.userData.hasTerrainHeight = requireTerrainHeight
    if (spawnId) chunk.grass.userData.spawnId = spawnId
    scene.add(chunk.grass)
  }
  chunk.grass.visible = true
}

const applyTerrainCase = (ctx: ChunkMutationContext): void => {
  ensureTerrainAndSampler(ctx)
  ctx.chunk.terrain!.visible = true
}

const applyAllCase = (ctx: ChunkMutationContext): void => {
  ensureTerrainAndSampler(ctx)
  ctx.chunk.terrain!.visible = true
  ensureTrees(ctx, ctx.chunk.heightSampler, true)
  ensureGrass(ctx, ctx.chunk.heightSampler, true)
}

const applyTreesCase = (ctx: ChunkMutationContext): void => {
  ensureGround(ctx)
  ensureTrees(ctx, undefined, false)
}

const applyGrassCase = (ctx: ChunkMutationContext): void => {
  ensureGround(ctx)
  ensureGrass(ctx, undefined, false)
}

const WORLD_CASE_HANDLERS: Record<string, (ctx: ChunkMutationContext) => void> = {
  terrain: applyTerrainCase,
  all: applyAllCase,
  trees: applyTreesCase,
  grass: applyGrassCase
}

const setChunkWorldCaseVisibility = (chunk: ChunkData, options: ApplyWorldCaseOptions): void => {
  const {
    scene,
    generatorConfig,
    worldCase,
    sharedGrassGeometry,
    sharedGrassMaterial,
    treesPerChunk,
    groundColor,
    terrainBaseColor,
    terrainPeakColor,
    treeSizeScale,
    treeSizeVariation,
    spawnId
  } = options
  const { chunkSize, noiseConfig, grassPerChunk } = generatorConfig

  if (chunk.terrain) chunk.terrain.visible = false
  if (chunk.trees) chunk.trees.visible = false
  if (chunk.grass) chunk.grass.visible = false
  if (chunk.ground) chunk.ground.visible = false

  const ctx: ChunkMutationContext = {
    chunk,
    scene,
    chunkSize,
    noiseConfig,
    grassPerChunk,
    treesPerChunk,
    groundColor,
    terrainBaseColor,
    terrainPeakColor,
    treeSizeScale,
    treeSizeVariation,
    sharedGrassGeometry,
    sharedGrassMaterial,
    spawnId
  }

  const handler = WORLD_CASE_HANDLERS[worldCase]
  if (handler) handler(ctx)
}

export const applyWorldCaseToAllChunks = (
  activeChunks: Map<ChunkKey, ChunkData>,
  options: ApplyWorldCaseOptions
): void => {
  activeChunks.forEach((chunk) => setChunkWorldCaseVisibility(chunk, options))
}
