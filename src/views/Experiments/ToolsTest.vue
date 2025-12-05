<script setup>
import { onMounted, ref } from "vue";
import { getTools, getModel } from "@webgametoolkit/threejs";
import { updateAnimation } from "@webgametoolkit/animation";

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
};

const setupConfig = {
  camera: { position: [0, 5, 20] },
  ground: { size: 10000, color: 0x99cc99 },
  sky: { size: 500, color: 0x87ceeb },
  lights: { directional: { intensity: 0.1 } },
};

const canvas = ref(null);
const init = async () => {
  const { setup, animate, scene, world, getDelta } = await getTools({
    stats: { init: () => {}, start: () => {}, stop: () => {} },
    route: { query: {} },
    canvas: canvas.value,
  });

  await setup({
    config: setupConfig,
    defineSetup: async () => {
      const chameleon = await getModel(scene, world, "chameleon.fbx", chameleonConfig);

      animate({
        beforeTimeline: () => {},
        timeline: [
          {
            // end: 1,
            // frequency: 75,
            action: () => {
              updateAnimation(chameleon.mixer, chameleon.actions["Walk"], getDelta(), 4);
            },
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
</template>

<style scoped>
canvas {
  display: block;
  width: 100%;
  height: 100vh;
}
</style>
