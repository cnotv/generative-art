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
    speed: 1,
  },
  player: {
    speed: 2.5,
    maxJump: 30,
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
    const mass = 0;
    const restitution = 0;
    const mesh: THREE.Mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.position.set(...position);
    mesh.userData.physics = { mass, restitution };
    scene.add(mesh);

    if (physics) {
      const { body, collider } = physics.addMesh(mesh, mass, restitution);
      return { mesh, body, collider };
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
    const obstacles = [] as THREE.Mesh[];

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

        function addBody(
          position: [number, number],
          fixed = true,
          physics?: RapierPhysics
        ) {
          const geometry = fixed
            ? new THREE.BoxGeometry(30, 30, 30)
            : new THREE.SphereGeometry(10);
          const material = new THREE.MeshStandardMaterial({
            color: fixed ? 0xff0000 : 0x00ff00,
          });
          const mass = fixed ? 0 : 5;
          const restitution = fixed ? 0 : 0.3;
          const mesh = new THREE.Mesh(geometry, material);
          mesh.castShadow = true;

          mesh.position.set(...position);

          mesh.userData.physics = {
            mass,
            restitution,
          };
          scene.add(mesh);
          if (physics) {
            const { body, collider } = physics.addMesh(mesh, mass, restitution);
            return { mesh, body, collider };
          }
          return { mesh };
        }

        function addControlledBlock() {}

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
            }
          },
          timeline: [
            {
              action: () => {
                if (physicsHelper) physicsHelper.update();

                movePlayer(player, playerController, physics, playerMovement);
                // updateAnimation(chickModel.mixer, chickModel.actions.run, getDelta(), 20);
              },
            },
            // Generate cubes
            {
              // frequency: 75,
              start: 50,
              end: 50,
              action: () => {
                const position = [30 * 5, 15 * Math.floor(Math.random() * 3) + 15];
                const { mesh, body, collider } = addBlock(scene, position, physics);
                console.log({ mesh, body, collider });
                // obstacles.push({ mesh, body, collider });

                addBody([Math.random() * 100, Math.random() * 100], false, physics);
              },
            },
            // Move obstacles
            {
              action: () => {
                obstacles.forEach((obstacle: THREE.Mesh) => {
                  console.log(obstacle);
                  physics.setMeshPosition(
                    { body: obstacle.body, collider: obstacle.collider },
                    [
                      obstacle.mesh.position.x - gameConfig.blocks.speed,
                      obstacle.mesh.position.y,
                      obstacle.mesh.position.z,
                    ]
                  );
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
