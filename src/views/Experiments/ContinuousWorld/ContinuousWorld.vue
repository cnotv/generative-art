<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, toRaw, watch } from "vue";
import { useRoute } from "vue-router";
import { cameraFollowPlayer } from "@webgamekit/threejs";
import { getRotation, createTimelineManager } from "@webgamekit/animation";
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
  CHUNK_UPDATE_FREQUENCY,
  DEFAULT_WORLD_CASE,
  TREES_PER_CHUNK,
  MOVEMENT_SPEED_SCALE,
  GRASS_DENSITY_MULTIPLIER,
  GROUND_COLOR,
  DIRECTIONAL_LIGHT_OFFSET,
  AMBIENT_LIGHT_NAME,
  DIRECTIONAL_LIGHT_NAME,
  configControls,
  baseConfigControls,
  proceduralConfigControls,
  densityControl,
} from "./config";
import { updateChunks, rebuildAllChunks, applyWorldCaseToAllChunks } from "./chunkManager";
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
  movementSpeed: 8,
  chunkSize: CHUNK_SIZE,
  viewRadius: VIEW_RADIUS,
  treeDensity: TREES_PER_CHUNK,
  grassDensity: 20,
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

const createPlayerMesh = (scene: THREE.Scene) => {
  const playerGeometry = new THREE.BoxGeometry(1, 2, 1);
  const playerMaterial = new THREE.MeshStandardMaterial({
    color: playerSettings.model.color,
  });
  const playerMesh = new THREE.Mesh(playerGeometry, playerMaterial);
  playerMesh.position.set(...playerSettings.model.position);
  playerMesh.castShadow = true;
  playerMesh.name = "Player";
  scene.add(playerMesh);
  return playerMesh;
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

const applyRotation = (mesh: THREE.Mesh, degrees: number) => {
  mesh.rotation.y = degrees * DEGREES_TO_RADIANS;
};

const moveForward = (mesh: THREE.Mesh, distance: number) => {
  const direction = new THREE.Vector3(0, 0, -1);
  direction.applyQuaternion(mesh.quaternion);
  mesh.position.addScaledVector(direction, distance);
};

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

const buildConfigSchema = (worldCase: WorldCase) =>
  worldCase === 'terrain'
    ? { ...baseConfigControls, ...proceduralConfigControls }
    : baseConfigControls;

const SPAWN_ID = 'world-generator'; // used for filtering chunk objects from elements panel
const SPAWN_ID_TERRAIN = 'world-terrain';
const SPAWN_ID_TREES = 'world-trees';
const SPAWN_ID_GRASS = 'world-grass';

const SPAWN_TO_WORLD_CASE: Record<string, WorldCase> = {
  [SPAWN_ID_TERRAIN]: 'terrain',
  [SPAWN_ID_TREES]: 'trees',
  [SPAWN_ID_GRASS]: 'grass',
};

const spawnVisibility = computed((): Record<string, boolean> =>
  Object.fromEntries(
    useDebugSceneStore().spawns.map(spawn => [spawn.id, !(spawn.hidden ?? false)])
  )
);

const buildChunkOptions = () => ({
  sharedGrassGeometry: sharedGrassGeometry!,
  sharedGrassMaterial: sharedGrassMaterial!,
  treesPerChunk: (reactiveConfig.value.treeDensity as number | undefined) ?? TREES_PER_CHUNK,
  groundColor: GROUND_COLOR,
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

const registerWorldElementProperties = () => {
  const elementPropertiesStore = useElementPropertiesStore();
  elementPropertiesStore.registerElementProperties(SPAWN_ID_TERRAIN, {
    title: 'Terrain',
    type: 'spawn',
    schema: proceduralConfigControls.procedural,
    getValue: (path) => (reactiveConfig.value.procedural as Record<string, unknown>)?.[path],
    updateValue: (path, value) => {
      reactiveConfig.value = {
        ...reactiveConfig.value,
        procedural: setNestedValueImmutable(reactiveConfig.value.procedural as Record<string, unknown>, path, value),
      };
    },
  });
  elementPropertiesStore.registerElementProperties(SPAWN_ID_TREES, {
    title: 'Trees',
    type: 'spawn',
    schema: { treeDensity: densityControl },
    getValue: (_path) => reactiveConfig.value.treeDensity,
    updateValue: (_path, value) => {
      reactiveConfig.value = { ...reactiveConfig.value, treeDensity: value };
    },
  });
  elementPropertiesStore.registerElementProperties(SPAWN_ID_GRASS, {
    title: 'Grass',
    type: 'spawn',
    schema: { grassDensity: densityControl },
    getValue: (_path) => reactiveConfig.value.grassDensity,
    updateValue: (_path, value) => {
      reactiveConfig.value = { ...reactiveConfig.value, grassDensity: value };
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
  groundColor: GROUND_COLOR,
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
});
watch(() => JSON.stringify(reactiveConfig.value.procedural), rebuildIfReady);
watch(() => reactiveConfig.value.treeDensity, rebuildIfReady);
watch(() => reactiveConfig.value.grassDensity, rebuildIfReady);
watch(() => reactiveConfig.value.chunkSize, rebuildIfReady);
watch(() => reactiveConfig.value.viewRadius, rebuildIfReady);

const elementPropertiesStore = useElementPropertiesStore();
watch(() => elementPropertiesStore.selectedElementName, (name) => {
  const worldCase = name ? SPAWN_TO_WORLD_CASE[name] : undefined;
  if (worldCase) reactiveConfig.value = { ...reactiveConfig.value, worldCase };
});

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
    defineSetup: async ({ scene, camera, animate }) => {
      const playerMesh = createPlayerMesh(scene);

      sharedGrassGeometry = createGrassBladeGeometry();
      sharedGrassMaterial = createGrassMaterial();
      sceneReference = scene;

      const activeChunks = new Map<ChunkKey, ChunkData>();
      activeChunksReference = activeChunks;

      updateChunks({
        playerPosition: playerMesh.position,
        activeChunks,
        scene,
        generatorConfig: buildGeneratorConfig(),
        worldCase: reactiveConfig.value.worldCase as WorldCase,
        viewRadius: (reactiveConfig.value.viewRadius as number | undefined) ?? VIEW_RADIUS,
        unloadRadius: UNLOAD_RADIUS,
        ...buildChunkOptions(),
      });

      let orbitReference = toRaw(store.orbitReference);
      const { game } = playerSettings;
      const { speed } = game;
      const directionalLight = scene.getObjectByName(DIRECTIONAL_LIGHT_NAME) as THREE.DirectionalLight | undefined;

      registerSceneLights(scene);

      registerWorldSpawns();
      registerWorldElementProperties();

      const timelineManager = createTimelineManager();

      timelineManager.addAction({
        frequency: speed.movement,
        name: "Move",
        category: "user-input",
        action: () => {
          const targetRotation = getRotation(currentActions, true);
          if (targetRotation !== null) {
            applyRotation(playerMesh, targetRotation);
          }

          if (reactiveConfig.value.autoWalk) {
            moveForward(playerMesh, ((reactiveConfig.value.movementSpeed as number | undefined) ?? game.distance) * MOVEMENT_SPEED_SCALE);
          }

          if (!orbitReference) orbitReference = toRaw(store.orbitReference);
          cameraFollowPlayer(camera, playerMesh, CAMERA_OFFSET, orbitReference, [
            "x",
            "z",
          ]);
          store.cameraConfig.value = {
            ...(store.cameraConfig.value as Record<string, unknown>),
            position: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
          };

          if (directionalLight) {
            directionalLight.position.set(
              playerMesh.position.x + DIRECTIONAL_LIGHT_OFFSET[0],
              playerMesh.position.y + DIRECTIONAL_LIGHT_OFFSET[1],
              playerMesh.position.z + DIRECTIONAL_LIGHT_OFFSET[2],
            );
            directionalLight.target.position.copy(playerMesh.position);
          }
        },
      });

      timelineManager.addAction({
        frequency: CHUNK_UPDATE_FREQUENCY,
        name: "ChunkUpdate",
        category: "world",
        action: () => {
          updateChunks({
            playerPosition: playerMesh.position,
            activeChunks,
            scene,
            generatorConfig: buildGeneratorConfig(),
            worldCase: reactiveConfig.value.worldCase as WorldCase,
            viewRadius: (reactiveConfig.value.viewRadius as number | undefined) ?? VIEW_RADIUS,
            unloadRadius: UNLOAD_RADIUS,
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
