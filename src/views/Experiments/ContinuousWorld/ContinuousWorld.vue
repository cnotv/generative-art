<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, toRaw, watch } from "vue";
import { useRoute } from "vue-router";
import { cameraFollowPlayer, getModel } from "@webgamekit/threejs";
import {
  getRotation,
  createTimelineManager,
  updateAnimation,
} from "@webgamekit/animation";
import { createControls } from "@webgamekit/controls";
import { useSceneViewStore } from "@/stores/sceneView";
import { useDebugSceneStore } from "@/stores/debugScene";
import { useElementPropertiesStore } from "@/stores/elementProperties";
import {
  registerViewConfig,
  unregisterViewConfig,
  updateViewSchema,
  createReactiveConfig,
} from "@/stores/viewConfig";
import { useSceneConfigStore, globalSceneSchema } from "@/stores/sceneConfig";
import { useViewPanelsStore } from "@/stores/viewPanels";
import { registerLightProperties } from "@/utils/lightProperties";
import { useQueryParameters } from "@/utils/queryParameters";
import { setNestedValueImmutable } from "@/utils/nestedObjects";
import {
  setupConfig,
  playerSettings,
  controlBindings,
  generatorConfig,
  noiseConfig,
  VIEW_RADIUS,
  CHUNK_SIZE,
  UNLOAD_RADIUS,
  CAMERA_OFFSET,
  CAMERA_FOLLOW_FREQUENCY,
  CHUNK_UPDATE_FREQUENCY,
  MAX_CHUNKS_PER_UPDATE,
  DEFAULT_WORLD_CASE,
  FORWARD_BIAS,
  CAMERA_Y_LERP_SPEED,
  TREES_PER_CHUNK,
  MOVEMENT_SPEED_SCALE,
  GRASS_DENSITY_MULTIPLIER,
  TREES_GROUND_COLOR,
  GRASS_GROUND_COLOR,
  TERRAIN_BASE_COLOR,
  TERRAIN_PEAK_COLOR,
  GRASS_COLOR,
  GRASS_BLADE_SCALE,
  TREE_SIZE_SCALE,
  TREE_SIZE_VARIATION,
  DIRECTIONAL_LIGHT_OFFSET,
  AMBIENT_LIGHT_NAME,
  DIRECTIONAL_LIGHT_NAME,
  configControls,
  baseConfigControls,
  densityControl,
  proceduralConfigControls,
} from "./config";
import {
  updateChunks,
  rebuildAllChunks,
  applyWorldCaseToAllChunks,
  computeChunkKey,
} from "./chunkManager";
import { createGrassBladeGeometry, createGrassMaterial } from "./grassGenerator";
import type { ChunkKey, ChunkData, WorldCase } from "./types";
import * as THREE from "three";

const route = useRoute();
const canvas = ref<HTMLCanvasElement | null>(null);
const store = useSceneViewStore();
const { setViewPanels, clearViewPanels } = useViewPanelsStore();

const { destroyControls, currentActions } = createControls(controlBindings);

const { readQueryParameters, syncQueryParameters } = useQueryParameters(configControls);

const defaultConfig = {
  autoWalk: true,
  freeCamera: false,
  movementSpeed: 8,
  cameraFollowFrequency: CAMERA_FOLLOW_FREQUENCY,
  chunkSize: CHUNK_SIZE,
  viewRadius: VIEW_RADIUS,
  treeDensity: TREES_PER_CHUNK,
  grassDensity: 60,
  forwardBias: FORWARD_BIAS,
  treesGroundColor: TREES_GROUND_COLOR,
  grassGroundColor: GRASS_GROUND_COLOR,
  terrainBaseColor: TERRAIN_BASE_COLOR,
  terrainPeakColor: TERRAIN_PEAK_COLOR,
  grassColor: GRASS_COLOR,
  grassBladeScale: GRASS_BLADE_SCALE,
  treeSizeScale: TREE_SIZE_SCALE,
  treeSizeVariation: TREE_SIZE_VARIATION,
  worldCase: DEFAULT_WORLD_CASE,
  procedural: {
    seed: noiseConfig.seed,
    frequency: noiseConfig.frequency,
    amplitude: noiseConfig.amplitude,
    octaves: noiseConfig.octaves,
    lacunarity: noiseConfig.lacunarity,
    persistence: noiseConfig.persistence,
  },
};

