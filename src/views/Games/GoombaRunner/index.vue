<script setup lang="ts">
import * as THREE from "three";
import { RapierPhysics } from "three/addons/physics/RapierPhysics.js";
import { RapierHelper } from "three/addons/helpers/RapierHelper.js";
import RAPIER from "@dimforge/rapier3d";

import { ref, onMounted, onUnmounted, watch } from "vue";
import { useRoute } from "vue-router";
import { controls } from "@/utils/control";
import { stats } from "@/utils/stats";
import { createSound, initializeAudio, stopSoundtrack } from "@/utils/audio";

import {
  getTools,
  getModel,
  colorModel,
  createZigzagTexture,
  tiltCamera,
  isOoS,
} from "@/utils/threeJs";
import { useUiStore } from "@/stores/ui";
import { updateAnimation } from "@/utils/animation";
import { getCube } from "@/utils/models";
import {
  enableZoomPrevention,
  loadGoogleFont,
  removeGoogleFont,
  disableZoomPrevention,
} from "@/utils/ui";
import { config, GAME_STATUS, SOUNDS } from "./config";

interface PlayerMovement {
  forward: number;
  right: number;
  up: number;
}

// Event configuration for state-based handling
interface EventHandlers {
  keyboard?: Record<string, () => void>;
  touch?: () => void;
}

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

const activeListeners: Array<{
  target: EventTarget;
  type: string;
  listener: EventListener;
}> = [];

// Add event listener with tracking
const addTrackedEventListener = (
  target: EventTarget,
  type: string,
  listener: EventListener
) => {
  target.addEventListener(type, listener);
  activeListeners.push({ target, type, listener });
};

// Remove all tracked event listeners
const removeAllEventListeners = () => {
  activeListeners.forEach(({ target, type, listener }) => {
    target.removeEventListener(type, listener);
  });
  activeListeners.length = 0;
};

// Reset and then update event listeners based on current game status
const updateEventListeners = () => {
  removeAllEventListeners();
  const listeners = listenersMap[gameStatus.value];

  // Add keyboard listeners
  if (listeners.keyboard) {
    const keyHandler = (event: KeyboardEvent) => {
      const handler = listeners.keyboard![event.key];
      if (handler) {
        event.preventDefault();
        handler();
      }
    };
    addTrackedEventListener(window, "keydown", keyHandler as EventListener);
  }

  // Add touch/click listeners
  if (listeners.touch) {
    const touchHandler = (event: TouchEvent) => {
      const handler = listeners.touch;
      if (handler && event.type === "touchstart") {
        event.preventDefault();
        handler();
      }
    };

    addTrackedEventListener(window, "touchstart", touchHandler as EventListener);
    addTrackedEventListener(window, "click", touchHandler as EventListener);
  }
};

// Jump function that triggers the player jump action
const handleJumpGoomba = () => {
  uiStore.controls.jump = true;
  // Reset jump control after a short delay to allow the jump to register
  setTimeout(() => {
    uiStore.controls.jump = false;
  }, 100);
};

const listenersMap: Record<GameStatus, EventHandlers> = {
  [GAME_STATUS.START]: {
    keyboard: {
      " ": () => handleStartGame(),
      Enter: () => handleStartGame(),
    },
    touch: () => handleStartGame(),
  },
  [GAME_STATUS.PLAYING]: {
    keyboard: {
      " ": () => handleJumpGoomba(),
      ArrowUp: () => handleJumpGoomba(),
    },
    touch: () => handleJumpGoomba(),
  },
  [GAME_STATUS.GAME_OVER]: {
    keyboard: {
      " ": () => handleRestartGame(),
      Enter: () => handleRestartGame(),
    },
    touch: () => handleRestartGame(),
  },
};

// Watch for game status changes and update event listeners
watch(
  gameStatus,
  () => {
    setTimeout(updateEventListeners, 500);
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
  updateEventListeners();
});

