<script setup lang="ts">
import { onMounted, onUnmounted, ref, shallowRef, watch } from "vue";
import { useRoute } from "vue-router";
import * as THREE from "three";
import {
  getTools,
  getCube,
  type ComplexModel,
} from "@webgamekit/threejs";
import { type CoordinateTuple } from "@webgamekit/animation";
import { registerViewConfig, unregisterViewConfig, createReactiveConfig } from "@/composables/useViewConfig";
import { useViewPanels } from "@/composables/useViewPanels";

import {
  gridConfig,
  sceneSetupConfig,
  cellTypeColors,
  cellTypeHeights,
  cellFootprint,
  startColor,
  goalColor,
  pathColor,
  obstacleDensity,
  markerSize,
  obstacleCubeBase,
  configControls,
  defaultSceneValues,
  sceneControls,
  defaultStart,
  defaultGoal,
  scenarios,
  type ScenarioConfig,
} from "./config";
import { createGrid, setCellType, gridToWorld, worldToGrid } from "./helpers/grid";
import type { Grid, GridConfig, CellType } from "./helpers/grid";
import type { Position } from "./helpers/pathfinding";
import { getBestRoute } from "./helpers/pathfinding";
import { createPathLine, removePathLine } from "./helpers/pathAnimation";

const route = useRoute();
const { setViewPanels, clearViewPanels } = useViewPanels();

const canvas = ref<HTMLCanvasElement | null>(null);
const hasPath = shallowRef(false);
const isDragging = shallowRef(false);
const dragAction = shallowRef<CellType | null>(null);

const reactiveConfig = createReactiveConfig({
  density: obstacleDensity,
  width: gridConfig.width,
  height: gridConfig.height,
  brush: "boulder",
  scenarios: "simple",
  showCosts: false,
});

const sceneConfig = createReactiveConfig(defaultSceneValues);

// Sync scenario selection from config panel (value is already the scenario key)
watch(
  () => reactiveConfig.value.scenarios,
  (name) => {
    loadScenario(name);
  }
);

// Grid size changes rebuild the scene
watch(
  () => [reactiveConfig.value.width, reactiveConfig.value.height] as const,
  ([newWidth, newHeight]) => {
    if (!sceneState) return;
    const newConfig: GridConfig = { ...gridConfig, width: newWidth, height: newHeight };
    buildScene(sceneState, reactiveConfig.value.density, newConfig);
  }
);

// Show/hide cost labels when the toggle changes
watch(
  () => reactiveConfig.value.showCosts,
  () => { refreshCostLabels(); }
);

// Isometric camera toggle
watch(
  () => sceneConfig.value.camera.isometric,
  (isIso) => {
    if (!sceneState) return;
    const { orthoCamera } = sceneState;
    if (isIso) {
      orthoCamera.position.set(30, 30, 30);
    } else {
      orthoCamera.position.set(0, 50, 0);
    }
    orthoCamera.lookAt(0, 0, 0);
    orthoCamera.updateProjectionMatrix();
  }
);

type SceneState = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  world: Parameters<typeof getCube>[1];
  orthoCamera: THREE.OrthographicCamera;
  obstacleMeshes: Map<string, ComplexModel>;
  pathLine: THREE.Group | null;
  costLabels: THREE.Sprite[];
  grid: Grid;
  startMarker: ComplexModel | null;
  goalMarker: ComplexModel | null;
  currentGridConfig: GridConfig;
  currentStart: Position | null;
  currentGoal: Position | null;
};

let sceneState: SceneState | null = null;
let animFrameId: number | null = null;

const FRUSTUM_SIZE = 40;
const GROUND_Y = -1;

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

type TypedPosition = { x: number; z: number; type: CellType };

// One wormhole pair per 8 obstacles; remainder split ~60% boulder / 40% gravel
const assignObstacleType = (index: number, count: number): CellType => {
  const pairCount = Math.floor(count / 8);
  const pairIndex = Math.floor(index / 2);
  if (pairIndex < pairCount) return index % 2 === 0 ? "wormholeEntrance" : "wormholeExit";
  return index % 10 < 6 ? "boulder" : "gravel";
};