const reactiveConfig = createReactiveConfig(readQueryParameters(defaultConfig));
const isSceneReady = ref(false);

watch(
  () => JSON.stringify(reactiveConfig.value),
  () => {
    if (isSceneReady.value) {
      syncQueryParameters(reactiveConfig.value as Record<string, unknown>);
    }
  },
);

let sharedGrassGeometry: THREE.BufferGeometry | null = null;
let sharedGrassMaterial: THREE.MeshPhysicalMaterial | null = null;
let sceneReference: THREE.Scene | null = null;
let activeChunksReference: Map<ChunkKey, ChunkData> | null = null;
let playerMeshReference: Awaited<ReturnType<typeof getModel>> | null = null;
let playerBottomOffsetReference: number | null = null;
let cameraReference: THREE.PerspectiveCamera | null = null;
let getDeltaReference: (() => number) | null = null;
let directionalLightReference: THREE.DirectionalLight | undefined;
const terrainRaycaster = new THREE.Raycaster();
terrainRaycaster.ray.direction.set(0, -1, 0);
let cameraFrameCounter = 0;
let freeCameraRotationY = 0;

const initializeWorld = async (
  scene: THREE.Scene,
  world: Parameters<typeof getModel>[1]
) => {
  const playerMesh = await getModel(scene, world, playerSettings.model.path, {
    name: "Player",
    position: playerSettings.model.position,
    rotation: playerSettings.model.rotation,
    scale: playerSettings.model.scale,
    castShadow: true,
  });

  sharedGrassGeometry = createGrassBladeGeometry((reactiveConfig.value.grassBladeScale as number | undefined) ?? GRASS_BLADE_SCALE);
  sharedGrassMaterial = createGrassMaterial((reactiveConfig.value.grassColor as number | undefined) ?? GRASS_COLOR);
  sceneReference = scene;

  const activeChunks = new Map<ChunkKey, ChunkData>();
  activeChunksReference = activeChunks;

  const initialViewRadius = (reactiveConfig.value.viewRadius as number | undefined) ?? VIEW_RADIUS;
  updateChunks({
    playerPosition: playerMesh.position,
    activeChunks,
    scene,
    generatorConfig: buildGeneratorConfig(),
    worldCase: reactiveConfig.value.worldCase as WorldCase,
    viewRadius: initialViewRadius,
    unloadRadius: UNLOAD_RADIUS,
    viewZOffset: getViewZOffset(),
    maxChunksPerUpdate: MAX_CHUNKS_PER_UPDATE,
    ...buildChunkOptions(),
  });

  const playerBBox = new THREE.Box3().setFromObject(playerMesh);
  const playerBottomOffset = -playerBBox.min.y + playerSettings.model.groundOffset;
  playerMesh.position.y = playerBottomOffset;

  const directionalLight = scene.getObjectByName(DIRECTIONAL_LIGHT_NAME) as
    | THREE.DirectionalLight
    | undefined;
  return { playerMesh, activeChunks, directionalLight, playerBottomOffset };
};

const updateDirectionalLight = (
  light: THREE.DirectionalLight,
  target: THREE.Object3D
): void => {
  light.position.set(
    target.position.x + DIRECTIONAL_LIGHT_OFFSET[0],
    target.position.y + DIRECTIONAL_LIGHT_OFFSET[1],
    target.position.z + DIRECTIONAL_LIGHT_OFFSET[2]
  );
  light.target.position.copy(target.position);
  light.target.updateMatrixWorld();
};

