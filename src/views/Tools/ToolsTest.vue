<script setup lang="ts">
import * as THREE from "three";
import { onMounted, onUnmounted, ref, shallowRef } from "vue";
import {
  getTools,
  getModel,
  setCameraPreset,
  CameraPreset,
  type SetupConfig,
  type PostProcessingConfig,
  CameraSide,
  setCameraSide,
} from "@webgamekit/threejs";
import { controllerTurn, controllerForward, type CoordinateTuple, type AnimationData, updateAnimation, createTimelineManager } from "@webgamekit/animation";
import type { ComplexModel } from "@webgamekit/threejs";
import { createGame } from "@webgamekit/game";
import { createControls } from "@webgamekit/controls";
import { initializeAudio, stopMusic, playAudioFile } from "@webgamekit/audio";
import type { GameState } from "@webgamekit/game";
import { getCube } from "@webgamekit/threejs";
import ControlsLogger from "@/components/ControlsLogger.vue";

// Assets
import flatFlowerImg from "@/assets/images/goomba/fire.png";
import jumpSound from "@/assets/audio/jump.wav";
import { times } from "@/utils/lodash";

const mushroomConfig = {
  position: [0, -1, 0] as CoordinateTuple,
  rotation: [0, -180, 0] as CoordinateTuple,
  scale: [1, 1, 1] as CoordinateTuple,
  restitution: -10,
  boundary: 0.5,
  // type: "kinematicPositionBased",
  hasGravity: false,
  castShadow: true,
  material: "MeshLambertMaterial",
  color: 0xaaaaaa,
};

const genericFlatConfig = {
  receiveShadow: false,
  castShadow: false,
  color: 0xcccccc,
  opacity: 0.95,
  material: "MeshBasicMaterial",
  physic: false,
}

const illustrations = times(3, (i) => times(3, (j) => ({
  ...genericFlatConfig,
  texture: flatFlowerImg,
  size: [2.5 * (i * 2 + 1), 3 * (i * 2 + 1), 0],
  position: [-20 + j * 20, 0, -5 * (i + 2)],
}))).flat();

const setupConfig: SetupConfig = {
  camera: {
    position: [0, 10, 20],
    fov: 80,
    up: new THREE.Vector3(0, 1, 0),
    near: 0.1,
    far: 1000,
    aspect: window.innerWidth / window.innerHeight,
    zoom: 1,
    focus: 10,
    // Optionally, you can set rotation using a THREE.Euler if you extract it from the matrix
  },
  ground: {
    size: [1000, 100, 100],
    color: 0x99aa99,
  },
  sky: { size: 500, color: 0x335533 },
  postprocessing: {
    // pixelate: { size: 5 },
    // bloom: { strength: 0.8, threshold: 0.2, radius: 1.0 },
    // fxaa: {},
    // dotScreen: { scale: 5, angle: Math.PI / 3, center: [0.2, 0.2] },
    // rgbShift: { amount: 0.005 },
    // film: { noiseIntensity: 5, grayscale: false },
    // glitch: {},
    // afterimage: {},
    // ssao: {},
    // vignette: { offset: 1.2, darkness: 1.3, color: 0x222222 },
    // colorCorrection: { contrast: 1.2, saturation: 1.1, brightness: 1.0 },
  } as PostProcessingConfig,
};

// Use correct GameState type and initialization
const gameState = shallowRef<GameState>();
createGame({ data: { score: 0 } }, gameState, onUnmounted);

const isJumping = shallowRef(false);
const canJump = shallowRef(true);
const logs = shallowRef<string[]>([]);

const handleJump = (): void => {
  if (isJumping.value || !canJump.value) return;
  playAudioFile(jumpSound);
  isJumping.value = true;
  canJump.value = false;
};

const getLogs = (actions: Record<string, any>): string[] =>
  Object.keys(actions)
    .filter((action) => !!actions[action])
    .map(
      (action) =>
        `${action} triggered by ${actions[action].trigger} ${actions[action].device}`
    );
let cameraPreset: any = null; // TODO: Identified issue for tooling block scoping