const generateTypedObstacles = (
  width: number,
  height: number,
  density: number,
  start: Position,
  goal: Position
): TypedPosition[] => {
  const total = width * height;
  const count = Math.floor(total * density);

  return Array.from({ length: total }, (_, i) => ({ x: i % width, z: Math.floor(i / width) }))
    .filter((pos) => !(pos.x === start.x && pos.z === start.z) && !(pos.x === goal.x && pos.z === goal.z))
    .map((pos) => ({ pos, sort: Math.random() }))
    .sort((a, b) => a.sort - b.sort)
    .map(({ pos }) => pos)
    .slice(0, count)
    .map((pos, i) => ({ ...pos, type: assignObstacleType(i, count) }));
};

const buildCostSprite = (text: string, position: THREE.Vector3, scene: THREE.Scene): THREE.Sprite => {
  const offscreenCanvas = document.createElement("canvas");
  offscreenCanvas.width = 192;
  offscreenCanvas.height = 96;
  const ctx = offscreenCanvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(0, 0, 192, 96);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 54px monospace";
    ctx.textAlign = "center";
    ctx.fillText(text, 96, 66);
  }
  const texture = new THREE.CanvasTexture(offscreenCanvas);
  const material = new THREE.SpriteMaterial({ map: texture });
  const sprite = new THREE.Sprite(material);
  sprite.position.copy(position);
  sprite.scale.set(1.8, 0.9, 1);
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
    const worldPos = new THREE.Vector3(wx, GROUND_Y + 1.5, wz);
    const sprite = buildCostSprite(String(index), worldPos, scene);
    labels.push(sprite);
  });
};

const CELL_Y_OFFSET = GROUND_Y;

const cellKey = (x: number, z: number): string => `${x},${z}`;

const makeCellMesh = (
  scene: THREE.Scene,
  world: SceneState["world"],
  x: number,
  z: number,
  type: CellType,
  currentGridConfig: GridConfig
): ComplexModel => {
  const worldPos = gridToWorld(x, z, currentGridConfig);
  const height = cellTypeHeights[type] ?? 1;
  const color = cellTypeColors[type] ?? cellTypeColors.boulder;
  return getCube(scene, world, {
    ...obstacleCubeBase,
    position: [worldPos[0], CELL_Y_OFFSET + height / 2, worldPos[2]] as CoordinateTuple,
    size: [cellFootprint, height, cellFootprint] as CoordinateTuple,
    color,
  });
};

const buildMeshesFromGrid = (
  scene: THREE.Scene,
  world: SceneState["world"],
  grid: Grid,
  currentGridConfig: GridConfig
): Map<string, ComplexModel> => {
  const map = new Map<string, ComplexModel>();
  grid.cells.flat()
    .filter((c) => c.type !== "empty")
    .forEach((c) => {
      map.set(cellKey(c.x, c.z), makeCellMesh(scene, world, c.x, c.z, c.type, currentGridConfig));
    });
  return map;
};

const clearSceneMeshes = (scene: THREE.Scene, meshes: Map<string, ComplexModel>): void => {
  meshes.forEach((mesh) => scene.remove(mesh));
  meshes.clear();
};

const computeAndDrawPath = (
  state: SceneState,
  start: Position | null,
  goal: Position | null,
  currentGridConfig: GridConfig
): void => {
  const { scene } = state;

  if (state.pathLine) {
    removePathLine(scene, state.pathLine);
    state.pathLine = null;
    hasPath.value = false;
  }
  clearCostLabels(scene, state.costLabels);

  if (!start || !goal) return;

  const path = getBestRoute(state.grid, start, goal);
  if (!path) return;

  state.pathLine = createPathLine(scene, path, currentGridConfig, pathColor);
  hasPath.value = true;

  if (reactiveConfig.value.showCosts) {
    drawCostLabels(scene, path, currentGridConfig, state.costLabels);
  }
};