const initializeSceneRegistrations = (scene: THREE.Scene) => {
  registerSceneLights(scene);
  registerWorldSpawns();
  registerWorldElementProperties();
};

const registerSceneLights = (scene: THREE.Scene) => {
  const lightConfig = [
    { objectName: AMBIENT_LIGHT_NAME, title: "Ambient Light" },
    { objectName: DIRECTIONAL_LIGHT_NAME, title: "Directional Light" },
  ] as const;

  lightConfig.forEach(({ objectName, title }) => {
    const light = scene.getObjectByName(objectName);
    if (light) {
      registerLightProperties({
        light: (light as unknown) as {
          color: { getHex: () => number; set: (value: number) => void };
          intensity: number;
        },
        name: objectName,
        title,
      });
    }
  });
};

const HALF_CIRCLE_DEGREES = 180;
const DEGREES_TO_RADIANS = Math.PI / HALF_CIRCLE_DEGREES;
const TERRAIN_RAYCAST_ORIGIN_Y = 200;

const applyRotation = (mesh: THREE.Object3D, degrees: number) => {
  mesh.rotation.y = degrees * DEGREES_TO_RADIANS;
};

const moveForward = (mesh: THREE.Object3D, distance: number) => {
  const direction = new THREE.Vector3(0, 0, -1);
  direction.applyQuaternion(mesh.quaternion);
  mesh.position.addScaledVector(direction, distance);
};

const snapToTerrain = (
  playerMesh: THREE.Object3D,
  activeChunks: Map<ChunkKey, ChunkData>,
  chunkSize: number,
  raycaster: THREE.Raycaster,
  bottomOffset: number,
): void => {
  const cx = Math.round(playerMesh.position.x / chunkSize);
  const cz = Math.round(playerMesh.position.z / chunkSize);
  const terrainMesh = activeChunks.get(computeChunkKey(cx, cz))?.terrain;
  if (!terrainMesh) return;
  raycaster.ray.origin.set(
    playerMesh.position.x,
    TERRAIN_RAYCAST_ORIGIN_Y,
    playerMesh.position.z
  );
  const hits = raycaster.intersectObject(terrainMesh, false);
  if (hits.length > 0) playerMesh.position.y = hits[0].point.y + bottomOffset;
};

const applyTerrainSnap = (): void => {
  if (!playerMeshReference || !activeChunksReference) return;
  const worldCase = reactiveConfig.value.worldCase as WorldCase;
  if (worldCase === 'terrain' || worldCase === 'all') {
    const chunkSize = (reactiveConfig.value.chunkSize as number | undefined) ?? CHUNK_SIZE;
    snapToTerrain(playerMeshReference, activeChunksReference, chunkSize, terrainRaycaster, playerBottomOffsetReference ?? 0);
  }
  if (directionalLightReference) updateDirectionalLight(directionalLightReference, playerMeshReference);
};

const applyCameraFollow = (): void => {
  if (!cameraReference || !playerMeshReference || !getDeltaReference) return;
  const orbit = toRaw(store.orbitReference);
  cameraFollowPlayer(cameraReference, playerMeshReference, CAMERA_OFFSET, orbit as Parameters<typeof cameraFollowPlayer>[3], ["x", "z"]);
  const targetCameraY = playerMeshReference.position.y + CAMERA_OFFSET[1];
  const cameraYDiff = targetCameraY - cameraReference.position.y;
  const cameraYStep = cameraYDiff * Math.abs(cameraYDiff) * CAMERA_Y_LERP_SPEED * getDeltaReference();
  cameraReference.position.y += Math.abs(cameraYStep) > Math.abs(cameraYDiff) ? cameraYDiff : cameraYStep;
  store.cameraConfig = {
    ...(store.cameraConfig as Record<string, unknown>),
    position: { x: cameraReference.position.x, y: cameraReference.position.y, z: cameraReference.position.z },
  };
};

