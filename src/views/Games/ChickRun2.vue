<script setup lang="ts">
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RapierPhysics } from "three/addons/physics/RapierPhysics.js";
import { RapierHelper } from "three/addons/helpers/RapierHelper.js";
import Stats from "three/addons/libs/stats.module.js";

import { ref, onMounted, onUnmounted } from "vue";
import { useRoute } from "vue-router";
import { controls } from "@/utils/control";
import { stats } from "@/utils/stats";

import { getModel, getTools, getTextures } from "@/utils/threeJs";
import { bindAnimatedElements, bodyJump, updateAnimation } from "@/utils/animation";
import { useUiStore } from "@/stores/ui";
import { getCube } from "@/utils/models";
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

  const addPlayerController = (scene: THREE.Scene, physics: RapierPhysics) => {
    // Character Capsule
    const size = 30;
    const geometry = new THREE.CapsuleGeometry(size * 0.3, size, size / 8, size / 8);
    const material = new THREE.MeshStandardMaterial({ color: 0x0000ff });
    const player = new THREE.Mesh(geometry, material);
    player.castShadow = true;
    player.position.set(0, 0.8, 0);
    const mass = 0;
    const restitution = 0;
    scene.add(player);

    // Rapier Character Controller
    const playerController = physics.world.createCharacterController(0.01);
    playerController.setApplyImpulsesToDynamicBodies(true);
    playerController.setCharacterMass(3);
    const colliderDesc = physics.RAPIER.ColliderDesc.capsule(0.5, 0.3).setTranslation(
      0,
      0.8,
      0
    );
    player.userData.collider = physics.world.createCollider(colliderDesc);

    if (physics) {
      physics.addMesh(player, mass, restitution);
    }

    return { player, playerController };
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
        const { player, playerController } = addPlayerController(scene, physics);
        onWindowResize(camera, renderer);
        getGround(scene, physics);

        // Movement input
        const playerMovement: PlayerMovement = { forward: 0, right: 0, up: 0 };

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
            const collisionThreshold = 40; // Adjusted for the 30x30x30 blocks and player size

            if (distance < collisionThreshold) {
              const collisionKey = `obstacle-${index}-${obstacle.mesh.uuid}`;

              if (!loggedCollisions.has(collisionKey)) {
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
            position.y += translation.y;
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

          mesh.position.y = -0.25;
          mesh.userData.physics = { mass: 0 };

          if (physics) {
            physics.addMesh(mesh);
          }
          scene.add(mesh);
        }

        animate({
          beforeTimeline: () => {
            // bindAnimatedElements([...elements, ...obstacles], world, getDelta());
            if (uiStore.controls.jump) {
              // TODO: Implement jump logic
            }
          },
          timeline: [
            {
              action: () => {
                if (physicsHelper) physicsHelper.update();

                movePlayer(player, playerController, physics, playerMovement);
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
