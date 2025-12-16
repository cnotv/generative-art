<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import { useRoute } from "vue-router";
import StartScreen from "./screens/StartScreen.vue";
import GameOver from "./screens/GameOver.vue";
import ScoreDisplay from "./screens/ScoreDisplay.vue";
import { createControls } from "@webgametoolkit/controls";
import { stats } from "@/utils/stats";
import { initializeAudio, stopMusic } from "@webgametoolkit/audio";
import { getTools } from "@webgametoolkit/threejs";
import { useUiStore } from "@/stores/ui";
import {
  enableZoomPrevention,
  loadGoogleFont,
  removeGoogleFont,
  disableZoomPrevention,
} from "@/utils/ui";
import { setupConfig } from "./config";
import { createTimeline } from "./animation";
import "@/assets/prevents.css";
import "./styles.css";

import { handleJumpGoomba } from "./helpers/events";

import {
  prevents,
  loadHighScore,
  checkHighScore,
  isGameOver,
  isGameStart,
  isGamePlaying,
  setStatus,
  setScore,
} from "./helpers/setup";
import type { ControlsOptions } from "packages/controls/dist";

const uiStore = useUiStore();
const fontName = "goomba-runner-font";
const shouldClearObstacles = ref(false);
const statsEl = ref(null);
const canvas = ref(null);
const route = useRoute();
const { originalViewport, preventZoomStyleElement } = enableZoomPrevention();

const bindings: Record<string, ControlsOptions> = {
  playing: {
    mapping: {
      keyboard: {
        " ": "jump",
      },
      gamepad: {
        a: "jump",
      },
      touch: {
        tap: "jump",
      },
    },
    onAction: (action) => {
      if (action === "jump") handleJumpGoomba(uiStore);
    },
  },
  "game-over": {
    mapping: {
      keyboard: {
        " ": "restart",
      },
      gamepad: {
        a: "restart",
      },
      touch: {
        tap: "restart",
      },
    },
    onAction: (action) => {
      if (action === "restart") handleRestartGame();
    },
  },
  idle: {
    mapping: {
      keyboard: {
        " ": "start",
      },
      gamepad: {
        a: "start",
      },
      touch: {
        tap: "start",
      },
    },
    onAction: (action) => {
      if (action === "start") handleStartGame();
    },
  },
};

const { remapControlsOptions, destroyControls } = createControls(bindings["idle"]);

const handleStartGame = async () => {
  setStatus("playing");
  setScore(0);
  remapControlsOptions(bindings["playing"]);
};

const handleRestartGame = () => {
  handleStartGame();
  shouldClearObstacles.value = true;
  remapControlsOptions(bindings["playing"]);
};

const endGame = () => {
  stopMusic();
  checkHighScore();
  setStatus("game-over");
  remapControlsOptions(bindings["game-over"]);
};

const init = async (canvas: HTMLCanvasElement, statsEl: HTMLElement) => {
  stats.init(route, statsEl);
  const createScene = async () => {
    initializeAudio();
    const { animate, setup, world, scene, getDelta, camera } = await getTools({
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
      }),
    });
  };
  createScene();
};

let initInstance: () => void;
onMounted(() => {
  loadGoogleFont(
    "https://fonts.googleapis.com/css2?family=Darumadrop+One&display=swap",
    fontName
  );
  loadHighScore();
  prevents();
  initInstance = () => {
    init(
      (canvas.value as unknown) as HTMLCanvasElement,
      (statsEl.value as unknown) as HTMLElement
    );
  };
  initInstance();
  window.addEventListener("resize", initInstance);
});

onUnmounted(() => {
  removeGoogleFont(fontName);
  disableZoomPrevention(originalViewport, preventZoomStyleElement);
  destroyControls();
  stopMusic();
  window.removeEventListener("resize", initInstance);
});
</script>

<template>
  <div ref="statsEl"></div>
  <canvas ref="canvas" style="position: relative; z-index: 0"></canvas>
  <StartScreen v-if="isGameStart" @start="handleStartGame" />
  <GameOver v-if="isGameOver" @restart="handleRestartGame" />
  <ScoreDisplay v-if="isGamePlaying || isGameOver" />
</template>
