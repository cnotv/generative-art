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
import { config, GAME_STATUS } from "./config";

// Helper imports
import {
  initPhysics,
  onWindowResize,
  addHorizonLine,
  getSpeed,
} from "./helpers/setup";
import { getGround } from "./helpers/ground";
import {
  populateInitialBackgrounds,
  updateFallingBackgrounds,
  createBackgrounds,
  moveBackgrounds,
} from "./helpers/background";
import { addBlock, moveBlock, removeBlock } from "./helpers/block";
import {
  addPlayerController,
  handleJump,
  movePlayer,
  ensurePlayerAboveGround,
  handleArcMovement,
  checkCollisions,
  updateExplosionParticles,
  type PlayerMovement,
  explosionParticles,
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
const goombaColor = 0x8b4513; // Brown color like Goomba
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

  // Prevent iOS zoom and selection behaviors
  const preventZoomAndSelection = (e: Event) => {
    e.preventDefault();
    e.stopPropagation();
  };

  // Additional iOS-specific prevention
  document.addEventListener("gesturestart", preventZoomAndSelection, { passive: false });
  document.addEventListener("gesturechange", preventZoomAndSelection, { passive: false });
  document.addEventListener("gestureend", preventZoomAndSelection, { passive: false });
  document.addEventListener("selectstart", preventZoomAndSelection, { passive: false });
  document.addEventListener("contextmenu", preventZoomAndSelection, { passive: false });

  // Prevent double-tap zoom
  let lastTouchEnd = 0;
  document.addEventListener(
    "touchend",
    (event) => {
      const now = new Date().getTime();
      if (now - lastTouchEnd <= 300) {
        event.preventDefault();
      }
      lastTouchEnd = now;
    },
    { passive: false }
  );

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
  controls.create(config, route, {}, () => createScene());
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
        camera: { position: [40, 20, 150] },
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
        const { player, playerController, model } = await addPlayerController(
          scene,
          physics,
          world
        );

        // Set Mario sky blue background
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
                  // Remove all obstacles from scene and physics
                  for (let i = obstacles.length - 1; i >= 0; i--) {
                    const obstacle = obstacles[i];
                    scene.remove(obstacle.mesh);
                    physics.world.removeCollider(obstacle.collider, true);
                  }
                  obstacles.length = 0;

                  for (let i = backgrounds.length - 1; i >= 0; i--) {
                    const background = backgrounds[i];
                    scene.remove(background.mesh);
                  }
                  backgrounds.length = 0;

                  // Repopulate backgrounds for restart
                  populateInitialBackgrounds(scene, world, backgrounds);
                  backgroundsPopulated = true;

                  // Clear explosion particles on restart
                  for (let i = explosionParticles.length - 1; i >= 0; i--) {
                    scene.remove(explosionParticles[i]);
                  }
                  explosionParticles.length = 0;

                  // Make Goomba visible again and reset to starting position
                  player.visible = true;

                  player.userData.arcMovement = { isActive: false };
                  player.rotation.set(0, Math.PI / 2 - 0.4, 0); // Back to original rotation (facing right/east)

                  // Reset Goomba opacity to full visibility
                  player.traverse((child: THREE.Object3D) => {
                    if ((child as any).isMesh && (child as any).material) {
                      const mesh = child as THREE.Mesh;
                      if (Array.isArray(mesh.material)) {
                        mesh.material.forEach((material: any) => {
                          material.transparent = false;
                          material.opacity = 1.0;
                        });
                      } else {
                        (mesh.material as any).transparent = false;
                        (mesh.material as any).opacity = 1.0;
                      }
                    }
                  });

                  const startPos = player.userData.startingPosition;
                  const groundLevel = player.userData.baseY; // Use correct ground level
                  const safeY = Math.max(startPos.y, groundLevel); // Ensure above ground
                  player.position.set(startPos.x, safeY, startPos.z);

                  // Reset collider position to match (with ground collision)
                  player.userData.collider.setTranslation({
                    x: startPos.x,
                    y: safeY,
                    z: startPos.z,
                  });

                  // Reset ground texture offset for restart
                  if (groundTexture) {
                    groundTexture.offset.x = 0;
                    groundTexture.offset.y = 0;
                  }

                  shouldClearObstacles.value = false;
                }

                movePlayer(player, playerController, physics, playerMovement, gameStatus.value);
                handleJump(player, gameStatus.value, uiStore, camera, horizonLine);
                handleArcMovement(player); // Handle arc movement after collision
                checkCollisions(player, obstacles, backgrounds, scene, endGame, loggedCollisions, goombaColor);
              },
            },

            // Generate cubes
            {
              frequency: config.blocks.spacing,
              action: async () => {
                if (gameStatus.value !== GAME_STATUS.PLAYING) return;
                const position: [number, number] = [
                  config.blocks.size * 10,
                  (config.blocks.size / 2) * Math.floor(Math.random() * 3) + 15,
                ];
                const { mesh, characterController, collider } = await addBlock(
                  scene,
                  position,
                  world,
                  physics
                );
                obstacles.push({ mesh, characterController, collider });
              },
            },

            // Move ground
            {
              action: () => {
                // Animate ground texture to create moving ground effect
                if (groundTexture && gameStatus.value === GAME_STATUS.PLAYING) {
                  groundTexture.offset.x += 0.03 * getSpeed(1, gameScore.value); // Move texture based on game speed
                }
              },
            },

            // Move background
            {
              action: () => {
                // Only move and create backgrounds when actively playing
                if (gameStatus.value !== GAME_STATUS.PLAYING) {
                  // During START screen and GAME_OVER, don't move backgrounds horizontally at all
                  // Only falling animations are allowed during game over
                  return;
                }

                createBackgrounds(scene, world, backgrounds, backgroundTimers, gameScore.value);
                moveBackgrounds(scene, camera, backgrounds, gameScore.value);
              },
            },

            // Make Goomba run
            {
              action: () => {
                if (gameStatus.value !== GAME_STATUS.PLAYING) return;
                const animationSpeed = getSpeed(config.player.speed, gameScore.value);
                updateAnimation(
                  model.mixer,
                  model.actions.run,
                  getDelta(),
                  animationSpeed
                );
              },
            },

            // Move obstacles
            {
              action: () => {
                if (gameStatus.value !== GAME_STATUS.PLAYING) return;

                // Move obstacles and remove off-screen ones
                for (let i = obstacles.length - 1; i >= 0; i--) {
                  const obstacle = obstacles[i];

                  // Move the block
                  moveBlock(obstacle, physics, gameScore.value);

                  // Award score when block passes behind Goomba (only once per block)
                  if (
                    !obstacle.mesh.userData.scored &&
                    obstacle.mesh.position.x < player.position.x - 20
                  ) {
                    obstacle.mesh.userData.scored = true; // Mark as scored
                    gameScore.value += 10;
                  }

                  // Check if block should be removed and remove it
                  if (obstacle.mesh.position.x < -300 - config.blocks.size) {
                    removeBlock(obstacle, obstacles, i, scene, physics);
                  }
                }
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

<style>
:root {
  --color-text: #333;
  --color-mario-gold: #ffd700;
  --color-mario-red: #ff6b6b;
  --color-mario-green: #32cd32;
  --color-mario-blue: #0064c8;
  --shadow-mario: 0.4rem 0.4rem 0px #000;
  --shadow-text-mario-basic: -1px -1px 0 #fff, 1px -1px 0 #fff, -1px 1px 0 #fff,
    1px 1px 0 #fff, -1px 0 0 #fff, 1px 0 0 #fff, 0 -1px 0 #fff, 0 1px 0 #fff;
  --shadow-text-mario: 0.2rem 0.2rem 0px #000, 0.25rem 0.25rem 0px #000,
    0.3rem 0.3rem 0px #000;
  --shadow-text-mario-large: 0.2rem 0.2rem 0px #000, 0.25rem 0.25rem 0px #000,
    0.3rem 0.3rem 0px #000, 0.4rem 0.4rem 0px #000, 0.5rem 0.5rem 0px #000;
  --border-mario: 3px solid var(--color-mario-gold);
  --font-playful: "Darumadrop One", "Arial Black", sans-serif;
}

/* iOS-specific zoom and selection prevention */
* {
  user-select: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  -webkit-touch-callout: none;
  -webkit-tap-highlight-color: transparent;
}

/* Prevent zoom and selection on canvas and all game elements */
canvas {
  user-select: none !important;
  -webkit-user-select: none !important;
  -moz-user-select: none !important;
  -ms-user-select: none !important;
  -webkit-touch-callout: none !important;
  -webkit-tap-highlight-color: transparent !important;
  touch-action: manipulation !important;
}

/* Prevent iOS zoom on double tap and pinch */
html,
body {
  touch-action: manipulation;
  -webkit-user-select: none;
  user-select: none;
  -webkit-touch-callout: none;
}
</style>
