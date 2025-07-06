<script setup lang="ts">
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RapierPhysics } from "three/addons/physics/RapierPhysics.js";
import { RapierHelper } from "three/addons/helpers/RapierHelper.js";
import Stats from "three/addons/libs/stats.module.js";

import { video } from "@/utils/video";

import { ref, onMounted, onUnmounted } from "vue";
import { useRoute } from "vue-router";
import { controls } from "@/utils/control";
import { stats } from "@/utils/stats";

import { getTools } from "@/utils/threeJs";
import { bindAnimatedElements } from "@/utils/animation";

const statsEl = ref(null);
const canvas = ref(null);
const route = useRoute();

const config = {
  directional: {
    enabled: true,
    helper: false,
    intensity: 2,
  },
};

const movement = { forward: 0, right: 0, up: 0 };

function random(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

async function initPhysics(scene: THREE.Scene) {
  //Initialize physics engine using the script in the jsm/physics folder
  const physics: RapierPhysics = await RapierPhysics();

  //Optionally display collider outlines
  const physicsHelper: RapierHelper = new RapierHelper(physics.world);
  scene.add(physicsHelper);

  physics.addScene(scene);

  return { physics, physicsHelper };
}

function addCharacterController(scene: THREE.Scene, physics: any) {
  // Character Capsule
  const geometry = new THREE.CapsuleGeometry(0.3, 1, 8, 8);
  const material = new THREE.MeshStandardMaterial({ color: 0x0000ff });
  const player = new THREE.Mesh(geometry, material);
  player.castShadow = true;
  player.position.set(0, 0.8, 0);
  scene.add(player);

  // Rapier Character Controller
  const characterController = physics.world.createCharacterController(0.01);
  characterController.setApplyImpulsesToDynamicBodies(true);
  characterController.setCharacterMass(3);
  const colliderDesc = physics.RAPIER.ColliderDesc.capsule(0.5, 0.3).setTranslation(
    0,
    0.8,
    0
  );
  player.userData.collider = physics.world.createCollider(colliderDesc);

  return { player, characterController };
}

function animatePlayer(
  player: THREE.Mesh,
  characterController: any,
  physics: RapierPhysics,
  movement = { forward: 0, right: 0, up: 0 }
) {
  if (physics && characterController) {
    const deltaTime = 1 / 60;

    // Character movement
    const speed = 4 * deltaTime;
    const moveVector = new physics.RAPIER.Vector3(
      movement.right * speed,
      0,
      -movement.forward * speed
    );

    characterController.computeColliderMovement(player.userData.collider, moveVector);

    // Read the result.
    const translation = characterController.computedMovement();
    const position = player.userData.collider.translation();

    position.x += translation.x;
    position.y += translation.y;
    position.z += translation.z;

    player.userData.collider.setTranslation(position);

    // Sync Three.js mesh with Rapier collider
    player.position.set(position.x, position.y, position.z);
  }

  return player;
}

function addBody(scene: THREE.Scene, fixed = true) {
  const geometry = fixed
    ? new THREE.BoxGeometry(1, 1, 1)
    : new THREE.SphereGeometry(0.25);
  const material = new THREE.MeshStandardMaterial({
    color: fixed ? 0xff0000 : 0x00ff00,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;

  mesh.position.set(random(-10, 10), 1.5, random(-10, 10));

  mesh.userData.physics = { mass: fixed ? 0 : 0.5, restitution: fixed ? 0 : 0.3 };

  scene.add(mesh);
}

function addBodies(scene: THREE.Scene, count: number) {
  for (let i = 0; i < count; i++) addBody(scene, Math.random() > 0.7);
}

function getLight(scene: THREE.Scene) {
  const ambient = new THREE.HemisphereLight(0x555555, 0xffffff);

  scene.add(ambient);

  const light = new THREE.DirectionalLight(0xffffff, 3);

  light.position.set(0, 12.5, 12.5);
  light.castShadow = true;
  light.shadow.radius = 3;
  light.shadow.blurSamples = 8;
  light.shadow.mapSize.width = 1024;
  light.shadow.mapSize.height = 1024;

  const size = 10;
  light.shadow.camera.left = -size;
  light.shadow.camera.bottom = -size;
  light.shadow.camera.right = size;
  light.shadow.camera.top = size;
  light.shadow.camera.near = 1;
  light.shadow.camera.far = 50;

  scene.add(light);

  return { light, ambient };
}

function setControls(movement: { forward: number; right: number; up: number }) {
  window.addEventListener("keydown", (event) => {
    if (event.key === "space") movement.up = 1;
    if (event.key === "w" || event.key === "ArrowUp") movement.forward = 1;
    if (event.key === "s" || event.key === "ArrowDown") movement.forward = -1;
    if (event.key === "a" || event.key === "ArrowLeft") movement.right = -1;
    if (event.key === "d" || event.key === "ArrowRight") movement.right = 1;
  });

  window.addEventListener("keyup", (event) => {
    if (event.key === "space") movement.up = 0;
    if (
      event.key === "w" ||
      event.key === "s" ||
      event.key === "ArrowUp" ||
      event.key === "ArrowDown"
    )
      movement.forward = 0;
    if (
      event.key === "a" ||
      event.key === "d" ||
      event.key === "ArrowLeft" ||
      event.key === "ArrowRight"
    )
      movement.right = 0;
  });
}

function getGround(scene: THREE.Scene) {
  const geometry = new THREE.BoxGeometry(20, 0.5, 20);
  const material = new THREE.MeshStandardMaterial({ color: 0xffffff });

  const ground = new THREE.Mesh(geometry, material);
  ground.receiveShadow = true;

  ground.position.y = -0.25;
  ground.userData.physics = { mass: 0 };

  scene.add(ground);
}

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
onUnmounted(() => window.removeEventListener("resize", initInstance));

const init = async (canvas: HTMLCanvasElement, statsEl: HTMLElement) => {
  stats.init(route, statsEl);
  controls.create(config, route, {}, () => createScene());
  const createScene = async () => {
    const elements = [] as any[];
    const { animate, setup, world, getDelta, scene } = getTools({
      stats,
      route,
      canvas,
    });
    setup({
      config: {
        camera: { position: [-2, 5, 15] },
        ground: false,
        sky: false,
        lights: false,
      },
      defineSetup: async () => {
        getLight(scene);
        getGround(scene);
        addBodies(scene, 10);

        const { physics, physicsHelper } = await initPhysics(scene);
        const { player, characterController } = await addCharacterController(
          scene,
          physics
        );

        setControls(movement);

        animate({
          beforeTimeline: () => {
            if (physicsHelper) physicsHelper.update();
            animatePlayer(player, characterController, physics, movement);
          },
          timeline: [
            {
              frequency: 75,
              action: () => {
                addBody(scene, false);
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
