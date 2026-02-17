<script setup lang="ts">
import { onMounted, onUnmounted, ref, shallowRef } from "vue";
import { useRoute } from "vue-router";
import * as THREE from "three";
import {
  getTools,
  getCube,
  getModel,
  type ComplexModel,
} from "@webgamekit/threejs";
import {
  createTimelineManager,
  animateTimeline,
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
  markerSize,
  obstacleSize,
  framesPerCell,
  configControls,
  sceneControls,
  defaultStart,
  defaultGoal,
  scenarios,
} from "./config";
import { createGrid, markObstacles, markObstacle, gridToWorld, worldToGrid } from "./helpers/grid";
import type { Grid, GridConfig } from "./helpers/grid";
import type { Position } from "./helpers/pathfinding";
import { getBestRoute } from "./helpers/pathfinding";
import { animateAlongPath, createPathLine, removePathLine } from "./helpers/pathAnimation";

const route = useRoute();
const { setViewPanels, clearViewPanels } = useViewPanels();

const canvas = ref<HTMLCanvasElement | null>(null);
const isAnimating = shallowRef(false);
const hasPath = shallowRef(false);
const showCosts = shallowRef(false);
const currentScenario = shallowRef<string>("random");

const reactiveConfig = createReactiveConfig({
  obstacles: { density: obstacleDensity },
});

const sceneConfig = createReactiveConfig({
  camera: { preset: "top-down" },
});

type SceneState = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  world: Parameters<typeof getCube>[1];
  orthoCamera: THREE.OrthographicCamera;
  getDelta: () => number;
  timelineManager: ReturnType<typeof createTimelineManager>;
  character: ComplexModel | null;
  obstacleMeshes: ComplexModel[];
  pathLine: THREE.Line | null;
  costLabels: THREE.Sprite[];
  grid: Grid;
  startMarker: ComplexModel | null;
  goalMarker: ComplexModel | null;
  currentGridConfig: GridConfig;
};

let sceneState: SceneState | null = null;
let animFrameId: number | null = null;
let frameCounter = 0;

const FRUSTUM_SIZE = 40;

const createOrthoCamera = (width: number, height: number): THREE.OrthographicCamera => {
  const aspect = width / height;
  const cam = new THREE.OrthographicCamera(
    (FRUSTUM_SIZE * aspect) / -2,
    (FRUSTUM_SIZE * aspect) / 2,
    FRUSTUM_SIZE / 2,
    FRUSTUM_SIZE / -2,
    0.1,
    1000
  );
  cam.position.set(0, 50, 0);
  cam.lookAt(0, 0, 0);
  return cam;
};

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

  return allPositions
    .filter(
      (pos) =>
        !(pos.x === start.x && pos.z === start.z) &&
        !(pos.x === goal.x && pos.z === goal.z)
    )
    .map((pos) => ({ pos, sort: Math.random() }))
    .sort((a, b) => a.sort - b.sort)
    .map(({ pos }) => pos)
    .slice(0, count);
};

const buildCostSprite = (text: string, position: THREE.Vector3, scene: THREE.Scene): THREE.Sprite => {
  const offscreenCanvas = document.createElement("canvas");
  offscreenCanvas.width = 64;
  offscreenCanvas.height = 32;
  const ctx = offscreenCanvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(0, 0, 64, 32);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 18px monospace";
    ctx.textAlign = "center";
    ctx.fillText(text, 32, 22);
  }
  const texture = new THREE.CanvasTexture(offscreenCanvas);
  const material = new THREE.SpriteMaterial({ map: texture });
  const sprite = new THREE.Sprite(material);
  sprite.position.copy(position);
  sprite.scale.set(0.8, 0.4, 1);
  scene.add(sprite);
  return sprite;
};

const clearCostLabels = (scene: THREE.Scene, labels: THREE.Sprite[]): void => {
  labels.forEach((sprite) => {
    scene.remove(sprite);
    sprite.material.dispose();
  });
  labels.length = 0;
};

const drawCostLabels = (
  scene: THREE.Scene,
  path: Position[],
  currentGridConfig: GridConfig,
  labels: THREE.Sprite[]
): void => {
  path.forEach((pos, index) => {
    const [wx, , wz] = gridToWorld(pos.x, pos.z, currentGridConfig);
    const worldPos = new THREE.Vector3(wx, 0.5, wz);
    const sprite = buildCostSprite(String(index), worldPos, scene);
    labels.push(sprite);
  });
};

const buildObstacleMeshes = (
  scene: THREE.Scene,
  world: SceneState["world"],
  positions: Position[],
  currentGridConfig: GridConfig
): ComplexModel[] =>
  positions.map((pos, index) => {
    const worldPos = gridToWorld(pos.x, pos.z, currentGridConfig);
    const color = obstacleColors[index % obstacleColors.length];
    return getCube(scene, world, {
      position: [worldPos[0], 1, worldPos[2]] as CoordinateTuple,
      size: obstacleSize,
      color,
      type: "fixed",
      castShadow: true,
      receiveShadow: true,
    });
  });