const applyFreeCameraMovement = (moveSpeed: number, targetRotation: number | null): void => {
  if (!cameraReference) return;
  if (targetRotation !== null) freeCameraRotationY = targetRotation * DEGREES_TO_RADIANS;
  const orbit = toRaw(store.orbitReference);
  const forward = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(0, freeCameraRotationY, 0));
  cameraReference.position.addScaledVector(forward, moveSpeed);
  (orbit as { target: THREE.Vector3 } | null)?.target.addScaledVector(forward, moveSpeed);
  store.cameraConfig = {
    ...(store.cameraConfig as Record<string, unknown>),
    position: { x: cameraReference.position.x, y: cameraReference.position.y, z: cameraReference.position.z },
  };
};

const applyPlayerMove = (targetRotation: number | null, moveSpeed: number, isMoving: boolean): void => {
  if (!playerMeshReference || !getDeltaReference) return;
  if (targetRotation !== null) applyRotation(playerMeshReference, targetRotation);
  updateAnimation({
    actionName: isMoving ? 'walk' : 'idle',
    player: playerMeshReference,
    delta: getDeltaReference(),
    speed: ((reactiveConfig.value.movementSpeed as number | undefined) ?? playerSettings.game.distance) * 10,
  });
  if (isMoving) moveForward(playerMeshReference, moveSpeed);
  applyTerrainSnap();
  cameraFrameCounter++;
  const followFrequency = (reactiveConfig.value.cameraFollowFrequency as number | undefined) ?? CAMERA_FOLLOW_FREQUENCY;
  if (cameraFrameCounter % followFrequency === 0) applyCameraFollow();
};

const getViewZOffset = (): number => -((reactiveConfig.value.forwardBias as number | undefined) ?? FORWARD_BIAS);

const buildGeneratorConfig = () => {
  const procedural = reactiveConfig.value.procedural as Record<string, number> | undefined;
  const grassDensity = reactiveConfig.value.grassDensity as number | undefined;
  const chunkSize = reactiveConfig.value.chunkSize as number | undefined;
  return {
    ...generatorConfig,
    ...(chunkSize !== undefined ? { chunkSize } : {}),
    ...(grassDensity !== undefined ? { grassPerChunk: grassDensity * GRASS_DENSITY_MULTIPLIER } : {}),
    noiseConfig: procedural
      ? { ...generatorConfig.noiseConfig, ...procedural }
      : generatorConfig.noiseConfig,
  };
};

const buildConfigSchema = (_worldCase: WorldCase) => baseConfigControls;

const SPAWN_ID = 'world-generator';
const SPAWN_ID_TERRAIN = 'world-terrain';
const SPAWN_ID_TREES = 'world-trees';
const SPAWN_ID_GRASS = 'world-grass';

const spawnVisibility = computed((): Record<string, boolean> =>
  Object.fromEntries(
    useDebugSceneStore().spawns.map(spawn => [spawn.id, !(spawn.hidden ?? false)])
  )
);

const getGroundColor = (worldCase: WorldCase): number => {
  const treesColor = (reactiveConfig.value.treesGroundColor as number | undefined) ?? TREES_GROUND_COLOR;
  const grassColor = (reactiveConfig.value.grassGroundColor as number | undefined) ?? GRASS_GROUND_COLOR;
  return worldCase === 'grass' ? grassColor : treesColor;
};

const buildChunkOptions = () => ({
  sharedGrassGeometry: sharedGrassGeometry!,
  sharedGrassMaterial: sharedGrassMaterial!,
  treesPerChunk: (reactiveConfig.value.treeDensity as number | undefined) ?? TREES_PER_CHUNK,
  groundColor: getGroundColor(reactiveConfig.value.worldCase as WorldCase),
  terrainBaseColor: (reactiveConfig.value.terrainBaseColor as number | undefined) ?? TERRAIN_BASE_COLOR,
  terrainPeakColor: (reactiveConfig.value.terrainPeakColor as number | undefined) ?? TERRAIN_PEAK_COLOR,
  treeSizeScale: (reactiveConfig.value.treeSizeScale as number | undefined) ?? TREE_SIZE_SCALE,
  treeSizeVariation: (reactiveConfig.value.treeSizeVariation as number | undefined) ?? TREE_SIZE_VARIATION,
  spawnId: SPAWN_ID,
  spawnVisibility: spawnVisibility.value,
  terrainSpawnId: SPAWN_ID_TERRAIN,
  treesSpawnId: SPAWN_ID_TREES,
  grassSpawnId: SPAWN_ID_GRASS,
});