onUnmounted(() => {
  removeGoogleFont(fontName);
  disableZoomPrevention(originalViewport, preventZoomStyleElement);
  updateEventListeners();
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
  updateEventListeners(); // Update event listeners for gameplay state

  // startSoundtrack(soundtrackSequence, gameScore.value);
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
  updateEventListeners(); // Update event listeners for game over state
};

/**
 * Increase speed based on score (0.1 speed increase per 10 points)
 * @param base
 */
const getSpeed = (base: number): number => {
  const speedMultiplier = 1 + gameScore.value * 0.001;
  const speed = base * speedMultiplier;
  return speed;
};

const init = async (canvas: HTMLCanvasElement, statsEl: HTMLElement) => {
  const initPhysics = async (scene: THREE.Scene) => {
    //Initialize physics engine using the script in the jsm/physics folder
    const physics = await RapierPhysics();

    //Optionally display collider outlines
    const physicsHelper = new RapierHelper(physics.world);
    if (config.game.helpers) {
      scene.add(physicsHelper); // Enable helper to show colliders
    }

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
      // showHelper: config.player.helper,
    });

    if (!goombaModel || !goombaModel.mesh) {
      throw new Error("Failed to load goomba model");
    }

    const player = goombaModel.mesh;
    player.castShadow = true;

    // Update colors
    colorModel(player, [
      0xffffff, // White - unknown
      0xffffff, // White - unknown
      0xffffff, // White - unknown
      0xb1865a, // Beige - body
      0xffffff, // White - unknown
      0xbf9a37, // Brown - head
      0xffffff, // White - unknown
      0xffffff, // White - tusks
      0xffffff, // White - unknown
      0x654321, // Dark brown - feet
      0x8b4513, // Brown - default/other parts
    ]);

    // Rotate goomba to face sideways (towards the camera/blocks)
    player.rotation.y = 2;

    // Position player above ground
    const groundY = 0.25; // Ground top surface is at y = 0.25
    const goombaHeight = 5; // Approximate height from center to bottom of Goomba
    const playerY = groundY + goombaHeight; // Position Goomba above ground
    const startingPosition = { x: 0, y: playerY, z: 0 };
    player.position.set(startingPosition.x, startingPosition.y, startingPosition.z);

    // Store starting position for resets
    player.userData.startingPosition = startingPosition;

    // Rapier Character Controller
    const playerController = physics.world.createCharacterController(0.01);
    playerController.setApplyImpulsesToDynamicBodies(true);
    playerController.setCharacterMass(3);

    // Remove existing collider from getModel to avoid conflicts
    if (goombaModel.collider) {
      physics.world.removeCollider(goombaModel.collider);
    }

    // Always create a custom capsule collider for better visibility and control
    const capsuleRadius = 8;
    const capsuleHeight = 20;
    const colliderDesc = physics.RAPIER.ColliderDesc.capsule(
      capsuleHeight / 2,
      capsuleRadius
    );
    colliderDesc.friction = 1;
    colliderDesc.mass = 1;
    player.userData.collider = physics.world.createCollider(colliderDesc);

    // Store base Y position for jump calculations (above ground level)
    player.userData.baseY = playerY;

    return { player, playerController, model: goombaModel };
  };

  const preventGlitches = (result: ComplexModel, options: any) => {
    // Fix texture opacity glitches during camera rotation
    if (result.mesh && options.opacity < 1) {
      // Set render order based on depth - farther elements render first
      result.mesh.renderOrder = Math.abs(options.zPosition) / 10;

      // Adjust material properties to prevent Z-fighting
      if (result.mesh.material instanceof THREE.MeshBasicMaterial) {
        result.mesh.material.depthTest = true;
        result.mesh.material.depthWrite = options.opacity >= 0.9; // Only write to depth if mostly opaque
        result.mesh.material.alphaTest = 0.01; // Discard very transparent pixels
      }
    }
  };

  const addBackground = (
    scene: THREE.Scene,
    world: RAPIER.World,
    options: any,
    initialX?: number
  ) => {
    const getVariation = (variation: number) =>
      (Math.random() - 0.5) * 2 * (variation || 0);

    // Calculate height based on ratio (width / ratio = height)
    const width = options.size;
    const height = options.ratio ? width / options.ratio : width / 2; // fallback to 2:1 ratio

    const xPosition =
      initialX !== undefined
        ? initialX + getVariation(options.xVariation)
        : window.innerWidth / 2 + width + getVariation(options.xVariation);

    const finalPosition: [number, number, number] = [
      xPosition,
      options.yPosition + getVariation(options.yVariation),
      options.zPosition + getVariation(options.zVariation),
    ];

    // Create the main textured layer
    const result = getCube(scene, world, {
      texture: options.texture,
      size: [width, height, 0],
      position: finalPosition,
      castShadow: false,
      receiveShadow: false,
      color: 0xffffff,
      opacity: options.opacity,
      material: "MeshBasicMaterial",
    });

    preventGlitches(result, options);

    return result;
  };

  const populateInitialBackgrounds = (
    scene: THREE.Scene,
    world: RAPIER.World,
    backgrounds: { mesh: THREE.Mesh; speed: number }[]
  ) => {
    const viewportWidth = window.innerWidth;
    const extendedWidth = viewportWidth * 2; // Cover more area initially

    config.backgrounds.layers.forEach((background) => {
      const totalElements = Math.ceil(extendedWidth / background.spacing) + 1;

      for (let i = 0; i < totalElements; i++) {
        const initialX = i * background.spacing - extendedWidth / 2;
        const { mesh } = addBackground(scene, world, background, initialX);
        backgrounds.push({ mesh, speed: background.speed });
      }
    });
  };

  const addBlock = async (
    scene: THREE.Scene,
    position: [number, number],
    world: RAPIER.World,
    physics?: RapierPhysics
  ) => {
    // Load sand block model
    const sandBlockModel = await getModel(scene, world, "sand_block.glb", {
      scale: [0.15, 0.15, 0.15],
      restitution: 0,
      position: [position[0], position[1], 0],
      type: "kinematicPositionBased", // Changed from "fixed" to allow movement
      hasGravity: false,
    });

    const mesh = sandBlockModel.mesh;
    mesh.castShadow = true;
    mesh.position.set(position[0], position[1], 0);

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
    const backgrounds = [] as { mesh: THREE.Mesh; speed: number }[];

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
        getGround(scene, physics);

        // Add cartoonish horizon line for visual separation
        const horizonLine = addHorizonLine(scene);

        // Movement input
        const playerMovement: PlayerMovement = { forward: 0, right: 0, up: 0 };

        // Track background generation timing for speed-adjusted spawning
        let backgroundTimers = config.backgrounds.layers.map(() => 0);

        // Track if initial backgrounds are populated
        let backgroundsPopulated = false;

        function handleJump(player: THREE.Mesh) {
          // Always ensure Goomba is at proper ground level, regardless of game state
          const ensureGroundPosition = () => {
            const currentPosition = player.userData.collider.translation();
            const groundLevel = player.userData.baseY;
            const safeY = Math.max(currentPosition.y, groundLevel);

            if (currentPosition.y !== safeY) {
              player.userData.collider.setTranslation({
                x: currentPosition.x,
                y: safeY,
                z: currentPosition.z,
              });
              player.position.set(currentPosition.x, safeY, currentPosition.z);
            }
          };

          // Stop jump animation if game is not playing
          if (gameStatus.value !== GAME_STATUS.PLAYING) {
            config.player.jump.isActive = false;
            config.player.jump.velocity = 0;
            // Ensure proper ground position even when game is not playing
            ensureGroundPosition();
            return;
          }

          const currentTime = Date.now();

          // Start jump if jump key is pressed OR touch is active and not already jumping
          if (uiStore.controls.jump && !config.player.jump.isActive) {
            config.player.jump.isActive = true;
            config.player.jump.startTime = currentTime;
            config.player.jump.velocity = config.player.jump.height;

            // Play boing sound effect
            createSound(SOUNDS.jump);
          }

          // Handle ongoing jump
          if (config.player.jump.isActive) {
            const jumpElapsed = currentTime - config.player.jump.startTime;
            const jumpProgress = jumpElapsed / config.player.jump.duration;

            if (jumpProgress >= 1.0) {
              // Jump complete - ensure Goomba returns to ground level
              config.player.jump.isActive = false;
              config.player.jump.velocity = 0;

              // Reset camera tilt when jump completes
              tiltCamera(camera, 0, 0.15);

              // Reset camera position when jump completes
              if (camera.userData.originalPosition) {
                camera.position.y = camera.userData.originalPosition.y;
              }

              // Reset horizon line position when jump completes
              if (horizonLine.userData.originalPosition) {
                horizonLine.position.y = horizonLine.userData.originalPosition.y;
              }

              // Ensure Goomba is positioned exactly at ground level
              const currentPosition = player.userData.collider.translation();
              const groundLevel = player.userData.baseY; // This is already above ground

              player.userData.collider.setTranslation({
                x: currentPosition.x,
                y: groundLevel,
                z: currentPosition.z,
              });
              player.position.set(currentPosition.x, groundLevel, currentPosition.z);
            } else {
              // Calculate jump arc (parabolic motion)
              const jumpCurve = Math.sin(jumpProgress * Math.PI); // Creates arc from 0 to 1 to 0
              const targetY =
                player.userData.baseY + config.player.jump.height * jumpCurve;

              // Tilt camera based on jump progress (tilt up more during ascent)
              const maxTilt = -0.1; // Negative = tilt up (radians, about 5.7 degrees)
              const cameraTilt = jumpCurve * maxTilt;
              tiltCamera(camera, cameraTilt, 0.2);

              // Move camera up with the player during jump
              if (!camera.userData.originalPosition) {
                camera.userData.originalPosition = {
                  x: camera.position.x,
                  y: camera.position.y,
                  z: camera.position.z,
                };
              }
              const cameraRiseAmount = jumpCurve * 15; // Rise up to 15 units with the jump
              camera.position.y = camera.userData.originalPosition.y + cameraRiseAmount;

              // Adjust horizon line to follow camera movement for consistent visual effect
              if (!horizonLine.userData.originalPosition) {
                horizonLine.userData.originalPosition = {
                  x: horizonLine.position.x,
                  y: horizonLine.position.y,
                  z: horizonLine.position.z,
                };
              }
              const horizonRiseAmount = jumpCurve * 9; // Rise less than camera for depth effect
              horizonLine.position.y =
                horizonLine.userData.originalPosition.y + horizonRiseAmount;

              // Ensure Goomba never goes below ground level
              const minY = player.userData.baseY; // Base Y is already above ground
              const safeTargetY = Math.max(targetY, minY);

              // Update player position
              const currentPosition = player.userData.collider.translation();
              player.userData.collider.setTranslation({
                x: currentPosition.x,
                y: safeTargetY,
                z: currentPosition.z,
              });

              // Sync Three.js mesh
              player.position.set(currentPosition.x, safeTargetY, currentPosition.z);
            }
          }
        }

        // Track collisions to log only once per block
        const loggedCollisions = new Set<string>();

        // Explosion particles array
        const explosionParticles: THREE.Mesh[] = [];

        function createStarExplosion(position: THREE.Vector3, color: number) {
          const starCount = 12; // Number of stars in explosion

          for (let i = 0; i < starCount; i++) {
            // Create cube geometry for both filled and wireframe
            const starGeometry = new THREE.BoxGeometry(8, 8, 8);

            // Create filled cube material
            const starMaterial = new THREE.MeshStandardMaterial({
              color,
            });

            // Create the main filled cube
            const star = new THREE.Mesh(starGeometry, starMaterial);

            // Position star at collision point
            star.position.copy(position);

            // Random rotation for variety
            star.rotation.set(
              Math.random() * Math.PI * 2,
              Math.random() * Math.PI * 2,
              Math.random() * Math.PI * 2
            );

            // Random velocity for explosion effect
            const velocity = new THREE.Vector3(
              (Math.random() - 0.5) * 60, // X velocity
              Math.random() * 40 + 20, // Y velocity (upward bias)
              (Math.random() - 0.5) * 40 // Z velocity
            );

            // Store animation data
            star.userData = {
              velocity,
              gravity: -120, // Gravity effect
              life: 1.0, // Life span (1.0 = full life)
              decay: 0.02, // How fast it decays
              initialScale: 1 + Math.random() * 0.5, // Random initial scale
              rotationSpeed: new THREE.Vector3(
                (Math.random() - 0.5) * 0.2,
                (Math.random() - 0.5) * 0.2,
                (Math.random() - 0.5) * 0.2
              ),
            };

            star.scale.setScalar(star.userData.initialScale);
            scene.add(star);
            explosionParticles.push(star);
          }
        }

        function updateExplosionParticles(deltaTime: number) {
          for (let i = explosionParticles.length - 1; i >= 0; i--) {
            const particle = explosionParticles[i];
            const userData = particle.userData;

            // Update velocity with gravity
            userData.velocity.y += userData.gravity * deltaTime;

            // Update position
            particle.position.add(userData.velocity.clone().multiplyScalar(deltaTime));

            // Update rotation
            particle.rotation.x += userData.rotationSpeed.x;
            particle.rotation.y += userData.rotationSpeed.y;
            particle.rotation.z += userData.rotationSpeed.z;

            // Update life and scale
            userData.life -= userData.decay;
            const scale = userData.initialScale * userData.life;
            particle.scale.setScalar(Math.max(0, scale));

            // Update opacity based on life
            if (particle.material instanceof THREE.MeshStandardMaterial) {
              particle.material.opacity = userData.life;
              particle.material.transparent = true;
            }

            // Remove particle when life is depleted
            if (userData.life <= 0) {
              scene.remove(particle);
              explosionParticles.splice(i, 1);
            }
          }
        }

        function checkCollisions(
          player: THREE.Mesh,
          obstacles: { mesh: THREE.Mesh; characterController: any; collider: any }[]
        ) {
          const playerPosition = player.position;
          obstacles.forEach((obstacle, index) => {
            const obstaclePosition = obstacle.mesh.position;
            const distance = playerPosition.distanceTo(obstaclePosition);
            if (distance < config.player.collisionThreshold) {
              const collisionKey = `obstacle-${index}-${obstacle.mesh.uuid}`;

              if (!loggedCollisions.has(collisionKey)) {
                loggedCollisions.add(collisionKey);

                // Play collision sound effect
                createSound(SOUNDS.collision);

                // Create explosion at collision point
                const explosionPosition = playerPosition.clone();
                createStarExplosion(explosionPosition, goombaColor);

                // Make Goomba disappear
                player.visible = false;

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
            const speed = config.player.speed * deltaTime;
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
            // Prevent vertical movement if game is not playing, but always ensure ground collision
            if (gameStatus.value === GAME_STATUS.PLAYING) {
              position.y += translation.y;
            }
            // Always ensure Goomba never goes below ground level, regardless of game state
            const minY = player.userData.baseY; // Base Y is already above ground
            position.y = Math.max(position.y, minY);
            position.z += translation.z;

            player.userData.collider.setTranslation(position);

            // Sync Three.js mesh with Rapier collider
            player.position.set(position.x, position.y, position.z);
          }
        }

        function addHorizonLine(scene: THREE.Scene) {
          // Create a dark grey horizontal bar/line for cartoonish horizon effect
          const horizonGeometry = new THREE.BoxGeometry(4000, 3, 2); // Wide, thin bar
          const horizonMaterial = new THREE.MeshBasicMaterial({
            color: 0x333333, // Dark grey
            transparent: true,
            opacity: 0.8,
          });

          const horizonLine = new THREE.Mesh(horizonGeometry, horizonMaterial);

          // Position the horizon line slightly above the ground level
          horizonLine.position.set(0, 11, -200); // Y=11 for horizon height, Z back a bit for depth
          horizonLine.receiveShadow = false;
          horizonLine.castShadow = false;

          scene.add(horizonLine);
          return horizonLine; // Return the horizon line so we can manipulate it during jumps
        }

        function getGround(scene: THREE.Scene, physics?: RapierPhysics) {
          const geometry = new THREE.BoxGeometry(2000, 0.5, 2000);

          // Create zigzag pattern texture with custom parameters
          const texture = createZigzagTexture({
            size: 128,
            backgroundColor: "#60af2c", // Slightly different green
            zigzagColor: "#ffff44", // Darker green for primary zigzag
            zigzagHeight: 100, // Taller zigzag amplitude
            zigzagWidth: 32, // Wider zigzag segments
            primaryThickness: 2, // Thicker primary line
            repeatX: 30, // Less repetition for larger pattern
            repeatY: 30,
          });

          // Store reference for animation
          groundTexture = texture;

          const material = new THREE.MeshStandardMaterial({
            map: texture,
            color: 0x68b469, // Use white to show natural texture colors
          });

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
          const speed = getSpeed(config.game.speed);
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

        function removeBlock(
          obstacle: { mesh: THREE.Mesh; characterController: any; collider: any },
          obstacles: { mesh: THREE.Mesh; characterController: any; collider: any }[],
          index: number,
          scene: THREE.Scene,
          physics: RapierPhysics
        ) {
          const { mesh, collider } = obstacle;

          // Remove from scene and physics world (scoring now happens when block passes behind player)
          scene.remove(mesh);
          physics.world.removeCollider(collider);

          // Remove from obstacles array
          obstacles.splice(index, 1);
        }

        // Helper function to ensure Goomba stays above ground in all states
        function ensurePlayerAboveGround(player: THREE.Mesh) {
          const currentPosition = player.userData.collider.translation();
          const groundLevel = player.userData.baseY;

          if (currentPosition.y < groundLevel) {
            player.userData.collider.setTranslation({
              x: currentPosition.x,
              y: groundLevel,
              z: currentPosition.z,
            });
            player.position.set(currentPosition.x, groundLevel, currentPosition.z);
          }
        }

        animate({
          beforeTimeline: () => {},
          timeline: [
            {
              action: () => {
                if (physicsHelper) physicsHelper.update();

                // Always ensure Goomba stays above ground, regardless of game state
                ensurePlayerAboveGround(player);

                // Populate backgrounds when game is in START status and not yet populated
                if (gameStatus.value === GAME_STATUS.START && !backgroundsPopulated) {
                  populateInitialBackgrounds(scene, world, backgrounds);
                  backgroundsPopulated = true;
                }

                // Update explosion particles
                updateExplosionParticles(getDelta());

                // Clear obstacles if restart was requested
                if (shouldClearObstacles.value) {
                  // Remove all obstacles from scene and physics
                  for (let i = obstacles.length - 1; i >= 0; i--) {
                    const obstacle = obstacles[i];
                    scene.remove(obstacle.mesh);
                    physics.world.removeCollider(obstacle.collider);
                  }
                  obstacles.length = 0; // Clear the array

                  for (let i = backgrounds.length - 1; i >= 0; i--) {
                    const background = backgrounds[i];
                    scene.remove(background.mesh);
                  }
                  backgrounds.length = 0; // Clear the array

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

                  // Reset Goomba to starting position (ensure proper ground level)
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

                movePlayer(player, playerController, physics, playerMovement);
                handleJump(player);
                checkCollisions(player, obstacles);
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

            // // Create background
            // ...config.backgrounds.layers.map((background) => ({
            //   frequency: background.spacing,
            //   action: () => {
            //     if (gameStatus.value !== GAME_STATUS.PLAYING) return;
            //     const { mesh } = addBackground(scene, world, background);
            //     backgrounds.push({ mesh, speed: background.speed });
            //   },
            // })),

            // Move ground
            {
              action: () => {
                // Animate ground texture to create moving ground effect
                if (groundTexture && gameStatus.value === GAME_STATUS.PLAYING) {
                  groundTexture.offset.x += 0.03 * getSpeed(1); // Move texture based on game speed
                }
              },
            },

            // Move background
            {
              action: () => {
                if (gameStatus.value !== GAME_STATUS.PLAYING) return;

                const createBg = () => {
                  // Dynamic background generation - create new backgrounds when needed based on speed
                  config.backgrounds.layers.forEach((backgroundConfig, layerIndex) => {
                    const currentSpeed = getSpeed(backgroundConfig.speed);
                    const adjustedSpacing = backgroundConfig.spacing / getSpeed(1); // Adjust spacing based on overall game speed

                    // Check if we need to generate a new background element for this layer
                    backgroundTimers[layerIndex] += currentSpeed;

                    if (backgroundTimers[layerIndex] >= adjustedSpacing) {
                      backgroundTimers[layerIndex] = 0; // Reset timer
                      const { mesh } = addBackground(scene, world, backgroundConfig);
                      backgrounds.push({ mesh, speed: backgroundConfig.speed });
                    }
                  });
                };

                const moveBg = () => {
                  // Move backgrounds and remove off-screen ones
                  for (let i = backgrounds.length - 1; i >= 0; i--) {
                    const background = backgrounds[i];
                    background.mesh.position.x -= getSpeed(background.speed);

                    // Remove when element is completely outside the camera cone vision
                    if (isOoS(camera, background)) {
                      scene.remove(background.mesh);
                      backgrounds.splice(i, 1);
                    }
                  }
                };

                createBg();
                moveBg();
              },
            },

            // Make Goomba run
            {
              action: () => {
                if (gameStatus.value !== GAME_STATUS.PLAYING) return;
                const animationSpeed = getSpeed(config.player.speed);
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
                  moveBlock(obstacle, physics);

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

  <!-- Start Screen -->
  <div v-if="gameStatus === GAME_STATUS.START" class="game game--start">
    <h1 class="game__title">
      <span v-for="(item, i) in 'Goomba Runner'" :key="i">
        {{ item.trim() }}
      </span>
    </h1>
    <button @click="handleStartGame" class="game__button game__button--start">
      Press SPACEBAR or TAP to Start
    </button>
  </div>

  <!-- Game Over Screen -->
  <div v-if="gameStatus === GAME_STATUS.GAME_OVER" class="game game--over">
    <h1 class="game__title">Game Over</h1>
    <div v-if="isNewHighScore" class="new-high-score">
      <div class="gratz-text">New High Score: {{ gameScore }}</div>
    </div>
    <button @click="handleRestartGame" class="game__button game__button--button">
      Press SPACEBAR or TAP to Restart
    </button>
  </div>

  <!-- In-Game Score Display -->
  <div
    v-if="gameStatus === GAME_STATUS.PLAYING || gameStatus === GAME_STATUS.GAME_OVER"
    class="game__score"
  >
    <span class="game__score__value">{{ gameScore }}</span>
    <span class="game__score__value game__score__value--highest"
      >Best: {{ highestScore }}</span
    >
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
  --font-playful: "Darumadrop One", "Arial Black", sans-serif;
}
</style>

<style scoped>
* {
  user-select: none;
}

.game__button {
  background: transparent;
  border: none;
  color: white;
}

.game {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  pointer-events: all;
  z-index: 1000;
}

.game--start .game__title {
  font-size: 12vh;
  font-weight: 900;
  margin-bottom: 1rem;
  text-shadow: var(--shadow-text-mario-large);
  text-transform: uppercase;
  font-family: var(--font-playful);
  color: #000;
  line-height: 0.6;
  letter-spacing: -0.4rem;
  /* Text outline using webkit-text-stroke */
  -webkit-text-stroke: 3px #fff;
  /* Fallback text outline using multiple text shadows */
  text-shadow: -1px -1px 0 #fff, 1px -1px 0 #fff, -1px 1px 0 #fff, 1px 1px 0 #fff,
    -1px 0 0 #fff, 1px 0 0 #fff, 0 -1px 0 #fff, 0 1px 0 #fff, -4px -4px 0 #000,
    4px -4px 0 #000, -4px 4px 0 #000, 4px 4px 0 #000, -4px 0 0 #000, 4px 0 0 #000,
    0 -4px 0 #000, 0 4px 0 #000, var(--shadow-text-mario-large);
}

.game--start .game__title > span {
  color: var(--color-mario-red); /* Default/first color */
  display: inline-block;
  transition: transform 0.3s ease;
}
.game--start .game__title > span:nth-child(4n + 1) {
  color: var(--color-mario-red); /* 1st, 5th, 9th... */
  transform: rotate(-3deg);
}
.game--start .game__title > span:nth-child(4n + 2) {
  color: var(--color-mario-blue); /* 2nd, 6th, 10th... */
  transform: rotate(2deg);
}
.game--start .game__title > span:nth-child(4n + 3) {
  color: var(--color-mario-green); /* 3rd, 7th, 11th... */
  transform: rotate(-1deg);
}
.game--start .game__title > span:nth-child(4n + 4) {
  color: var(--color-mario-gold); /* 4th, 8th, 12th... */
  transform: rotate(4deg);
}
.game--start .game__title > span:empty {
  display: block;
}

.game--over {
  justify-content: center;
}

.game--over .game__title {
  font-size: 12vh;
  font-weight: 900;
  margin-bottom: 1rem;
  text-transform: uppercase;
  font-family: var(--font-playful);
  line-height: 0.6;
  letter-spacing: -0.4rem;
  color: var(--color-mario-red);

  text-shadow: -1px -1px 0 #fff, 1px -1px 0 #fff, -1px 1px 0 #fff, 1px 1px 0 #fff,
    -1px 0 0 #fff, 1px 0 0 #fff, 0 -1px 0 #fff, 0 1px 0 #fff, -4px -4px 0 #000,
    4px -4px 0 #000, -4px 4px 0 #000, 4px 4px 0 #000, -4px 0 0 #000, 4px 0 0 #000,
    0 -4px 0 #000, 0 4px 0 #000, var(--shadow-text-mario-large);
}

.game__button {
  padding: 15px 30px;
  font-size: 1.5rem;
  font-weight: 800;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.3s ease;
  pointer-events: all;
  color: #000;
  text-shadow: -1px -1px 0 #fff, 1px -1px 0 #fff, -1px 1px 0 #fff, 1px 1px 0 #fff,
    -1px 0 0 #fff, 1px 0 0 #fff, 0 -1px 0 #fff, 0 1px 0 #fff;
  font-family: var(--font-playful);
  /* font-family: monospace; */
  margin-top: 2rem;
}

.game__score {
  position: absolute;
  pointer-events: all;
  display: flex;
  width: 100vw;
  top: 20px;
  flex-direction: column;
}

.game__score__value {
  display: flex;
  flex-direction: column;
  align-items: end;
}

.game__score__value {
  padding: 0 24px;
  border-radius: 25px;
  font-size: 4rem;
  font-weight: 800;
  font-family: var(--font-playful);
  text-shadow: var(--shadow-text-mario);
}

.game__score__value--highest {
  font-size: 1.5rem;
}

.gratz-text {
  font-size: 3rem;
  font-weight: 900;
  color: var(--color-mario-gold);
  font-family: var(--font-playful);
  text-shadow: var(--shadow-text-mario-large);
  animation: bounce 0.8s ease-in-out infinite;
  margin-bottom: 0.5rem;
}

@keyframes bounce {
  0%,
  20%,
  50%,
  80%,
  100% {
    transform: translateY(0);
  }
  40% {
    transform: translateY(-10px);
  }
  60% {
    transform: translateY(-5px);
  }
}
</style>
