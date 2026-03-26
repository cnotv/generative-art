<script setup lang="ts">
import { onMounted, onUnmounted, ref, shallowRef, toRaw } from "vue";
import { useRoute } from "vue-router";
import * as THREE from "three";
import { cameraFollowPlayer, removeElements } from "@webgamekit/threejs";
import type { CoordinateTuple } from "@webgamekit/animation";
import { createTimelineManager } from "@webgamekit/animation";
import { createGame, type GameState } from "@webgamekit/game";
import { createControls } from "@webgamekit/controls";
import { updateAnimation } from "@webgamekit/animation";
import type { Grid } from "@webgamekit/logic";
import {
  registerViewConfig,
  unregisterViewConfig,
  createReactiveConfig,
} from "@/stores/viewConfig";
import { useSceneViewStore } from "@/stores/sceneView";

import { createOfficeWalls, createIslandMaze, createOfficeShelves, createLevelMarkers } from "./helpers/island";
import { createMinimap } from "./helpers/minimap";
import { createScorePoster } from "./helpers/scorePoster";
import { spawnCoins, updateCoinSpin, checkCoinCollection } from "./helpers/coins";
import { spawnPaperPlanes, updatePaperPlaneChase, buildNavigationGrid, createInitialPaperPlanePathState, NAVIGATION_GRID_CONFIG, type PaperPlanePathState } from "./helpers/enemies";
import { createPlayer, updatePlayerMovement } from "./helpers/player";
import { getMazeCellCenters } from "./helpers/maze";
import { createPathDebug } from "./helpers/pathDebug";
import type { ComplexModel } from "@webgamekit/threejs";
import {
  setupConfig,
  controlBindings,
  configControls,
  CAMERA_OFFSET,
  PAPER_PLANE_COUNT,
  PAPER_PLANE_SPEED,
  PLAYER_SPEED,
  COLLECTION_RADIUS,
  COIN_SPIN_SPEED,
  ISLAND_SIZE,
  MAZE_CELL_SIZE,
  MAZE_EXIT_POSITION,
  PLAYER_START,
  PLAYER_DISTANCE,
  PATH_COLOR_PLAYER,
  PATH_COLORS_PLANES,
  PATH_Y_STEP,
  LEVEL_COMPLETE_RADIUS,
} from "./config";

type ReactiveConfigShape = { player: { speed: number }; autoMode: { enabled: boolean }; debug: { showPath: boolean } };

const route = useRoute();
const store = useSceneViewStore();

const reactiveConfig = createReactiveConfig({
  player: { speed: PLAYER_SPEED },
  paperPlane: { speed: PAPER_PLANE_SPEED },
  autoMode: { enabled: true },
  debug: { showPath: false },
});

const gameState = shallowRef<GameState>();
createGame({ data: { score: 0 } }, gameState, onUnmounted);

const canvas = ref<HTMLCanvasElement | null>(null);
const minimapCanvas = ref<HTMLCanvasElement | null>(null);

const { destroyControls, currentActions } = createControls(controlBindings);

const DIRECTIONAL_ACTIONS = ['move-left', 'move-right', 'move-up', 'move-down'];

const handleSpacebar = (e: KeyboardEvent) => {
  if (e.code !== 'Space') return;
  const cfg = reactiveConfig.value as unknown as { autoMode: { enabled: boolean } };
  cfg.autoMode.enabled = !cfg.autoMode.enabled;
};

