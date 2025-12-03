<script setup>
import { onMounted, ref } from "vue";
import { getTools } from "@webgametoolkit/threejs";

const canvas = ref(null);

onMounted(async () => {
  const { setup, animate, scene, world } = await getTools({
    stats: { init: () => {}, start: () => {}, stop: () => {} },
    route: { query: {} },
    canvas: canvas.value,
  });

  await setup({
    config: {
      camera: { position: [0, 5, 10] },
      ground: { size: 100, color: 0x00ff00 },
      sky: { size: 500, color: 0x87ceeb },
      lights: { directional: { intensity: 2 } },
    },
    defineSetup: async () => {
      animate({
        beforeTimeline: () => {},
        timeline: [],
      });
    },
  });
});
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