const clearSceneMeshes = (scene: THREE.Scene, meshes: ComplexModel[]): void => {
  meshes.forEach((mesh) => scene.remove(mesh));
  meshes.length = 0;
};

const computeAndDrawPath = (
  state: SceneState,
  start: Position,
  goal: Position,
  currentGridConfig: GridConfig
): void => {
  const { scene, timelineManager, getDelta, character } = state;

  if (state.pathLine) {
    removePathLine(scene, state.pathLine);
    state.pathLine = null;
    hasPath.value = false;
  }
  clearCostLabels(scene, state.costLabels);

  const path = getBestRoute(state.grid, start, goal);
  if (!path || !character) return;

  state.pathLine = createPathLine(scene, path, currentGridConfig, pathColor);
  hasPath.value = true;

  if (showCosts.value) {
    drawCostLabels(scene, path, currentGridConfig, state.costLabels);
  }

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

const buildScene = (
  state: SceneState,
  density: number,
  currentGridConfig: GridConfig,
  obstaclePositions?: Position[]
): void => {
  const { scene, world, timelineManager } = state;
  const start = defaultStart;
  const goal = defaultGoal(currentGridConfig.width, currentGridConfig.height);

  if (state.pathLine) {
    removePathLine(scene, state.pathLine);
    state.pathLine = null;
    hasPath.value = false;
  }
  clearCostLabels(scene, state.costLabels);

  const positions = obstaclePositions ??
    generateObstaclePositions(currentGridConfig.width, currentGridConfig.height, density, start, goal);

  state.grid = markObstacles(createGrid(currentGridConfig), positions);

  clearSceneMeshes(scene, state.obstacleMeshes);
  buildObstacleMeshes(scene, world, positions, currentGridConfig).forEach((m) =>
    state.obstacleMeshes.push(m)
  );

  if (state.startMarker) scene.remove(state.startMarker);
  if (state.goalMarker) scene.remove(state.goalMarker);

  const startWorld = gridToWorld(start.x, start.z, currentGridConfig);
  state.startMarker = getCube(scene, world, {
    position: [startWorld[0], 0.1, startWorld[2]] as CoordinateTuple,
    size: markerSize,
    color: startColor,
    type: "fixed",
  });

  const goalWorld = gridToWorld(goal.x, goal.z, currentGridConfig);
  state.goalMarker = getCube(scene, world, {
    position: [goalWorld[0], 0.1, goalWorld[2]] as CoordinateTuple,
    size: markerSize,
    color: goalColor,
    type: "fixed",
  });

  if (state.character) {
    const [sx, , sz] = startWorld;
    state.character.position.set(sx, -1, sz);
  }

  // Reset timeline
  const allActions = timelineManager.getTimeline();
  allActions.filter((a) => a.category === "pathfinding").forEach((a) => {
    if (a.id) timelineManager.removeAction(a.id);
  });

  computeAndDrawPath(state, start, goal, currentGridConfig);
};

const onCanvasClick = (event: MouseEvent): void => {
  if (!sceneState || isAnimating.value) return;
  const { renderer, orthoCamera, scene, world, grid } = sceneState;
  const currentGridConfig = sceneState.currentGridConfig;

  const rect = renderer.domElement.getBoundingClientRect();
  const ndcX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  const ndcY = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), orthoCamera);

  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const target = new THREE.Vector3();
  raycaster.ray.intersectPlane(groundPlane, target);

  const gridPos = worldToGrid([target.x, 0, target.z], currentGridConfig);
  if (
    gridPos.x < 0 || gridPos.x >= currentGridConfig.width ||
    gridPos.z < 0 || gridPos.z >= currentGridConfig.height
  ) return;

  const start = defaultStart;
  const goal = defaultGoal(currentGridConfig.width, currentGridConfig.height);
  if (
    (gridPos.x === start.x && gridPos.z === start.z) ||
    (gridPos.x === goal.x && gridPos.z === goal.z)
  ) return;

  const cell = grid.cells[gridPos.z]?.[gridPos.x];
  if (!cell) return;

  if (cell.walkable) {
    const worldPos = gridToWorld(gridPos.x, gridPos.z, currentGridConfig);
    const color = obstacleColors[(gridPos.x + gridPos.z) % obstacleColors.length];
    const cube = getCube(scene, world, {
      position: [worldPos[0], 1, worldPos[2]] as CoordinateTuple,
      size: obstacleSize,
      color,
      type: "fixed",
    });
    sceneState.obstacleMeshes.push(cube);
    sceneState.grid = markObstacle(grid, gridPos.x, gridPos.z);
  } else {
    const worldPos = gridToWorld(gridPos.x, gridPos.z, currentGridConfig);
    const idx = sceneState.obstacleMeshes.findIndex(
      (m) =>
        Math.abs(m.position.x - worldPos[0]) < 0.5 &&
        Math.abs(m.position.z - worldPos[2]) < 0.5
    );
    if (idx !== -1) {
      scene.remove(sceneState.obstacleMeshes[idx]);
      sceneState.obstacleMeshes.splice(idx, 1);
    }
    const remaining = sceneState.obstacleMeshes.map((m) =>
      worldToGrid([m.position.x, 0, m.position.z], currentGridConfig)
    );
    sceneState.grid = markObstacles(createGrid(currentGridConfig), remaining);
  }

  computeAndDrawPath(sceneState, start, goal, currentGridConfig);
};

