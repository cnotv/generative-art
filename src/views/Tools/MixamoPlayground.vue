<script setup lang="ts">
import * as THREE from 'three';
import { onMounted, onUnmounted, ref, shallowRef } from "vue";
import {
  getTools,
  getModel,
  cameraFollowPlayer,
  type ComplexModel
} from "@webgamekit/threejs";
import { controllerForward, type CoordinateTuple, type AnimationData, updateAnimation, setRotation, getRotation } from "@webgamekit/animation";
import { createControls, isMobile } from "@webgamekit/controls";

import TouchControl from '@/components/TouchControl.vue'
import grassTextureImg from "@/assets/images/textures/grass.jpg";

const playerSettings = {
  model: {
    position: [0, -1, 0] as CoordinateTuple,
    rotation: [0, 0, 0] as CoordinateTuple,
    scale: [0.15, 0.15, 0.15] as CoordinateTuple,
    restitution: -10,
    boundary: 0.5,
    hasGravity: false,
    castShadow: true,
    material: "MeshLambertMaterial",
    animations: "walk2.fbx",
    // animations: ["walk2.fbx", "idle.fbx"],
    color: 0xffffff,
  },
  movement: {
    requireGround: true,
    maxGroundDistance: 5,
    maxStepHeight: 0.5,
    characterRadius: 4,
    debug: false,
  },
  game: {
    distance: 0.5,
    speed: {
      movement: 2,
      turning: 4,
    },
  },
};

const setupConfig = {
  orbit: {
    target: new THREE.Vector3(0, 15, 0),
    disabled: true,
  },
  camera: {
    position: [0, 7, 35],
    lookAt: [0, 0, 0],
    fov: 80,
    up: new THREE.Vector3(0, 1, 0),
    near: 0.1,
    far: 1000,
    zoom: 1,
    focus: 10,
  },
  ground: {
    size: [1000, 100, 50],
    texture: grassTextureImg,
    textureRepeat: [100, 10] as [number, number],
    color: 0x80b966,
  },
  sky: { size: 500, color: 0x00aaff },
};

const controlBindings = {
  mapping: {
    keyboard: {
      " ": "jump",
      a: "move-left",
      d: "move-right",
      w: "move-up",
      s: "move-down",
      p: "print-log",
    },
    gamepad: {
      // Buttons
      cross: "jump",
      "dpad-left": "move-left",
      "dpad-right": "move-right",
      "dpad-down": "move-down",
      "dpad-up": "move-up",
      "axis0-left": "move-left",
      "axis0-right": "move-right",
      "axis1-up": "move-up",
      "axis1-down": "move-down",
    },
    'faux-pad': {
      left: "move-left",
      right: "move-right",
      up: "move-up",
      down: "move-down",
    },
  },
  axisThreshold: 0.5,
};

const logs = shallowRef<string[]>([]);
const showLogs = true;
const isMobileDevice = isMobile();

const getLogs = (actions: Record<string, any>): string[] =>
  Object.keys(actions)
    .filter((action) => !!actions[action])
    .map(
      (action) =>
        `${action} triggered by ${actions[action].trigger} ${actions[action].device}`
    );

const bindings = {
  ...controlBindings,
  onAction: (action: string) => {
    logs.value = getLogs(currentActions);

    switch (action) {
      case "print-log":
        break;
    }
  },
  onRelease: () => {
    logs.value = getLogs(currentActions);
  },
};
const { destroyControls, currentActions, remapControlsOptions } = createControls(
  bindings
);

const canvas = ref<HTMLCanvasElement | null>(null);
const init = async (): Promise<void> => {
  if (!canvas.value) return;
  const { setup, animate, scene, world, getDelta, camera } = await getTools({
    canvas: canvas.value,
  });

  const { orbit } = await setup({
    config: setupConfig,
    defineSetup: async ({ ground }) => {
      const { distance, speed } = playerSettings.game;
      const { movement } = playerSettings;
      const obstacles: ComplexModel[] = [];
      const cameraOffset = (setupConfig.camera?.position || [0, 10, 20]) as CoordinateTuple;

      const player = await getModel(scene, world, "mixamoYBot.fbx", playerSettings.model);
      const groundBodies: ComplexModel[] = ground?.mesh ? [ground.mesh as unknown as ComplexModel] : [];
      console.log(player)
      remapControlsOptions(bindings);

      animate({
        beforeTimeline: () => {},
        timeline: [
          {
            frequency: speed.movement,
            name: "Walk",
            action: () => {
              const targetRotation = getRotation(currentActions);
              const isMoving = targetRotation !== null;
              const actionName = isMoving ? "mixamo.com" : "Take 001";
              const animationData: AnimationData = { actionName, player, delta: getDelta() * 2, speed: 20, backward: false };
              if (isMoving) {
                setRotation(player, targetRotation);
                controllerForward(
                  obstacles,
                  groundBodies,
                  distance,
                  animationData,
                  movement
                );
                cameraFollowPlayer(camera, player, cameraOffset, orbit, ['x', 'z']);
              } else {
                updateAnimation(animationData);
              }
            },
          },
        ],
      });
    },
  });
};

onMounted(async () => {
  await init();
  window.addEventListener("resize", init);
});
onUnmounted(() => {
  destroyControls();
  window.removeEventListener("resize", init);
});
</script>

<template>
  <canvas ref="canvas"></canvas>
  <div v-if="showLogs" class="ui">
    <div v-for="(log, i) in logs" :key="i">{{ log }}</div>
  </div>

  <TouchControl
    v-if="isMobileDevice"
    style="left: 25px; bottom: 25px"
    :mapping="{
      left: 'move-left',
      right: 'move-right',
      up: 'move-up',
      down: 'move-down',
    }"
    :options="{ deadzone: 0.15 }"
    :current-actions="currentActions"
    :on-action="bindings.onAction"
  />
  <TouchControl
    v-if="isMobileDevice"
    style="right: 25px; bottom: 25px"
    mode="button"
    :mapping="{ click: 'jump' }"
    :on-action="bindings.onAction"
  />
</template>

<style scoped>
canvas {
  display: block;
  width: 100%;
  height: 100vh;
}
.ui {
  position: relative;
  display: flex;
  flex-direction: column;
  align-self: center;
  font-size: 24px;
  line-height: 1.2em;
  margin: 1rem;
}

@media (max-width: 600px) {
  .ui {
    line-height: 0.2em;
  }
}
</style>
