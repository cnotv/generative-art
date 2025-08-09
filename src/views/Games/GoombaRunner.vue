<script setup lang="ts">
import * as THREE from "three";
import { RapierPhysics } from "three/addons/physics/RapierPhysics.js";
import { RapierHelper } from "three/addons/helpers/RapierHelper.js";
import RAPIER from "@dimforge/rapier3d";

import { ref, onMounted, onUnmounted } from "vue";
import { useRoute } from "vue-router";
import { controls } from "@/utils/control";
import { stats } from "@/utils/stats";

import { getTools, getTextures, getModel } from "@/utils/threeJs";
import { useUiStore } from "@/stores/ui";
import { updateAnimation } from "@/utils/animation";
import brickTexture from "@/assets/brick.jpg";

// Set UI controls
const uiStore = useUiStore();
const keyUp = (event: KeyboardEvent) => {
  uiStore.setKeyState(event.key, true);

  // Handle spacebar for game state transitions
  if (event.key === " ") {
    handleGameStateTransition();
  }
};
const keyDown = (event: KeyboardEvent) => uiStore.setKeyState(event.key, false);

// Touch state tracking for jump
const isTouchActive = ref(false);

// Touch event handlers
const handleTouch = (event: TouchEvent) => {
  event.preventDefault(); // Prevent scrolling and other default behaviors

  if (event.type === "touchstart") {
    isTouchActive.value = true;
  } else if (event.type === "touchend") {
    isTouchActive.value = false;
  }

  handleGameStateTransition();
};

// Common function for both keyboard and touch interactions
const handleGameStateTransition = () => {
  if (!gameStarted.value) {
    startGame();
  } else if (gameOver.value) {
    restartGame();
  } else if (gamePlay.value && gameStarted.value) {
    // Hide UI when spacebar/touch is pressed during gameplay
    uiVisible.value = false;
  }
};

interface PlayerMovement {
  forward: number;
  right: number;
  up: number;
}

// Game state refs
const gamePlay = ref(false); // Start with game paused to show start screen
const gameScore = ref(0);
const gameOver = ref(false);
const gameStarted = ref(false);
const shouldClearObstacles = ref(false);
const uiVisible = ref(true);

const gameConfig = {
  blocks: {
    speed: 1.5,
  },
  player: {
    speed: 2.5,
    maxJump: 30,
    jump: {
      height: 70,
      duration: 1000, // milliseconds
      isActive: false,
      velocity: 0,
      startTime: 0,
    },
  },
};

const statsEl = ref(null);
const canvas = ref(null);
const route = useRoute();

let initInstance: () => void;
onMounted(() => {
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
  window.addEventListener("keydown", keyUp);
  window.addEventListener("keyup", keyDown);

  // Add touch event listeners for mobile support
  window.addEventListener("touchstart", handleTouch, { passive: false });
  window.addEventListener("touchend", handleTouch, { passive: false });
});

onUnmounted(() => {
  window.removeEventListener("keydown", keyUp);
  window.removeEventListener("keyup", keyDown);

  // Remove touch event listeners
  window.removeEventListener("touchstart", handleTouch);
  window.removeEventListener("touchend", handleTouch);
});

onUnmounted(() => window.removeEventListener("resize", initInstance));

// Game state functions
const startGame = () => {
  gamePlay.value = true;
  gameStarted.value = true;
  gameOver.value = false;
  gameScore.value = 0;
  uiVisible.value = false; // Hide UI immediately when starting game
};

const restartGame = () => {
  gamePlay.value = true;
  gameOver.value = false;
  gameScore.value = 0;
  shouldClearObstacles.value = true;
  uiVisible.value = false; // Hide UI immediately when restarting
};

const endGame = () => {
  gamePlay.value = false;
  gameOver.value = true;
  uiVisible.value = true; // Show UI on game over
};

const config = {
  directional: {
    enabled: true,
    helper: false,
    intensity: 2,
  },
};

