<script setup lang="ts">
import { onMounted, onUnmounted, ref, shallowRef, watch } from "vue";
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
  cellTypeColors,
  cellTypeHeights,
  cellFootprint,
  startColor,
  goalColor,
  pathColor,
  obstacleDensity,
  characterSettings,
  markerSize,
  framesPerCell,
  configControls,
  sceneControls,
  defaultStart,
  defaultGoal,
  scenarios,
} from "./config";
import { createGrid, markObstacles, setCellType, isCellWalkable, gridToWorld, worldToGrid } from "./helpers/grid";
import type { Grid, GridConfig, CellType } from "./helpers/grid";
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
const isDragging = shallowRef(false);
const dragAction = shallowRef<CellType | null>(null);

const reactiveConfig = createReactiveConfig({
  obstacles: { density: obstacleDensity },
  grid: { width: gridConfig.width, height: gridConfig.height },
});

watch(
  () => [reactiveConfig.value.grid.width, reactiveConfig.value.grid.height] as const,
  ([newWidth, newHeight]) => {
    if (!sceneState) return;
    const newConfig: GridConfig = { ...gridConfig, width: newWidth, height: newHeight };
    sceneState.currentGridConfig = newConfig;
    buildScene(sceneState, reactiveConfig.value.obstacles.density, newConfig);
  }
);

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
  obstacleMeshes: Map<string, ComplexModel>;
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
    const worldPos = new THREE.Vector3(wx, 0.5, wz);
    const sprite = buildCostSprite(String(index), worldPos, scene);
    labels.push(sprite);
  });
};

const CELL_Y_OFFSET = 0.15;

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
    position: [worldPos[0], CELL_Y_OFFSET + height / 2, worldPos[2]] as CoordinateTuple,
    size: [cellFootprint, height, cellFootprint] as CoordinateTuple,
    color,
    type: "fixed",
    castShadow: true,
    receiveShadow: true,
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

const EDITOR_CYCLE: CellType[] = ["empty", "boulder", "gravel", "wormholeEntrance", "wormholeExit"];

