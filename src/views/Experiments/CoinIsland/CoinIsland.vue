<script setup lang="ts">
import { onMounted, onUnmounted, ref, shallowRef, toRaw } from "vue";
import { useRoute } from "vue-router";
import { cameraFollowPlayer, removeElements, type ComplexModel } from "@webgamekit/threejs";
import type { CoordinateTuple } from "@webgamekit/animation";
import { createTimelineManager } from "@webgamekit/animation";
import { createGame, type GameState } from "@webgamekit/game";
import { createControls } from "@webgamekit/controls";
import {
  registerViewConfig,
  unregisterViewConfig,
  createReactiveConfig,
} from "@/stores/viewConfig";
import { useSceneViewStore } from "@/stores/sceneView";

import { createOfficeWalls, createDeskModels } from "./helpers/island";
import { createScorePoster } from "./helpers/scorePoster";
import { spawnCoins, updateCoinSpin, checkCoinCollection } from "./helpers/coins";
import { spawnWasps, updateWaspChase } from "./helpers/enemies";
import { createPlayer, updatePlayerMovement } from "./helpers/player";
import {
  setupConfig,
  controlBindings,
  configControls,
  CAMERA_OFFSET,
  COIN_POSITIONS,
  WASP_COUNT,
  WASP_SPEED,
  PLAYER_SPEED,
  COLLECTION_RADIUS,
  COIN_SPIN_SPEED,
} from "./config";

const route = useRoute();
const store = useSceneViewStore();

const reactiveConfig = createReactiveConfig({
  player: { speed: PLAYER_SPEED },
  wasp: { speed: WASP_SPEED },
});

const gameState = shallowRef<GameState>();
createGame({ data: { score: 0 } }, gameState, onUnmounted);

const canvas = ref<HTMLCanvasElement | null>(null);

const { destroyControls, currentActions } = createControls(controlBindings);

onMounted(async () => {
  if (!canvas.value) return;

  registerViewConfig(
    route.name as string,
    reactiveConfig,
    configControls
  );

  await store.init(canvas.value, setupConfig, {
    viewPanels: { showConfig: false, showElements: false },
    playMode: true,
    defineSetup: async ({ scene, camera, world, getDelta, animate }) => {
      const obstacles: ComplexModel[] = [];
      const cameraOffset = CAMERA_OFFSET as CoordinateTuple;

      // Walls
      const wallsGroup = createOfficeWalls(scene, world);
      (wallsGroup.children as ComplexModel[]).forEach((wall) => obstacles.push(wall));

      // Desks
      const desks = await createDeskModels(scene, world);
      desks.forEach((desk) => obstacles.push(desk));

      // Player
      const player = await createPlayer(scene, world);

      // Score poster
      const updatePoster = createScorePoster(scene, 0);

      // Coins
      let coins = spawnCoins(scene, world, COIN_POSITIONS);

      // Enemies
      const wasps = await spawnWasps(scene, world, WASP_COUNT);

      // Lazy orbit ref
      let orbitReference: Parameters<typeof cameraFollowPlayer>[3] | null = null;

      const timelineManager = createTimelineManager();

      // Player movement
      timelineManager.addAction({
        frequency: 2,
        name: "player-movement",
        category: "user-input",
        action: () => {
          updatePlayerMovement(
            player,
            currentActions,
            getDelta,
            (reactiveConfig.value as Record<string, Record<string, number>>).player.speed
          );
          if (!orbitReference) orbitReference = toRaw(store.orbitReference) as Parameters<typeof cameraFollowPlayer>[3];
          cameraFollowPlayer(camera, player, cameraOffset, orbitReference, ["x", "z"]);
        },
      });

      // Coin spinning
      timelineManager.addAction({
        name: "coin-spin",
        category: "visual",
        action: () => {
          updateCoinSpin(coins, getDelta(), COIN_SPIN_SPEED);
        },
      });

      // Wasp chase
      timelineManager.addAction({
        frequency: 2,
        name: "wasp-chase",
        category: "ai",
        action: () => {
          const speed = (reactiveConfig.value as Record<string, Record<string, number>>).wasp.speed;
          wasps.forEach((wasp) =>
            updateWaspChase(wasp, player.position, speed, getDelta(), obstacles)
          );
        },
      });

      // Coin collection
      timelineManager.addAction({
        frequency: 4,
        name: "coin-collection",
        category: "physics",
        action: () => {
          if (coins.length === 0) return;
          const collected = checkCoinCollection(player.position, coins, COLLECTION_RADIUS);
          if (collected.length === 0) return;

          // Remove collected coins (reverse order to maintain indices)
          [...collected].reverse().forEach((index) => {
            const coin = coins[index];
            removeElements(scene, world, [coin]);
            coins = [...coins.slice(0, index), ...coins.slice(index + 1)];
          });

          const newScore = (gameState.value?.data.score ?? 0) + collected.length;
          gameState.value?.setData('score', newScore);
          updatePoster(newScore);
        },
      });

      animate({
        beforeTimeline: () => {},
        timeline: timelineManager,
      });
    },
  });
});

onUnmounted(() => {
  store.cleanup();
  destroyControls();
  unregisterViewConfig(route.name as string);
});
</script>

<template>
  <canvas ref="canvas" />
</template>