const buildScene = (
  state: SceneState,
  density: number,
  baseGridConfig: GridConfig,
  scenario?: ScenarioConfig
): void => {
  const { scene, world } = state;

  // Scenario may override grid size
  const effectiveGridConfig: GridConfig = scenario?.gridSize
    ? { ...baseGridConfig, ...scenario.gridSize }
    : baseGridConfig;

  const start = scenario?.start ?? defaultStart;
  const goal = scenario?.goal ?? defaultGoal(effectiveGridConfig.width, effectiveGridConfig.height);

  state.currentGridConfig = effectiveGridConfig;
  state.currentStart = start;
  state.currentGoal = goal;

  if (state.pathLine) {
    removePathLine(scene, state.pathLine);
    state.pathLine = null;
    hasPath.value = false;
  }
  clearCostLabels(scene, state.costLabels);

  // Build grid: apply scenario cells or generate random obstacles
  let grid = createGrid(effectiveGridConfig);
  if (scenario?.cells?.length) {
    grid = scenario.cells.reduce(
      (g, cell) => setCellType(g, cell.x, cell.z, cell.type ?? "boulder"),
      grid
    );
  } else {
    grid = generateTypedObstacles(effectiveGridConfig.width, effectiveGridConfig.height, density, start, goal)
      .reduce((g, { x, z, type }) => setCellType(g, x, z, type), grid);
  }
  state.grid = grid;

  clearSceneMeshes(scene, state.obstacleMeshes);
  buildMeshesFromGrid(scene, world, state.grid, effectiveGridConfig).forEach((mesh, key) => {
    state.obstacleMeshes.set(key, mesh);
  });

  if (state.startMarker) scene.remove(state.startMarker);
  if (state.goalMarker) scene.remove(state.goalMarker);

  const startWorld = gridToWorld(start.x, start.z, effectiveGridConfig);
  state.startMarker = getCube(scene, world, {
    position: [startWorld[0], GROUND_Y + 0.5, startWorld[2]] as CoordinateTuple,
    size: markerSize,
    color: startColor,
    type: "fixed",
    castShadow: true,
    receiveShadow: false,
  });

  const goalWorld = gridToWorld(goal.x, goal.z, effectiveGridConfig);
  state.goalMarker = getCube(scene, world, {
    position: [goalWorld[0], GROUND_Y + 0.5, goalWorld[2]] as CoordinateTuple,
    size: markerSize,
    color: goalColor,
    type: "fixed",
    castShadow: true,
    receiveShadow: false,
  });

  computeAndDrawPath(state, start, goal, effectiveGridConfig);
};

const applyObstacleEdit = (
  state: SceneState,
  gridPos: { x: number; z: number },
  targetType: CellType
): void => {
  const { scene, world, grid, currentGridConfig } = state;
  const isStart = state.currentStart && gridPos.x === state.currentStart.x && gridPos.z === state.currentStart.z;
  const isGoal = state.currentGoal && gridPos.x === state.currentGoal.x && gridPos.z === state.currentGoal.z;

  if (isStart || isGoal) return;

  const cell = grid.cells[gridPos.z]?.[gridPos.x];
  if (!cell || cell.type === targetType) return;

  const key = cellKey(gridPos.x, gridPos.z);
  const oldMesh = state.obstacleMeshes.get(key);
  if (oldMesh) {
    scene.remove(oldMesh);
    state.obstacleMeshes.delete(key);
  }

  state.grid = setCellType(grid, gridPos.x, gridPos.z, targetType);

  if (targetType !== "empty") {
    const mesh = makeCellMesh(scene, world, gridPos.x, gridPos.z, targetType, currentGridConfig);
    state.obstacleMeshes.set(key, mesh);
  }
};

