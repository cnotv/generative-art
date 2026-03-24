<script setup lang="ts">
import { onMounted, onUnmounted, ref, shallowRef, toRaw } from "vue";
import { useRoute } from "vue-router";
import { cameraFollowPlayer, removeElements, type ComplexModel } from "@webgamekit/threejs";
import type { CoordinateTuple, AnimationData } from "@webgamekit/animation";
import { createTimelineManager } from "@webgamekit/animation";
import { createGame, type GameState } from "@webgamekit/game";
import { createControls } from "@webgamekit/controls";
import {
  registerViewConfig,
  unregisterViewConfig,
  createReactiveConfig,
} from "@/stores/viewConfig";
import { useSceneViewStore } from "@/stores/sceneView";

import { createIslandGround, createWaterPlane, createWalls } from "./helpers/island";
import { spawnCoins, updateCoinSpin, checkCoinCollection } from "./helpers/coins";
import { spawnWasps, updateWaspChase, checkWaspCatch } from "./helpers/enemies";
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
  CATCH_RADIUS,
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

const gameOver = ref(false);
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
    viewPanels: { showConfig: true, showElements: false },
    playMode: true,
    defineSetup: async ({ scene, camera, world, getDelta, animate }) => {
      const obstacles: ComplexModel[] = [];
      const cameraOffset = CAMERA_OFFSET as CoordinateTuple;

      // Environment
      const ground = createIslandGround(scene, world);
      obstacles.push(ground);
      const water = createWaterPlane(scene);
      const walls = await createWalls(scene, world);
      walls.forEach((wall) => obstacles.push(wall));

      // Player
      const player = await createPlayer(scene, world);
      const groundBodies: ComplexModel[] = [ground];

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
          if (gameOver.value) return;
          updatePlayerMovement(
            player,
            currentActions,
            obstacles,
            groundBodies,
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
          if (gameOver.value) return;
          const speed = (reactiveConfig.value as Record<string, Record<string, number>>).wasp.speed;
          wasps.forEach((wasp) =>
            updateWaspChase(wasp, player.position, speed, getDelta())
          );
        },
      });

      // Coin collection
      timelineManager.addAction({
        frequency: 4,
        name: "coin-collection",
        category: "physics",
        action: () => {
          if (gameOver.value || coins.length === 0) return;
          const collected = checkCoinCollection(player.position, coins, COLLECTION_RADIUS);
          if (collected.length === 0) return;

          // Remove collected coins (reverse order to maintain indices)
          [...collected].reverse().forEach((index) => {
            const coin = coins[index];
            removeElements(scene, world, [coin]);
            coins = [...coins.slice(0, index), ...coins.slice(index + 1)];
          });

          gameState.value?.setScore(
            (gameState.value?.data.score ?? 0) + collected.length
          );
        },
      });

      // Wasp catch check
      timelineManager.addAction({
        frequency: 4,
        name: "wasp-catch",
        category: "physics",
        action: () => {
          if (gameOver.value) return;
          if (checkWaspCatch(player.position, wasps, CATCH_RADIUS)) {
            gameOver.value = true;
          }
        },
      });

      // Water animation
      timelineManager.addAction({
        name: "water-animation",
        category: "visual",
        action: () => {
          water.update(getDelta());
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
  <div v-if="gameState" class="coin-island__score">
    Coins: {{ gameState.data.score }}
  </div>
  <div v-if="gameOver" class="coin-island__game-over">
    <div class="coin-island__game-over-content">
      <h2 class="coin-island__game-over-title">Game Over!</h2>
      <p class="coin-island__game-over-score">
        You collected {{ gameState?.data.score ?? 0 }} coins
      </p>
    </div>
  </div>
</template>

<style scoped>
.coin-island__score {
  position: fixed;
  top: var(--spacing-md);
  left: 50%;
  transform: translateX(-50%);
  padding: var(--spacing-sm) var(--spacing-lg);
  background: var(--color-surface-overlay);
  color: var(--color-text-primary);
  border-radius: var(--radius-md);
  font-family: var(--font-mono);
  font-size: var(--font-size-lg);
  z-index: var(--z-overlay);
  pointer-events: none;
}

.coin-island__game-over {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-surface-overlay);
  z-index: var(--z-modal);
}

.coin-island__game-over-content {
  text-align: center;
  color: var(--color-text-primary);
}

.coin-island__game-over-title {
  font-size: var(--font-size-xxl);
  font-family: var(--font-mono);
  margin-bottom: var(--spacing-md);
}

.coin-island__game-over-score {
  font-size: var(--font-size-lg);
  font-family: var(--font-mono);
}
</style>
