<script setup lang="ts">
import { onMounted, onUnmounted, ref, shallowRef } from "vue";
import {
  getTools,
  getModel,
  colorModel,
  setCameraPreset,
  CameraPreset,
  instanceMatrixMesh,
  type SetupConfig,
} from "@webgamekit/threejs";
import { controllerTurn, controllerForward, type CoordinateTuple, type ComplexModel } from "@webgamekit/animation";
import { createGame } from "@webgamekit/game";
import { createControls } from "@webgamekit/controls";
import { initializeAudio, stopMusic, playAudioFile } from "@webgamekit/audio";
import type { GameState } from "@webgamekit/game";
import { getCube } from "@/utils/models";

// Assets
import jumpSound from "@/assets/audio/jump.wav";
import flowerImg from "@/assets/images/flat/fire.png";
import illustrationCactusImg from "@/assets/images/illustrations/cactus.png";
import illustrationFlowersImg from "@/assets/images/illustrations/flowers.png";
import smbBlockImg from "@/assets/images/textures/smb_block.png";
import groundImg from "@/assets/images/textures/grass.jpg";
// import groundImg from "@/assets/images/textures/smb_brick.png";
import cloudImg from "@/assets/images/flat/cloud.png";

import illustrationFlowers2Img from "@/assets/images/illustrations/flowers2.png";
import illustrationFlowers3Img from "@/assets/images/illustrations/flowers3.png";
import illustrationFlowers4Img from "@/assets/images/illustrations/flowers4.png";
import illustrationFlowers5Img from "@/assets/images/illustrations/flowers5.png";
import illustrationPangolinImg from "@/assets/images/illustrations/pangolin.png";
import illustrationRockDudeImg from "@/assets/images/illustrations/rock_dude.png";
import illustrationShroomQueenImg from "@/assets/images/illustrations/shroom_queen.png";

const chameleonConfig = {
  position: [0, -1, 0] as CoordinateTuple,
  scale: [0.03, 0.03, 0.03] as CoordinateTuple,
  restitution: -10,
  boundary: 0.5,
  // type: "kinematicPositionBased",
  hasGravity: false,
  castShadow: true,
  animations: "chameleon_animations.fbx",
  material: "MeshLambertMaterial",
  materialColors: [0x99cc99],
};

const genericFlatConfig = {
  receiveShadow: false,
  castShadow: false,
  color: 0xffffff,
  opacity: 0.95,
  material: "MeshBasicMaterial",
  physic: false,
}

const cloudConfig = {
  texture: cloudImg,
  size: [12, 5, 0],
  position: [3, 10, -10],
  ...genericFlatConfig,
}

const flowerConfig = {
  texture: flowerImg,
  size: [1, 1, 0],
  position: [6, -0.5, 0],
  ...genericFlatConfig,
}

const illustrations = {
  flower: {
    texture: illustrationFlowersImg,
    size: [4, 6, 0],
    position: [-10, 1, -9],
    ...genericFlatConfig,
  },
  cactus: {
    texture: illustrationCactusImg,
    size: [5, 7, 0],
    position: [-6, 2.5, -9],
    ...genericFlatConfig,
  },
  flowers2: {
    texture: illustrationFlowers2Img,
    size: [5, 7, 0],
    position: [-2, 2.5, -9],
    ...genericFlatConfig,
  },
  flowers3: {
    texture: illustrationFlowers3Img,
    size: [5, 7, 0],
    position: [4, 2.5, -9],
    ...genericFlatConfig,
  },
  flowers4: {
    texture: illustrationFlowers4Img,
    size: [5, 7, 0],
    position: [8, 2.5, -9],
    ...genericFlatConfig,
  },
  flowers5: {
    texture: illustrationFlowers5Img,
    size: [5, 7, 0],
    position: [13, 2.5, -9],
    ...genericFlatConfig,
  },
  pangolin: {
    texture: illustrationPangolinImg,
    size: [10, 5, 0],
    position: [10, 0.5, 7],
    ...genericFlatConfig,
  },
  rockDude: {
    texture: illustrationRockDudeImg,
    size: [20, 22, 0],
    position: [-15, 8.4, 0],
    ...genericFlatConfig,
  },
  shroomQueen: {
    texture: illustrationShroomQueenImg,
    size: [10, 15, 0],
    position: [15, 7, 0],
    ...genericFlatConfig,
  },
}

