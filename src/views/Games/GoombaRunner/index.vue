<script setup lang="ts">
import * as THREE from "three";
import { ref, onMounted, onUnmounted, watch } from "vue";
import { useRoute } from "vue-router";
import Start from "./screens/Start.vue";
import GameOver from "./screens/GameOver.vue";
import Score from "./screens/Score.vue";
import { controls } from "@/utils/control";
import { stats } from "@/utils/stats";
import { initializeAudio, stopSoundtrack } from "@/utils/audio";
import { getTools } from "@/utils/threeJs";
import { useUiStore } from "@/stores/ui";
import { updateAnimation } from "@/utils/animation";
import {
  enableZoomPrevention,
  loadGoogleFont,
  removeGoogleFont,
  disableZoomPrevention,
} from "@/utils/ui";
import { config, GAME_STATUS, configControls } from "./config";
import "@/assets/prevents.css";
import "./styles.css";

// Helper imports
import {
  initPhysics,
  onWindowResize,
  addHorizonLine,
  getSpeed,
  prevents,
} from "./helpers/setup";
import { getGround, moveGround, resetGround } from "./helpers/ground";
import {
  populateInitialBackgrounds,
  updateFallingBackgrounds,
  createBackgrounds,
  moveBackgrounds,
  resetBackgrounds,
} from "./helpers/background";
import { moveBlocks, resetObstacles, createCubes } from "./helpers/block";
import {
  createPlayer,
  handleJump,
  movePlayer,
  ensurePlayerAboveGround,
  handleArcMovement,
  checkCollisions,
  updateExplosionParticles,
  updatePlayerAnimation,
  resetPlayer,
  type PlayerMovement,
} from "./helpers/player";
import {
  updateEventListeners,
  removeAllEventListeners,
  handleJumpGoomba,
} from "./helpers/events";

type GameStatus = typeof GAME_STATUS[keyof typeof GAME_STATUS];

// Set UI controls
const uiStore = useUiStore();
const fontName = "goomba-runner-font";
const HIGH_SCORE_KEY = "goomba-runner-high-score";

const gameScore = ref(0);
const shouldClearObstacles = ref(false);
const highestScore = ref(0);
const isNewHighScore = ref(false);

// Load highest score from localStorage on component mount
const loadHighestScore = () => {
  const saved = localStorage.getItem(HIGH_SCORE_KEY);
  if (saved) {
    highestScore.value = parseInt(saved, 10);
  }
};

// Save highest score to localStorage
const saveHighestScore = (score: number) => {
  localStorage.setItem(HIGH_SCORE_KEY, score.toString());
  highestScore.value = score;
};

const gameStatus = ref<GameStatus>(GAME_STATUS.START);

// Watch for game status changes and update event listeners
watch(
  gameStatus,
  () => {
    setTimeout(() => {
      updateEventListeners(gameStatus.value, {
        onStart: handleStartGame,
        onRestart: handleRestartGame,
        onJump: () => handleJumpGoomba(uiStore),
      });
    }, 500);
  },
  { immediate: true }
);

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
  loadHighestScore(); // Load saved high score from localStorage

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

onMounted(() => {
  updateEventListeners(gameStatus.value, {
    onStart: handleStartGame,
    onRestart: handleRestartGame,
    onJump: () => handleJumpGoomba(uiStore),
  });
});

onUnmounted(() => {
  removeGoogleFont(fontName);
  disableZoomPrevention(originalViewport, preventZoomStyleElement);
  removeAllEventListeners(); // This will also stop gamepad polling
  stopSoundtrack();
});

onUnmounted(() => window.removeEventListener("resize", initInstance));

// Game state functions
const handleStartGame = async () => {
  // Initialize audio on first user interaction (required for iOS)
  await initializeAudio();

  gameStatus.value = GAME_STATUS.PLAYING;
  gameScore.value = 0;
  isNewHighScore.value = false; // Reset new high score flag
  updateEventListeners(gameStatus.value, {
    onStart: handleStartGame,
    onRestart: handleRestartGame,
    onJump: () => handleJumpGoomba(uiStore),
  }); // Update event listeners for gameplay state
};

const handleRestartGame = () => {
  handleStartGame();
  shouldClearObstacles.value = true;
};

const endGame = () => {
  // Stop background music
  stopSoundtrack();

  // Check for new high score
  isNewHighScore.value = gameScore.value > highestScore.value;
  if (isNewHighScore.value) {
    saveHighestScore(gameScore.value);
  }

  gameStatus.value = GAME_STATUS.GAME_OVER;
  updateEventListeners(gameStatus.value, {
    onStart: handleStartGame,
    onRestart: handleRestartGame,
    onJump: () => handleJumpGoomba(uiStore),
  }); // Update event listeners for game over state
};