const getGridPosFromEvent = (
  event: MouseEvent,
  state: SceneState
): { x: number; z: number } | null => {
  const { renderer, orthoCamera } = state;
  const rect = renderer.domElement.getBoundingClientRect();
  const ndcX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  const ndcY = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), orthoCamera);

  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const target = new THREE.Vector3();
  raycaster.ray.intersectPlane(groundPlane, target);

  const gridPos = worldToGrid([target.x, 0, target.z], state.currentGridConfig);
  const { width, height } = state.currentGridConfig;
  if (gridPos.x < 0 || gridPos.x >= width || gridPos.z < 0 || gridPos.z >= height) {
    return null;
  }
  return gridPos;
};

const placeMarker = (
  state: SceneState,
  gridPos: { x: number; z: number },
  which: "start" | "goal"
): void => {
  const { scene, world, currentGridConfig } = state;
  const other = which === "start" ? state.currentGoal : state.currentStart;
  if (other && gridPos.x === other.x && gridPos.z === other.z) return;
  const cell = state.grid.cells[gridPos.z]?.[gridPos.x];
  if (!cell || cell.type !== "empty") return;

  const [wx, , wz] = gridToWorld(gridPos.x, gridPos.z, currentGridConfig);

  if (which === "start") {
    if (state.startMarker) scene.remove(state.startMarker);
    state.startMarker = getCube(scene, world, {
      position: [wx, GROUND_Y + 0.5, wz] as CoordinateTuple,
      size: markerSize, color: startColor, type: "fixed",
      castShadow: true, receiveShadow: false,
    });
    state.currentStart = { x: gridPos.x, z: gridPos.z };
  } else {
    if (state.goalMarker) scene.remove(state.goalMarker);
    state.goalMarker = getCube(scene, world, {
      position: [wx, GROUND_Y + 0.5, wz] as CoordinateTuple,
      size: markerSize, color: goalColor, type: "fixed",
      castShadow: true, receiveShadow: false,
    });
    state.currentGoal = { x: gridPos.x, z: gridPos.z };
  }
};

const onCanvasClick = (event: MouseEvent): void => {
  if (!sceneState || isDragging.value) return;

  const gridPos = getGridPosFromEvent(event, sceneState);
  if (!gridPos) return;

  const brush = reactiveConfig.value.brush;
  if (brush === "start") {
    placeMarker(sceneState, gridPos, "start");
  } else if (brush === "goal") {
    placeMarker(sceneState, gridPos, "goal");
  } else {
    const cell = sceneState.grid.cells[gridPos.z]?.[gridPos.x];
    if (!cell) return;
    applyObstacleEdit(sceneState, gridPos, brush as CellType);
  }
  computeAndDrawPath(sceneState, sceneState.currentStart, sceneState.currentGoal, sceneState.currentGridConfig);
};

const onCanvasMouseDown = (event: MouseEvent): void => {
  if (!sceneState) return;
  const brush = reactiveConfig.value.brush;
  if (brush === "start" || brush === "goal") return; // start/goal only on click, not drag

  const gridPos = getGridPosFromEvent(event, sceneState);
  if (!gridPos) return;
  const cell = sceneState.grid.cells[gridPos.z]?.[gridPos.x];
  if (!cell) return;

  isDragging.value = false;
  dragAction.value = brush as CellType;
};

const onCanvasMouseMove = (event: MouseEvent): void => {
  if (!sceneState || dragAction.value === null || event.buttons === 0) return;
  isDragging.value = true;

  const gridPos = getGridPosFromEvent(event, sceneState);
  if (!gridPos) return;

  applyObstacleEdit(sceneState, gridPos, dragAction.value);
};