const nextCellType = (current: CellType): CellType => {
  const idx = EDITOR_CYCLE.indexOf(current);
  return EDITOR_CYCLE[(idx + 1) % EDITOR_CYCLE.length];
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
  buildMeshesFromGrid(scene, world, state.grid, currentGridConfig).forEach((mesh, key) => {
    state.obstacleMeshes.set(key, mesh);
  });

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

const stopPathAnimation = (state: SceneState): void => {
  state.timelineManager
    .getTimeline()
    .filter((a) => a.category === "pathfinding")
    .forEach((a) => { if (a.id) state.timelineManager.removeAction(a.id); });
  isAnimating.value = false;
};

const applyObstacleEdit = (
  state: SceneState,
  gridPos: { x: number; z: number },
  targetType: CellType
): void => {
  const { scene, world, grid } = state;
  const currentGridConfig = state.currentGridConfig;
  const start = defaultStart;
  const goal = defaultGoal(currentGridConfig.width, currentGridConfig.height);

  if (
    (gridPos.x === start.x && gridPos.z === start.z) ||
    (gridPos.x === goal.x && gridPos.z === goal.z)
  ) return;

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

const onCanvasClick = (event: MouseEvent): void => {
  if (!sceneState || isDragging.value) return;

  const gridPos = getGridPosFromEvent(event, sceneState);
  if (!gridPos) return;

  if (isAnimating.value) stopPathAnimation(sceneState);

  const cell = sceneState.grid.cells[gridPos.z]?.[gridPos.x];
  if (!cell) return;

  applyObstacleEdit(sceneState, gridPos, nextCellType(cell.type));

  const start = defaultStart;
  const goal = defaultGoal(sceneState.currentGridConfig.width, sceneState.currentGridConfig.height);
  computeAndDrawPath(sceneState, start, goal, sceneState.currentGridConfig);
};

const onCanvasMouseDown = (event: MouseEvent): void => {
  if (!sceneState) return;
  const gridPos = getGridPosFromEvent(event, sceneState);
  if (!gridPos) return;

  const cell = sceneState.grid.cells[gridPos.z]?.[gridPos.x];
  if (!cell) return;

  isDragging.value = false;
  dragAction.value = nextCellType(cell.type);
};

const onCanvasMouseMove = (event: MouseEvent): void => {
  if (!sceneState || dragAction.value === null || event.buttons === 0) return;
  isDragging.value = true;

  if (isAnimating.value) stopPathAnimation(sceneState);

  const gridPos = getGridPosFromEvent(event, sceneState);
  if (!gridPos) return;

  applyObstacleEdit(sceneState, gridPos, dragAction.value);
};

const onCanvasMouseUp = (): void => {
  if (dragAction.value !== null && sceneState) {
    const start = defaultStart;
    const goal = defaultGoal(sceneState.currentGridConfig.width, sceneState.currentGridConfig.height);
    computeAndDrawPath(sceneState, start, goal, sceneState.currentGridConfig);
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
    obstacleMeshes: new Map(),
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
  canvas.value.addEventListener("mousedown", onCanvasMouseDown);
  canvas.value.addEventListener("mousemove", onCanvasMouseMove);
  canvas.value.addEventListener("mouseup", onCanvasMouseUp);
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

const clearObstacles = (): void => {
  if (!sceneState) return;
  if (isAnimating.value) stopPathAnimation(sceneState);
  clearSceneMeshes(sceneState.scene, sceneState.obstacleMeshes);
  sceneState.grid = createGrid(sceneState.currentGridConfig);
  const start = defaultStart;
  const goal = defaultGoal(sceneState.currentGridConfig.width, sceneState.currentGridConfig.height);
  computeAndDrawPath(sceneState, start, goal, sceneState.currentGridConfig);
};

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

  <Teleport to="#config-panel-extra">
    <div class="pf-panel">
      <!-- Scenarios -->
      <section class="pf-panel__section">
        <h4 class="pf-panel__heading">Scenarios</h4>
        <div class="pf-panel__btn-group">
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
        </div>
      </section>

      <!-- Actions -->
      <section class="pf-panel__section">
        <h4 class="pf-panel__heading">Actions</h4>
        <div class="pf-panel__btn-group">
          <Button variant="secondary" size="sm" :disabled="isAnimating" @click="generateNewScene">
            New Scene
          </Button>
          <Button variant="secondary" size="sm" :disabled="isAnimating" @click="recalculatePath">
            Recalculate
          </Button>
          <Button variant="outline" size="sm" @click="clearObstacles">
            Clear
          </Button>
          <Button variant="outline" size="sm" @click="toggleCosts">
            {{ showCosts ? "Hide Costs" : "Show Costs" }}
          </Button>
        </div>
        <p v-if="!hasPath" class="pf-panel__no-path">No path found</p>
      </section>

      <!-- Legend -->
      <section class="pf-panel__section">
        <h4 class="pf-panel__heading">Legend</h4>
        <ul class="pf-panel__legend">
          <li class="pf-panel__legend-item">
            <span class="pf-panel__swatch pf-panel__swatch--start"></span>Start
          </li>
          <li class="pf-panel__legend-item">
            <span class="pf-panel__swatch pf-panel__swatch--goal"></span>Goal
          </li>
          <li class="pf-panel__legend-item">
            <span class="pf-panel__swatch pf-panel__swatch--path"></span>Path
          </li>
          <li class="pf-panel__legend-item">
            <span class="pf-panel__swatch pf-panel__swatch--boulder"></span>Boulder (impassable)
          </li>
          <li class="pf-panel__legend-item">
            <span class="pf-panel__swatch pf-panel__swatch--gravel"></span>Gravel (half speed)
          </li>
          <li class="pf-panel__legend-item">
            <span class="pf-panel__swatch pf-panel__swatch--entrance"></span>Wormhole entrance
          </li>
          <li class="pf-panel__legend-item">
            <span class="pf-panel__swatch pf-panel__swatch--exit"></span>Wormhole exit
          </li>
          <li class="pf-panel__legend-item">
            <span class="pf-panel__swatch pf-panel__swatch--character"></span>Character
          </li>
        </ul>
        <p class="pf-panel__hint">Click to cycle cell type · Drag to paint</p>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
canvas {
  display: block;
  width: 100%;
  height: 100vh;
}

/* Panel content (teleported into config panel) */
.pf-panel {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.pf-panel__section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.pf-panel__heading {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--muted-foreground, #888);
  margin: 0;
}

.pf-panel__btn-group {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
}

.pf-panel__no-path {
  font-size: 0.75rem;
  color: #e74c3c;
  margin: 0.25rem 0 0;
}

.pf-panel__legend {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.pf-panel__legend-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8rem;
}

.pf-panel__swatch {
  display: inline-block;
  width: 0.875rem;
  height: 0.875rem;
  border-radius: 0.125rem;
  flex-shrink: 0;
}

.pf-panel__swatch--start    { background: #2ecc71; }
.pf-panel__swatch--goal     { background: #e74c3c; }
.pf-panel__swatch--path     { background: #f39c12; }
.pf-panel__swatch--boulder  { background: #7f8c8d; }
.pf-panel__swatch--gravel   { background: #a07850; }
.pf-panel__swatch--entrance { background: #8e44ad; }
.pf-panel__swatch--exit     { background: #16a085; }
.pf-panel__swatch--character { background: #ffffff; border: 1px solid #555; }

.pf-panel__hint {
  font-size: 0.7rem;
  color: var(--muted-foreground, #888);
  margin: 0.25rem 0 0;
}
</style>