const handleResize = (): void => {
  if (!sceneState) return;
  const { renderer, orthoCamera } = sceneState;
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setSize(width, height);
  const aspect = width / height;
  orthoCamera.left = (FRUSTUM_SIZE * aspect) / -2;
  orthoCamera.right = (FRUSTUM_SIZE * aspect) / 2;
  orthoCamera.top = FRUSTUM_SIZE / 2;
  orthoCamera.bottom = FRUSTUM_SIZE / -2;
  orthoCamera.updateProjectionMatrix();
};

const init = async (): Promise<void> => {
  if (!canvas.value) return;

  if (animFrameId !== null) cancelAnimationFrame(animFrameId);
  frameCounter = 0;

  const { renderer, scene, world, getDelta } = await getTools({ canvas: canvas.value });

  // Override renderer size
  renderer.setSize(window.innerWidth, window.innerHeight);

  const orthoCamera = createOrthoCamera(window.innerWidth, window.innerHeight);
  scene.add(orthoCamera);

  // Lights
  const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
  scene.add(ambientLight);
  const dirLight = new THREE.DirectionalLight(0xffffff, 2);
  dirLight.position.set(20, 30, 20);
  dirLight.castShadow = true;
  scene.add(dirLight);

  // Ground
  const groundGeo = new THREE.PlaneGeometry(200, 200);
  const groundMat = new THREE.MeshLambertMaterial({ color: 0x2c3e50 });
  const groundMesh = new THREE.Mesh(groundGeo, groundMat);
  groundMesh.rotation.x = -Math.PI / 2;
  groundMesh.receiveShadow = true;
  scene.add(groundMesh);
  scene.background = new THREE.Color(0x1a1a2e);

  const timelineManager = createTimelineManager();
  const currentGridConfig = { ...gridConfig };

  const character = await getModel(scene, world, "mushroom.glb", characterSettings.model);

  sceneState = {
    renderer,
    scene,
    world,
    orthoCamera,
    getDelta,
    timelineManager,
    character,
    obstacleMeshes: [],
    pathLine: null,
    costLabels: [],
    grid: createGrid(currentGridConfig),
    startMarker: null,
    goalMarker: null,
    currentGridConfig,
  };

  buildScene(sceneState, reactiveConfig.value.obstacles.density, currentGridConfig);

  // Custom render loop using orthographic camera
  const runLoop = (): void => {
    animFrameId = requestAnimationFrame(runLoop);
    world.step();
    animateTimeline(timelineManager, frameCounter, undefined, { enableAutoRemoval: true });
    frameCounter++;
    renderer.render(scene, orthoCamera);
  };
  runLoop();

  canvas.value.addEventListener("click", onCanvasClick);
  window.addEventListener("resize", handleResize);
};

const generateNewScene = (): void => {
  if (!sceneState || isAnimating.value) return;
  currentScenario.value = "random";
  buildScene(sceneState, reactiveConfig.value.obstacles.density, sceneState.currentGridConfig);
};

const recalculatePath = (): void => {
  if (!sceneState || isAnimating.value) return;
  const start = defaultStart;
  const goal = defaultGoal(sceneState.currentGridConfig.width, sceneState.currentGridConfig.height);

  if (sceneState.character) {
    const startWorld = gridToWorld(start.x, start.z, sceneState.currentGridConfig);
    sceneState.character.position.set(startWorld[0], -1, startWorld[2]);
  }

  computeAndDrawPath(sceneState, start, goal, sceneState.currentGridConfig);
};

const loadScenario = (name: string): void => {
  if (!sceneState || isAnimating.value) return;
  const scenario = scenarios[name];
  if (!scenario) return;
  currentScenario.value = name;
  buildScene(sceneState, 0, sceneState.currentGridConfig, scenario);
};