const onCanvasMouseUp = (): void => {
  if (dragAction.value !== null && sceneState) {
    computeAndDrawPath(sceneState, sceneState.currentStart, sceneState.currentGoal, sceneState.currentGridConfig);
  }
  dragAction.value = null;
  setTimeout(() => { isDragging.value = false; }, 0);
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

  const { setup, renderer, scene, world } = await getTools({ canvas: canvas.value });

  const orthoCamera = createOrthoCamera(window.innerWidth, window.innerHeight);
  scene.add(orthoCamera);

  await setup({ config: sceneSetupConfig, defineSetup: async () => {} });

  const currentGridConfig = { ...gridConfig };

  sceneState = {
    renderer,
    scene,
    world,
    orthoCamera,
    obstacleMeshes: new Map(),
    pathLine: null,
    costLabels: [],
    grid: createGrid(currentGridConfig),
    startMarker: null,
    goalMarker: null,
    currentGridConfig,
    currentStart: null,
    currentGoal: null,
  };

  buildScene(sceneState, reactiveConfig.value.density, currentGridConfig);

  const runLoop = (): void => {
    animFrameId = requestAnimationFrame(runLoop);
    world.step();
    renderer.render(scene, orthoCamera);
  };
  runLoop();

  canvas.value.addEventListener("click", onCanvasClick);
  canvas.value.addEventListener("mousedown", onCanvasMouseDown);
  canvas.value.addEventListener("mousemove", onCanvasMouseMove);
  canvas.value.addEventListener("mouseup", onCanvasMouseUp);
  window.addEventListener("resize", handleResize);
};

const generateNewScene = (): void => {
  if (!sceneState) return;
  buildScene(sceneState, reactiveConfig.value.density, sceneState.currentGridConfig);
};

const recalculatePath = (): void => {
  if (!sceneState) return;
  computeAndDrawPath(sceneState, sceneState.currentStart, sceneState.currentGoal, sceneState.currentGridConfig);
};

const loadScenario = (name: string): void => {
  if (!sceneState) return;
  const scenario = scenarios[name];
  if (!scenario) return;
  buildScene(sceneState, 0, sceneState.currentGridConfig, scenario);
};

const refreshCostLabels = (): void => {
  if (!sceneState) return;
  const { scene, grid, currentGridConfig, currentStart, currentGoal } = sceneState;
  clearCostLabels(scene, sceneState.costLabels);
  if (reactiveConfig.value.showCosts && sceneState.pathLine && currentStart && currentGoal) {
    const path = getBestRoute(grid, currentStart, currentGoal);
    if (path) drawCostLabels(scene, path, currentGridConfig, sceneState.costLabels);
  }
};

const clearObstacles = (): void => {
  if (!sceneState) return;
  clearSceneMeshes(sceneState.scene, sceneState.obstacleMeshes);
  sceneState.grid = createGrid(sceneState.currentGridConfig);
  computeAndDrawPath(sceneState, sceneState.currentStart, sceneState.currentGoal, sceneState.currentGridConfig);
};

onMounted(async () => {
  setViewPanels({ showConfig: true, showScene: true });
  registerViewConfig(
    route.name as string,
    reactiveConfig,
    configControls,
    sceneConfig,
    sceneControls,
    undefined,
    undefined,
    {
      generateNewScene,
      recalculate: recalculatePath,
      clearObstacles,
    }
  );
  await init();
});

onUnmounted(() => {
  if (animFrameId !== null) cancelAnimationFrame(animFrameId);
  canvas.value?.removeEventListener("click", onCanvasClick);
  canvas.value?.removeEventListener("mousedown", onCanvasMouseDown);
  canvas.value?.removeEventListener("mousemove", onCanvasMouseMove);
  canvas.value?.removeEventListener("mouseup", onCanvasMouseUp);
  window.removeEventListener("resize", handleResize);
  clearViewPanels();
  unregisterViewConfig(route.name as string);
  sceneState = null;
});
</script>

<template>
  <canvas ref="canvas"></canvas>

  <!-- Status indicator (bottom-right) -->
  <div class="pf-toolbar">
    <p v-if="!hasPath" class="pf-toolbar__no-path">No path found</p>
  </div>
</template>

<style scoped>
canvas {
  display: block;
  width: 100%;
  height: 100vh;
}

/* Action toolbar */
.pf-toolbar {
  position: fixed;
  bottom: 1rem;
  right: 1rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
  align-items: center;
}

.pf-toolbar__no-path {
  font-size: 0.75rem;
  color: #e74c3c;
  margin: 0;
}
</style>
