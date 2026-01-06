<script setup lang="ts">
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
import * as THREE from "three";
import { controllerTurn, controllerForward, type CoordinateTuple, type ComplexModel, updateAnimation } from "@webgamekit/animation";
import { createGame } from "@webgamekit/game";
import { createControls } from "@webgamekit/controls";
import { initializeAudio, stopMusic, playAudioFile } from "@webgamekit/audio";
import type { GameState } from "@webgamekit/game";
import { getCube } from "@/utils/models";

// Assets
import jumpSound from "@/assets/audio/jump.wav";
import illustrationBackgroundImg from "@/assets/images/illustrations/background.png";
// import groundImg from "@/assets/images/textures/grass.jpg";
// import groundImg from "@/assets/images/textures/smb_brick.png";

import groundImg from "@/assets/images/illustrations/ground.png";
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

const illustrations = {
  background: {
    texture: illustrationBackgroundImg,
    size: [200, 200, 0],
    position: [-0, -15, -20],
    ...genericFlatConfig,
    opacity: 0.5
  },
  // flower: {
  //   texture: illustrationFlowersImg,
  //   size: [4, 6, 0],
  //   position: [-10, 1, -9],
  //   ...genericFlatConfig,
  // },
  // cactus: {
  //   texture: illustrationCactusImg,
  //   size: [5, 7, 0],
  //   position: [-6, 2.5, -9],
  //   ...genericFlatConfig,
  // },
  // flowers2: {
  //   texture: illustrationFlowers2Img,
  //   size: [5, 7, 0],
  //   position: [-2, 2.5, -9],
  //   ...genericFlatConfig,
  // },
  // flowers3: {
  //   texture: illustrationFlowers3Img,
  //   size: [5, 7, 0],
  //   position: [4, 2.5, -9],
  //   ...genericFlatConfig,
  // },
  // flowers4: {
  //   texture: illustrationFlowers4Img,
  //   size: [5, 7, 0],
  //   position: [8, 2.5, -9],
  //   ...genericFlatConfig,
  // },
  // flowers5: {
  //   texture: illustrationFlowers5Img,
  //   size: [5, 7, 0],
  //   position: [13, 2.5, -9],
  //   ...genericFlatConfig,
  // },
  pangolin: {
    texture: illustrationPangolinImg,
    size: [10, 5, 0],
    position: [10, 0.5, 7],
    ...genericFlatConfig,
  },
  rockDude: {
    texture: illustrationRockDudeImg,
    size: [30, 35, 0],
    position: [-40, 14, 0],
    ...genericFlatConfig,
  },
  shroomQueen: {
    texture: illustrationShroomQueenImg,
    size: [15, 24, 0],
    position: [30, 11, 0],
    ...genericFlatConfig,
  },
}

const setupConfig: SetupConfig = {
  orbit: {
    target: new THREE.Vector3(0, 0, 0),
  },
  camera: {
    position: [-0.1137142860882116, 7.309126007131214, 35.4614049040206],
    lookAt: [0, 0, 0],
    fov: 80,
    up: new THREE.Vector3(0, 1, 0),
    near: 0.1,
    far: 1000,
    zoom: 1,
    focus: 10,
  },
  ground: {
    size: [1000, 100, 20],
    texture: groundImg,
    textureRepeat: [500, 20] as [number, number],
    color: 0xffffff,
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
let orbitControls: any = null;
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
      case "print-log":
        console.log("Current camera:", cameraPreset);
        console.log(orbitControls)
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
  const { camera, setup, animate, scene, world, getDelta, orbit } = await getTools({
    canvas: canvas.value,
  });
  orbitControls = orbit;
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

      // const player = await getModel(scene, world, "chameleon.fbx", chameleonConfig);
      const player = await getModel(scene, world, "mushroom.glb", mushroomConfig);
      // obstacles.push(await getModel(scene, world, "sand_block.glb", blockConfig));

      Object.keys(illustrations).forEach((key) => {
        const config = (illustrations as Record<string, any>)[key];
        getCube(scene, world, config);
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

      // colorModel(player, chameleonConfig.materialColors);
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
                  player,
                  obstacles,
                  distance,
                  getDelta() * 2,
                  "Esqueleto|walking",
                  // "Idle_A",
                  true
                );
              else updateAnimation(player.userData.mixer, player.userData.actions["Esqueleto|idle"]!, getDelta(), 10);
            },
          },
          {
            name: "Loop: Turn player",
            frequency: speed.movement * angle,
            action: () => {
              if (!currentActions["toggle-move"]) {
                controllerTurn(player, angle);
              }
            },
          },
          {
            name: "Free: Turn player",
            frequency: speed.movement,
            action: () => {
              if (currentActions["toggle-move"]) {
                if (currentActions["turn-left"]) controllerTurn(player, speed.turning);
                if (currentActions["turn-right"])
                  controllerTurn(player, -speed.turning);
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
                if (player.position.y >= chameleonConfig.position[1] + maxJump) {
                  isJumping.value = false;
                } else {
                  player.position.y += speed.jump * 0.1;
                }
              } else {
                player.position.y -= speed.jump * 0.1;
              }

              // Fake gravity
              if (player.position.y <= chameleonConfig.position[1] + 0.1) {
                canJump.value = true;
                player.position.y = chameleonConfig.position[1];
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
