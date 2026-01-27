<script setup lang="ts">
import * as THREE from 'three';
import { onMounted, onUnmounted, ref, shallowRef } from "vue";
import {
  getTools,
  getModel,
  cameraFollowPlayer,
  type ComplexModel
} from "@webgamekit/threejs";
import { controllerForward, type CoordinateTuple, type AnimationData, updateAnimation, setRotation, getRotation, createTimelineManager, playBlockingAction } from "@webgamekit/animation";
import { createControls, isMobile } from "@webgamekit/controls";

import TouchControl from '@/components/TouchControl.vue'
import ControlsLogger from '@/components/ControlsLogger.vue'
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
    animations: ["animations/walk2.fbx", "animations/idle.fbx", 'animations/running.fbx', 'animations/roll.fbx', 'animations/kick.fbx', 'animations/punch.fbx', 'animations/jump.fbx'],
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
    size: [1000, 100, 1000],
    texture: grassTextureImg,
    textureRepeat: [100, 100] as [number, number],
    color: 0x80b966,
  },
  sky: { size: 500, color: 0x00aaff },
};

const controlBindings = {
  mapping: {
    keyboard: {
      a: "move-left",
      d: "move-right",
      w: "move-up",
      s: "move-down",
      p: "print-log",
      Enter: "run",
      " ": "jump",
      ArrowUp: "jump",
      ArrowLeft: "kick",
      ArrowRight: "punch",
      ArrowDown: "roll",
    },
    gamepad: {
      // Buttons
      cross: "jump",
      square: "kick",
      triangle: "punch",
      circle: "roll",
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

const getActionName = (actions: Record<string, any>): string => {
  if (actions["kick"]) return "kick";
  if (actions["punch"]) return "punch";
  if (actions["jump"]) return "jump";
  if (actions["move-up"] || actions["move-down"] || actions["move-left"] || actions["move-right"]) {
    if (actions["roll"]) return "roll";
    if (actions["run"]) return "running";
    return "walk2";
  }
  return "idle";
};

const getActionData = (player: ComplexModel, currentActions: Record<string, any>, basicDistance: number, getDelta: () => number): AnimationData => {
  const actionName = getActionName(currentActions);
  const distance = currentActions["run"] ? basicDistance * 2 : basicDistance;
  return {
    actionName,
    player,
    delta: getDelta() * 2,
    speed: 20,
    backward: false,
    distance,
  };
}

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
  const { setup, animate, scene, world, camera, getDelta } = await getTools({
    canvas: canvas.value,
  });

  const { orbit } = await setup({
    config: setupConfig,
    defineSetup: async ({ ground }) => {
      const { distance, speed } = playerSettings.game;
      const { movement } = playerSettings;
      const obstacles: ComplexModel[] = [];
      const cameraOffset = (setupConfig.camera?.position || [0, 10, 20]) as CoordinateTuple;

      const player = await getModel(scene, world, "character2.fbx", playerSettings.model);
      // console.log(player.userData.actions)
      const groundBodies: ComplexModel[] = ground?.mesh ? [ground.mesh as unknown as ComplexModel] : [];

      const updatedBindings = {
        ...bindings,
        onAction: (action: string) => {
          logs.value = getLogs(currentActions);

          switch (action) {
            case 'kick':
            case 'punch':
            case 'jump':
              playBlockingAction(player, action, {
                allowMovement: false,
                allowRotation: false,
                allowActions: action === 'jump' ? ['roll'] : [],
              });
              break;
            case 'roll':
              playBlockingAction(player, action, {
                allowMovement: true,
                allowRotation: true,
              });
              break;
            case "print-log":
              break;
          }
        },
      };

      remapControlsOptions(updatedBindings);

      const timelineManager = createTimelineManager();
      timelineManager.addAction({
        frequency: speed.movement,
        name: "Walk",
        category: "user-input",
        action: () => {
          const targetRotation = getRotation(currentActions);
          const isMoving = targetRotation !== null;
          const animationData: AnimationData = getActionData(player, currentActions, distance, getDelta);
          if (isMoving) {
            setRotation(player, targetRotation);
            controllerForward(
              obstacles,
              groundBodies,
              animationData,
              movement
            );
            cameraFollowPlayer(camera, player, cameraOffset, orbit, ['x', 'z']);
          } else {
            updateAnimation(animationData);
          }
        },
      });

      animate({
        beforeTimeline: () => {},
        timeline: timelineManager,
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
  <ControlsLogger v-if="showLogs" :logs="logs" />

  <template v-if="isMobileDevice">
    <TouchControl
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
      style="right: 25px; bottom: 25px"
      mode="button"
      :mapping="{ click: 'jump' }"
      :on-action="bindings.onAction"
    />
  </template>
</template>

<style scoped>
canvas {
  display: block;
  width: 100%;
  height: 100vh;
}
</style>
