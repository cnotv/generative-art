<script setup lang="ts">
import { onMounted, onUnmounted, ref, shallowRef } from "vue";
import { useRoute } from "vue-router";
import * as THREE from "three";
import {
  getTools,
  getCube,
  getModel,
  setCameraPreset,
  type ComplexModel,
} from "@webgamekit/threejs";
import {
  createTimelineManager,
  type CoordinateTuple,
} from "@webgamekit/animation";
import { registerViewConfig, unregisterViewConfig, createReactiveConfig } from "@/composables/useViewConfig";
import { useViewPanels } from "@/composables/useViewPanels";
import Button from "@/components/ui/button/Button.vue";

import {
  gridConfig,
  obstacleColors,
  startColor,
  goalColor,
  pathColor,
  obstacleDensity,
  characterSettings,
  cameraPreset,
  markerSize,
  obstacleSize,
  framesPerCell,
  setupConfig,
  configControls,
  sceneControls,
  defaultStart,
  defaultGoal,
} from "./config";
import { createGrid, markObstacles, gridToWorld } from "./helpers/grid";
import type { Grid } from "./helpers/grid";
import type { Position } from "./helpers/pathfinding";
import { getBestRoute } from "./helpers/pathfinding";
import { animateAlongPath, createPathLine, removePathLine } from "./helpers/pathAnimation";

const route = useRoute();
const { setViewPanels, clearViewPanels } = useViewPanels();

const canvas = ref<HTMLCanvasElement | null>(null);
const isAnimating = shallowRef(false);
const hasPath = shallowRef(false);

const reactiveConfig = createReactiveConfig({
  obstacles: { density: obstacleDensity },
  grid: { width: gridConfig.width, height: gridConfig.height },
});

const sceneConfig = createReactiveConfig({
  camera: { preset: "top-down" },
});

// Scene state kept outside reactive system for performance
type SceneState = {
  scene: THREE.Scene;
  world: Parameters<typeof getCube>[1];
  getDelta: () => number;
  camera: THREE.Camera;
  timelineManager: ReturnType<typeof createTimelineManager>;
  character: ComplexModel | null;
  obstacleMeshes: ComplexModel[];
  pathLine: THREE.Line | null;
  grid: Grid;
};

let sceneState: SceneState | null = null;

const generateObstaclePositions = (
  width: number,
  height: number,
  density: number,
  start: Position,
  goal: Position
): Position[] => {
  const total = width * height;
  const count = Math.floor(total * density);
  const allPositions = Array.from({ length: total }, (_, i) => ({
    x: i % width,
    z: Math.floor(i / width),
  }));

  const candidates = allPositions.filter(
    (pos) =>
      !(pos.x === start.x && pos.z === start.z) &&
      !(pos.x === goal.x && pos.z === goal.z)
  );

  // Fisher-Yates shuffle using functional style
  const shuffled = candidates
    .map((pos) => ({ pos, sort: Math.random() }))
    .sort((a, b) => a.sort - b.sort)
    .map(({ pos }) => pos);

  return shuffled.slice(0, count);
};

const buildScene = async (
  state: SceneState,
  density: number,
  currentGridConfig: typeof gridConfig
): Promise<void> => {
  const { scene, world, timelineManager } = state;
  const start = defaultStart;
  const goal = defaultGoal(currentGridConfig.width, currentGridConfig.height);

  // Clear previous path line
  if (state.pathLine) {
    removePathLine(scene, state.pathLine);
    state.pathLine = null;
    hasPath.value = false;
  }

  // Create grid and obstacles
  const obstaclePositions = generateObstaclePositions(
    currentGridConfig.width,
    currentGridConfig.height,
    density,
    start,
    goal
  );

  state.grid = markObstacles(
    createGrid(currentGridConfig),
    obstaclePositions
  );

  // Remove old obstacle meshes from scene
  state.obstacleMeshes.forEach((mesh) => scene.remove(mesh));
  state.obstacleMeshes.length = 0;

  // Place obstacles as cubes
  obstaclePositions.forEach((pos, index) => {
    const worldPos = gridToWorld(pos.x, pos.z, currentGridConfig);
    const color = obstacleColors[index % obstacleColors.length];
    const cube = getCube(scene, world, {
      position: [worldPos[0], 1, worldPos[2]] as CoordinateTuple,
      size: obstacleSize,
      color,
      type: "fixed",
      castShadow: true,
      receiveShadow: true,
    });
    state.obstacleMeshes.push(cube);
  });

  // Place start marker
  const startWorld = gridToWorld(start.x, start.z, currentGridConfig);
  getCube(scene, world, {
    position: [startWorld[0], 0.1, startWorld[2]] as CoordinateTuple,
    size: markerSize,
    color: startColor,
    type: "fixed",
  });

  // Place goal marker
  const goalWorld = gridToWorld(goal.x, goal.z, currentGridConfig);
  getCube(scene, world, {
    position: [goalWorld[0], 0.1, goalWorld[2]] as CoordinateTuple,
    size: markerSize,
    color: goalColor,
    type: "fixed",
  });

  // Place character at start
  if (state.character) {
    const [sx, sy, sz] = startWorld;
    state.character.position.set(sx, sy - 1, sz);
  }

  // Compute and display initial path
  await computeAndDrawPath(state, start, goal, currentGridConfig);
};