const registerWorldSpawns = () => {
  const { registerSpawn } = useDebugSceneStore();
  registerSpawn(SPAWN_ID_TERRAIN, 'Terrain', () => {
    activeChunksReference?.forEach(chunk => {
      if (chunk.terrain) chunk.terrain.visible = !chunk.terrain.visible;
    });
  });
  registerSpawn(SPAWN_ID_TREES, 'Trees', () => {
    activeChunksReference?.forEach(chunk => {
      if (chunk.trees) chunk.trees.visible = !chunk.trees.visible;
      if (chunk.ground && !chunk.grass?.visible) chunk.ground.visible = !chunk.ground.visible;
    });
  });
  registerSpawn(SPAWN_ID_GRASS, 'Grass', () => {
    activeChunksReference?.forEach(chunk => {
      if (chunk.grass) chunk.grass.visible = !chunk.grass.visible;
      if (chunk.ground && !chunk.trees?.visible) chunk.ground.visible = !chunk.ground.visible;
    });
  });
};

const TERRAIN_COLOR_KEYS = ['terrainBaseColor', 'terrainPeakColor'] as const;

const registerWorldElementProperties = () => {
  const elementPropertiesStore = useElementPropertiesStore();
  elementPropertiesStore.registerElementProperties(SPAWN_ID_TERRAIN, {
    title: 'Terrain',
    type: 'spawn',
    schema: {
      terrainBaseColor: { color: true, label: 'Base Color' },
      terrainPeakColor: { color: true, label: 'Peak Color' },
      ...proceduralConfigControls.procedural,
    },
    getValue: (path) => {
      if ((TERRAIN_COLOR_KEYS as readonly string[]).includes(path)) return reactiveConfig.value[path];
      return (reactiveConfig.value.procedural as Record<string, unknown>)?.[path];
    },
    updateValue: (path, value) => {
      if ((TERRAIN_COLOR_KEYS as readonly string[]).includes(path)) {
        reactiveConfig.value = { ...reactiveConfig.value, [path]: value };
      } else {
        reactiveConfig.value = {
          ...reactiveConfig.value,
          procedural: setNestedValueImmutable(reactiveConfig.value.procedural as Record<string, unknown>, path, value),
        };
      }
    },
  });
  elementPropertiesStore.registerElementProperties(SPAWN_ID_TREES, {
    title: 'Trees',
    type: 'spawn',
    schema: {
      treesGroundColor: { color: true, label: 'Ground Color' },
      treeDensity: densityControl,
      treeSizeScale: { min: 0.1, max: 5, step: 0.1, label: 'Size Scale' },
      treeSizeVariation: { min: 0, max: 1, step: 0.05, label: 'Size Variation' },
    },
    getValue: (path) => reactiveConfig.value[path],
    updateValue: (path, value) => {
      reactiveConfig.value = { ...reactiveConfig.value, [path]: value };
    },
  });
  elementPropertiesStore.registerElementProperties(SPAWN_ID_GRASS, {
    title: 'Grass',
    type: 'spawn',
    schema: {
      grassGroundColor: { color: true, label: 'Ground Color' },
      grassColor: { color: true, label: 'Grass Color' },
      grassDensity: densityControl,
      grassBladeScale: { min: 0.5, max: 8, step: 0.5, label: 'Blade Scale' },
    },
    getValue: (path) => reactiveConfig.value[path],
    updateValue: (path, value) => {
      reactiveConfig.value = { ...reactiveConfig.value, [path]: value };
    },
  });
};