const init = async (canvas: HTMLCanvasElement, statsEl: HTMLElement) => {
  const initPhysics = async (scene: THREE.Scene) => {
    //Initialize physics engine using the script in the jsm/physics folder
    const physics = await RapierPhysics();

    //Optionally display collider outlines
    const physicsHelper = new RapierHelper(physics.world);
    // scene.add(physicsHelper); // Disabled helper

    physics.addScene(scene);

    return { physics, physicsHelper };
  };

  const addPlayerController = async (
    scene: THREE.Scene,
    physics: RapierPhysics,
    world: RAPIER.World
  ) => {
    // Load Goomba model
    const goombaModel = await getModel(scene, world, "goomba.glb", {
      scale: [0.4, 0.4, 0.4],
      size: 3,
      restitution: -10,
      boundary: 0.5,
      type: "kinematicPositionBased",
      hasGravity: false,
    });

    if (!goombaModel || !goombaModel.mesh) {
      throw new Error("Failed to load goomba model");
    }

    const player = goombaModel.mesh;
    player.castShadow = true;

    // Rotate goomba to face sideways (towards the camera/blocks)
    player.rotation.y = 2;

    // Position player above ground
    const groundY = 0;
    const modelHeight = 3; // Approximate height of goomba model
    const playerY = groundY + modelHeight + 5; // Full height + offset to ensure above ground
    player.position.set(0, playerY, 0);

    // Rapier Character Controller
    const playerController = physics.world.createCharacterController(0.01);
    playerController.setApplyImpulsesToDynamicBodies(true);
    playerController.setCharacterMass(3);

    // Create collider that approximates the goomba model (using existing collider from getModel)
    if (goombaModel.collider) {
      player.userData.collider = goombaModel.collider;
      // Update collider position to match player position
      player.userData.collider.setTranslation({ x: 0, y: playerY, z: 0 });
    } else {
      // Fallback: create a capsule collider
      const capsuleRadius = 8;
      const capsuleHeight = 15;
      const colliderDesc = physics.RAPIER.ColliderDesc.capsule(
        capsuleHeight / 2,
        capsuleRadius
      ).setTranslation(0, playerY, 0);
      player.userData.collider = physics.world.createCollider(colliderDesc);
    }

    // Store base Y position for jump calculations (closer to ground level)
    player.userData.baseY = groundY + 2; // Just slightly above ground

    return { player, playerController, model: goombaModel };
  };

  const addBlock = (
    scene: THREE.Scene,
    position: [number, number],
    physics?: RapierPhysics
  ) => {
    const geometry = new THREE.BoxGeometry(30, 30, 30);
    const material = new THREE.MeshStandardMaterial({
      color: 0x72391e, // Mario brick orange/brown color
      map: getTextures(brickTexture),
    });
    const mesh: THREE.Mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.position.set(...position);
    scene.add(mesh);

    if (physics) {
      // Create character controller for controlled movement
      const characterController = physics.world.createCharacterController(0.01);
      characterController.setApplyImpulsesToDynamicBodies(true);

      // Create collider for the block
      const colliderDesc = physics.RAPIER.ColliderDesc.cuboid(15, 15, 15).setTranslation(
        position[0],
        position[1],
        0
      );
      const collider = physics.world.createCollider(colliderDesc);

      // Store collider reference in mesh userData
      mesh.userData.collider = collider;
      mesh.userData.characterController = characterController;

      return { mesh, characterController, collider };
    }

    return { mesh };
  };

  const onWindowResize = (camera: THREE.Camera, renderer: THREE.WebGLRenderer) => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);
  };

  stats.init(route, statsEl);
  controls.create(config, route, {}, () => createScene());
  const createScene = async () => {
    const obstacles = [] as {
      mesh: THREE.Mesh;
      characterController: any;
      collider: any;
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
        sky: { size: 700 }, // Sky color set through scene.background
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
        getGround(scene, physics);

        // Movement input
        const playerMovement: PlayerMovement = { forward: 0, right: 0, up: 0 };

        function handleJump(player: THREE.Mesh) {
          // Stop jump animation if game is not playing
          if (!gamePlay.value) {
            gameConfig.player.jump.isActive = false;
            gameConfig.player.jump.velocity = 0;
            // Don't move the player - keep current position when game stops
            return;
          }

          const currentTime = Date.now();

          // Start jump if jump key is pressed OR touch is active and not already jumping
          if (
            (uiStore.controls.jump || isTouchActive.value) &&
            !gameConfig.player.jump.isActive
          ) {
            gameConfig.player.jump.isActive = true;
            gameConfig.player.jump.startTime = currentTime;
            gameConfig.player.jump.velocity = gameConfig.player.jump.height;
          }

          // Handle ongoing jump
          if (gameConfig.player.jump.isActive) {
            const jumpElapsed = currentTime - gameConfig.player.jump.startTime;
            const jumpProgress = jumpElapsed / gameConfig.player.jump.duration;

            if (jumpProgress >= 1.0) {
              // Jump complete
              gameConfig.player.jump.isActive = false;
              gameConfig.player.jump.velocity = 0;
            } else {
              // Calculate jump arc (parabolic motion)
              const jumpCurve = Math.sin(jumpProgress * Math.PI); // Creates arc from 0 to 1 to 0
              const targetY =
                player.userData.baseY + gameConfig.player.jump.height * jumpCurve;

              // Update player position
              const currentPosition = player.userData.collider.translation();
              player.userData.collider.setTranslation({
                x: currentPosition.x,
                y: targetY,
                z: currentPosition.z,
              });

              // Sync Three.js mesh
              player.position.set(currentPosition.x, targetY, currentPosition.z);
            }
          }
        }

        // Track collisions to log only once per block
        const loggedCollisions = new Set<string>();

        function checkCollisions(
          player: THREE.Mesh,
          obstacles: { mesh: THREE.Mesh; characterController: any; collider: any }[]
        ) {
          const playerPosition = player.position;
          obstacles.forEach((obstacle, index) => {
            const obstaclePosition = obstacle.mesh.position;
            const distance = playerPosition.distanceTo(obstaclePosition);
            const collisionThreshold = 25; // Reduced threshold for smaller player capsule

            if (distance < collisionThreshold) {
              const collisionKey = `obstacle-${index}-${obstacle.mesh.uuid}`;

              if (!loggedCollisions.has(collisionKey)) {
                loggedCollisions.add(collisionKey);
                endGame();
              }
            }
          });
        }

        function movePlayer(
          player: THREE.Mesh,
          playerController: any,
          physics: RapierPhysics,
          playerMovement: PlayerMovement
        ) {
          if (physics && playerController) {
            const deltaTime = 1 / 60;

            // Player movement
            const speed = gameConfig.player.speed * deltaTime;
            const moveVector = new physics.RAPIER.Vector3(
              playerMovement.right * speed,
              playerMovement.up * speed,
              -playerMovement.forward * speed
            );

            playerController.computeColliderMovement(
              player.userData.collider,
              moveVector
            );

            // Read the result
            const translation = playerController.computedMovement();
            const position = player.userData.collider.translation();

            position.x += translation.x;
            // Prevent vertical movement if game is not playing
            if (gamePlay.value) {
              position.y += translation.y;
            }
            position.z += translation.z;

            player.userData.collider.setTranslation(position);

            // Sync Three.js mesh with Rapier collider
            player.position.set(position.x, position.y, position.z);
          }
        }

        function getGround(scene: THREE.Scene, physics?: RapierPhysics) {
          const geometry = new THREE.BoxGeometry(2000, 0.5, 2000);
          const material = new THREE.MeshStandardMaterial({ color: 0x32cd32 }); // Mario green ground

          const mesh = new THREE.Mesh(geometry, material);
          mesh.receiveShadow = true;

          // Position ground at y = 0, with the top surface at y = 0.25
          mesh.position.y = 0;
          mesh.userData.physics = { mass: 0 };

          if (physics) {
            physics.addMesh(mesh);
          }
          scene.add(mesh);
        }

        function moveBlock(
          obstacle: { mesh: THREE.Mesh; characterController: any; collider: any },
          physics: RapierPhysics
        ) {
          const { mesh, characterController, collider } = obstacle;

          // Use character controller to move the block
          const baseSpeed = gameConfig.blocks.speed;
          // Increase speed based on score (0.1 speed increase per 10 points)
          const speedMultiplier = 1 + gameScore.value * 0.01;
          const speed = baseSpeed * speedMultiplier;
          const moveVector = new physics.RAPIER.Vector3(-speed, 0, 0);

          characterController.computeColliderMovement(collider, moveVector);
          const translation = characterController.computedMovement();
          const position = collider.translation();

          position.x += translation.x;
          position.y += translation.y;
          position.z += translation.z;

          collider.setTranslation(position);

          // Sync Three.js mesh with Rapier collider
          mesh.position.set(position.x, position.y, position.z);
        }

        function shouldRemoveBlock(mesh: THREE.Mesh): boolean {
          // Account for block size (30 units) so blocks don't disappear while visible
          const blockSize = 30;
          return mesh.position.x < -300 - blockSize;
        }

        function removeBlock(
          obstacle: { mesh: THREE.Mesh; characterController: any; collider: any },
          obstacles: { mesh: THREE.Mesh; characterController: any; collider: any }[],
          index: number,
          scene: THREE.Scene,
          physics: RapierPhysics
        ) {
          const { mesh, collider } = obstacle;

          // Increase score when block passes player
          gameScore.value += 10;

          // Remove from scene and physics world
          scene.remove(mesh);
          physics.world.removeCollider(collider);

          // Remove from obstacles array
          obstacles.splice(index, 1);
        }

        animate({
          beforeTimeline: () => {},
          timeline: [
            {
              action: () => {
                if (physicsHelper) physicsHelper.update();

                // Clear obstacles if restart was requested
                if (shouldClearObstacles.value) {
                  // Remove all obstacles from scene and physics
                  for (let i = obstacles.length - 1; i >= 0; i--) {
                    const obstacle = obstacles[i];
                    scene.remove(obstacle.mesh);
                    physics.world.removeCollider(obstacle.collider);
                  }
                  obstacles.length = 0; // Clear the array
                  shouldClearObstacles.value = false;
                }

                movePlayer(player, playerController, physics, playerMovement);
                handleJump(player);
                checkCollisions(player, obstacles);
                // updateAnimation(chickModel.mixer, chickModel.actions.run, getDelta(), 20);
              },
            },
            // Generate cubes
            {
              frequency: 75,
              action: () => {
                if (!gamePlay.value) return;
                const position: [number, number] = [
                  30 * 10,
                  15 * Math.floor(Math.random() * 3) + 15,
                ];
                const { mesh, characterController, collider } = addBlock(
                  scene,
                  position,
                  physics
                );
                obstacles.push({ mesh, characterController, collider });
              },
            },

            // Make Goomba run
            {
              action: () => {
                if (!gamePlay.value) return;
                // Increase animation speed based on score (0.1 speed increase per 10 points)
                const baseSpeed = 20;
                const speedMultiplier = 1 + gameScore.value * 0.01;
                const animationSpeed = baseSpeed * speedMultiplier;
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
                if (!gamePlay.value) return;

                // Move obstacles and remove off-screen ones
                for (let i = obstacles.length - 1; i >= 0; i--) {
                  const obstacle = obstacles[i];

                  // Move the block
                  moveBlock(obstacle, physics);

                  // Check if block should be removed and remove it
                  if (shouldRemoveBlock(obstacle.mesh)) {
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
  <canvas ref="canvas"></canvas>

  <!-- UI Overlay -->
  <div v-if="uiVisible" class="game-ui-overlay">
    <!-- Start Screen -->
    <div v-if="!gameStarted" class="game-screen start-screen">
      <div class="game-content">
        <h1 class="game-title">
          <span v-for="(item, i) in 'Goomba Runner'" :key="i">
            {{ item.trim() }}
          </span>
        </h1>
        <button @click="startGame" class="game-button start-button">
          Press SPACEBAR or TAP to Start
        </button>
      </div>
    </div>

    <!-- Game Over Screen -->
    <div v-if="gameOver" class="game-screen game-over-screen">
      <div class="game-content">
        <h1 class="game-over-title">Game Over</h1>
        <button @click="restartGame" class="game-button restart-button">
          Press SPACEBAR or TAP to Restart
        </button>
      </div>
    </div>

    <!-- In-Game Score Display -->
    <div v-if="gamePlay && gameStarted" class="score-hud">
      <span class="current-score">Score: {{ gameScore }}</span>
      <div class="ui-hint">Press SPACEBAR or TAP to hide UI</div>
    </div>
  </div>

  <!-- Always visible score during gameplay (even when UI is hidden) -->
  <div v-if="gamePlay && gameStarted && !uiVisible" class="persistent-score">
    <span class="score-display">{{ gameScore }}</span>
  </div>
</template>

<style>
/* Global CSS variables for Mario theme */
:root {
  --color-mario-gold: #ffd700;
  --color-mario-red: #ff6b6b;
  --color-mario-green: #32cd32;
  --color-mario-blue: #0064c8;
  --shadow-mario: 0.4rem 0.4rem 0px #000;
  --shadow-text-mario: 0.2rem 0.2rem 0px #000, 0.25rem 0.25rem 0px #000,
    0.3rem 0.3rem 0px #000;
  --shadow-text-mario-large: 0.2rem 0.2rem 0px #000, 0.25rem 0.25rem 0px #000,
    0.3rem 0.3rem 0px #000, 0.4rem 0.4rem 0px #000, 0.5rem 0.5rem 0px #000;
  --border-mario: 3px solid var(--color-mario-gold);
}
</style>

<style scoped>
button {
  background: transparent;
  border: none;
  color: white;
}

.game-ui-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 1;
}

.game-screen {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  /* backdrop-filter: blur(8px); */
  pointer-events: all;
}

.game-content {
  text-align: center;
  color: white;
  padding: 2rem;
  border-radius: 15px;
  flex-grow: 1;
  height: 100%;
}

.game-title {
  font-size: 5rem;
  font-weight: bold;
  margin-bottom: 1rem;
  text-shadow: var(--shadow-text-mario-large);
  text-transform: uppercase;
  font-family: "Arial Black", Arial, sans-serif;
}

.game-title > span {
  color: var(--color-mario-red); /* Default/first color */
  display: inline-block;
  transition: transform 0.3s ease;
}
.game-title > span:nth-child(4n + 1) {
  color: var(--color-mario-red); /* 1st, 5th, 9th... */
  transform: rotate(-3deg);
}
.game-title > span:nth-child(4n + 2) {
  color: var(--color-mario-blue); /* 2nd, 6th, 10th... */
  transform: rotate(2deg);
}
.game-title > span:nth-child(4n + 3) {
  color: var(--color-mario-green); /* 3rd, 7th, 11th... */
  transform: rotate(-1deg);
}
.game-title > span:nth-child(4n + 4) {
  color: var(--color-mario-gold); /* 4th, 8th, 12th... */
  transform: rotate(4deg);
}
.game-title > span:empty {
  display: block;
}

.game-over-title {
  font-size: 5rem;
  font-weight: bold;
  margin-bottom: 1rem;
  text-shadow: var(--shadow-text-mario);
  text-transform: uppercase;

  font-family: "Arial Black", Arial, sans-serif;
}

.score-label {
  display: block;
  font-size: 1.2rem;
  margin-bottom: 0.5rem;
  opacity: 0.8;
}

.score-value {
  display: block;
  font-size: 3rem;
  font-weight: bold;
  text-shadow: var(--shadow-text-mario);
}

.game-button {
  padding: 15px 30px;
  font-size: 1.1rem;
  font-weight: bold;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.3s ease;
  pointer-events: all;
  text-shadow: var(--shadow-text-mario);
  font-family: "Arial Black", Arial, sans-serif;
}

kbd {
  padding: 6px 12px;
  border-radius: 8px;
  font-family: "Arial Black", Arial, monospace;
  font-weight: bold;
}

.score-hud {
  position: absolute;
  top: 20px;
  left: 20px;
  pointer-events: all;
}

.current-score {
  padding: 12px 24px;
  border-radius: 25px;
  font-size: 1.3rem;
  font-weight: bold;
  font-family: "Arial Black", Arial, sans-serif;
  text-shadow: var(--shadow-text-mario);
}

.ui-hint {
  margin-top: 8px;
  font-size: 0.8rem;
  opacity: 0.6;
}

.persistent-score {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 2;
  pointer-events: none;
  text-shadow: var(--shadow-text-mario);
}

.score-display {
  padding: 15px 25px;
  margin: 2rem 0;
  font-size: 1.8rem;
  font-weight: bold;
  font-family: "Arial Black", Arial, sans-serif;
  text-shadow: var(--shadow-text-mario);
}
</style>