// Return binding 1 to x for each preset
const cameraPresetBindings = Object.values(CameraPreset).reduce(
  (acc, preset, index) => ({ ...acc, [index + 1]: preset }),
  {}
);
const cameraSideBindings = Object.values(CameraSide).reduce(
  (acc, preset) => {
    const [capital, ...rest] = preset.replace('camera-', '')
    const key = `Arrow${capital.toUpperCase()}${rest.join('')}`
    return { ...acc, [key]: preset }
  },
  {}
);
const bindings = {
  mapping: {
    keyboard: {
      " ": "jump",
      Enter: "toggle-move",
      a: "turn-left",
      d: "turn-right",
      w: "moving",
      s: "moving",
      p: 'print-log',
      ...cameraPresetBindings,
      ...cameraSideBindings
    },
    gamepad: {
      // Buttons
      cross: "jump",
      circle: "toggle-move",
      "dpad-left": "turn-left",
      "dpad-right": "turn-right",
      "dpad-down": "moving",
      "dpad-up": "moving",
      // Left analog stick
      "axis0-left": "turn-left",
      "axis0-right": "turn-right",
      "axis1-up": "moving",
      "axis1-down": "moving",
    },
    touch: {
      'touchstart': "jump",
    },
  },
  axisThreshold: 0.3, // Lower threshold for more sensitive analog stick
  onAction: (action: string) => {
    logs.value = getLogs(currentActions);

    switch (action) {
      case "jump":
        handleJump();
        break;
      case "print-log":
        console.log("Current camera:", cameraPreset);
        break;

      // TODO: Iterate instead of hardcoding
      case CameraPreset.Perspective:
      case CameraPreset.Orthographic:
      case CameraPreset.Fisheye:
      case CameraPreset.Cinematic:
      case CameraPreset.Orbit:
      case CameraPreset.OrthographicFollowing:
      case CameraPreset.TopDown:
        setCameraPreset(cameraPreset, action as CameraPreset);
        break;

      case CameraSide.CameraDown:
      case CameraSide.CameraUp:
      case CameraSide.CameraLeft:
      case CameraSide.CameraRight:
        setCameraSide(cameraPreset, cameraPreset, action as CameraSide)
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
  const { camera, setup, animate, scene, world, getDelta } = await getTools({
    canvas: canvas.value,
  });
  cameraPreset = camera;
  await setup({
    config: setupConfig,
    defineSetup: async () => {
      const angle = 90;
      const distance = 0.08;
      const speed = {
        movement: 1,
        turning: 4,
        jump: 3,
      };
      const maxJump = 2;
      const obstacles: ComplexModel[] = [];

      const player = await getModel(scene, world, "mushroom.glb", mushroomConfig);
      // obstacles.push(await getModel(scene, world, "sand_block.glb", blockConfig));

      Object.keys(illustrations).forEach((key) => {
        const config = (illustrations as Record<string, any>)[key];
        getCube(scene, world, config);
        // obstacles.push(model);
      });

      // const flower = getCube(scene, world, flowerConfig);
      // instanceMatrixMesh(flower, scene, [
      //   { position: [12, 0.8, -10] },
      //   { position: [15, 0.8, -15] },
      //   { position: [18, 0.8, -12] },
      // ]);

      // colorModel(player, chameleonConfig.materialColors);
      remapControlsOptions(bindings);

      const timelineManager = createTimelineManager();

      timelineManager.addAction({
        frequency: speed.movement,
        name: "Walk",
        category: "user-input",
        action: () => {
          const walkAnimData: AnimationData = {
            player,
            actionName: "Esqueleto|walking",
            delta: getDelta() * 2,
            speed: 10,
            distance,
            backward: true
          };
          const idleAnimData: AnimationData = {
            player,
            actionName: "Esqueleto|idle",
            delta: getDelta(),
            speed: 10
          };
          if (!currentActions["toggle-move"] || currentActions["moving"])
            controllerForward(
              obstacles,
              [],
              walkAnimData
            );
          else updateAnimation(idleAnimData);
        },
      });

      timelineManager.addAction({
        name: "Loop: Turn player",
        frequency: speed.movement * angle,
        category: "user-input",
        action: () => {
          if (!currentActions["toggle-move"]) {
            controllerTurn(player, angle);
          }
        },
      });

      timelineManager.addAction({
        name: "Free: Turn player",
        frequency: speed.movement,
        category: "user-input",
        action: () => {
          if (currentActions["toggle-move"]) {
            if (currentActions["turn-left"]) controllerTurn(player, speed.turning);
            if (currentActions["turn-right"])
              controllerTurn(player, -speed.turning);
          }
        },
      });

      timelineManager.addAction({
        name: "Loop: Set score",
        frequency: speed.movement * angle * 4,
        category: "game-logic",
        action: () => {
          if (!currentActions["toggle-move"]) {
            if (gameState.value)
              gameState.value.setData("score", (gameState.value.data.score || 0) + 1);
          }
        },
      });

      timelineManager.addAction({
        name: "Jump action",
        category: "physics",
        action: () => {
          if (isJumping.value) {
            if (player.position.y >= mushroomConfig.position[1] + maxJump) {
              isJumping.value = false;
            } else {
              player.position.y += speed.jump * 0.1;
            }
          } else {
            player.position.y -= speed.jump * 0.1;
          }

          // Fake gravity
          if (player.position.y <= mushroomConfig.position[1] + 0.1) {
            canJump.value = true;
            player.position.y = mushroomConfig.position[1];
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
  await initializeAudio();
  window.addEventListener("resize", init);
});
onUnmounted(() => {
  stopMusic();
  destroyControls();
  window.removeEventListener("resize", init);
});
</script>

<template>
  <canvas ref="canvas"></canvas>
  <ControlsLogger v-if="gameState" :logs="logs">
    <div>
      <span>{{ isJumping ? "Jumping" : "On ground" }},</span>
      <span>{{ canJump ? "ready" : "not ready" }}</span>
      <span
        >-
        {{
          currentActions["toggle-move"]
            ? "Free move"
            : `In the loop (${gameState.data.score || 0})`
        }}</span
      >
    </div>
  </ControlsLogger>
</template>

<style scoped>
canvas {
  display: block;
  width: 100%;
  height: 100vh;
}
</style>
