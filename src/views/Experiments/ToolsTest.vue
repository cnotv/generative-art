<script setup>
import { onMounted, onUnmounted, ref, shallowRef } from "vue";
import { getTools, getModel, colorModel } from "@webgametoolkit/threejs";
import {
  updateAnimation,
  controllerTurn,
  controllerForward,
} from "@webgametoolkit/animation";
import waterImage from "@/assets/water.png";
import { createGame } from "@webgametoolkit/game";

const chameleonConfig = {
  position: [0, -0.75, 0],
  scale: [0.05, 0.05, 0.05],
  restitution: -10,
  boundary: 0.5,
  type: "kinematicPositionBased",
  hasGravity: false,
  castShadow: true,
  receiveShadow: true,
  animations: "chameleon_animations.fbx",
  material: true,
  materialType: "MeshLambertMaterial",
};

const setupConfig = {
  camera: { position: [0, 5, 20] },
  ground: {
    size: 10000,
    texture: waterImage,
    textureRepeat: [400, 400],
    color: 0x99cc99,
  },
  sky: { size: 500, color: 0x87ceeb },
  lights: { directional: { intensity: 0.1 } },
};

const gameState = shallowRef({ data: { score: 0 } });
createGame({ data: { score: 0 } }, gameState, onUnmounted);

const canvas = ref(null);
const init = async () => {
  const { setup, animate, scene, world, getDelta } = await getTools({
    canvas: canvas.value,
  });

  await setup({
    config: setupConfig,
    defineSetup: async () => {
      const chameleon = await getModel(scene, world, "chameleon.fbx", chameleonConfig);
      const angle = 90;
      const distance = 0.1;
      const speed = 1;
      colorModel(chameleon.mesh, chameleonConfig.materialColors);

      animate({
        beforeTimeline: () => {},
        timeline: [
          {
            action: () =>
              updateAnimation(
                chameleon.mixer,
                chameleon.actions["Idle_A"],
                getDelta(),
                10
              ),
          },
          {
            frequency: speed,
            action: () => controllerForward(chameleon, [], distance, getDelta(), false),
          },
          {
            frequency: speed * angle,
            action: () => controllerTurn(chameleon, angle),
          },
          {
            frequency: speed * angle * 4,
            action: () =>
              gameState.value.setData("score", (gameState.value.data.score || 0) + 1),
          },
        ],
      });
    },
  });
};

onMounted(async () => init());
</script>

<template>
  <canvas ref="canvas"></canvas>
  <div v-if="gameState" class="ui">
    <h1>Loops: {{ gameState.data.score }}</h1>
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
  text-align: center;
  font-size: 3em;
}
</style>