onMounted(async () => {
  if (!canvas.value) return;

  registerViewConfig(
    route.name as string,
    reactiveConfig,
    configControls
  );

  window.addEventListener('keydown', handleSpacebar);

  await store.init(canvas.value, setupConfig, {
    viewPanels: { showConfig: false, showElements: false },
    playMode: true,
    defineSetup: async ({ scene, camera, world, getDelta, animate }) => {
      const cameraOffset = CAMERA_OFFSET as CoordinateTuple;

      // ── Persistent setup (created once) ────────────────────────────
      createOfficeWalls(scene, world);
      const player = await createPlayer(scene, world);
      const updatePoster = createScorePoster(scene, 0);
      const paperPlanes = await spawnPaperPlanes(scene, world, PAPER_PLANE_COUNT);

      const updatePlayerPath = createPathDebug(scene, NAVIGATION_GRID_CONFIG, PATH_COLOR_PLAYER, 0);
      const updatePlanePaths = paperPlanes.map((_, i) =>
        createPathDebug(scene, NAVIGATION_GRID_CONFIG, PATH_COLORS_PLANES[i % PATH_COLORS_PLANES.length], PATH_Y_STEP * (i + 1))
      );

      const planeColliders = new Set<object>(paperPlanes.map((p) => p.userData.collider as object));
      const playerCollider = player.userData.collider as object;

      // ── Per-level mutable state ─────────────────────────────────────
      let navGrid: Grid = buildNavigationGrid([]);
      let updateMinimap: ((p: THREE.Vector3, coins: ReturnType<typeof spawnCoins>, planes: typeof paperPlanes) => void) | null = null;
      let coins: ComplexModel[] = [];
      let paperPlanePathStates: PaperPlanePathState[] = paperPlanes.map(() => createInitialPaperPlanePathState());
      let playerPathState = createInitialPaperPlanePathState();
      let levelDispose = () => {};
      let isResettingLevel = false;

      const playerFilter = (col: object): boolean =>
        !planeColliders.has(col) && !coins.some((c) => (c.userData.collider as object) === col);
      const planeFilter = (col: object): boolean =>
        col !== playerCollider && !coins.some((c) => (c.userData.collider as object) === col);

      const buildLevel = async () => {
        if (isResettingLevel) return;
        isResettingLevel = true;

        levelDispose();
        updatePlayerPath(null, false);
        updatePlanePaths.forEach((fn) => fn(null, false));

        const { walls, segments, mazeGrid, extraBodies } = await createIslandMaze(scene, world);
        const shelves = await createOfficeShelves(scene, world);
        const { disposeMarkers } = createLevelMarkers(scene);

        navGrid = buildNavigationGrid(mazeGrid);
        updateMinimap = minimapCanvas.value ? createMinimap(minimapCanvas.value, segments) : null;
        coins = spawnCoins(scene, world, getMazeCellCenters(ISLAND_SIZE, MAZE_CELL_SIZE, 2));
        paperPlanePathStates = paperPlanes.map(() => createInitialPaperPlanePathState());
        playerPathState = createInitialPaperPlanePathState();

        levelDispose = () => {
          removeElements(scene, world, [...walls, ...shelves, ...coins]);
          extraBodies.forEach((b) => world.removeRigidBody(b));
          disposeMarkers();
          coins = [];
        };

        const [sx, sy, sz] = PLAYER_START as [number, number, number];
        const body = player.userData.body;
        body.setNextKinematicTranslation({ x: sx, y: sy, z: sz });
        player.position.set(sx, sy, sz);

        isResettingLevel = false;
      };

      await buildLevel();

      // ── Timeline ────────────────────────────────────────────────────
      const exitPosition = new THREE.Vector3(...(MAZE_EXIT_POSITION as [number, number, number]));
      let orbitReference: Parameters<typeof cameraFollowPlayer>[3] | null = null;
      const timelineManager = createTimelineManager();

      timelineManager.addAction({
        name: "player-movement",
        category: "user-input",
        action: () => {
          const cfg = reactiveConfig.value as unknown as ReactiveConfigShape;
          const isMovingManually = DIRECTIONAL_ACTIONS.some((key) => currentActions[key]);
          if (cfg.autoMode.enabled && isMovingManually) cfg.autoMode.enabled = false;

          if (cfg.autoMode.enabled && !isMovingManually) {
            const delta = getDelta();
            playerPathState = updatePaperPlaneChase(player, exitPosition, cfg.player.speed, delta, navGrid, playerPathState, playerFilter);
            updatePlayerPath(playerPathState.path, cfg.debug.showPath);
            updateAnimation({ actionName: playerPathState.path ? 'walk' : 'idle', player, delta: delta * 2, speed: cfg.player.speed, distance: PLAYER_DISTANCE });
          } else {
            updatePlayerMovement(player, currentActions, getDelta, cfg.player.speed, playerFilter);
          }
          if (!orbitReference) orbitReference = toRaw(store.orbitReference) as Parameters<typeof cameraFollowPlayer>[3];
          cameraFollowPlayer(camera, player, cameraOffset, orbitReference, ["x", "z"]);
          updateMinimap?.(player.position, coins, paperPlanes);
        },
      });

      timelineManager.addAction({
        name: "coin-spin", category: "visual",
        action: () => { updateCoinSpin(coins, getDelta(), COIN_SPIN_SPEED); },
      });

      timelineManager.addAction({
        frequency: 2, name: "paper-plane-chase", category: "ai",
        action: () => {
          const cfg = reactiveConfig.value as unknown as ReactiveConfigShape & { paperPlane: { speed: number } };
          const delta = getDelta();
          paperPlanePathStates = paperPlanes.map((plane, i) => {
            const state = updatePaperPlaneChase(plane, player.position, cfg.paperPlane.speed, delta, navGrid, paperPlanePathStates[i], planeFilter);
            updatePlanePaths[i](state.path, cfg.debug.showPath);
            return state;
          });
        },
      });

      timelineManager.addAction({
        frequency: 4, name: "coin-collection", category: "physics",
        action: () => {
          if (coins.length === 0) return;
          const collected = checkCoinCollection(player.position, coins, COLLECTION_RADIUS);
          if (collected.length === 0) return;
          [...collected].reverse().forEach((index) => {
            removeElements(scene, world, [coins[index]]);
            coins = [...coins.slice(0, index), ...coins.slice(index + 1)];
          });
          const newScore = (gameState.value?.data.score ?? 0) + collected.length;
          gameState.value?.setData('score', newScore);
          updatePoster(newScore);
        },
      });

      timelineManager.addAction({
        frequency: 4, name: "level-exit", category: "physics",
        action: () => {
          if (isResettingLevel || coins.length > 0) return;
          if (player.position.distanceTo(exitPosition) <= LEVEL_COMPLETE_RADIUS) {
            buildLevel();
          }
        },
      });

      animate({ beforeTimeline: () => {}, timeline: timelineManager });
    },
  });
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleSpacebar);
  store.cleanup();
  destroyControls();
  unregisterViewConfig(route.name as string);
});
</script>

<template>
  <canvas ref="canvas" />
  <canvas
    ref="minimapCanvas"
    class="maze__minimap"
    width="160"
    height="160"
  />
</template>

<style scoped>
.maze__minimap {
  position: fixed;
  bottom: var(--minimap-margin);
  right: var(--minimap-margin);
  width: var(--minimap-size);
  height: var(--minimap-size);
  border-radius: var(--minimap-border-radius);
  opacity: var(--minimap-opacity);
  pointer-events: none;
}
</style>
