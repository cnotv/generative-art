<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { controls } from '@/utils/control';
import { stats } from '@/utils/stats';
import { createLights, getEnvironment, getGround, getModel, getTools } from '@/utils/threeJs';
import { getBall, getWalls } from '@/utils/models';

const statsEl = ref(null)
const canvas = ref(null)
const route = useRoute();

onMounted(() => {
  init(
    canvas.value as unknown as HTMLCanvasElement,
    statsEl.value as unknown as HTMLElement,
  ), statsEl.value!;
})

const init = async (canvas: HTMLCanvasElement, statsEl: HTMLElement, ) => {
  const config = {
    directional: {
      enabled: true,
      helper: false,
      intensity: 2,
    },
  }
  stats.init(route, statsEl);
  controls.create(config, route, {
  }, () => {
    createScene()
  });

  const createScene = async () => {
    const { animate, setup, scene, world } = getTools({ stats, route, canvas });
    setup({
      config: {
        camera: { position: [-35, 80, -115] },
        ground: { size: 1000.0 },
        lights: { directional: { intensity: config.directional.intensity } },
      },
      defineSetup: () => {
        getWalls(scene, world, { length: 400, height: 150, depth: 0.2 });
      }
    });
    animate({ beforeTimeline: () => getBall(scene, world, {position: [0, 10, 0], size: 3, weight: 40, restitution: 0.8, damping: 0.1, color: 0xffffff, roughness: 0.9})});
  }
  createScene();
}
</script>

<template>
  <div ref="statsEl"></div>
  <canvas ref="canvas"></canvas>
</template>