const init = async (canvas: HTMLCanvasElement, statsEl: HTMLElement) => {
  stats.init(route, statsEl);
  controls.create(config, route, configControls, () => createScene());
  const createScene = async () => {
    const obstacles = [] as {
      mesh: THREE.Mesh;
      characterController: any;
      collider: any;
    }[];
    const backgrounds = [] as {
      mesh: THREE.Mesh;
      speed: number;
      fallAnimation?: {
        isActive: boolean;
        startTime: number;
        delay: number;
        fallSpeed: number;
        rotationSpeed: number;
      };
    }[];

    const { animate, setup, world, scene, getDelta, renderer, camera } = getTools({
      stats,
      route,
      canvas,
    });
    setup({
      config: {
        camera: config.camera as any,
        // ground: { size: 100000, color: 0x32CD32 },
        ground: false,
        sky: false, // Disable sky sphere to avoid hiding UI elements
        lights: {
          directional: {
            intensity: config.directional.intensity * 1.5,
          },
        },
        orbit: false,
      },
      defineSetup: async () => {
        const { physics, physicsHelper } = await initPhysics(scene);
        const { player, playerController, model } = await createPlayer(
          scene,
          physics,
          world
        );
        scene.background = new THREE.Color(0x87ceeb);
        onWindowResize(camera, renderer);
        // Track ground texture for animation
        let groundTexture: THREE.Texture | null = null;
        groundTexture = getGround(scene, physics);
        const horizonLine = addHorizonLine(scene);
        const playerMovement: PlayerMovement = { forward: 0, right: 0, up: 0 };
        let backgroundTimers = config.backgrounds.layers.map(() => 0);
        let backgroundsPopulated = false;
        const loggedCollisions = new Set<string>();

        animate({
          beforeTimeline: () => {},
          timeline: [
            {
              action: () => {
                if (physicsHelper) physicsHelper.update();
                ensurePlayerAboveGround(player);
                if (gameStatus.value === GAME_STATUS.START && !backgroundsPopulated) {
                  populateInitialBackgrounds(scene, world, backgrounds);
                  backgroundsPopulated = true;
                }
                updateExplosionParticles(scene, getDelta());
                updateFallingBackgrounds(getDelta(), backgrounds, scene);
                if (shouldClearObstacles.value) {
                  resetObstacles(obstacles, scene, physics);
                  resetBackgrounds(scene, world, backgrounds);
                  backgroundsPopulated = true;
                  resetPlayer(player, scene);
                  resetGround(groundTexture);
                  shouldClearObstacles.value = false;
                }

                movePlayer(player, playerController, physics, playerMovement, gameStatus.value);
                handleJump(player, gameStatus.value, uiStore, camera, horizonLine);
                handleArcMovement(player); // Handle arc movement after collision
                checkCollisions(player, obstacles, backgrounds, scene, endGame, loggedCollisions);
              },
            },

            // Generate cubes
            {
              frequency: config.blocks.spacing,
              action: async () => {
                if (gameStatus.value !== GAME_STATUS.PLAYING) return;
                await createCubes(scene, world, physics, obstacles);
              },
            },

            // Move ground
            {
              action: () => {
                moveGround(groundTexture, gameStatus.value, gameScore.value);
              },
            },

            // Move background
            {
              action: () => {
                if (gameStatus.value === GAME_STATUS.PLAYING) {
                  createBackgrounds(scene, world, backgrounds, backgroundTimers, gameScore.value);
                  moveBackgrounds(scene, camera, backgrounds, gameScore.value);
                }
              },
            },

            // Make Goomba run
            {
              action: () => {
                updatePlayerAnimation(
                  model,
                  gameStatus.value,
                  gameScore.value,
                  getDelta,
                  updateAnimation,
                  getSpeed
                );
              },
            },

            // Move obstacles
            {
              action: () => {
                if (gameStatus.value !== GAME_STATUS.PLAYING) return;
                moveBlocks(
                  obstacles,
                  physics,
                  gameScore.value,
                  player,
                  scene,
                  (points) => {
                    gameScore.value += points;
                  }
                );
              },
            },
          ],
        });
      },
    });
  };
  createScene();
};
</script>

<template>
  <div ref="statsEl"></div>
  <canvas ref="canvas" style="position: relative; z-index: 0"></canvas>

  <Start v-if="gameStatus === GAME_STATUS.START" @start="handleStartGame" />
  <GameOver
    v-if="gameStatus === GAME_STATUS.GAME_OVER"
    :game-score="gameScore"
    :is-new-high-score="isNewHighScore"
    @restart="handleRestartGame"
  />
  <Score
    v-if="gameStatus === GAME_STATUS.PLAYING || gameStatus === GAME_STATUS.GAME_OVER"
    :game-score="gameScore"
    :highest-score="highestScore"
  />
</template>