const buildApplyWorldCaseOptions = (worldCase: WorldCase) => ({
  scene: sceneReference!,
  generatorConfig: buildGeneratorConfig(),
  worldCase,
  sharedGrassGeometry: sharedGrassGeometry!,
  sharedGrassMaterial: sharedGrassMaterial!,
  treesPerChunk: (reactiveConfig.value.treeDensity as number | undefined) ?? TREES_PER_CHUNK,
  groundColor: getGroundColor(worldCase),
  terrainBaseColor: (reactiveConfig.value.terrainBaseColor as number | undefined) ?? TERRAIN_BASE_COLOR,
  terrainPeakColor: (reactiveConfig.value.terrainPeakColor as number | undefined) ?? TERRAIN_PEAK_COLOR,
  treeSizeScale: (reactiveConfig.value.treeSizeScale as number | undefined) ?? TREE_SIZE_SCALE,
  treeSizeVariation: (reactiveConfig.value.treeSizeVariation as number | undefined) ?? TREE_SIZE_VARIATION,
  spawnId: SPAWN_ID,
});

const rebuildIfReady = () => {
  if (
    !sceneReference ||
    !activeChunksReference ||
    !sharedGrassGeometry ||
    !sharedGrassMaterial
  )
    return;
  rebuildAllChunks({
    activeChunks: activeChunksReference,
    scene: sceneReference,
    generatorConfig: buildGeneratorConfig(),
    worldCase: reactiveConfig.value.worldCase as WorldCase,
    ...buildChunkOptions(),
  });
};

watch(() => reactiveConfig.value.worldCase, (worldCase) => {
  updateViewSchema(route.name as string, buildConfigSchema(worldCase as WorldCase));
  if (sceneReference && activeChunksReference && sharedGrassGeometry && sharedGrassMaterial) {
    applyWorldCaseToAllChunks(activeChunksReference, buildApplyWorldCaseOptions(worldCase as WorldCase));
  }
  if (playerMeshReference && playerBottomOffsetReference !== null) {
    playerMeshReference.position.y = playerBottomOffsetReference;
  }
});
watch(() => JSON.stringify(reactiveConfig.value.procedural), rebuildIfReady);
watch(() => reactiveConfig.value.treeDensity, rebuildIfReady);
watch(() => reactiveConfig.value.grassDensity, rebuildIfReady);
watch(() => reactiveConfig.value.treesGroundColor, rebuildIfReady);
watch(() => reactiveConfig.value.grassGroundColor, rebuildIfReady);
watch(() => reactiveConfig.value.terrainBaseColor, rebuildIfReady);
watch(() => reactiveConfig.value.terrainPeakColor, rebuildIfReady);
watch(() => reactiveConfig.value.treeSizeScale, rebuildIfReady);
watch(() => reactiveConfig.value.treeSizeVariation, rebuildIfReady);
watch(() => reactiveConfig.value.grassColor, (newColor) => {
  if (sharedGrassMaterial) {
    (sharedGrassMaterial as THREE.MeshPhysicalMaterial).color.set((newColor as number | undefined) ?? GRASS_COLOR);
  }
});
watch(() => reactiveConfig.value.grassBladeScale, () => {
  if (!sharedGrassGeometry) return;
  sharedGrassGeometry.dispose();
  sharedGrassGeometry = createGrassBladeGeometry((reactiveConfig.value.grassBladeScale as number | undefined) ?? GRASS_BLADE_SCALE);
  rebuildIfReady();
});
watch(() => reactiveConfig.value.chunkSize, rebuildIfReady);
watch(() => reactiveConfig.value.viewRadius, rebuildIfReady);