const smbCubeConfig = {
  texture: smbBlockImg,
  size: [2, 2, 2],
  position: [2, 0, -5],
  material: "MeshBasicMaterial",
  color: 0xffffff,
}

const blockConfig = {
  scale: [0.01, 0.01, 0.01] as CoordinateTuple,
  restitution: 0,
  position: [1, 0.2, 0] as CoordinateTuple,
  hasGravity: false,
}

const setupConfig: SetupConfig = {
  camera: { position: [0, 5, 20] as CoordinateTuple },
  ground: {
    size: [1000, 20, 20],
    texture: groundImg,
    textureRepeat: [500, 10] as [number, number],
    color: 0x99cc99,
  },
  sky: { size: 500, color: 0x87ceeb },
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
const cameraBindings = Object.values(CameraPreset).reduce(
  (acc, preset, index) => ({ ...acc, [index + 1]: preset }),
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
      ...cameraBindings,
    },
    gamepad: {
      cross: "jump",
      circle: "toggle-move",
      "dpad-left": "turn-left",
      "dpad-right": "turn-right",
      "dpad-down": "moving",
      "dpad-up": "moving",
    },
    touch: {
      tap: "jump",
    },
  },
  onAction: (action: string) => {
    logs.value = getLogs(currentActions);

    switch (action) {
      case "jump":
        handleJump();
        break;

      // TODO: Iterate instead of hardcoding
      case "perspective":
      case "orthographic":
      case "fisheye":
      case "cinematic":
      case "orbit":
      case "orthographic-following":
      case "top-down":
        setCameraPreset(cameraPreset, action as CameraPreset);
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
      const distance = 0.1;
      const speed = {
        movement: 1,
        turning: 4,
        jump: 3,
      };
      const maxJump = 3;
      const obstacles: ComplexModel[] = [];

      const chameleon = await getModel(scene, world, "chameleon.fbx", chameleonConfig);
      // obstacles.push(await getModel(scene, world, "sand_block.glb", blockConfig));

      Object.keys(illustrations).forEach((key) => {
        const config = (illustrations as Record<string, any>)[key];
        const model = getCube(scene, world, config);
        // obstacles.push(model);
      });

      // const cloud = getCube(scene, world, cloudConfig);
      // const smbCube = getCube(scene, world, smbCubeConfig);

      // const flower = getCube(scene, world, flowerConfig);
      // instanceMatrixMesh(flower, scene, [
      //   { position: [12, 0.8, -10] },
      //   { position: [15, 0.8, -15] },
      //   { position: [18, 0.8, -12] },
      // ]);

      colorModel(chameleon, chameleonConfig.materialColors);
      remapControlsOptions(bindings);
      animate({
        beforeTimeline: () => {},
        timeline: [
          {
            frequency: speed.movement,
            name: "Walk",
            action: () => {
              if (!currentActions["toggle-move"] || currentActions["moving"])
                controllerForward(
                  chameleon,
                  obstacles,
                  distance,
                  getDelta(),
                  "Idle_A",
                  false
                );
            },
          },
          {
            name: "Loop: Turn chameleon",
            frequency: speed.movement * angle,
            action: () => {
              if (!currentActions["toggle-move"]) {
                controllerTurn(chameleon, angle);
              }
            },
          },
          {
            name: "Free: Turn chameleon",
            frequency: speed.movement,
            action: () => {
              if (currentActions["toggle-move"]) {
                if (currentActions["turn-left"]) controllerTurn(chameleon, speed.turning);
                if (currentActions["turn-right"])
                  controllerTurn(chameleon, -speed.turning);
              }
            },
          },
          {
            name: "Loop: Set score",
            frequency: speed.movement * angle * 4,
            action: () => {
              if (!currentActions["toggle-move"]) {
                if (gameState.value)
                  gameState.value.setData("score", (gameState.value.data.score || 0) + 1);
              }
            },
          },
          {
            name: "Jump action",
            action: () => {
              if (isJumping.value) {
                if (chameleon.position.y >= chameleonConfig.position[1] + maxJump) {
                  isJumping.value = false;
                } else {
                  chameleon.position.y += speed.jump * 0.1;
                }
              } else {
                chameleon.position.y -= speed.jump * 0.1;
              }

              // Fake gravity
              if (chameleon.position.y <= chameleonConfig.position[1] + 0.1) {
                canJump.value = true;
                chameleon.position.y = chameleonConfig.position[1];
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
  <div v-if="gameState" class="ui">
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
    <div v-for="(log, i) in logs" :key="i">{{ log }}</div>
  </div>
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
