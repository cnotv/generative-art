<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from "vue";
import { useRoute } from "vue-router";
import Start from "./screens/Start.vue";
import GameOver from "./screens/GameOver.vue";
import Score from "./screens/Score.vue";
import { controls } from "@/utils/control";
import { stats } from "@/utils/stats";
import { initializeAudio, stopMusic } from "@webgametoolkit/audio";
import { getTools } from "@webgametoolkit/threejs";
import { gameState, GAME_STATUS } from "@webgametoolkit/game";
import { useUiStore } from "@/stores/ui";
import {
  enableZoomPrevention,
  loadGoogleFont,
  removeGoogleFont,
  disableZoomPrevention,
} from "@/utils/ui";
import { config, configControls, setupConfig } from "./config";
import { createTimeline } from "./animation";
import "@/assets/prevents.css";
import "./styles.css";

// Helper imports
import { prevents } from "./helpers/setup";
import {
  updateEventListeners,
  removeAllEventListeners,
  handleJumpGoomba,
} from "./helpers/events";

const {
  loadHighScore,
  checkHighScore,
  setGameStatus,
  resetGameScore,
  getGameStatus,
} = gameState;

// Set UI controls
const uiStore = useUiStore();
const fontName = "goomba-runner-font";

const gameStatus = ref(getGameStatus());
const isGameStart = computed(() => gameStatus.value === GAME_STATUS.START);
const isGamePlaying = computed(() => gameStatus.value === GAME_STATUS.PLAYING);
const isGameOver = computed(() => gameStatus.value === GAME_STATUS.GAME_OVER);

const shouldClearObstacles = ref(false);
const changeEventListeners = () =>
  updateEventListeners(getGameStatus(), {
    onStart: handleStartGame,
    onRestart: handleRestartGame,
    onJump: () => handleJumpGoomba(uiStore),
  });

// Watch for game status changes and update event listeners
watch(gameStatus, () => setTimeout(() => changeEventListeners(), 500), {
  immediate: true,
});

const statsEl = ref(null);
const canvas = ref(null);
const route = useRoute();

const { originalViewport, preventZoomStyleElement } = enableZoomPrevention(); // Enable zoom prevention for this game

let initInstance: () => void;
onMounted(() => {
  loadGoogleFont(
    "https://fonts.googleapis.com/css2?family=Darumadrop+One&display=swap",
    fontName
  );
  loadHighScore(); // Load saved high score from localStorage
  prevents();
  initInstance = () => {
    init(
      (canvas.value as unknown) as HTMLCanvasElement,
      (statsEl.value as unknown) as HTMLElement
    );
  };

  initInstance();
  window.addEventListener("resize", initInstance);
  changeEventListeners();
});

onUnmounted(() => {
  removeGoogleFont(fontName);
  disableZoomPrevention(originalViewport, preventZoomStyleElement);
  removeAllEventListeners(); // This will also stop gamepad polling
  stopMusic();
  window.removeEventListener("resize", initInstance);
});

// Game state functions
const handleStartGame = async () => {
  // Initialize audio on first user interaction (required for iOS)
  await initializeAudio();
  setGameStatus(GAME_STATUS.PLAYING);
  gameStatus.value = GAME_STATUS.PLAYING;
  resetGameScore();
  changeEventListeners();
};

const handleRestartGame = () => {
  handleStartGame();
  shouldClearObstacles.value = true;
};

const endGame = () => {
  stopMusic();
  checkHighScore();
  setGameStatus(GAME_STATUS.GAME_OVER);
  gameStatus.value = GAME_STATUS.GAME_OVER;
  changeEventListeners();
};

const init = async (canvas: HTMLCanvasElement, statsEl: HTMLElement) => {
  stats.init(route, statsEl);
  controls.create(config, route, configControls, () => createScene());
  const createScene = async () => {
    const { animate, setup, world, scene, getDelta, renderer, camera } = await getTools({
      stats,
      route,
      canvas,
    });
    await setup({
      config: setupConfig,
    });
    animate({
      timeline: await createTimeline({
        scene,
        getDelta,
        world,
        shouldClearObstacles,
        camera,
        uiStore,
        endGame,
        gameState,
      }),
    });
  };
  createScene();
};
</script>

<template>
  <div ref="statsEl"></div>
  <canvas ref="canvas" style="position: relative; z-index: 0"></canvas>
  <Start v-if="isGameStart" @start="handleStartGame" />
  <GameOver v-if="isGameOver" @restart="handleRestartGame" />
  <Score v-if="isGamePlaying || isGameOver" />
</template>
