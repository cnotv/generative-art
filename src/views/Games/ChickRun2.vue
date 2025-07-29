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
// import brickTexture from "@/assets/brick.jpg";

// Set UI controls
const uiStore = useUiStore();
const keyUp = (event: KeyboardEvent) => uiStore.setKeyState(event.key, true);
const keyDown = (event: KeyboardEvent) => uiStore.setKeyState(event.key, false);

interface PlayerMovement {
  forward: number;
  right: number;
  up: number;
}

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
  game: {
    play: true,
    score: 0,
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
});

onUnmounted(() => {
  window.removeEventListener("keydown", keyUp);
  window.removeEventListener("keyup", keyDown);
});

onUnmounted(() => window.removeEventListener("resize", initInstance));

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
    scene.add(physicsHelper);

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
      size: 15,
      type: "kinematicPositionBased",
      hasGravity: false,
    });

    if (!goombaModel || !goombaModel.mesh) {
      throw new Error("Failed to load goomba model");
    }

    const player = goombaModel.mesh;
    player.castShadow = true;

    // Rotate goomba to face sideways (towards the camera/blocks)
    player.rotation.y = Math.PI / 2; // 90 degrees rotation on Y-axis

    // Position player above ground
    const groundY = 0;
    const modelHeight = 15; // Approximate height of goomba model
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
      const capsuleRadius = 5;
      const capsuleHeight = 10;
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
      color: 0xff0000,
      // map: getTextures(brickTexture),
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
        camera: { position: [0, 20, 150] },
        // ground: { size: 100000, color: 0x227755 },
        ground: false,
        sky: { size: 700 },
        lights: { directional: { intensity: config.directional.intensity } },
        orbit: false,
      },
      defineSetup: async () => {
        const { physics, physicsHelper } = await initPhysics(scene);
        const { player, playerController, model } = await addPlayerController(
          scene,
          physics,
          world
        );
        onWindowResize(camera, renderer);
        getGround(scene, physics);

        // Movement input
        const playerMovement: PlayerMovement = { forward: 0, right: 0, up: 0 };

        function handleJump(player: THREE.Mesh) {
          // Stop jump animation if game is not playing
          if (!gameConfig.game.play) {
            gameConfig.player.jump.isActive = false;
            gameConfig.player.jump.velocity = 0;
            // Don't move the player - keep current position when game stops
            return;
          }

          const currentTime = Date.now();

          // Start jump if jump key is pressed and not already jumping
          if (uiStore.controls.jump && !gameConfig.player.jump.isActive) {
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
                gameConfig.game.play = false;
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
            const speed = 2.5 * deltaTime;
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
            if (gameConfig.game.play) {
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
          const material = new THREE.MeshStandardMaterial({ color: 0xffffff });

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

        animate({
          beforeTimeline: () => {},
          timeline: [
            {
              action: () => {
                if (physicsHelper) physicsHelper.update();

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
                if (!gameConfig.game.play) return;
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
                if (!gameConfig.game.play) return;
                updateAnimation(model.mixer, model.actions.run, getDelta(), 20);
              },
            },
            // Move obstacles
            {
              action: () => {
                if (!gameConfig.game.play) return;
                obstacles.forEach((obstacle) => {
                  const { mesh, characterController, collider } = obstacle;

                  // Use character controller to move the block
                  const speed = gameConfig.blocks.speed;
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
                });
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
</template>