onMounted(async () => {
  if (!canvas.value) return;

  setViewPanels({ showConfig: true });
  const sceneConfigStore = useSceneConfigStore();
  const { orbit: _orbit, ...sceneSchemaWithoutOrbit } = globalSceneSchema;
  sceneConfigStore.schema = sceneSchemaWithoutOrbit;
  registerViewConfig(
    route.name as string,
    reactiveConfig,
    buildConfigSchema(reactiveConfig.value.worldCase as WorldCase)
  );

  await store.init(canvas.value, setupConfig, {
    playMode: true,
    defineSetup: async ({ scene, camera, world, getDelta, animate }) => {
      const { playerMesh, activeChunks, directionalLight, playerBottomOffset } = await initializeWorld(
        scene,
        world
      );
      playerMeshReference = playerMesh;
      playerBottomOffsetReference = playerBottomOffset;
      cameraReference = camera as THREE.PerspectiveCamera;
      getDeltaReference = getDelta;
      directionalLightReference = directionalLight;

      const { game } = playerSettings;
      const { speed } = game;

      initializeSceneRegistrations(scene);

      const timelineManager = createTimelineManager();

      timelineManager.addAction({
        frequency: speed.movement,
        name: "Move",
        category: "user-input",
        action: () => {
          const isFreeCamera = reactiveConfig.value.freeCamera as boolean;
          const autoWalk = reactiveConfig.value.autoWalk as boolean;
          const targetRotation = getRotation(currentActions, true);
          const moveSpeed = ((reactiveConfig.value.movementSpeed as number | undefined) ?? game.distance) * MOVEMENT_SPEED_SCALE;
          if (isFreeCamera) {
            applyPlayerMove(null, moveSpeed, autoWalk);
            if (targetRotation !== null) applyFreeCameraMovement(moveSpeed, targetRotation);
          } else {
            applyPlayerMove(targetRotation, moveSpeed, autoWalk || targetRotation !== null);
          }
        },
      });

      timelineManager.addAction({
        frequency: CHUNK_UPDATE_FREQUENCY,
        name: "ChunkUpdate",
        category: "world",
        action: () => {
          const isFreeCamera = reactiveConfig.value.freeCamera as boolean;
          const currentViewRadius = (reactiveConfig.value.viewRadius as number | undefined) ?? VIEW_RADIUS;
          updateChunks({
            playerPosition: isFreeCamera ? (cameraReference?.position ?? playerMesh.position) : playerMesh.position,
            activeChunks,
            scene,
            generatorConfig: buildGeneratorConfig(),
            worldCase: reactiveConfig.value.worldCase as WorldCase,
            viewRadius: currentViewRadius,
            unloadRadius: UNLOAD_RADIUS,
            viewZOffset: getViewZOffset(),
            maxChunksPerUpdate: MAX_CHUNKS_PER_UPDATE,
            ...buildChunkOptions(),
          });
        },
      });

      animate({ timeline: timelineManager });
      isSceneReady.value = true;
    },
  });
});

onUnmounted(() => {
  useSceneConfigStore().schema = globalSceneSchema;
  const { unregisterSpawn } = useDebugSceneStore();
  unregisterSpawn(SPAWN_ID_TERRAIN);
  unregisterSpawn(SPAWN_ID_TREES);
  unregisterSpawn(SPAWN_ID_GRASS);
  destroyControls();
  store.cleanup();
  clearViewPanels();
  unregisterViewConfig(route.name as string);
  if (sharedGrassGeometry) sharedGrassGeometry.dispose();
  if (sharedGrassMaterial) sharedGrassMaterial.dispose();
  sceneReference = null;
  activeChunksReference = null;
  playerMeshReference = null;
  playerBottomOffsetReference = null;
  cameraReference = null;
  getDeltaReference = null;
  directionalLightReference = undefined;
  cameraFrameCounter = 0;
  freeCameraRotationY = 0;
});
</script>

<template>
  <div class="continuous-world">
    <canvas ref="canvas" />
  </div>
</template>

<style scoped>
.continuous-world {
  position: relative;
  width: 100%;
  height: 100vh;
}

canvas {
  display: block;
  width: 100%;
  height: 100vh;
}
</style>