const toggleCosts = (): void => {
  if (!sceneState) return;
  showCosts.value = !showCosts.value;
  const { scene, grid, currentGridConfig } = sceneState;
  clearCostLabels(scene, sceneState.costLabels);
  if (showCosts.value && sceneState.pathLine) {
    const start = defaultStart;
    const goal = defaultGoal(currentGridConfig.width, currentGridConfig.height);
    const path = getBestRoute(grid, start, goal);
    if (path) drawCostLabels(scene, path, currentGridConfig, sceneState.costLabels);
  }
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
});

onUnmounted(() => {
  if (animFrameId !== null) cancelAnimationFrame(animFrameId);
  canvas.value?.removeEventListener("click", onCanvasClick);
  window.removeEventListener("resize", handleResize);
  clearViewPanels();
  unregisterViewConfig(route.name as string);
  sceneState = null;
});
</script>

<template>
  <canvas ref="canvas"></canvas>

  <aside class="pathfinder-viz__legend">
    <h3 class="pathfinder-viz__legend-title">Legend</h3>
    <ul class="pathfinder-viz__legend-list">
      <li class="pathfinder-viz__legend-item">
        <span class="pathfinder-viz__legend-swatch pathfinder-viz__legend-swatch--start"></span>
        Start
      </li>
      <li class="pathfinder-viz__legend-item">
        <span class="pathfinder-viz__legend-swatch pathfinder-viz__legend-swatch--goal"></span>
        Goal
      </li>
      <li class="pathfinder-viz__legend-item">
        <span class="pathfinder-viz__legend-swatch pathfinder-viz__legend-swatch--path"></span>
        Path
      </li>
      <li class="pathfinder-viz__legend-item">
        <span class="pathfinder-viz__legend-swatch pathfinder-viz__legend-swatch--obstacle"></span>
        Obstacle
      </li>
    </ul>
    <p class="pathfinder-viz__legend-hint">Click grid to toggle obstacles</p>
  </aside>

  <nav class="pathfinder-viz__scenarios">
    <span class="pathfinder-viz__scenarios-label">Scenarios:</span>
    <Button
      v-for="(_, name) in scenarios"
      :key="name"
      size="sm"
      :variant="currentScenario === name ? 'default' : 'outline'"
      :disabled="isAnimating"
      @click="loadScenario(String(name))"
    >
      {{ name }}
    </Button>
  </nav>

  <div class="pathfinder-viz__controls">
    <Button variant="secondary" :disabled="isAnimating" @click="generateNewScene">
      New Scene
    </Button>
    <Button variant="secondary" :disabled="isAnimating" @click="recalculatePath">
      Recalculate
    </Button>
    <Button variant="outline" size="sm" @click="toggleCosts">
      {{ showCosts ? "Hide Costs" : "Show Costs" }}
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

.pathfinder-viz__legend {
  position: fixed;
  top: 50%;
  right: 1rem;
  transform: translateY(-50%);
  background: rgba(0, 0, 0, 0.75);
  padding: 1rem;
  border-radius: 0.5rem;
  min-width: 8rem;
  backdrop-filter: blur(4px);
}

.pathfinder-viz__legend-title {
  color: #ffffff;
  font-family: monospace;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin: 0 0 0.75rem;
}

.pathfinder-viz__legend-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.pathfinder-viz__legend-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #e0e0e0;
  font-family: monospace;
  font-size: 0.8rem;
}

.pathfinder-viz__legend-swatch {
  display: inline-block;
  width: 1rem;
  height: 1rem;
  border-radius: 0.125rem;
  flex-shrink: 0;
}

.pathfinder-viz__legend-swatch--start { background: #2ecc71; }
.pathfinder-viz__legend-swatch--goal  { background: #e74c3c; }
.pathfinder-viz__legend-swatch--path  { background: #f39c12; }
.pathfinder-viz__legend-swatch--obstacle { background: #4ecdc4; }

.pathfinder-viz__legend-hint {
  color: #888;
  font-size: 0.7rem;
  font-family: monospace;
  margin: 0.75rem 0 0;
}

.pathfinder-viz__scenarios {
  position: fixed;
  top: 1rem;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 0.5rem;
  align-items: center;
  background: rgba(0, 0, 0, 0.6);
  padding: 0.5rem 0.75rem;
  border-radius: 0.5rem;
  backdrop-filter: blur(4px);
}

.pathfinder-viz__scenarios-label {
  color: #ccc;
  font-family: monospace;
  font-size: 0.75rem;
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
  .pathfinder-viz__legend,
  .pathfinder-viz__controls,
  .pathfinder-viz__scenarios {
    background: rgba(255, 255, 255, 0.85);
  }

  .pathfinder-viz__legend-title { color: #1a1a2e; }
  .pathfinder-viz__legend-item { color: #333; }
  .pathfinder-viz__legend-hint { color: #666; }
  .pathfinder-viz__scenarios-label { color: #333; }
  .pathfinder-viz__no-path { color: #c0392b; }
}
</style>
