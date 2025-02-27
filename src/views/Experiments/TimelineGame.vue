<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRoute } from "vue-router";
import { controls } from "@/utils/control";
import { stats } from "@/utils/stats";
import {
  bindAnimatedElements,
  getModel,
  getTools,
  resetAnimation,
} from "@/utils/threeJs";
import { moveForward, moveJump, updateAnimation } from "@/utils/animation";
import { getCube } from "@/utils/models";

const statsEl = ref(null);
const canvas = ref(null);
const route = useRoute();

onMounted(() => {
  init(
    (canvas.value as unknown) as HTMLCanvasElement,
    (statsEl.value as unknown) as HTMLElement
  ),
    statsEl.value!;
});

const config = {
  directional: {
    enabled: true,
    helper: false,
    intensity: 2,
  },
};

const init = async (canvas: HTMLCanvasElement, statsEl: HTMLElement) => {
  stats.init(route, statsEl);
  controls.create(config, route, {}, () => createScene());
  const createScene = async () => {
    const elements = [] as any[];
    const { animate, setup, scene, world, getDelta, getFrame } = getTools({
      stats,
      route,
      canvas,
    });
    setup({
      config: {
        camera: { position: [-113, 52, 30] },
        ground: { size: 100000.0 },
        lights: { directional: { intensity: config.directional.intensity } },
      },
      defineSetup: async () => {
        // getWalls(scene, world, { length: 400, height: 150, depth: 0.2 });
        const goomba = await getModel(scene, world, "goomba.glb", {
          position: [0, 30, 0],
          scale: [0.3, 0.3, 0.3],
          size: 3,
          restitution: -1,
          boundary: 0.5,
          weight: 50,
        });
        const { mesh, rigidBody, mixer, actions }: ComplexModel = goomba;
        const cube = getCube(scene, world, {
          size: [30, 30, 30],
          restitution: -1,
          position: [0, 15, 0],
          type: "fixed",
          boundary: 0.5,
          // weight: 10,
        });
        elements.push(goomba, cube);

        animate({
          beforeTimeline: () => {
            bindAnimatedElements(elements);
          },
          timeline: [
            {
              interval: [100, 100],
              action: () => {
                updateAnimation(mixer, actions.run, getDelta(), 10);
                moveForward(goomba, [cube], 0.5);
                mesh.rotation.y = 0;
              },
            },
            {
              interval: [100, 100],
              delay: 100,
              action: () => {
                updateAnimation(mixer, actions.run, getDelta(), 10);
                moveForward(goomba, [cube], 0.5, true);

                mesh.rotation.y = 3;
              },
            },
            {
              interval: [30, 170],
              delay: 145,
              action: () => {
                updateAnimation(mixer, actions.run, getDelta(), 10);
                moveJump(goomba, [cube], 0.5, 3);

                mesh.rotation.y = 3;
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