const computeAndDrawPath = async (
  state: SceneState,
  start: Position,
  goal: Position,
  currentGridConfig: typeof gridConfig
): Promise<void> => {
  const { scene, timelineManager, getDelta, character } = state;

  // Remove old path line
  if (state.pathLine) {
    removePathLine(scene, state.pathLine);
    state.pathLine = null;
    hasPath.value = false;
  }

  const path = getBestRoute(state.grid, start, goal);
  if (!path || !character) return;

  state.pathLine = createPathLine(scene, path, currentGridConfig, pathColor);
  hasPath.value = true;

  isAnimating.value = true;

  animateAlongPath({
    path,
    character,
    gridConfig: currentGridConfig,
    timelineManager,
    getDelta,
    framesPerCell,
    onComplete: () => {
      isAnimating.value = false;
    },
  });
};

const init = async (): Promise<void> => {
  if (!canvas.value) return;

  const { setup, animate, scene, world, getDelta, camera } = await getTools({
    canvas: canvas.value,
  });

  const aspect = window.innerWidth / window.innerHeight;
  setCameraPreset(camera as THREE.PerspectiveCamera, cameraPreset, aspect);

  const timelineManager = createTimelineManager();

  await setup({
    config: setupConfig,
    defineSetup: async () => {
      const character = await getModel(
        scene,
        world,
        "mushroom.glb",
        characterSettings.model
      );

      sceneState = {
        scene,
        world,
        getDelta,
        camera,
        timelineManager,
        character,
        obstacleMeshes: [],
        pathLine: null,
        grid: createGrid(gridConfig),
      };

      await buildScene(sceneState, reactiveConfig.value.obstacles.density, gridConfig);

      animate({
        beforeTimeline: () => {},
        timeline: timelineManager,
      });
    },
  });
};

const generateNewScene = async (): Promise<void> => {
  if (!sceneState || isAnimating.value) return;
  await buildScene(
    sceneState,
    reactiveConfig.value.obstacles.density,
    gridConfig
  );
};

const recalculatePath = async (): Promise<void> => {
  if (!sceneState || isAnimating.value) return;
  const start = defaultStart;
  const goal = defaultGoal(gridConfig.width, gridConfig.height);

  // Reset character to start
  if (sceneState.character) {
    const startWorld = gridToWorld(start.x, start.z, gridConfig);
    sceneState.character.position.set(startWorld[0], startWorld[1] - 1, startWorld[2]);
  }

  await computeAndDrawPath(sceneState, start, goal, gridConfig);
};

onMounted(async () => {
  setViewPanels({ showConfig: true });

  registerViewConfig(
    route.name as string,
    reactiveConfig,
    configControls,
    sceneConfig,
    sceneControls
  );

  await init();
  window.addEventListener("resize", init);
});

onUnmounted(() => {
  clearViewPanels();
  unregisterViewConfig(route.name as string);
  window.removeEventListener("resize", init);
  sceneState = null;
});
</script>

<template>
  <canvas ref="canvas"></canvas>

  <div class="pathfinder-viz__controls">
    <Button variant="secondary" :disabled="isAnimating" @click="generateNewScene">
      Generate New Scene
    </Button>
    <Button variant="secondary" :disabled="isAnimating" @click="recalculatePath">
      Recalculate Path
    </Button>
    <span v-if="!hasPath" class="pathfinder-viz__no-path">No path found</span>
  </div>
</template>

<style scoped>
canvas {
  display: block;
  width: 100%;
  height: 100vh;
}

.pathfinder-viz__controls {
  position: fixed;
  bottom: 1.5rem;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 0.75rem;
  align-items: center;
  background: rgba(0, 0, 0, 0.6);
  padding: 0.75rem 1.25rem;
  border-radius: 0.5rem;
  backdrop-filter: blur(4px);
}

.pathfinder-viz__no-path {
  color: #e74c3c;
  font-family: monospace;
  font-size: 0.875rem;
}

@media (prefers-color-scheme: light) {
  .pathfinder-viz__controls {
    background: rgba(255, 255, 255, 0.8);
  }

  .pathfinder-viz__no-path {
    color: #c0392b;
  }
}
</style>
